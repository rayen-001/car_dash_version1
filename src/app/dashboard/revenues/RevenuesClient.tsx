'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, X, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Landmark,
  Search, FileText, AlertCircle, Clock, Star, ShieldAlert as ShieldAlertIcon, Calendar, Phone, Car as CarIcon
} from 'lucide-react'
import { addExpense, updateExpense, deleteExpense, clearOutstandingLedgerItem, updateBookingHistoricalDetails, toggleTrancheStatus, settleBookingTrancheCascade } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import ExpenseReportModal from '../expenses/components/ExpenseReportModal'
import QuickEditBookingModal from '@/app/dashboard/vehicles/[id]/history/components/QuickEditBookingModal'
import { BusinessSettings } from '@/types'
import { calculateTrustScore } from '@/lib/trustScore'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Installment {
  id: string
  amount: number
  due_date: string
  status: 'paid' | 'unpaid'
  paid_date?: string | null
}

interface LedgerRow {
  id: string
  date: string
  type: 'inflow' | 'outflow'
  category: 'rental_revenue' | 'maintenance' | 'fuel' | 'insurance' | 'cleaning' | 'incident' | 'other' | 'damage_repair' | 'installment_tranche' | 'late_return_penalty'
  description: string
  entity: string
  vehicleLabel: string
  licensePlate: string
  amount: number
  rawRef: 'booking' | 'expense' | 'maintenance' | 'claim'
  installments: Installment[]   // sorted by due_date ASC
  totalOwed: number             // sum of unpaid installments or claim balance
  hasOverdue: boolean           // any unpaid tranche past today
  contractKey: string           // tokenized contract identifier
  collectedAmount: number       // realized inflow for the row
  remainingAmount: number       // amount still owed or unsettled
  settlementBookingId?: string
  settlementVehicleId?: string
  settlementLineItemId?: string
  clientPhone?: string
  driverDocsLabel?: string
  claimType?: 'damage_repair' | 'installment_tranche' | 'late_return_penalty'
  vehicleId?: string
  totalAmount?: number
  rawBooking?: any
  clients?: any
}

type DatePreset = 'today' | 'week' | 'month' | 'custom'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function isoDate(s: string | null | undefined): string {
  return s ? s.split('T')[0] : ''
}

function fmtDate(s: string): string {
  if (!s) return '—'
  try {
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00')
    return d.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return s }
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)
}

function buildVehicleLabel(v?: { brand?: string; model?: string; license_plate?: string } | null): string {
  if (!v) return 'General'
  const name = [v.brand, v.model].filter(Boolean).join(' ')
  return name || 'Vehicle'
}

function buildPlateLabel(v?: { license_plate?: string } | null): string {
  return v?.license_plate || ''
}

function buildContractKey(id: string): string {
  return `#${String(id).slice(0, 6).toUpperCase()}`
}

function formatTunisianPlate(plate: string): string {
  return plate ? `[ TN | ${plate} ]` : '—'
}

function getInfractionLabel(type?: string) {
  switch (type) {
    case 'damage_repair': return 'Damage Repair'
    case 'installment_tranche': return 'Installment Tranche'
    case 'late_return_penalty': return 'Late Return Penalty'
    default: return 'Operational Claim'
  }
}

function normalizePhone(value?: string) {
  return value ? value : 'Phone unavailable'
}

function resolveDriverDocs(value?: string) {
  return value ? `Docs: ${value}` : 'Driver documentation pending'
}

function fmtLegalDate(d?: string): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB')
  } catch {
    return d
  }
}

const getClientRiskProfile = (
  clientId: string | undefined,
  clientName: string | undefined,
  allBookings: any[]
) => {
  if (!clientId && !clientName) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  const clientBookings = allBookings.filter(b => {
    if (clientId && b.clients?.id === clientId) return true
    if (clientName && b.client_name === clientName) return true
    return false
  }).filter(b => b.status !== 'cancelled')

  if (clientBookings.length === 0) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const { trustScore: score, hasCriminalOverride } = calculateTrustScore(clientBookings as any, todayStr)

  let riskLevel: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'very_high_risk' | 'criminal'
  
  if (hasCriminalOverride || (score !== null && score < 15.0)) {
    riskLevel = 'criminal'
  } else if (score !== null && score >= 92.0) {
    riskLevel = 'very_low_risk'
  } else if (score !== null && score >= 80.0) {
    riskLevel = 'low_risk'
  } else if (score !== null && score >= 60.0) {
    riskLevel = 'medium_risk'
  } else if (score !== null && score >= 45.0) {
    riskLevel = 'high_risk'
  } else {
    riskLevel = 'very_high_risk'
  }

  return { score, riskLevel }
}

