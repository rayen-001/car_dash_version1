/**
 * Booking → Rental Inflow event mapping. Single source-of-truth for how a
 * booking's payment history surfaces on the Rental Inflows Hub.
 *
 * Architectural choice: rental inflows are DERIVED on read from the
 * `bookings` table (acompte_paid column) plus the `booking_installments`
 * table — we do NOT maintain a separate `rental_inflows` table. Reasons:
 *
 *   1. Single source of truth — every write path that records a payment
 *      already lands in one of these two places. No duplicate sync logic
 *      to keep in lock-step.
 *   2. No drift — there is literally no way for inflows to lag behind
 *      the booking's financial state because they're computed from it.
 *   3. The cascade in updateBookingHistoricalDetails and
 *      settleBookingTrancheCascade already creates a paid installment
 *      row for every cash collection, so "Amount Collected Now"
 *      automatically becomes a tranche-type inflow event with no extra
 *      sync code needed.
 *
 * Stable event IDs (per the spec: bookingId + paymentType + paymentDate
 * + amount-ish identifier) guarantee React keys stay stable and no
 * duplicate events render if the same booking is fetched twice.
 *
 * Each RentalInflow record carries:
 *   - bookingId (= contract reference)
 *   - clientName + vehicle (for display)
 *   - amount + currency-implicit DT
 *   - paymentType: acompte | installment | close_collection | balance
 *   - status: paid | unpaid | overdue
 *   - date (YYYY-MM-DD)
 *   - createdAt / updatedAt (from the underlying row's timestamps when
 *     available, else the date itself)
 *
 * NOTE on close_collection vs installment: at the data layer there is no
 * way to distinguish "this paid installment came from a scheduled tranche
 * paid today" vs "this paid installment came from the close-contract
 * cash-collected cascade today" — both end up as identical paid rows in
 * booking_installments. We tag the synthetic ones (created by the
 * cascade with due_date = today AND paid_date = today AND not in the
 * original scheduled list) as `close_collection` heuristically. This
 * costs nothing at write time and gives the operator useful context.
 */

export type PaymentType = 'acompte' | 'installment' | 'close_collection' | 'balance'
export type PaymentStatus = 'paid' | 'unpaid' | 'overdue'

export interface RentalInflow {
  id: string                          // stable: bookingId__type__date(or installmentId)
  bookingId: string
  contractKey: string                 // pretty display ref, e.g. "#FB506B"
  clientName: string
  clientId?: string | null
  vehicle: {
    brand?: string
    model?: string
    license_plate?: string
  } | null
  vehicleId?: string | null
  amount: number
  paymentType: PaymentType
  status: PaymentStatus
  date: string                        // YYYY-MM-DD — when the payment was collected / is due
  createdAt: string                   // ISO timestamp
  updatedAt: string                   // ISO timestamp
}

// Minimal shape we read from a Supabase booking row. Kept loose because
// upstream uses select('*') and the booking table schema evolves freely.
interface BookingLike {
  id: string
  client_name?: string | null
  client_id?: string | null
  vehicle_id?: string | null
  total_amount?: number | string | null
  acompte_paid?: number | string | null
  acompte_paid_date?: string | null   // optional; falls back to created_at
  created_at?: string | null
  start_date?: string | null
  status?: string | null
  vehicles?: { brand?: string; model?: string; license_plate?: string } | null
  installments?: Array<{
    id: string
    booking_id?: string
    amount: number | string | null
    due_date: string | null
    status: string | null
    paid_date?: string | null
    created_at?: string | null
    updated_at?: string | null
  }> | null
}

function asYMD(s?: string | null): string {
  if (!s) return ''
  return s.split('T')[0]
}

