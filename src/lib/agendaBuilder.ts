// ---------------------------------------------------------------------------
// Phase 18 — Pure helper that derives the To-Do Hub agenda on read.
// No new "agenda" table. Same architectural pattern as src/lib/rentalInflows.ts:
// single source of truth, sorted/filtered on demand from raw rows.
// ---------------------------------------------------------------------------

import type { Booking, Vehicle, Todo, VehicleLegalDoc } from '@/types'

export type AgendaKind = 'handover' | 'maintenance' | 'document' | 'manual'
export type AgendaPriority = 'critical' | 'high' | 'normal'
export type AgendaIcon =
  | 'plane'
  | 'hotel'
  | 'pin'
  | 'wrench'
  | 'shield'
  | 'check'
  | 'truck'

export interface AgendaItem {
  id: string
  kind: AgendaKind
  priority: AgendaPriority
  title: string
  subtitle?: string
  icon: AgendaIcon
  date: string                            // YYYY-MM-DD this item belongs to
  time?: string                           // HH:MM if applicable
  deltaKm?: number
  vehicle?: { brand?: string; model?: string; license_plate?: string }
  client?: { initials?: string; name?: string; phone?: string }
  actionType: 'complete' | 'open-handover' | 'open-vehicle' | 'open-doc' | null
  actionPayload?: {
    bookingId?: string
    vehicleId?: string
    todoId?: string
    docId?: string
  }
  isCompleted?: boolean
}

export interface AgendaWindow {
  from: string                            // YYYY-MM-DD inclusive
  to: string                              // YYYY-MM-DD inclusive
}

// ---------------------------------------------------------------------------
// Small pure utilities (no date library — stay tree-shakeable).
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<AgendaPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
}

export function getTodayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function daysBetween(fromYMD: string, toYMD: string): number {
  const [fy, fm, fd] = fromYMD.split('-').map(Number)
  const [ty, tm, td] = toYMD.split('-').map(Number)
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000)
}

