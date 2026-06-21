import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { fetchAllBookings } from '@/app/actions/_shared'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel fan-out: all independent queries.
  const [vehiclesRes, vehicleLegalDocsRes, expensesRes, maintenanceRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*')
      .eq('owner_id', user.id)
      .is('withdrawn_at', null),
    supabase
      .from('vehicle_legal_docs')
      .select('*')
      .eq('owner_id', user.id),
    supabase
      .from('expenses')
      .select('id, amount, category, description, created_at, client_id, vehicle_id')
      .eq('owner_id', user.id),
    supabase
      .from('maintenance')
      .select('id, cost, service_date, description, created_at, vehicle_id')
      .eq('owner_id', user.id),
  ])

  // Fetch all bookings (handling Postgrest 1000 limit)
  const bookings = await fetchAllBookings(
    supabase,
    user.id,
    `
      *,
      vehicles(id, brand, model, license_plate, price_per_day),
      primary_client:clients!client_id(
        id,
        full_name, phone, license_number, cin, address,
        trust_score,
        date_naissance, cin_delivre_le,
        permis_numero, permis_delivre_le
      ),
      secondary_client:clients!secondary_client_id(
        id,
        full_name, phone, license_number, cin, address,
        trust_score,
        date_naissance, cin_delivre_le,
        permis_numero, permis_delivre_le
      ),
      installments:booking_installments(
        id, amount, due_date, status, paid_date
      )
    `
  )

  // vehiclesRes already filtered to withdrawn_at IS NULL — these are all active vehicles
  const activeVehicles = vehiclesRes.data || []
  const vehicleLegalDocs = vehicleLegalDocsRes.data || []
  const expenses = expensesRes.data || []
  const maintenance = maintenanceRes.data || []

  const activeVehicleIds = new Set(activeVehicles.map((v: any) => v.id))

  // Filter legal documents to only belong to active vehicles for active warnings
  const activeVehicleLegalDocs = vehicleLegalDocs.filter((doc: any) => activeVehicleIds.has(doc.vehicle_id))

  const fleetSize = activeVehicles.length

  let revenueYTD = 0
  let expensesYTD = 0
  let outstandingLiabilities = 0
  let activeRentals = 0
  let riskSignalsCount = 0

  const todayObj = new Date()
  const targetYear = todayObj.getFullYear()
  const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const dayStr = String(todayObj.getDate()).padStart(2, '0')
  const today = `${targetYear}-${monthStr}-${dayStr}`

  if (bookings) {
    bookings.forEach((booking) => {
      const status = (booking.status || '').toLowerCase()
      const isConfirmed = status === 'confirmed'
      const isCompleted = status === 'completed'

      if (isConfirmed || isCompleted) {
        const totalAmount = Number(booking.total_amount) || 0
        const acomptePaid = Number(booking.acompte_paid) || 0
        let paidInstallments = 0

        if (booking.installments && Array.isArray(booking.installments)) {
          booking.installments.forEach((inst: any) => {
            if (inst.status === 'paid') {
              paidInstallments += Number(inst.amount) || 0
            }
          })
        }

        const remaining = totalAmount - acomptePaid - paidInstallments
        if (remaining > 0) {
          outstandingLiabilities += remaining
        }

        // True cash-basis attribution:
        // 1. Acompte is attributed to acompte_paid_date year (fallback to created_at year for legacy rows).
        const acompteDateStr = booking.acompte_paid_date || booking.created_at
        const acompteYear = acompteDateStr ? new Date(acompteDateStr).getFullYear() : 0
        if (acompteYear === targetYear && acomptePaid > 0) {
          revenueYTD += acomptePaid
        }

        // 2. Installments are counted in the year they were actually paid.
        if (booking.installments && Array.isArray(booking.installments)) {
          booking.installments.forEach((inst: any) => {
            if (inst.status === 'paid') {
              const instAmt = Number(inst.amount) || 0
              const instDateStr = inst.paid_date || inst.due_date
              const instYear = instDateStr ? new Date(instDateStr).getFullYear() : 0
              if (instYear === targetYear) {
                revenueYTD += instAmt
              }
            }
          })
        }
      }

      // Active = currently within the rental date window AND status is confirmed AND vehicle is active.
      if (isConfirmed && booking.start_date <= today && booking.end_date >= today && activeVehicleIds.has(booking.vehicle_id)) {
        activeRentals++
      }

      // Risk signal: Overdue return (confirmed status but end_date < today AND vehicle is active)
      if (isConfirmed && booking.end_date < today && activeVehicleIds.has(booking.vehicle_id)) {
        riskSignalsCount++
      }
    })
  }

  if (expenses) {
    expenses.forEach((e) => {
      const eDateStr = e.created_at
      const eYear = eDateStr ? new Date(eDateStr).getFullYear() : 0

      // Standard fleet outflows reduce YTD profit; claim categories are receivables, not outflows.
      const isClaim = ['damage_repair', 'installment_tranche', 'late_return_penalty'].includes(e.category)
      if (!isClaim && eYear === targetYear) {
        expensesYTD += Number(e.amount) || 0
      }
    })
  }

  if (maintenance) {
    maintenance.forEach((m) => {
      const mDateStr = m.service_date || m.created_at
      const mYear = mDateStr ? new Date(mDateStr).getFullYear() : 0
      if (mYear === targetYear) {
        expensesYTD += Number(m.cost) || 0
      }
    })
  }

  if (activeVehicleLegalDocs) {
    activeVehicleLegalDocs.forEach((doc: any) => {
      if (doc.expiry_date) {
        const diffTime = new Date(doc.expiry_date).getTime() - new Date(today).getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 30) {
          riskSignalsCount++
        }
      }
    })
  }

  const netProfitYTD = revenueYTD - expensesYTD
  const utilizationRate = fleetSize > 0 ? (activeRentals / fleetSize) * 100 : 0
  const recentBookings = bookings ? bookings.slice(0, 5) : []

  return (
    <DashboardClient
      stats={{
        revenueYTD,
        expensesYTD,
        netProfitYTD,
        fleetSize,
        activeRentals,
        utilizationRate,
        outstandingLiabilities,
        riskSignalsCount,
        targetYear
      }}
      recentBookings={recentBookings}
      vehicles={activeVehicles}
      allBookings={bookings}
      vehicleLegalDocs={activeVehicleLegalDocs}
      expenses={expenses}
      maintenance={maintenance}
    />
  )
}