function contractKey(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`
}

/**
 * Convert one booking row into its rental-inflow event timeline.
 *
 * @param booking  Supabase booking row with `installments` joined.
 * @param today    YYYY-MM-DD used to classify unpaid installments as overdue.
 * @returns        Array of RentalInflow records — one per payment moment
 *                 (acompte + each installment + optional balance/solde).
 *                 Empty array if the booking has no cash activity at all.
 */
export function bookingToRentalInflows(booking: BookingLike, today: string): RentalInflow[] {
  const out: RentalInflow[] = []

  const bookingId = booking.id
  const clientName = booking.client_name || 'Client'
  const clientId = booking.client_id ?? null
  const vehicle = booking.vehicles || null
  const vehicleId = booking.vehicle_id ?? null
  const refKey = contractKey(bookingId)

  const total = Number(booking.total_amount) || 0
  const acompte = Number(booking.acompte_paid) || 0
  const acompteDate = asYMD(booking.acompte_paid_date || booking.created_at || booking.start_date)

  // ── 1. Acompte (initial deposit) ─────────────────────────────────────
  if (acompte > 0) {
    out.push({
      id: `${bookingId}__acompte__${acompteDate || 'unknown'}`,
      bookingId,
      contractKey: refKey,
      clientName,
      clientId,
      vehicle,
      vehicleId,
      amount: acompte,
      paymentType: 'acompte',
      status: 'paid',
      date: acompteDate || asYMD(booking.created_at) || today,
      createdAt: booking.created_at || acompteDate || today,
      updatedAt: booking.acompte_paid_date || booking.created_at || today,
    })
  }

  // ── 2. Installments (scheduled + close_collection) ───────────────────
  const installments = (booking.installments || [])
    .filter(t => !String(t.id).startsWith('unpaid-liability-'))

  let paidInstallmentsSum = 0

  for (const inst of installments) {
    const amt = Number(inst.amount) || 0
    const isPaid = inst.status === 'paid'
    const dueDate = asYMD(inst.due_date)
    const paidDate = asYMD(inst.paid_date)
    const eventDate = isPaid ? (paidDate || dueDate) : dueDate

    let status: PaymentStatus
    if (isPaid) {
      status = 'paid'
      paidInstallmentsSum += amt
    } else if (dueDate && dueDate < today) {
      status = 'overdue'
    } else {
      status = 'unpaid'
    }

    // close_collection heuristic: a paid installment whose due_date equals
    // its paid_date AND both equal today means the operator collected this
    // cash via the Live Cash Ledger Update modal (the cascade inserts the
    // row with due_date = paid_date = today). Tag it distinctly so the UI
    // can show "Cash collected at counter" vs a regular scheduled payment.
    const paymentType: PaymentType =
      isPaid && paidDate && dueDate === paidDate && paidDate === today
        ? 'close_collection'
        : 'installment'

    out.push({
      id: `${bookingId}__${paymentType}__${inst.id}`,
      bookingId,
      contractKey: refKey,
      clientName,
      clientId,
      vehicle,
      vehicleId,
      amount: amt,
      paymentType,
      status,
      date: eventDate || today,
      createdAt: inst.created_at || eventDate || today,
      updatedAt: inst.updated_at || inst.paid_date || eventDate || today,
    })
  }

  // ── 3. Balance / Solde — remaining contract liability not covered by
  // scheduled tranches. Surfaces only when there's a real shortfall.
  const collected = acompte + paidInstallmentsSum
  const installmentsUnpaidSum = installments
    .filter(t => t.status !== 'paid')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const contractRemaining = total - collected
  const balanceShortfall = contractRemaining - installmentsUnpaidSum

  if (balanceShortfall > 0.01 && contractRemaining > 0) {
    // Use today as the due date for the unscheduled remainder — it's "due
    // now" because the operator never scheduled a tranche for it.
    out.push({
      id: `${bookingId}__balance__${today}`,
      bookingId,
      contractKey: refKey,
      clientName,
      clientId,
      vehicle,
      vehicleId,
      amount: balanceShortfall,
      paymentType: 'balance',
      status: 'unpaid',
      date: today,
      createdAt: booking.created_at || today,
      updatedAt: today,
    })
  }

  return out
}

/**
 * Convenience: apply bookingToRentalInflows to a list of bookings and
 * return the flat list of inflow records.
 */
export function bookingsToRentalInflows(bookings: BookingLike[], today: string): RentalInflow[] {
  const out: RentalInflow[] = []
  for (const b of bookings) {
    out.push(...bookingToRentalInflows(b, today))
  }
  return out
}

/**
 * Aggregations the Rental Inflows summary cards need. Computed off the
 * already-filtered visible inflows so the totals match what's rendered.
 */
export interface InflowSummary {
  totalCollected: number     // sum of paid amounts
  totalUnpaid: number        // sum of unpaid + overdue
  overdueCount: number       // number of overdue events
  paidCount: number
  unpaidCount: number
}

export function summarizeInflows(inflows: RentalInflow[]): InflowSummary {
  let totalCollected = 0
  let totalUnpaid = 0
  let overdueCount = 0
  let paidCount = 0
  let unpaidCount = 0

  for (const inf of inflows) {
    if (inf.status === 'paid') {
      totalCollected += inf.amount
      paidCount += 1
    } else {
      totalUnpaid += inf.amount
      unpaidCount += 1
      if (inf.status === 'overdue') overdueCount += 1
    }
  }

  return { totalCollected, totalUnpaid, overdueCount, paidCount, unpaidCount }
}