function initials(fullName: string | undefined | null): string {
  if (!fullName) return '?'
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function locationIcon(loc: string): AgendaIcon {
  const l = loc.toLowerCase()
  if (l.includes('matar') || l.includes('airport') || l.includes('aéroport') || l.includes('aeroport')) return 'plane'
  if (l.includes('hotel') || l.includes('hôtel')) return 'hotel'
  return 'pin'
}

// ---------------------------------------------------------------------------
// Window predicates
// ---------------------------------------------------------------------------

export function startOfISOWeek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() || 7         // Sun=7
  dt.setUTCDate(dt.getUTCDate() - (dow - 1))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function endOfISOWeek(ymd: string): string {
  return addDays(startOfISOWeek(ymd), 6)
}

export function firstDayOfMonth(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

export function lastDayOfMonth(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m, 0))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export interface BuildAgendaInput {
  bookings: Booking[]
  vehicles: Vehicle[]
  legalDocs: VehicleLegalDoc[]
  todos: Todo[]
  window: AgendaWindow
  today?: string                          // override for testing
}

export function buildAgenda(input: BuildAgendaInput): AgendaItem[] {
  const { bookings, vehicles, legalDocs, todos, window } = input
  const TODAY = input.today || getTodayYMD()
  const vehiclesById = new Map(vehicles.map(v => [v.id, v]))
  const out: AgendaItem[] = []

  // -- Stream 1: handover deliveries -----------------------------------------
  for (const b of bookings) {
    if (!b.handover_location?.trim()) continue

    // Use the edited handover date if available, otherwise fall back to start_date
    const dateYMD = b.handover_datetime ? b.handover_datetime.split('T')[0] : b.start_date
    if (!dateYMD) continue
    if (dateYMD < window.from || dateYMD > window.to) continue
    
    // Handovers strictly in the past (before TODAY/sysdate) should not appear in the active to-do list
    if (dateYMD < TODAY) continue

    const loc = b.handover_location.trim()
    let time: string | undefined = undefined
    if (b.handover_datetime && !b.handover_datetime.includes('T00:00:00') && !b.handover_datetime.includes(' 00:00')) {
      const parts = b.handover_datetime.split('T')
      if (parts.length > 1) {
        time = parts[1].substring(0, 5) // "HH:MM"
      } else {
        const spaceParts = b.handover_datetime.split(' ')
        if (spaceParts.length > 1) {
          time = spaceParts[1].substring(0, 5) // "HH:MM"
        }
      }
    }

    out.push({
      id: `handover__${b.id}__${dateYMD}`,
      kind: 'handover',
      priority: 'critical',
      title: `Delivery: ${b.vehicles?.brand ?? ''} ${b.vehicles?.model ?? ''} to ${b.client_name || 'Client'}`.trim(),
      subtitle: `${b.vehicles?.license_plate || ''} → ${loc}`.trim(),
      icon: locationIcon(loc),
      date: dateYMD,
      time,
      vehicle: b.vehicles
        ? { brand: b.vehicles.brand, model: b.vehicles.model, license_plate: b.vehicles.license_plate }
        : undefined,
      client: {
        initials: initials(b.client_name),
        name: b.client_name,
        phone: b.client_phone || b.primary_client?.phone || undefined,
      },
      actionType: 'open-handover',
      actionPayload: { bookingId: b.id },
    })
  }

  // -- Stream 2: mechanical maintenance --------------------------------------
  for (const v of vehicles) {
    // Skip withdrawn vehicles — no alerts should be generated for retired fleet
    if (v.withdrawn_at) continue

    const current = Number(v.current_km) || 0

    // --- Vidange / Oil Change (warn at ≤1000 km remaining) -----------------
    const targetVid = Number(v.next_vidange_km) || 0
    if (targetVid > 0) {
      const delta = targetVid - current
      if (delta <= 1000) {
        const isCritical = delta <= 0 || delta <= 200
        out.push({
          id: `maint__vidange__${v.id}`,
          kind: 'maintenance',
          priority: isCritical ? 'critical' : 'high',
          title: delta <= 0
            ? `🔴 Oil Change OVERDUE by ${Math.abs(delta).toLocaleString()} km — ${v.license_plate ?? `${v.brand} ${v.model}`}`
            : delta <= 200
            ? `🔴 Oil Change CRITICAL: ${delta.toLocaleString()} km left — ${v.brand} ${v.model}`
            : `⚠ Oil Change due in ${delta.toLocaleString()} km — ${v.brand} ${v.model}`,
          subtitle: `Current: ${current.toLocaleString()} km · Limit: ${targetVid.toLocaleString()} km${v.license_plate ? ` · ${v.license_plate}` : ''}`,
          icon: 'wrench',
          date: TODAY,
          deltaKm: delta,
          vehicle: { brand: v.brand, model: v.model, license_plate: v.license_plate },
          actionType: 'open-vehicle',
          actionPayload: { vehicleId: v.id },
        })
      }
    }

    // --- Brake-pads (warn at ≤1000 km remaining) ---------------------------
    const targetPads = Number(v.next_pads_km) || 0
    if (targetPads > 0) {
      const delta = targetPads - current
      if (delta <= 1000) {
        const isCritical = delta <= 0 || delta <= 200
        out.push({
          id: `maint__pads__${v.id}`,
          kind: 'maintenance',
          priority: isCritical ? 'critical' : 'high',
          title: delta <= 0
            ? `🔴 Brake Pads OVERDUE by ${Math.abs(delta).toLocaleString()} km — ${v.license_plate ?? `${v.brand} ${v.model}`}`
            : delta <= 200
            ? `🔴 Brake Pads CRITICAL: ${delta.toLocaleString()} km left — ${v.brand} ${v.model}`
            : `⚠ Brake Pads due in ${delta.toLocaleString()} km — ${v.brand} ${v.model}`,
          subtitle: `Current: ${current.toLocaleString()} km · Limit: ${targetPads.toLocaleString()} km${v.license_plate ? ` · ${v.license_plate}` : ''}`,
          icon: 'wrench',
          date: TODAY,
          deltaKm: delta,
          vehicle: { brand: v.brand, model: v.model, license_plate: v.license_plate },
          actionType: 'open-vehicle',
          actionPayload: { vehicleId: v.id },
        })
      }
    }
  }

  // -- Stream 3: statutory document expiry -----------------------------------
  const horizon = addDays(window.from, 30)
  for (const doc of legalDocs) {
    if (!doc.expiry_date) continue
    if (doc.expiry_date > horizon && doc.expiry_date > window.to) continue

    // Skip docs belonging to withdrawn vehicles
    const v = vehiclesById.get(doc.vehicle_id)
    if (!v || v.withdrawn_at) continue

    const isExpired = doc.expiry_date < TODAY
    const daysUntil = daysBetween(TODAY, doc.expiry_date)
    const label =
      doc.doc_type === 'assurance' ? 'Assurance' :
      doc.doc_type === 'visite_technique' ? 'Visite Technique' :
      doc.doc_type === 'laissez_passer' ? 'Laissez-Passer' :
      doc.doc_type

    out.push({
      id: `doc__${doc.id}`,
      kind: 'document',
      priority: isExpired || daysUntil <= 7 ? 'critical' : 'high',
      title: isExpired
        ? `${label} EXPIRED ${Math.abs(daysUntil)} days ago — ${v?.license_plate ?? ''}`
        : `${label} expires in ${daysUntil} days — ${v?.license_plate ?? ''}`,
      subtitle: v ? `${v.brand} ${v.model}` : '',
      icon: 'shield',
      date: doc.expiry_date,
      vehicle: v ? { brand: v.brand, model: v.model, license_plate: v.license_plate } : undefined,
      actionType: 'open-doc',
      actionPayload: { vehicleId: doc.vehicle_id, docId: doc.id },
    })
  }

  // -- Stream 4: manual todos ------------------------------------------------
  for (const t of todos) {
    if (t.is_completed) {
      if (!t.completed_at) continue
      const compDateStr = t.completed_at.split('T')[0]
      const days = daysBetween(compDateStr, TODAY)
      if (days > 1) continue // Keep for exactly 1 day (today + yesterday)
    }
    if (t.due_date && (t.due_date < window.from || t.due_date > window.to)) continue

    const priority: AgendaPriority =
      t.priority === 'high' ? 'high' : t.priority === 'low' ? 'normal' : 'normal'

    out.push({
      id: `manual__${t.id}`,
      kind: 'manual',
      priority,
      title: t.title,
      subtitle: t.notes ?? undefined,
      icon: 'check',
      date: t.due_date || window.from,
      isCompleted: t.is_completed,
      actionType: 'complete',
      actionPayload: { todoId: t.id },
    })
  }

  // -- Sort: priority → date → time → title ----------------------------------
  out.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if ((a.time || '') !== (b.time || '')) return (a.time || '').localeCompare(b.time || '')
    return a.title.localeCompare(b.title)
  })

  return out
}

// ---------------------------------------------------------------------------
// KPI strip summary (count per stream within the current window).
// ---------------------------------------------------------------------------

export interface AgendaSummary {
  handovers: number
  maintenance: number
  documents: number
  manual: number
}

export function summarizeAgenda(items: AgendaItem[]): AgendaSummary {
  return items.reduce<AgendaSummary>((acc, it) => {
    if (it.kind === 'handover') acc.handovers++
    else if (it.kind === 'maintenance') acc.maintenance++
    else if (it.kind === 'document') acc.documents++
    else if (it.kind === 'manual') acc.manual++
    return acc
  }, { handovers: 0, maintenance: 0, documents: 0, manual: 0 })
}