function renderTrustBadge(row: LedgerRow, initialBookings: any[]) {
  const { score, riskLevel } = getClientRiskProfile(row.clients?.id, row.rawBooking?.client_name, initialBookings)

  if (score === null) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: '0.7rem',
        fontWeight: 600,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginTop: '0.25rem',
        width: 'fit-content'
      }}>
        New Client
      </span>
    )
  }

  if (riskLevel === 'criminal') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.2)',
          color: '#ff4444',
          fontSize: '0.7rem',
          fontWeight: 900,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          border: '1px solid #ff4444',
          animation: 'glow-warning-badge 1.5s infinite alternate',
          width: 'fit-content'
        }}>
          <ShieldAlertIcon size={12} style={{ fill: 'rgba(255, 68, 68, 0.2)' }} />
          Blacklisted / Suspended ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.65rem', color: '#ff7777', fontWeight: 600 }}>
          ⚠️ Block booking. Active contract triggers repossession flag.
        </span>
      </div>
    )
  }

  if (riskLevel === 'very_high_risk') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.45rem',
          borderRadius: '4px',
          background: 'rgba(244, 63, 94, 0.15)',
          color: '#fb7185',
          fontSize: '0.7rem',
          fontWeight: 700,
          border: '1px solid rgba(244, 63, 94, 0.5)',
          width: 'fit-content'
        }}>
          <ShieldAlertIcon size={12} style={{ fill: 'rgba(244, 63, 94, 0.2)' }} />
          Restricted / High Risk ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.65rem', color: '#fb7185' }}>
          Economy Tier Only, 100% Upfront Cash, Manager Co-Sign.
        </span>
      </div>
    )
  }

  if (riskLevel === 'high_risk') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          fontSize: '0.7rem',
          fontWeight: 700,
          border: '1px solid rgba(245, 158, 11, 0.5)',
          width: 'fit-content'
        }}>
          <ShieldAlertIcon size={12} style={{ fill: 'rgba(245, 158, 11, 0.2)' }} />
          Cautionary ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.65rem', color: '#fbbf24' }}>
          Economy/Standard Only, Mandatory Vehicle Condition Photos.
        </span>
      </div>
    )
  }

  if (riskLevel === 'medium_risk') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          fontSize: '0.7rem',
          fontWeight: 700,
          border: '1px solid rgba(59, 130, 246, 0.5)',
          width: 'fit-content'
        }}>
          Standard ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
          Access to All Fleets, Standard Multi-Point Checklist.
        </span>
      </div>
    )
  }

  if (riskLevel === 'low_risk') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          fontSize: '0.7rem',
          fontWeight: 700,
          border: '1px solid rgba(16, 185, 129, 0.5)',
          width: 'fit-content'
        }}>
          Preferred ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.65rem', color: '#6ee7b7' }}>
          Access to All Fleets, Standard Pricing, Minimal Checklist.
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', marginTop: '0.25rem' }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        background: 'rgba(229, 193, 125, 0.15)',
        color: 'var(--accent-gold)',
        fontSize: '0.7rem',
        fontWeight: 700,
        border: '1px solid rgba(229, 193, 125, 0.5)',
        animation: 'glow-emerald-badge 1.5s infinite alternate',
        width: 'fit-content'
      }}>
        <Star size={11} style={{ fill: 'var(--accent-gold)' }} />
        Elite / VIP Renter ({score.toFixed(1)} DRI)
      </span>
      <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
        Access to Luxury Fleets (SUVs), 0% Upfront Advance Approved.
      </span>
    </div>
  )
}

function parseMaintenanceDescription(description: string, totalCost: number) {
  const partsRegex = /(?:parts|pièces|pieces)\s*[:=]?\s*(\d+(?:\.\d+)?)/i
  const laborRegex = /(?:labor|main d'oeuvre|main-d'oeuvre|labour|mo)\s*[:=]?\s*(\d+(?:\.\d+)?)/i
  
  const partsMatch = description.match(partsRegex)
  const laborMatch = description.match(laborRegex)
  
  let parts = partsMatch ? Number(partsMatch[1]) : 0
  let labor = laborMatch ? Number(laborMatch[1]) : 0
  
  if (parts === 0 && labor === 0) {
    parts = totalCost * 0.7
    labor = totalCost * 0.3
  } else if (parts > 0 && labor === 0) {
    labor = Math.max(0, totalCost - parts)
  } else if (labor > 0 && parts === 0) {
    parts = Math.max(0, totalCost - labor)
  }
  
  return { parts, labor }
}

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.5))' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const ToolIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)


// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  rental_revenue: { label: 'Rental Revenue',     emoji: '💵', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  maintenance:    { label: 'Vehicle Maintenance', emoji: '🛠️', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  fuel:           { label: 'Fleet Fuel',          emoji: '⛽', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  insurance:      { label: 'Insurance',           emoji: '🛡️', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)' },
  cleaning:       { label: 'Cleaning',            emoji: '🧹', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  incident:       { label: 'Incident Indemnity',  emoji: '💥', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  other:          { label: 'Other',               emoji: '📋', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
}

// ─── Installment Roadmap Sub-Panel ────────────────────────────────────────────

function InstallmentRoadmap({ installments, today }: { installments: Installment[]; today: string }) {
  if (!installments || installments.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.4rem',
      marginTop: '0.5rem',
      paddingTop: '0.5rem',
      borderTop: '1px solid rgba(229,193,125,0.07)'
    }}>
      {installments.map((tr, idx) => {
        const isPaid = tr.status === 'paid'
        const isOverdue = !isPaid && tr.due_date < today
        const amt = Number(tr.amount).toFixed(2)

        return (
          <div
            key={tr.id}
            title={isPaid ? `Tranche #${idx + 1} settled` : isOverdue ? `OVERDUE since ${tr.due_date}` : `Pending tranche due ${tr.due_date}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.28rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.22rem 0.55rem',
              borderRadius: '20px',
              whiteSpace: 'nowrap',
              background: isPaid ? 'rgba(16,185,129,0.06)' : isOverdue ? 'rgba(239,68,68,0.06)' : 'rgba(229,193,125,0.07)',
              border: `1px solid ${isPaid ? 'rgba(16,185,129,0.18)' : isOverdue ? 'rgba(239,68,68,0.24)' : 'rgba(229,193,125,0.15)'}`,
              color: isPaid ? '#10b981' : isOverdue ? '#f87171' : 'rgba(229,193,125,0.7)'
            }}
          >
            <span style={{ marginRight: 6 }}>{isPaid ? '🟢' : isOverdue ? '🔴' : '⚪'}</span>
            <span style={{ fontWeight: 800 }}>{amt} DT</span>
            {!isPaid && (
              <span style={{ marginLeft: 8, color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.45)', fontWeight: isOverdue ? 800 : 600 }}>{`(Due: ${tr.due_date})`}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BookingInput {
  id: string
  client_name?: string
  client_phone?: string
  vehicle_id?: string
  vehicles?: any
  installments?: Installment[]
  acompte_paid?: number | string
  actual_return_date?: string | null
  created_at?: string
  start_date?: string
  total_amount?: number | string
  client_license_number?: string
  clients?: any
  client_behavior_status?: string
  damage_notes?: string
  starting_km?: number | null
  return_km?: number | null
  fuel_level_pickup?: string
  fuel_level_return?: string
  lavage_pickup?: string
  lavage_return?: string
  departure_time?: string
  return_time?: string
  rental_days_text?: string
}

interface ExpenseInput {
  id: string
  created_at?: string
  category?: string
  description?: string
  amount?: number | string
  vehicles?: any
  client_phone?: string
}

interface MaintenanceInput {
  id: string
  service_date?: string
  created_at?: string
  description?: string
  cost?: number | string
  vehicles?: any
}

export default function RevenuesClient({
  initialExpenses,
  initialMaintenance,
  initialBookings,
  vehicles,
  businessSettings,
  legalDocs = [],
}: {
  initialExpenses: ExpenseInput[]
  initialMaintenance: MaintenanceInput[]
  initialBookings: BookingInput[]
  vehicles: any[]
  businessSettings: BusinessSettings | null
  legalDocs?: { vehicle_id: string; doc_type: string; expiry_date: string }[]
}) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const TODAY = todayStr()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen]     = useState(false)
  const [editingExpense, setEditingExpense]  = useState<any>(null)
  const [editingBooking, setEditingBooking]  = useState<any>(null)
  const [loading, setLoading]               = useState(false)
  const [settledInstallmentIds, setSettledInstallmentIds] = useState<string[]>([])
  const [locallySettledClaims, setLocallySettledClaims] = useState<string[]>([])
  const [collectAmounts, setCollectAmounts] = useState<Record<string, string>>({})
  const [flowFilter, setFlowFilter]         = useState<'all' | 'settled' | 'unpaid'>('all')
  const [expandedRowId, setExpandedRowId]   = useState<string | null>(null)
  const [trancheActionLoading, setTrancheActionLoading] = useState<string | null>(null)
  const router = useRouter()

  // ── Temporal Filter ───────────────────────────────────────────────────────
  const [preset, setPreset]       = useState<DatePreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')

  // ── Search + Type Filter ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | 'inflow' | 'outflow'>('all')

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') setIsAddModalOpen(true)
  }, [searchParams])

  // ── Date Window ───────────────────────────────────────────────────────────
  const dateWindow = useMemo<{ from: string; to: string }>(() => {
    if (preset === 'today') return { from: TODAY, to: TODAY }
    if (preset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { from, to: TODAY }
    }
    if (preset === 'month') {
      const d = new Date()
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      return { from, to: TODAY }
    }
    return { from: customFrom || '2000-01-01', to: customTo || TODAY }
  }, [preset, customFrom, customTo, TODAY])

  // ── Build Unified Ledger (with installments) ──────────────────────────────
  const allRows = useMemo<LedgerRow[]>(() => {
    const rows: LedgerRow[] = []

    // 1. Booking inflows with liabilities
    for (const b of initialBookings) {
      const acompte = Number(b.acompte_paid) || 0
      const date = isoDate(b.actual_return_date || b.created_at || b.start_date)
      const v = b.vehicles as any
      const rawInstallments: Installment[] = Array.isArray(b.installments) ? b.installments : []
      const sortedInstallments = [...rawInstallments].sort((a, b) =>
        a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0
      )
      
      const localInstallments = sortedInstallments.map(inst => {
        if (settledInstallmentIds.includes(inst.id)) {
          return { ...inst, status: 'paid' as const }
        }
        return inst
      })

      const paidInstallmentsSum = localInstallments
        .filter(t => t.status === 'paid')
        .reduce((sum, item) => sum + Number(item.amount), 0)

      const totalAmount = Number(b.total_amount) || 0
      const collectedAmount = acompte + paidInstallmentsSum
      const remainingAmount = totalAmount - collectedAmount

      const installmentsUnpaidSum = localInstallments
        .filter(t => t.status === 'unpaid')
        .reduce((s, t) => s + Number(t.amount), 0)

      const extraLiability = remainingAmount - installmentsUnpaidSum

      if (extraLiability > 0.01 && remainingAmount > 0) {
        localInstallments.push({
          id: 'unpaid-liability-' + b.id,
          amount: extraLiability,
          due_date: date || TODAY,
          status: 'unpaid'
        })
      }

      const unpaidInstallments = localInstallments.filter(t => t.status === 'unpaid')
      const hasOverdue = unpaidInstallments.some(t => t.due_date < TODAY)
      const plate = buildPlateLabel(v)
      const modelLabel = buildVehicleLabel(v)
      const entityLabel = b.client_name || 'Client'
      const firstUnpaid = unpaidInstallments[0]

      rows.push({
        id: `booking-${b.id}`,
        date,
        type: 'inflow',
        category: 'rental_revenue',
        description: `Contract ledger · ${entityLabel}`,
        entity: entityLabel,
        vehicleLabel: modelLabel,
        licensePlate: plate,
        amount: collectedAmount,
        rawRef: 'booking',
        installments: localInstallments,
        totalOwed: remainingAmount,
        hasOverdue,
        contractKey: buildContractKey(b.id),
        collectedAmount,
        remainingAmount,
        settlementBookingId: b.id,
        settlementVehicleId: b.vehicle_id,
        settlementLineItemId: firstUnpaid?.id,
        clientPhone: (b as any).client_phone || '',
        driverDocsLabel: (b as any).client_license_number ? resolveDriverDocs((b as any).client_license_number) : resolveDriverDocs(undefined),
        vehicleId: b.vehicle_id,
        totalAmount,
        rawBooking: b,
        clients: b.clients,
      })
    }

    // 2. Expense + claim adjustments
    for (const e of initialExpenses) {
      const date = isoDate(e.created_at)
      const cat = e.category as string
      const isClaim = ['damage_repair', 'installment_tranche', 'late_return_penalty'].includes(cat)
      if (!isClaim) continue;
      const plate = buildPlateLabel(e.vehicles as any)
      const modelLabel = buildVehicleLabel(e.vehicles as any)
      const amount = Number(e.amount) || 0
      
      const isClaimSettled = locallySettledClaims.includes(`expense-${e.id}`)
      const collectedAmount = isClaim ? (isClaimSettled ? amount : 0) : amount
      const remainingAmount = isClaim ? (isClaimSettled ? 0 : amount) : 0

      rows.push({
        id: `expense-${e.id}`,
        date,
        type: isClaim ? 'inflow' : 'outflow',
        category: (cat in CATEGORY_META ? cat : isClaim ? cat as LedgerRow['category'] : 'other') as LedgerRow['category'],
        description: e.description || (isClaim ? `${getInfractionLabel(cat)} claim` : 'Expense entry'),
        entity: e.vehicles ? modelLabel : 'General',
        vehicleLabel: e.vehicles ? modelLabel : 'General',
        licensePlate: plate,
        amount,
        rawRef: isClaim ? 'claim' : 'expense',
        installments: [],
        totalOwed: isClaim ? (isClaimSettled ? 0 : amount) : 0,
        hasOverdue: false,
        contractKey: buildContractKey(e.id),
        collectedAmount,
        remainingAmount,
        clientPhone: (e as any).client_phone || '',
        driverDocsLabel: '',
        claimType: isClaim ? cat as LedgerRow['claimType'] : undefined,
        vehicleId: (e as any).vehicle_id || '',
      })
    }

    return rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  }, [initialBookings, initialExpenses, initialMaintenance, TODAY, settledInstallmentIds, locallySettledClaims])

  // ── Smart Filter (date string, "overdue", "due today") ────────────────────
  const filtered = useMemo(() => {
    const { from, to } = dateWindow
    const q = searchQuery.trim().toLowerCase()

    // Parse smart search keywords
    const isOverdueQuery  = q === 'overdue'
    const isDueTodayQuery = q === 'due today' || q === 'duetoday'
    // Detect YYYY-MM-DD date pattern
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const isDueDateSearch = datePattern.test(q)

    return allRows.filter(row => {
      const inWindow = row.date >= from && row.date <= to
      const typeMatch = typeFilter === 'all' || row.type === typeFilter

      // Flow filter match
      let flowMatch = true
      if (flowFilter === 'settled') {
        flowMatch = row.remainingAmount <= 0
      } else if (flowFilter === 'unpaid') {
        flowMatch = row.hasOverdue || row.remainingAmount > 0
      }

      if (!flowMatch) return false

      // Smart search intercept for installment-based queries
      if (isOverdueQuery) {
        return inWindow && typeMatch && (row.hasOverdue || row.remainingAmount > 0)
      }
      if (isDueTodayQuery) {
        return inWindow && typeMatch && row.installments.some(
          t => t.status === 'unpaid' && t.due_date === TODAY
        )
      }
      if (isDueDateSearch) {
        // Match rows whose installment due dates contain this date
        const hasMatchingTranche = row.installments.some(t => t.due_date === q)
        if (hasMatchingTranche) return inWindow && typeMatch
      }

      // Standard free-text search
      const searchMatch = !q ||
        row.description.toLowerCase().includes(q) ||
        row.entity.toLowerCase().includes(q) ||
        row.vehicleLabel.toLowerCase().includes(q) ||
        row.licensePlate.toLowerCase().includes(q) ||
        row.installments.some(t => t.due_date.includes(q))

      return inWindow && typeMatch && searchMatch
    })
  }, [allRows, dateWindow, typeFilter, flowFilter, searchQuery, TODAY])

  // ── KPI Computations ──────────────────────────────────────────────────────
  const totalInflow  = useMemo(() => filtered.filter(r => r.type === 'inflow').reduce((s, r) => s + r.amount, 0), [filtered])
  const totalOutflow = useMemo(() => filtered.filter(r => r.type === 'outflow').reduce((s, r) => s + r.amount, 0), [filtered])
  const netPosition  = totalInflow - totalOutflow

  // Aggregate receivables across visible rows
  const totalOwedInPeriod = useMemo(() =>
    filtered.filter(r => r.type === 'inflow').reduce((s, r) => s + r.totalOwed, 0),
    [filtered]
  )
  const overdueRowCount = useMemo(() =>
    filtered.filter(r => r.hasOverdue).length,
    [filtered]
  )

  // ── Expense-only for report modal ─────────────────────────────────────────
  const expensesOnly = useMemo(() => {
    const { from, to } = dateWindow
    return initialExpenses.filter(e => {
      const d = isoDate(e.created_at)
      return d >= from && d <= to
    })
  }, [initialExpenses, dateWindow])

  // ─── CRUD Handlers ────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addExpense(new FormData(e.currentTarget))
      setIsAddModalOpen(false)
      showToast('Expense logged successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to log expense.', 'error')
    }
    setLoading(false)
  }

  const handleCascade = async (row: LedgerRow) => {
    if (!row.settlementBookingId) return showToast('No booking attached to this row', 'error')
    const raw = collectAmounts[row.id] || ''
    const amount = Number(raw)
    if (!amount || amount <= 0) return showToast('Please enter a positive amount to cascade', 'info')
    setLoading(true)
    try {
      await updateBookingHistoricalDetails(row.settlementBookingId, row.settlementVehicleId || '', { amount_collected_now: amount })
      setCollectAmounts(prev => ({ ...prev, [row.id]: '' }))
      showToast(`Allocated ${amount.toFixed(2)} DT`, 'success')
      router.refresh()
    } catch (err: any) {
      console.error('Cascade error', err)
      showToast(err?.message || 'Failed to allocate payment', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTranche = async (bookingId: string, trancheId: string, currentStatus: 'paid' | 'unpaid') => {
    setTrancheActionLoading(trancheId)
    try {
      await toggleTrancheStatus(bookingId, trancheId, currentStatus)
      showToast(`Tranche status updated.`, 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err?.message || 'Failed to update tranche status', 'error')
    } finally {
      setTrancheActionLoading(null)
    }
  }

  const handleDrawerCascade = async (bookingId: string, rowId: string) => {
    const raw = collectAmounts[rowId + '-drawer'] || ''
    const amount = Number(raw)
    if (!amount || amount <= 0) return showToast('Please enter a positive amount to settle', 'info')
    setLoading(true)
    try {
      await settleBookingTrancheCascade(bookingId, amount)
      setCollectAmounts(prev => ({ ...prev, [rowId + '-drawer']: '' }))
      showToast(`Successfully cascaded ${amount.toFixed(2)} DT across tranches.`, 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err?.message || 'Failed to cascade settlement', 'error')
    } finally {
      setLoading(false)
    }
  }


  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingExpense) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('id', editingExpense.id)
    try {
      await updateExpense(formData)
      setEditingExpense(null)
      showToast('Expense updated successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update expense.', 'error')
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to permanently delete this expense record?',
      confirmLabel: 'Yes, Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteExpense(id)
      showToast('Expense record deleted.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense.', 'error')
    }
  }

  const handleClearOutstanding = async (row: LedgerRow) => {
    if (!row.settlementBookingId || !row.settlementLineItemId) {
      showToast('No outstanding installment selected for settlement.', 'error')
      return
    }
    setLoading(true)
    try {
      await clearOutstandingLedgerItem(row.settlementBookingId, row.settlementLineItemId)
      setSettledInstallmentIds(prev => Array.from(new Set([...prev, row.settlementLineItemId!])))
      showToast('Outstanding liability settled instantly.', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to mark the debt as collected.', 'error')
    }
    setLoading(false)
  }

  const handleMarkClaimSettled = (row: LedgerRow) => {
    setLocallySettledClaims(prev => Array.from(new Set([...prev, row.id])))
    showToast('Claim line marked collected.', 'success')
  }

  // ─── Expense Form ─────────────────────────────────────────────────────────
  const ExpenseForm = ({ defaultValues, onSubmit, submitLabel }: {
    defaultValues?: any
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    submitLabel: string
  }) => {
    const [infractionType, setInfractionType] = useState(defaultValues?.claimType || '')
    const [amount, setAmount] = useState(defaultValues?.amount || '')
    const [targetLiability, setTargetLiability] = useState(defaultValues?.amount || '')

    // Keep them synced if infraction is chosen
    useEffect(() => {
      if (infractionType) {
        setAmount(targetLiability)
      }
    }, [infractionType, targetLiability])

    return (
      <form onSubmit={onSubmit} className="modal-form">
        <div className="form-group">
          <label>Claim / Infraction Type</label>
          <select
            name="infraction_type"
            className="form-input"
            value={infractionType}
            onChange={(e) => setInfractionType(e.target.value)}
          >
            <option value="">None (Standard Expense)</option>
            <option value="damage_repair">🔧 Damage Repair</option>
            <option value="installment_tranche">💳 Installment Tranche</option>
            <option value="late_return_penalty">⏰ Late Return Penalty</option>
          </select>
        </div>

        {!infractionType ? (
          <div className="form-group">
            <label>Category</label>
            <select name="category" required className="form-input" defaultValue={defaultValues?.category || 'fuel'}>
              <option value="fuel">⛽ Fuel</option>
              <option value="maintenance">🛠️ Maintenance</option>
              <option value="insurance">🛡️ Insurance</option>
              <option value="cleaning">🧹 Cleaning</option>
              <option value="other">📋 Other</option>
            </select>
          </div>
        ) : (
          <div className="form-group">
            <label>Target Liability Amount (DT)</label>
            <input
              type="number"
              name="target_liability_amount"
              placeholder="0.00"
              className="form-input"
              min="0"
              step="0.01"
              value={targetLiability}
              onChange={(e) => setTargetLiability(e.target.value)}
              required
            />
            {/* Hidden input to satisfy amount field on server */}
            <input type="hidden" name="amount" value={amount} />
          </div>
        )}

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            name="description"
            placeholder={infractionType ? "e.g. Broken side mirror claim" : "e.g. Weekly car wash"}
            className="form-input"
            defaultValue={defaultValues?.description || ''}
            required
          />
        </div>

        <div className="form-row">
          {!infractionType && (
            <div className="form-group">
              <label>Amount (DT)</label>
              <input
                type="number"
                name="amount"
                required
                placeholder="50"
                min="0"
                step="0.01"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
          <div className="form-group">
            <label>Link to Vehicle (Optional)</label>
            <select name="vehicle_id" className="form-input" defaultValue={defaultValues?.vehicleId || defaultValues?.vehicle_id || ''}>
              <option value="">-- General Expense --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setEditingExpense(null) }}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            <span>{submitLabel}</span>
          </button>
        </div>
      </form>
    )
  }

  const presetLabels: Record<DatePreset, string> = {
    today: 'Today', week: 'This Week', month: 'This Month', custom: 'Custom Range',
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="header-section">
        <div className="header-title-row">
          <div>
            <h1 className="page-title">Rental Inflows Hub</h1>
            <p className="subtitle">Track incoming payments, client cash collections, and unpaid tranches.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
            <button className="btn-secondary" onClick={() => setIsReportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} /><span>Export PDF</span>
            </button>
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} /><span>Log Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Temporal Filter Bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem',
        background: 'rgba(10,8,7,0.7)',
        border: '1px solid rgba(229,193,125,0.12)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {(['today', 'week', 'month', 'custom'] as DatePreset[]).map(p => (
          <button key={p} onClick={() => setPreset(p)} style={{
            padding: '0.55rem 1.2rem', borderRadius: '8px', border: '1px solid',
            borderColor: preset === p ? 'rgba(229,193,125,0.4)' : 'transparent',
            background: preset === p ? 'linear-gradient(135deg,rgba(229,193,125,0.18),rgba(197,160,89,0.1))' : 'transparent',
            color: preset === p ? 'var(--accent-gold)' : 'rgba(229,193,125,0.5)',
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-body)',
          }}>
            {presetLabels[p]}
          </button>
        ))}

        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.5)' }}>From</span>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPreset('custom') }} style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '6px',
              color: '#fff', padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark', outline: 'none',
            }} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.5)' }}>To</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPreset('custom') }} style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '6px',
              color: '#fff', padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark', outline: 'none',
            }} />
            {(customFrom || customTo) && (
              <button
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(229,193,125,0.7)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.2rem',
                }}
                title="Clear dates"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(229,193,125,0.4)', paddingRight: '0.5rem' }}>
          {filtered.length} transactions
          {overdueRowCount > 0 && (
            <span style={{ marginLeft: '0.6rem', color: '#f87171', fontWeight: 700 }}>
              · {overdueRowCount} overdue
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(16,185,129,0.05)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#10b981,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(16,185,129,0.7)', fontWeight: 700 }}>Total Rental Inflows</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#10b981', letterSpacing: '-0.02em' }}>
            +{totalInflow.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {filtered.length} inflow transactions
          </div>
        </div>

        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(239,68,68,0.05)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#ef4444,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(239,68,68,0.7)', fontWeight: 700 }}>Unpaid Tranches / Debt</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#ef4444', letterSpacing: '-0.02em' }}>
            {totalOwedInPeriod.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            <span style={{ color: overdueRowCount > 0 ? '#ef4444' : 'inherit' }}>
              {overdueRowCount > 0 && <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />}
              {overdueRowCount} contracts with overdue tranches
            </span>
          </div>
        </div>
      </div>

      
      {/* ── Rental Inflows Filter Ribbon ── */}
      <div style={{
        display: 'flex',
        gap: '0.6rem',
        overflowX: 'auto',
        padding: '0.4rem 0.2rem',
        marginBottom: '1.25rem',
        scrollbarWidth: 'none',
      }} className="no-print">
        {[
          { key: 'all', label: 'All Inflows', emoji: '📊', color: 'var(--accent-gold)' },
          { key: 'settled', label: 'Fully Settled', emoji: '🟢', color: '#10b981' },
          { key: 'unpaid', label: 'Unpaid/Overdue', emoji: '🔴', color: '#ef4444' }
        ].map(item => {
          const active = flowFilter === item.key
          return (
            <button
              key={item.key}
              onClick={() => setFlowFilter(item.key as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.15rem',
                borderRadius: '999px',
                border: active ? `1px solid ${item.color}` : '1px solid rgba(229,193,125,0.12)',
                background: active
                  ? `linear-gradient(135deg, ${item.color}1e, ${item.color}0a)`
                  : 'rgba(10,8,7,0.4)',
                color: active ? item.color : 'rgba(229,193,125,0.6)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                boxShadow: active ? `0 0 12px ${item.color}25` : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Search Bar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>

        <div style={{ flex: 1, position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(229,193,125,0.4)' }} />
          <input
            type="text"
            placeholder='Search · "overdue" · "due today" · YYYY-MM-DD · client · plate'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'rgba(229,193,125,0.4)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
            >×</button>
          )}
        </div>
        </div>

      {/* ── Daily Chronological Inflow Ledger (Phase 17c) ─────────────────── */}
      {/* Each booking row is EXPLODED into atomic PaymentEvent objects:
            1) one event for the acompte (paid at booking creation date)
            2) one event per installment (paid_date if paid, due_date if not)
            3) one event for the synthetic "unpaid-liability-*" balance (Solde)
          Events are then grouped by YYYY-MM-DD.

          IMPORTANT: we source from `allRows` (NOT `filtered`) because the
          parent-level date window in `filtered` uses the booking's row.date
          (start/created/return) — which would hide a booking entirely if
          its tranche was paid in a different month than the booking's date.
          Date window is applied PER EVENT below so "This Month" means
          "cash collected this month" regardless of when the booking opened. */}
      {(() => {
        type PaymentEvent = {
          id: string
          date: string                                         // YYYY-MM-DD
          amount: number
          kind: 'acompte' | 'tranche' | 'solde' | 'expense'
          trancheLabel: string                                 // "Acompte Initial" / "Tranche 1/2" / "Solde"
          status: 'paid' | 'unpaid' | 'overdue'
          parentRow: typeof allRows[number]
        }

        // Parent-level filters (flow, type, search) — same predicates as the
        // existing `filtered` useMemo but WITHOUT the date window.
        const q = searchQuery.trim().toLowerCase()
        const isOverdueQuery = q === 'overdue'
        const isDueTodayQuery = q === 'due today' || q === 'duetoday'
        const isDueDateSearch = /^\d{4}-\d{2}-\d{2}$/.test(q)

        const parentFiltered = allRows.filter(row => {
          if (typeFilter !== 'all' && row.type !== typeFilter) return false
          if (flowFilter === 'settled' && row.remainingAmount > 0) return false
          if (flowFilter === 'unpaid' && !(row.hasOverdue || row.remainingAmount > 0)) return false

          if (isOverdueQuery) return row.hasOverdue || row.remainingAmount > 0
          if (isDueTodayQuery) return row.installments.some(t => t.status === 'unpaid' && t.due_date === TODAY)
          if (isDueDateSearch) return row.installments.some(t => t.due_date === q) || row.date === q
          if (!q) return true
          return (
            row.description.toLowerCase().includes(q) ||
            row.entity.toLowerCase().includes(q) ||
            row.vehicleLabel.toLowerCase().includes(q) ||
            row.licensePlate.toLowerCase().includes(q) ||
            row.installments.some(t => t.due_date.includes(q))
          )
        })

        const events: PaymentEvent[] = []
        for (const row of parentFiltered) {
          // Inflow expenses (rare) — passthrough as single event
          if (row.type !== 'inflow') continue
          if (row.rawRef !== 'booking' || !row.rawBooking) {
            events.push({
              id: row.id,
              date: (row.date || '').split('T')[0] || row.date,
              amount: row.amount,
              kind: 'expense',
              trancheLabel: 'Inflow',
              status: 'paid',
              parentRow: row,
            })
            continue
          }

          const b: any = row.rawBooking
          const acompte = Number(b.acompte_paid) || 0
          const acompteRawDate = b.acompte_paid_date || b.created_at || b.start_date || row.date
          const acompteDate = (acompteRawDate || '').split('T')[0] || row.date

          // 1. Acompte event
          if (acompte > 0) {
            events.push({
              id: `${row.id}__acompte`,
              date: acompteDate,
              amount: acompte,
              kind: 'acompte',
              trancheLabel: 'Acompte Initial',
              status: 'paid',
              parentRow: row,
            })
          }

          // 2. Installment events — exclude the synthetic "Solde" row; handle separately
          const realInstallments = (row.installments || []).filter(t => !String(t.id).startsWith('unpaid-liability-'))
          const totalCount = realInstallments.length
          realInstallments.forEach((inst, idx) => {
            const trancheLabel = `Tranche ${idx + 1}/${totalCount}`
            const isPaid = inst.status === 'paid'
            const dateField = isPaid ? (inst.paid_date || inst.due_date) : inst.due_date
            const date = (dateField || row.date).split('T')[0] || row.date
            const status: 'paid' | 'unpaid' | 'overdue' = isPaid
              ? 'paid'
              : (inst.due_date && inst.due_date < TODAY ? 'overdue' : 'unpaid')

            events.push({
              id: `${row.id}__inst_${inst.id}`,
              date,
              amount: Number(inst.amount) || 0,
              kind: 'tranche',
              trancheLabel,
              status,
              parentRow: row,
            })
          })

          // 3. Synthetic Solde (remaining contract balance not covered by tranches)
          const solde = (row.installments || []).find(t => String(t.id).startsWith('unpaid-liability-'))
          if (solde) {
            const date = (solde.due_date || row.date).split('T')[0] || row.date
            const status: 'paid' | 'unpaid' | 'overdue' = solde.due_date && solde.due_date < TODAY ? 'overdue' : 'unpaid'
            events.push({
              id: `${row.id}__solde`,
              date,
              amount: Number(solde.amount) || 0,
              kind: 'solde',
              trancheLabel: 'Solde',
              status,
              parentRow: row,
            })
          }
        }

        // Apply date-window AND flow-filter at event level — daily totals must
        // reflect ONLY visible events. The date window matches event.date (when
        // cash was collected / when payment is due) instead of parent.date.
        const { from: winFrom, to: winTo } = dateWindow
        const visibleEvents = events.filter(ev => {
          if (ev.date < winFrom || ev.date > winTo) return false
          if (flowFilter === 'settled') return ev.status === 'paid'
          if (flowFilter === 'unpaid') return ev.status !== 'paid'
          return true
        })

        // Count events the date window hid so the empty state can offer a
        // one-click widening when the operator's data is real but out-of-range.
        const eventsOutsideWindow = events.length - visibleEvents.length
        const totalEventsExist = events.length > 0

        if (visibleEvents.length === 0) {
          // Smart empty state: if events exist outside the window, offer a
          // one-click widening so the operator isn't left wondering whether
          // the data is missing or just out-of-range.
          return (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'rgba(229,193,125,0.35)', marginBottom: '2rem', borderRadius: '14px' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📊</span>
              {totalEventsExist ? (
                <>
                  <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    No cash inflows in the current date range.
                  </p>
                  <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                    You have <strong style={{ color: '#E5C17D' }}>{eventsOutsideWindow}</strong> inflow event{eventsOutsideWindow > 1 ? 's' : ''} outside this window
                    {flowFilter !== 'all' ? <> (filter: <em style={{ color: '#E5C17D' }}>{flowFilter === 'settled' ? 'Fully Settled' : 'Unpaid/Overdue'}</em>)</> : null}.
                  </p>
                  <button
                    onClick={() => {
                      setCustomFrom('2024-01-01')
                      setCustomTo(TODAY)
                      setPreset('custom')
                    }}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, #c5a059, #e5c17d)',
                      border: 'none',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      boxShadow: '0 4px 14px rgba(229,193,125,0.3)',
                    }}
                  >
                    Show all inflows ever →
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>No inflows recorded yet.</p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.24)' }}>
                    Create a booking with an acompte or scheduled tranches and they will surface here.
                  </p>
                </>
              )}
            </div>
          )
        }

        // Group by ISO date — newest day first
        const groups: Record<string, PaymentEvent[]> = {}
        visibleEvents.forEach(ev => {
          if (!groups[ev.date]) groups[ev.date] = []
          groups[ev.date].push(ev)
        })
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            {sortedKeys.map((dateKey) => {
              const dayEvents = groups[dateKey]
              const dailyInflow = dayEvents.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)
              const dailyPending = dayEvents.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0)
              const localized = (() => {
                try {
                  const d = new Date(dateKey + 'T00:00:00')
                  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                } catch { return dateKey }
              })()

              return (
                <div
                  key={dateKey}
                  className="glass-panel"
                  style={{
                    padding: '1.25rem 1.35rem',
                    borderRadius: '14px',
                    border: '1px solid rgba(229,193,125,0.12)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 0 1px rgba(229,193,125,0.08)',
                  }}
                >
                  {/* Header matrix */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: '0.75rem',
                    marginBottom: '1rem', paddingBottom: '0.85rem',
                    borderBottom: '1px dashed rgba(229,193,125,0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ae9260', boxShadow: '0 0 10px rgba(229,193,125,0.6)' }} />
                      <Calendar size={14} style={{ color: '#ae9260' }} />
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', letterSpacing: '0.01em', textTransform: 'capitalize' }}>
                        {localized}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginLeft: '0.25rem' }}>
                        · {dayEvents.length} transaction{dayEvents.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
                      {dailyPending > 0 && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.32rem 0.7rem', borderRadius: '999px',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          color: '#f87171', fontSize: '0.78rem', fontWeight: 700,
                        }}>
                          <Clock size={11} />
                          <span>Pending: {dailyPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT</span>
                        </div>
                      )}
                      {dailyInflow > 0 && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                          padding: '0.4rem 0.85rem', borderRadius: '999px',
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)',
                          color: '#34d399', fontSize: '0.82rem', fontWeight: 800,
                          letterSpacing: '0.02em',
                          boxShadow: '0 0 14px rgba(16,185,129,0.18), inset 0 0 4px rgba(16,185,129,0.05)',
                        }}>
                          <TrendingUp size={13} />
                          <span style={{ opacity: 0.85 }}>Total Daily Inflow:</span>
                          <span>+{dailyInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Itemized event rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {dayEvents.map((ev) => {
                      const row = ev.parentRow
                      const isPaid = ev.status === 'paid'
                      const isOverdue = ev.status === 'overdue'
                      const tone = isPaid ? '#34d399' : isOverdue ? '#f87171' : 'rgba(229,193,125,0.85)'
                      const toneBg = isPaid
                        ? 'rgba(16,185,129,0.05)'
                        : isOverdue ? 'rgba(239,68,68,0.05)'
                        : 'rgba(255,255,255,0.02)'
                      const toneBorder = isPaid
                        ? 'rgba(16,185,129,0.15)'
                        : isOverdue ? 'rgba(239,68,68,0.18)'
                        : 'rgba(255,255,255,0.04)'

                      const kindIcon = ev.kind === 'acompte' ? '💰' : ev.kind === 'solde' ? '⚖️' : '🧩'
                      const phoneMasked = row.clientPhone
                        ? (row.clientPhone.length > 6 ? row.clientPhone.replace(/(\d{4})(\d+)(\d{3})$/, '$1····$3') : row.clientPhone)
                        : ''

                      return (
                        <div
                          key={ev.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(280px, 1.6fr) minmax(180px, 1fr) minmax(180px, 0.9fr)',
                            gap: '1rem',
                            padding: '0.85rem 1rem',
                            background: toneBg,
                            border: `1px solid ${toneBorder}`,
                            borderRadius: '10px',
                            alignItems: 'center',
                          }}
                        >
                          {/* ── Column A — Client & Fleet Node Identity ── */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            {/* Client block */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(229,193,125,0.3), rgba(255,255,255,0.05))',
                                border: '1px solid rgba(229,193,125,0.3)',
                                display: 'grid', placeItems: 'center',
                                color: '#fff', fontWeight: 800, fontSize: '0.78rem',
                                flexShrink: 0,
                              }}>
                                {getInitials(row.entity)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{
                                  fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  maxWidth: '170px',
                                }} title={row.entity}>
                                  {row.entity}
                                </div>
                                {phoneMasked && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.1rem',
                                  }} title={row.clientPhone}>
                                    <Phone size={9} />
                                    <span>{phoneMasked}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Vehicle block */}
                            {row.licensePlate ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'stretch',
                                  width: 'fit-content',
                                  background: 'linear-gradient(180deg, #1f1f1f 0%, #111 100%)',
                                  border: '1.5px solid rgba(229,193,125,0.3)',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontFamily: "'Courier New', Courier, monospace",
                                  fontWeight: 800,
                                  color: '#fff',
                                  overflow: 'hidden',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                }}>
                                  <div style={{
                                    background: 'linear-gradient(135deg, #c5a059, #e5c17d)',
                                    color: '#000',
                                    padding: '0.18rem 0.45rem',
                                    fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.05em',
                                    display: 'grid', placeItems: 'center',
                                  }}>TN</div>
                                  <div style={{
                                    padding: '0.18rem 0.55rem',
                                    letterSpacing: '0.05em',
                                    textShadow: '0 0 4px rgba(255,255,255,0.2)',
                                    display: 'grid', placeItems: 'center',
                                  }}>{row.licensePlate}</div>
                                </div>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                  fontSize: '0.66rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600,
                                }}>
                                  <CarIcon size={9} />
                                  <span>{row.vehicleLabel}</span>
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>No vehicle linked</span>
                            )}
                          </div>

                          {/* ── Column B — Tranche / Payment segment ── */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.3rem 0.7rem', borderRadius: '999px',
                              background: ev.kind === 'acompte'
                                ? 'linear-gradient(135deg, rgba(229,193,125,0.15), rgba(229,193,125,0.05))'
                                : ev.kind === 'solde'
                                  ? 'rgba(251,191,36,0.1)'
                                  : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${ev.kind === 'acompte'
                                ? 'rgba(229,193,125,0.35)'
                                : ev.kind === 'solde'
                                  ? 'rgba(251,191,36,0.3)'
                                  : 'rgba(229,193,125,0.18)'}`,
                              color: ev.kind === 'acompte' ? '#E5C17D' : ev.kind === 'solde' ? '#fbbf24' : 'rgba(229,193,125,0.95)',
                              fontSize: '0.72rem', fontWeight: 700,
                              width: 'fit-content',
                            }}>
                              <span>{kindIcon}</span>
                              <span>{ev.trancheLabel}</span>
                            </div>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.2rem 0.55rem', borderRadius: '999px',
                              background: isPaid ? 'rgba(16,185,129,0.1)' : isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.08)',
                              border: `1px solid ${isPaid ? 'rgba(16,185,129,0.25)' : isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.22)'}`,
                              color: tone,
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em',
                              width: 'fit-content',
                            }}>
                              {isPaid ? '🟢 PAID' : isOverdue ? '🔴 OVERDUE' : '⚪ PENDING'}
                            </div>
                          </div>

                          {/* ── Column C — Financial Balance Ledger ── */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span style={{
                              color: tone,
                              fontWeight: 800,
                              fontSize: '1.05rem',
                              letterSpacing: '-0.01em',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              textShadow: isPaid ? '0 0 12px rgba(16,185,129,0.25)' : 'none',
                            }}>
                              {isPaid ? '+' : ''}{ev.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
                            </span>
                            <span style={{
                              fontSize: '0.62rem', color: 'rgba(229,193,125,0.55)',
                              fontFamily: 'monospace', letterSpacing: '0.04em',
                            }}>
                              {row.contractKey}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}


      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Log New Expense</h2>
              <button className="icon-btn" onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
            </div>
            <ExpenseForm onSubmit={handleAdd} submitLabel="Add Expense" />
          </div>
        </div>
      )}

      {editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Edit Expense</h2>
              <button className="icon-btn" onClick={() => setEditingExpense(null)}><X size={20} /></button>
            </div>
            <ExpenseForm defaultValues={editingExpense} onSubmit={handleEdit} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      <QuickEditBookingModal
        booking={editingBooking}
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
        vehiclePricePerDay={editingBooking?.vehicles?.price_per_day}
      />

      {isReportOpen && (
        <ExpenseReportModal
          expenses={expensesOnly}
          businessSettings={businessSettings}
          onClose={() => setIsReportOpen(false)}
          filters={{ category: 'All', vehicle: 'All Vehicles', searchQuery }}
          stats={{
            thisMonth: expensesOnly.reduce((s, e) => s + Number(e.amount || 0), 0),
            overall: initialExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
            filtered: expensesOnly.reduce((s, e) => s + Number(e.amount || 0), 0),
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media print {
          .sidebar,.topbar,.sidebar-overlay,.no-print,.no-print *,
          .modal-overlay:not(.print-report-container),button { display:none!important; }
          .layout-container,.main-content,.content-area,.dashboard-page {
            display:block!important;background:#fff!important;background-image:none!important;
            box-shadow:none!important;border:none!important;margin:0!important;padding:0!important;
            width:100%!important;max-width:100%!important;min-height:0!important;height:auto!important;
          }
          html,body{background:#fff!important;color:#000!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;}
          @page{size:A4 portrait;margin:8mm 12mm!important;}
          .print-report-container{position:absolute!important;left:0!important;top:0!important;
            width:100%!important;height:auto!important;margin:0!important;padding:0!important;
            background:#fff!important;box-shadow:none!important;border:none!important;display:block!important;z-index:99999!important;}
        }
      ` }} />
    </div>
  )
}
