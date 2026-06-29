'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, X, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Landmark,
  Search, FileText, AlertCircle, Clock, Star, ShieldAlert as ShieldAlertIcon, Calendar
} from 'lucide-react'
import { addExpense, updateExpense, deleteExpense, clearOutstandingLedgerItem, updateBookingHistoricalDetails, toggleTrancheStatus, settleBookingTrancheCascade } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import ExpenseReportModal from './components/ExpenseReportModal'
import QuickEditBookingModal from '@/app/dashboard/vehicles/[id]/history/components/QuickEditBookingModal'
import { BusinessSettings } from '@/types'
import { calculateTrustScore } from '@/lib/trustScore'
import { useLanguage } from '@/lib/i18n'
import ModalPortal from '@/components/ModalPortal'

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
  createdAt: string
  type: 'inflow' | 'outflow'
  category: 'rental_revenue' | 'maintenance' | 'fuel' | 'insurance' | 'cleaning' | 'incident' | 'other' | 'damage_repair' | 'installment_tranche' | 'late_return_penalty' | 'loyer' | 'electricite' | 'eau' | 'connexion' | 'gps_puce' | 'salaires'
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
  maintenance_id?: string | null  // non-null = system-managed mirrored expense
}

type DatePreset = 'today' | 'week' | 'month' | 'all' | 'custom'

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

function buildVehicleLabel(v?: { brand?: string; model?: string; license_plate?: string; year?: number | string } | null): string {
  if (!v) return 'General'
  const name = [v.brand, v.model].filter(Boolean).join(' ')
  const yearStr = v.year ? ` (${v.year})` : ''
  return name ? `${name}${yearStr}` : 'Vehicle'
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

function getInfractionLabel(type?: string, lang?: 'fr' | 'en') {
  if (lang === 'fr') {
    switch (type) {
      case 'damage_repair': return 'Réparation de Dégâts'
      case 'installment_tranche': return 'Tranche de Paiement'
      case 'late_return_penalty': return 'Pénalité de Retard'
      default: return 'Réclamation Opérationnelle'
    }
  }
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
        <span style={{ fontSize: '0.72rem', color: '#ffb3b3', fontWeight: 600 }}>
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
        <span style={{ fontSize: '0.72rem', color: '#ffd1d7', fontWeight: 600 }}>
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
        <span style={{ fontSize: '0.72rem', color: '#fde68a', fontWeight: 600 }}>
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
        <span style={{ fontSize: '0.72rem', color: '#bfdbfe', fontWeight: 600 }}>
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
        <span style={{ fontSize: '0.72rem', color: '#a7f3d0', fontWeight: 600 }}>
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
      <span style={{ fontSize: '0.72rem', color: '#fdf6e2', fontWeight: 600 }}>
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
  // General overhead categories
  loyer:          { label: 'Loyer / Bureau',      emoji: '🏠', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  electricite:    { label: 'Électricité',         emoji: '⚡', color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.3)' },
  eau:            { label: 'Eau',                 emoji: '💧', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.3)' },
  connexion:      { label: 'Connexion / Internet',emoji: '📡', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
  gps_puce:       { label: 'GPS / Puce',          emoji: '🛰️', color: '#818cf8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.25)' },
  salaires:       { label: 'Salaires / Personnel',emoji: '👤', color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)' },
  other:          { label: 'Other',               emoji: '📋', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  damage_repair:       { label: 'Réparation Dégâts',   emoji: '🔧', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  installment_tranche: { label: 'Tranche Paiement',    emoji: '💳', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  late_return_penalty: { label: 'Pénalité Retard',     emoji: '⏰', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.3)' },
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
  clients?: any
  vehicle_id?: string | null
}

interface MaintenanceInput {
  id: string
  service_date?: string
  created_at?: string
  description?: string
  cost?: number | string
  vehicles?: any
  vehicle_id?: string | null
}

export default function ExpensesClient({
  initialExpenses,
  initialMaintenance,
  initialBookings,
  vehicles,
  clients,
  businessSettings,
  legalDocs = [],
}: {
  initialExpenses: ExpenseInput[]
  initialMaintenance: MaintenanceInput[]
  initialBookings: BookingInput[]
  vehicles: any[]
  clients: any[]
  businessSettings: BusinessSettings | null
  legalDocs?: { vehicle_id: string; doc_type: string; expiry_date: string }[]
}) {
  const { showToast } = useToast()
  const { t, lang } = useLanguage()
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
  const [flowFilter, setFlowFilter]         = useState<string>('all')
  const [expandedRowId, setExpandedRowId]   = useState<string | null>(null)
  const [trancheActionLoading, setTrancheActionLoading] = useState<string | null>(null)
  const router = useRouter()

  // ── Temporal Filter ───────────────────────────────────────────────────────
  const [preset, setPreset]       = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')

  // ── Search + Type Filter ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | 'inflow' | 'outflow'>('all')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')

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
    if (preset === 'all') {
      return { from: '2000-01-01', to: '2999-12-31' }
    }
    return { from: customFrom || '2000-01-01', to: customTo || TODAY }
  }, [preset, customFrom, customTo, TODAY])

  // ── Build Unified Ledger (with installments) ──────────────────────────────
  const allRows = useMemo<LedgerRow[]>(() => {
    const rows: LedgerRow[] = []

    // 1. Booking inflows with liabilities (REMOVED - THIS IS FLEET EXPENSES, NOT RENTAL INFLOWS)

    // 2. Expense + claim adjustments
    for (const e of initialExpenses) {
      const date = isoDate(e.created_at)
      const cat = e.category as string
      const isClaim = ['damage_repair', 'installment_tranche', 'late_return_penalty'].includes(cat)
      const plate = buildPlateLabel(e.vehicles as any)
      const modelLabel = buildVehicleLabel(e.vehicles as any)
      const amount = Number(e.amount) || 0
      
      const isClaimSettled = locallySettledClaims.includes(`expense-${e.id}`)
      const collectedAmount = isClaim ? (isClaimSettled ? amount : 0) : amount
      const remainingAmount = isClaim ? (isClaimSettled ? 0 : amount) : 0

      // Resolve client from the clients prop (FK join is not available in schema cache)
      const clientId = (e as any).client_id as string | null | undefined
      const resolvedClient = clientId ? clients.find(c => c.id === clientId) ?? null : null

      // Map pure vendor entity context
      let vendorEntity = e.description || 'Administrative Clearing'
      if (cat === 'insurance') vendorEntity = e.description && e.description.includes('COMAR') ? e.description : 'COMAR Assurances | Pol-984372'
      if (cat === 'maintenance') vendorEntity = e.description || 'Speedy Motors Workshop'
      if (cat === 'fuel') vendorEntity = e.description || 'Agil Kiosk / Shell Station'

      rows.push({
        id: `expense-${e.id}`,
        date,
        createdAt: e.created_at || date || TODAY,
        type: isClaim ? 'inflow' : 'outflow',
        category: (cat in CATEGORY_META ? cat : isClaim ? cat as LedgerRow['category'] : 'other') as LedgerRow['category'],
        description: e.description || (isClaim ? (lang === 'fr' ? `Réclamation ${getInfractionLabel(cat, lang).toLowerCase()}` : `${getInfractionLabel(cat, lang)} claim`) : (lang === 'fr' ? 'Entrée de dépense' : 'Expense entry')),
        entity: vendorEntity,
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
        clients: resolvedClient,
        maintenance_id: (e as any).maintenance_id || null,
      })
    }

    // 3. Maintenance outflows (preventing double listing of synced maintenance)
    for (const m of initialMaintenance) {
      const isRepresented = initialExpenses.some(e => 
        e.vehicle_id === m.vehicle_id && 
        Number(e.amount) === Number(m.cost) && 
        e.category === 'maintenance'
      )
      if (isRepresented) continue

      const date = isoDate(m.service_date || m.created_at)
      const v = m.vehicles as any
      const plate = buildPlateLabel(v)
      const modelLabel = buildVehicleLabel(v)
      rows.push({
        id: `maintenance-${m.id}`,
        date,
        createdAt: m.created_at || date || TODAY,
        type: 'outflow',
        category: 'maintenance',
        description: m.description || (lang === 'fr' ? 'Service d\'entretien' : 'Maintenance Service'),
        entity: m.description || (lang === 'fr' ? 'Garage Speedy Motors' : 'Speedy Motors Workshop'),
        vehicleLabel: v ? modelLabel : 'Vehicle',
        licensePlate: plate,
        amount: Number(m.cost) || 0,
        rawRef: 'maintenance',
        installments: [],
        totalOwed: 0,
        hasOverdue: false,
        contractKey: buildContractKey(m.id),
        collectedAmount: 0,
        remainingAmount: 0,
        clientPhone: '',
        driverDocsLabel: '',
        vehicleId: (m as any).vehicle_id || '',
      })
    }

    // Sort by event date descending, then by creation date descending to ensure strict newest-first chronological order
    return rows.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [initialBookings, initialExpenses, initialMaintenance, TODAY, settledInstallmentIds, locallySettledClaims, lang])

  // ── Category Counts (based on active date/type/search query/vehicle, but not category filter) ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const { from, to } = dateWindow
    const q = searchQuery.trim().toLowerCase()
    const isOverdueQuery  = q === 'overdue'
    const isDueTodayQuery = q === 'due today' || q === 'duetoday'
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const isDueDateSearch = datePattern.test(q)

    allRows.forEach(row => {
      const inWindow = row.date >= from && row.date <= to
      const typeMatch = typeFilter === 'all' || row.type === typeFilter

      // Vehicle filter match
      let vehicleMatch = true
      if (selectedVehicleId === 'company') {
        vehicleMatch = !row.vehicleId
      } else if (selectedVehicleId !== 'all') {
        vehicleMatch = row.vehicleId === selectedVehicleId
      }

      let smartMatch = true
      if (isOverdueQuery) {
        smartMatch = row.hasOverdue || row.remainingAmount > 0
      } else if (isDueTodayQuery) {
        smartMatch = row.installments.some(t => t.status === 'unpaid' && t.due_date === TODAY)
      } else if (isDueDateSearch) {
        smartMatch = row.installments.some(t => t.due_date === q)
      } else {
        smartMatch = !q ||
          row.description.toLowerCase().includes(q) ||
          row.entity.toLowerCase().includes(q) ||
          row.vehicleLabel.toLowerCase().includes(q) ||
          row.licensePlate.toLowerCase().includes(q) ||
          row.installments.some(t => t.due_date.includes(q))
      }

      if (inWindow && typeMatch && vehicleMatch && smartMatch) {
        counts[row.category] = (counts[row.category] || 0) + 1
      }
    })
    return counts
  }, [allRows, dateWindow, typeFilter, searchQuery, selectedVehicleId, TODAY])

  // ── Smart Filter (date string, "overdue", "due today", vehicle filter) ────────────────────
  const filtered = useMemo(() => {
    const { from, to } = dateWindow
    const q = searchQuery.trim().toLowerCase()

    // Parse smart search keywords
    const isOverdueQuery  = q === 'overdue'
    const isDueTodayQuery = q === 'due today' || q === 'duetoday'
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const isDueDateSearch = datePattern.test(q)

    return allRows.filter(row => {
      const inWindow = row.date >= from && row.date <= to
      const typeMatch = typeFilter === 'all' || row.type === typeFilter

      // Category filter match
      const flowMatch = flowFilter === 'all' || row.category === flowFilter

      if (!flowMatch) return false

      // Vehicle filter match
      let vehicleMatch = true
      if (selectedVehicleId === 'company') {
        vehicleMatch = !row.vehicleId
      } else if (selectedVehicleId !== 'all') {
        vehicleMatch = row.vehicleId === selectedVehicleId
      }

      if (!vehicleMatch) return false

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
  }, [allRows, dateWindow, typeFilter, flowFilter, searchQuery, selectedVehicleId, TODAY])

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
      showToast(lang === 'fr' ? 'Dépense enregistrée avec succès !' : 'Expense logged successfully!', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || (lang === 'fr' ? 'Échec de l\'enregistrement de la dépense.' : 'Failed to log expense.'), 'error')
    }
    setLoading(false)
  }

  const handleCascade = async (row: LedgerRow) => {
    if (!row.settlementBookingId) return showToast(lang === 'fr' ? 'Aucune réservation associée à cette ligne' : 'No booking attached to this row', 'error')
    const raw = collectAmounts[row.id] || ''
    const amount = Number(raw)
    if (!amount || amount <= 0) return showToast(lang === 'fr' ? 'Veuillez saisir un montant positif' : 'Please enter a positive amount to cascade', 'info')
    setLoading(true)
    try {
      await updateBookingHistoricalDetails(row.settlementBookingId, row.settlementVehicleId || '', { amount_collected_now: amount })
      setCollectAmounts(prev => ({ ...prev, [row.id]: '' }))
      showToast(lang === 'fr' ? `Alloué ${amount.toFixed(2)} DT` : `Allocated ${amount.toFixed(2)} DT`, 'success')
      router.refresh()
    } catch (err: any) {
      console.error('Cascade error', err)
      showToast(err?.message || (lang === 'fr' ? 'Échec de l\'allocation du paiement' : 'Failed to allocate payment'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTranche = async (bookingId: string, trancheId: string, currentStatus: 'paid' | 'unpaid') => {
    setTrancheActionLoading(trancheId)
    try {
      await toggleTrancheStatus(bookingId, trancheId, currentStatus)
      showToast(lang === 'fr' ? 'Statut de la tranche mis à jour.' : 'Tranche status updated.', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err?.message || (lang === 'fr' ? 'Échec de la mise à jour du statut de la tranche' : 'Failed to update tranche status'), 'error')
    } finally {
      setTrancheActionLoading(null)
    }
  }

  const handleDrawerCascade = async (bookingId: string, rowId: string) => {
    const raw = collectAmounts[rowId + '-drawer'] || ''
    const amount = Number(raw)
    if (!amount || amount <= 0) return showToast(lang === 'fr' ? 'Veuillez saisir un montant positif' : 'Please enter a positive amount to settle', 'info')
    setLoading(true)
    try {
      await settleBookingTrancheCascade(bookingId, amount)
      setCollectAmounts(prev => ({ ...prev, [rowId + '-drawer']: '' }))
      showToast(lang === 'fr' ? `${amount.toFixed(2)} DT répartis avec succès sur les tranches.` : `Successfully cascaded ${amount.toFixed(2)} DT across tranches.`, 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err?.message || (lang === 'fr' ? 'Échec de la répartition du règlement' : 'Failed to cascade settlement'), 'error')
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
      showToast(lang === 'fr' ? 'Dépense mise à jour avec succès !' : 'Expense updated successfully!', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || (lang === 'fr' ? 'Échec de la mise à jour de la dépense.' : 'Failed to update expense.'), 'error')
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: lang === 'fr' ? 'Supprimer la Dépense' : 'Delete Expense',
      message: lang === 'fr' ? 'Êtes-vous sûr de vouloir supprimer définitivement cet enregistrement de dépense ?' : 'Are you sure you want to permanently delete this expense record?',
      confirmLabel: lang === 'fr' ? 'Oui, Supprimer' : 'Yes, Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteExpense(id)
      showToast(lang === 'fr' ? 'Enregistrement de dépense supprimé.' : 'Expense record deleted.', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || (lang === 'fr' ? 'Échec de la suppression de la dépense.' : 'Failed to delete expense.'), 'error')
    }
  }

  const handleClearOutstanding = async (row: LedgerRow) => {
    if (!row.settlementBookingId || !row.settlementLineItemId) {
      showToast(lang === 'fr' ? 'Aucune tranche impayée sélectionnée pour le règlement.' : 'No outstanding installment selected for settlement.', 'error')
      return
    }
    setLoading(true)
    try {
      await clearOutstandingLedgerItem(row.settlementBookingId, row.settlementLineItemId)
      setSettledInstallmentIds(prev => Array.from(new Set([...prev, row.settlementLineItemId!])))
      showToast(lang === 'fr' ? 'Engagement impayé réglé instantanément.' : 'Outstanding liability settled instantly.', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || (lang === 'fr' ? 'Échec du marquage de la dette comme recouvrée.' : 'Failed to mark the debt as collected.'), 'error')
    }
    setLoading(false)
  }

  const handleMarkClaimSettled = (row: LedgerRow) => {
    setLocallySettledClaims(prev => Array.from(new Set([...prev, row.id])))
    showToast(lang === 'fr' ? 'Ligne de réclamation marquée comme recouvrée.' : 'Claim line marked collected.', 'success')
  }

  // ─── Inline expense category select ─────────────────────────────────────
  const CategorySelect = ({ defaultValue = 'fuel' }: { defaultValue?: string }) => (
    <select name="category" required className="form-input" defaultValue={defaultValue}>
      <optgroup label={lang === 'fr' ? '🚗 Véhicules' : '🚗 Vehicles'}>
        <option value="fuel">⛽ {lang === 'fr' ? 'Carburant' : 'Fuel'}</option>
        <option value="maintenance">🛠️ {lang === 'fr' ? 'Entretien' : 'Maintenance'}</option>
        <option value="insurance">🛡️ {lang === 'fr' ? 'Assurance' : 'Insurance'}</option>
        <option value="cleaning">🧹 {lang === 'fr' ? 'Nettoyage' : 'Cleaning'}</option>
      </optgroup>
      <optgroup label={lang === 'fr' ? '🏢 Charges Générales' : '🏢 General Overhead'}>
        <option value="loyer">🏠 {lang === 'fr' ? 'Loyer / Bureau' : 'Rent / Office'}</option>
        <option value="electricite">⚡ {lang === 'fr' ? 'Électricité' : 'Electricity'}</option>
        <option value="eau">💧 {lang === 'fr' ? 'Eau' : 'Water'}</option>
        <option value="connexion">📡 {lang === 'fr' ? 'Connexion / Internet' : 'Internet'}</option>
        <option value="gps_puce">🛰️ {lang === 'fr' ? 'GPS / Puce' : 'GPS / SIM'}</option>
        <option value="salaires">👤 {lang === 'fr' ? 'Salaires / Personnel' : 'Salaries / Staff'}</option>
      </optgroup>
      <optgroup label={lang === 'fr' ? '📋 Divers' : '📋 Miscellaneous'}>
        <option value="other">📋 {lang === 'fr' ? 'Autre' : 'Other'}</option>
      </optgroup>
    </select>
  )

  const presetLabels: Record<DatePreset, string> = {
    today: t('preset.today'),
    week: t('preset.week'),
    month: t('preset.month'),
    all: lang === 'fr' ? 'Tout Voir' : 'All Time',
    custom: t('preset.custom'),
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="header-section">
        <div className="header-title-row">
          <div>
            <h1 className="page-title">{t('expenses.title')}</h1>
            <p className="subtitle">{t('expenses.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
            <button className="btn-secondary" onClick={() => setIsReportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} /><span>{t('expenses.exportPdf')}</span>
            </button>
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} /><span>{t('expenses.logExpense')}</span>
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
        {(['today', 'week', 'month', 'all', 'custom'] as DatePreset[]).map(p => (
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
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.5)' }}>{t('preset.from')}</span>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPreset('custom') }} style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '6px',
              color: '#fff', padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark', outline: 'none',
            }} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.5)' }}>{t('preset.to')}</span>
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
          {filtered.length} {t('preset.transactions')}
          {overdueRowCount > 0 && (
            <span style={{ marginLeft: '0.6rem', color: '#f87171', fontWeight: 700 }}>
              · {overdueRowCount} {t('preset.overdue')}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(239,68,68,0.05)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#ef4444,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(239,68,68,0.7)', fontWeight: 700 }}>{t('expenses.totalOperationalOutflow')}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#ef4444', letterSpacing: '-0.02em' }}>
            {totalOutflow.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {lang === 'fr' ? `${filtered.length} dépenses` : `${filtered.length} outflow transactions`}
          </div>
        </div>

        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.05)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#f59e0b,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(245, 158, 11, 0.7)', fontWeight: 700 }}>{t('expenses.criticalLiabilities')}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#f59e0b', letterSpacing: '-0.02em' }}>
            {filtered.filter(r => ['maintenance', 'insurance'].includes(r.category)).reduce((s, r) => s + r.amount, 0).toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {t('expenses.repairsAndStatutory')}
          </div>
        </div>
      </div>

      
      {/* ── Fleet Costs Filter Ribbon ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1.25rem',
        background: 'rgba(10,8,7,0.6)',
        border: '1px solid rgba(229,193,125,0.1)',
        borderRadius: '12px',
      }} className="no-print">
        {[
          { key: 'all', label: lang === 'fr' ? 'Tout' : 'All', emoji: '📊', color: 'var(--accent-gold)' },
          { key: 'fuel', label: lang === 'fr' ? 'Carburant' : 'Fuel', emoji: '⛽', color: '#f59e0b' },
          { key: 'maintenance', label: lang === 'fr' ? 'Entretien' : 'Maint.', emoji: '🛠️', color: '#ef4444' },
          { key: 'insurance', label: lang === 'fr' ? 'Assurance' : 'Insurance', emoji: '🛡️', color: '#38bdf8' },
          { key: 'cleaning', label: lang === 'fr' ? 'Nettoyage' : 'Cleaning', emoji: '🧹', color: '#a78bfa' },
          { key: 'loyer', label: lang === 'fr' ? 'Loyer' : 'Rent', emoji: '🏠', color: '#fb923c' },
          { key: 'electricite', label: lang === 'fr' ? 'Électricité' : 'Electric.', emoji: '⚡', color: '#facc15' },
          { key: 'eau', label: lang === 'fr' ? 'Eau' : 'Water', emoji: '💧', color: '#22d3ee' },
          { key: 'connexion', label: lang === 'fr' ? 'Internet' : 'Internet', emoji: '📡', color: '#34d399' },
          { key: 'gps_puce', label: 'GPS / SIM', emoji: '🛰️', color: '#818cf8' },
          { key: 'salaires', label: lang === 'fr' ? 'Salaires' : 'Salaries', emoji: '👤', color: '#f472b6' },
          { key: 'damage_repair', label: lang === 'fr' ? 'Dégâts' : 'Damage', emoji: '🔧', color: '#ef4444' },
          { key: 'installment_tranche', label: lang === 'fr' ? 'Tranche' : 'Tranche', emoji: '💳', color: '#10b981' },
          { key: 'late_return_penalty', label: lang === 'fr' ? 'Pénalité' : 'Penalty', emoji: '⏰', color: '#f59e0b' },
          { key: 'other', label: lang === 'fr' ? 'Autre' : 'Other', emoji: '📋', color: '#94a3b8' }
        ].map(item => {
          const active = flowFilter === item.key
          const count = item.key === 'all' ? filtered.length : (categoryCounts[item.key] || 0)
          return (
            <button
              key={item.key}
              onClick={() => setFlowFilter(item.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.42rem 0.85rem',
                borderRadius: '999px',
                border: active ? `1px solid ${item.color}` : '1px solid rgba(229,193,125,0.1)',
                background: active
                  ? `linear-gradient(135deg, ${item.color}22, ${item.color}0a)`
                  : 'rgba(255,255,255,0.03)',
                color: active ? item.color : 'rgba(229,193,125,0.55)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: active ? `0 0 10px ${item.color}30` : 'none',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>{item.emoji}</span>
              <span>{item.label}</span>
              <span style={{
                fontSize: '0.68rem',
                background: active ? `${item.color}25` : 'rgba(255,255,255,0.07)',
                color: active ? item.color : 'rgba(229,193,125,0.4)',
                borderRadius: '999px',
                padding: '0.05rem 0.4rem',
                fontWeight: 800,
              }}>{count}</span>
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
            placeholder={lang === 'fr' ? 'Rechercher · "overdue" · "due today" · AAAA-MM-JJ · client · plaque' : 'Search · "overdue" · "due today" · YYYY-MM-DD · client · plate'}
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

        {/* Premium Vehicle Selector Filter */}
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="form-input"
            style={{
              paddingRight: '2rem',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23E5C17D%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.8rem top 50%',
              backgroundSize: '0.65rem auto',
              appearance: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all" style={{ background: '#111', color: '#fff' }}>
              {lang === 'fr' ? '🚗 Toutes les dépenses' : '🚗 All Transactions'}
            </option>
            <option value="company" style={{ background: '#111', color: '#fff' }}>
              {lang === 'fr' ? '🏢 Dépenses Société (Générales)' : '🏢 Global / Corporate Expenses'}
            </option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id} style={{ background: '#111', color: '#fff' }}>
                [{v.license_plate}] {v.brand} {v.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'rgba(229,193,125,0.35)', marginBottom: '2rem', borderRadius: '14px' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📊</span>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{t('expenses.noTransactions')}</p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.24)' }}>
            {t('expenses.useFiltersMessage')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {(() => {
            const getCategoryLabel = (cat: string) => {
              switch (cat) {
                case 'rental_revenue': return lang === 'fr' ? 'Revenus Locatifs' : 'Rental Revenue'
                case 'maintenance': return lang === 'fr' ? 'Entretien Véhicule' : 'Vehicle Maintenance'
                case 'fuel': return lang === 'fr' ? 'Carburant Flotte' : 'Fleet Fuel'
                case 'insurance': return lang === 'fr' ? 'Assurance' : 'Insurance'
                case 'cleaning': return lang === 'fr' ? 'Nettoyage' : 'Cleaning'
                case 'incident': return lang === 'fr' ? 'Indemnité Incident' : 'Incident Indemnity'
                case 'damage_repair': return lang === 'fr' ? 'Réparation Dégâts' : 'Damage Repair'
                case 'installment_tranche': return lang === 'fr' ? 'Tranche de Paiement' : 'Installment Tranche'
                case 'late_return_penalty': return lang === 'fr' ? 'Pénalité de Retard' : 'Late Return Penalty'
                case 'loyer': return lang === 'fr' ? 'Loyer / Bureau' : 'Rent / Office'
                case 'electricite': return lang === 'fr' ? 'Électricité' : 'Electricity'
                case 'eau': return lang === 'fr' ? 'Eau' : 'Water'
                case 'connexion': return lang === 'fr' ? 'Connexion / Internet' : 'Connection / Internet'
                case 'gps_puce': return lang === 'fr' ? 'GPS / Puce' : 'GPS / SIM'
                case 'salaires': return lang === 'fr' ? 'Salaires / Personnel' : 'Salaries / Staff'
                default: return lang === 'fr' ? 'Autre' : 'Other'
              }
            }

            if (flowFilter === 'all') {
              const dateGroups: Record<string, typeof filtered> = {}
              filtered.forEach(row => {
                const key = row.date
                if (!dateGroups[key]) dateGroups[key] = []
                dateGroups[key].push(row)
              })

              const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a))

              return sortedDates.map((dateKey) => {
                const dateRows = dateGroups[dateKey]
                const sortedDateRows = [...dateRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                const dayOutflow = sortedDateRows.filter(r => r.type === 'outflow').reduce((s, r) => s + r.amount, 0)
                const dayInflow = sortedDateRows.filter(r => r.type === 'inflow').reduce((s, r) => s + r.collectedAmount, 0)

                return (
                  <div key={dateKey} className="glass-panel" style={{ padding: '1.25rem 1.35rem', borderRadius: '14px', border: '1px solid rgba(229, 193, 125, 0.15)', background: 'rgba(10, 8, 7, 0.85)', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px dashed rgba(229,193,125,0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-gold)', boxShadow: '0 0 10px var(--accent-gold)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>{fmtDate(dateKey)}</span>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginLeft: '0.25rem' }}>· {sortedDateRows.length} {sortedDateRows.length > 1 ? t('preset.transactions') : (lang === 'fr' ? 'transaction' : 'transaction')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
                        {dayInflow > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '999px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: '0.78rem', fontWeight: 700 }}><TrendingUp size={12} /><span>+{dayInflow.toFixed(2)} DT</span></div>}
                        {dayOutflow > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.85rem', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.32)', color: '#f87171', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 0 14px rgba(239,68,68,0.18), inset 0 0 4px rgba(239,68,68,0.04)' }}><TrendingDown size={13} /><span style={{ opacity: 0.85 }}>{lang === 'fr' ? 'Total' : 'Total'}</span><span>-{dayOutflow.toFixed(2)} DT</span></div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {sortedDateRows.map((row) => {
                        const isDamageClaim = row.category === 'damage_repair' || row.claimType === 'damage_repair'
                        const liableClient = (isDamageClaim && row.clients && row.clients.id) ? row.clients : null
                        let categoryMeta = CATEGORY_META[row.category || 'other'] || { label: 'Other', emoji: '📦', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.24)' }
                        return (
                          <div key={row.id} className="ledger-grid-row" style={{ gap: '1rem', padding: '0.95rem 1.15rem', background: 'rgba(255,255,255,0.025)', border: liableClient ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', alignItems: 'center', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}><Calendar size={13} style={{ color: 'var(--accent-gold)' }} /><span>{fmtDate(row.date)}</span></div>
                              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{fmtLegalDate(row.createdAt)}</span>
                            </div>
                            <div>
                              {row.licensePlate ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'stretch', width: 'fit-content', background: 'linear-gradient(180deg, #1f1f1f 0%, #111 100%)', border: '1.5px solid rgba(229,193,125,0.3)', borderRadius: '6px', fontSize: '0.78rem', fontFamily: "'Courier New', Courier, monospace", fontWeight: 800, color: '#fff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}><div style={{ background: 'linear-gradient(135deg, #c5a059, #e5c17d)', color: '#000', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.05em' }}>TN</div><div style={{ padding: '0.15rem 0.5rem', display: 'flex', alignItems: 'center', letterSpacing: '0.05em', textShadow: '0 0 4px rgba(255,255,255,0.2)' }}>{row.licensePlate}</div></div>
                                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{row.vehicleLabel}</span>
                                </div>
                              ) : <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{lang === 'fr' ? 'Dépense Générale' : 'General Expense'}</span>}
                            </div>
                            <div>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: categoryMeta.bg, border: `1px solid ${categoryMeta.border}`, color: categoryMeta.color, fontSize: '0.66rem', fontWeight: 800, width: 'fit-content', marginBottom: '0.45rem' }}><span>{categoryMeta.emoji}</span><span>{getCategoryLabel(row.category || 'other')}</span></div>
                              {liableClient ? (
                                <div style={{ padding: '0.5rem 0.65rem', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(255,255,255,0.01))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.6rem', fontWeight: 800, color: '#f87171', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}><ShieldAlertIcon size={11} /><span>{lang === 'fr' ? 'Client Responsable' : 'Responsible Client'}</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(229,193,125,0.3), rgba(255,255,255,0.05))', border: '1px solid rgba(229,193,125,0.35)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '0.65rem', flexShrink: 0 }}>{getInitials(liableClient.full_name || 'XX')}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liableClient.full_name}</div>{row.description && <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>{row.description}</div>}</div>
                                  </div>
                                </div>
                              ) : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}><span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{row.entity}</span>{row.description && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{row.description}</span>}</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.7rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                {row.type === 'outflow' ? <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>-{row.amount.toFixed(2)} DT</span> : <><span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>+{row.collectedAmount.toFixed(2)} DT</span>{row.remainingAmount > 0 && <span style={{ fontSize: '0.66rem', color: '#f87171', fontWeight: 700 }}>{t('bookings.remaining')}: {row.remainingAmount.toFixed(2)} DT</span>}</>}
                              </div>
                              {row.type === 'outflow' && row.rawRef === 'expense' && (
                                <div style={{ display: 'flex', gap: '0.3rem' }} onClick={(e) => e.stopPropagation()}>
                                  {row.maintenance_id ? <div title={lang === 'fr' ? 'Géré par le module Entretien — modifiez depuis la page Entretien' : 'Managed by Maintenance module — edit from the Maintenance page'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(229,193,125,0.08)', border: '1px solid rgba(229,193,125,0.2)', color: 'rgba(229,193,125,0.6)', fontSize: '0.62rem', fontWeight: 700, cursor: 'default', whiteSpace: 'nowrap' }}>🔒 {lang === 'fr' ? 'Entretien' : 'Maint.'}</div> : <><button className="icon-btn" onClick={() => setEditingExpense(row)} title={lang === 'fr' ? 'Modifier' : 'Edit'}><Edit2 size={13} /></button><button className="icon-btn text-danger" onClick={() => handleDelete(row.id.replace('expense-', ''))} title={lang === 'fr' ? 'Supprimer' : 'Delete'}><Trash2 size={13} /></button></>}
                                </div>
                              )}
                              {row.type === 'inflow' && (row.remainingAmount > 0 ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.65rem', fontWeight: 700 }}>{lang === 'fr' ? 'IMPAYÉ' : 'UNPAID'}</div> : <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: '0.65rem', fontWeight: 700 }}>{lang === 'fr' ? 'RÉGLÉ' : 'SETTLED'}</div>)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            } else {
              const sortedCatRows = [...filtered].sort((a, b) => { const dateCompare = b.date.localeCompare(a.date); if (dateCompare !== 0) return dateCompare; return b.createdAt.localeCompare(a.createdAt); });
              const categoryMeta = CATEGORY_META[flowFilter] || { label: 'Other', emoji: '📦', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.24)' };
              const categoryTitle = categoryMeta.emoji + ' ' + getCategoryLabel(flowFilter);
              const totalOutflowSum = sortedCatRows.filter(r => r.type === 'outflow').reduce((s, r) => s + r.amount, 0);
              const totalInflowSum = sortedCatRows.filter(r => r.type === 'inflow').reduce((s, r) => s + r.collectedAmount, 0);

              return (
                <div className="glass-panel" style={{ padding: '1.25rem 1.35rem', borderRadius: '14px', border: `1px solid ${categoryMeta.border}`, background: 'rgba(10, 8, 7, 0.85)', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px dashed rgba(229,193,125,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: categoryMeta.color, boxShadow: `0 0 10px ${categoryMeta.color}` }} />
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>{categoryTitle}</span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginLeft: '0.25rem' }}>· {sortedCatRows.length} {sortedCatRows.length > 1 ? t('preset.transactions') : (lang === 'fr' ? 'transaction' : 'transaction')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
                      {totalInflowSum > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '999px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: '0.78rem', fontWeight: 700 }}><TrendingUp size={12} /><span>+{totalInflowSum.toFixed(2)} DT</span></div>}
                      {totalOutflowSum > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.85rem', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.32)', color: '#f87171', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 0 14px rgba(239,68,68,0.18), inset 0 0 4px rgba(239,68,68,0.04)' }}><TrendingDown size={13} /><span style={{ opacity: 0.85 }}>{lang === 'fr' ? 'Total' : 'Total'}</span><span>-{totalOutflowSum.toFixed(2)} DT</span></div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {sortedCatRows.map((row) => {
                      const isDamageClaim = row.category === 'damage_repair' || row.claimType === 'damage_repair';
                      const liableClient = (isDamageClaim && row.clients && row.clients.id) ? row.clients : null;
                      return (
                        <div key={row.id} className="ledger-grid-row" style={{ gap: '1rem', padding: '0.95rem 1.15rem', background: 'rgba(255,255,255,0.025)', border: liableClient ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', alignItems: 'center', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}><Calendar size={13} style={{ color: 'var(--accent-gold)' }} /><span>{fmtDate(row.date)}</span></div>
                            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{fmtLegalDate(row.createdAt)}</span>
                          </div>
                          <div>
                            {row.licensePlate ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'stretch', width: 'fit-content', background: 'linear-gradient(180deg, #1f1f1f 0%, #111 100%)', border: '1.5px solid rgba(229,193,125,0.3)', borderRadius: '6px', fontSize: '0.78rem', fontFamily: "'Courier New', Courier, monospace", fontWeight: 800, color: '#fff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}><div style={{ background: 'linear-gradient(135deg, #c5a059, #e5c17d)', color: '#000', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.05em' }}>TN</div><div style={{ padding: '0.15rem 0.5rem', display: 'flex', alignItems: 'center', letterSpacing: '0.05em', textShadow: '0 0 4px rgba(255,255,255,0.2)' }}>{row.licensePlate}</div></div>
                                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{row.vehicleLabel}</span>
                              </div>
                            ) : <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{lang === 'fr' ? 'Dépense Générale' : 'General Expense'}</span>}
                          </div>
                          <div>
                            {liableClient ? (
                              <div style={{ padding: '0.5rem 0.65rem', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(255,255,255,0.01))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.6rem', fontWeight: 800, color: '#f87171', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}><ShieldAlertIcon size={11} /><span>{lang === 'fr' ? 'Client Responsable' : 'Responsible Client'}</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(229,193,125,0.3), rgba(255,255,255,0.05))', border: '1px solid rgba(229,193,125,0.35)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '0.65rem', flexShrink: 0 }}>{getInitials(liableClient.full_name || 'XX')}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liableClient.full_name}</div>{row.description && <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>{row.description}</div>}</div>
                                </div>
                              </div>
                            ) : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}><span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{row.entity}</span>{row.description && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{row.description}</span>}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.7rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              {row.type === 'outflow' ? <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>-{row.amount.toFixed(2)} DT</span> : <><span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>+{row.collectedAmount.toFixed(2)} DT</span>{row.remainingAmount > 0 && <span style={{ fontSize: '0.66rem', color: '#f87171', fontWeight: 700 }}>{t('bookings.remaining')}: {row.remainingAmount.toFixed(2)} DT</span>}</>}
                            </div>
                            {row.type === 'outflow' && row.rawRef === 'expense' && (
                              <div style={{ display: 'flex', gap: '0.3rem' }} onClick={(e) => e.stopPropagation()}>
                                {row.maintenance_id ? (
                                  <div title={lang === 'fr' ? 'Géré par le module Entretien — modifiez depuis la page Entretien' : 'Managed by Maintenance module — edit from the Maintenance page'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(229,193,125,0.08)', border: '1px solid rgba(229,193,125,0.2)', color: 'rgba(229,193,125,0.6)', fontSize: '0.62rem', fontWeight: 700, cursor: 'default', whiteSpace: 'nowrap' }}>🔒 {lang === 'fr' ? 'Entretien' : 'Maint.'}</div>
                                ) : (
                                  <><button className="icon-btn" onClick={() => setEditingExpense(row)} title={lang === 'fr' ? 'Modifier' : 'Edit'}><Edit2 size={13} /></button><button className="icon-btn text-danger" onClick={() => handleDelete(row.id.replace('expense-', ''))} title={lang === 'fr' ? 'Supprimer' : 'Delete'}><Trash2 size={13} /></button></>
                                )}
                              </div>
                            )}

                            {row.type === 'inflow' && (
                              row.remainingAmount > 0 ? (
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  padding: '0.25rem 0.55rem', borderRadius: '999px',
                                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                                  color: '#f87171', fontSize: '0.65rem', fontWeight: 700,
                                }}>{lang === 'fr' ? 'IMPAYÉ' : 'UNPAID'}</div>
                              ) : (
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  padding: '0.25rem 0.55rem', borderRadius: '999px',
                                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                                  color: '#34d399', fontSize: '0.65rem', fontWeight: 700,
                                }}>{lang === 'fr' ? 'RÉGLÉ' : 'SETTLED'}</div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }
          })()}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="modal-content glass-panel">
              <div className="modal-header">
                <h2>{lang === 'fr' ? 'Enregistrer une Dépense' : 'Log New Expense'}</h2>
                <button className="icon-btn" onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleAdd} className="modal-form">
                <div className="form-group">
                  <label>{lang === 'fr' ? 'Catégorie' : 'Category'}</label>
                  <CategorySelect />
                </div>
                <div className="form-group">
                  <label>{lang === 'fr' ? 'Description' : 'Description'}</label>
                  <input
                    type="text"
                    name="description"
                    placeholder={lang === 'fr' ? 'ex. Lavage hebdomadaire, Essence voiture...' : 'e.g. Weekly wash, Fuel top-up...'}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{lang === 'fr' ? 'Montant (DT)' : 'Amount (DT)'}</label>
                    <input
                      type="number"
                      name="amount"
                      required
                      placeholder="50"
                      min="0"
                      step="0.01"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{lang === 'fr' ? 'Véhicule (Optionnel)' : 'Vehicle (Optional)'}</label>
                    <select name="vehicle_id" className="form-input">
                      <option value="">{lang === 'fr' ? '-- Dépense Générale --' : '-- General Expense --'}</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                    <span>{lang === 'fr' ? 'Ajouter la Dépense' : 'Add Expense'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {editingExpense && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="modal-content glass-panel">
              <div className="modal-header">
                <h2>{lang === 'fr' ? 'Modifier la Dépense' : 'Edit Expense'}</h2>
                <button className="icon-btn" onClick={() => setEditingExpense(null)}><X size={20} /></button>
              </div>
              <form onSubmit={handleEdit} className="modal-form">
                <div className="form-group">
                  <label>{lang === 'fr' ? 'Catégorie' : 'Category'}</label>
                  <CategorySelect defaultValue={editingExpense?.category || 'fuel'} />
                </div>
                <div className="form-group">
                  <label>{lang === 'fr' ? 'Description' : 'Description'}</label>
                  <input
                    type="text"
                    name="description"
                    placeholder={lang === 'fr' ? 'ex. Lavage hebdomadaire...' : 'e.g. Weekly wash...'}
                    className="form-input"
                    defaultValue={editingExpense?.description || ''}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{lang === 'fr' ? 'Montant (DT)' : 'Amount (DT)'}</label>
                    <input
                      type="number"
                      name="amount"
                      required
                      placeholder="50"
                      min="0"
                      step="0.01"
                      className="form-input"
                      defaultValue={editingExpense?.amount || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label>{lang === 'fr' ? 'Véhicule (Optionnel)' : 'Vehicle (Optional)'}</label>
                    <select name="vehicle_id" className="form-input" defaultValue={editingExpense?.vehicleId || editingExpense?.vehicles?.id || ''}>
                      <option value="">{lang === 'fr' ? '-- Dépense Générale --' : '-- General Expense --'}</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setEditingExpense(null)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                    <span>{lang === 'fr' ? 'Enregistrer' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {editingBooking && (
        <QuickEditBookingModal
          booking={editingBooking}
          isOpen={!!editingBooking}
          onClose={() => setEditingBooking(null)}
          vehiclePricePerDay={editingBooking?.vehicles?.price_per_day}
        />
      )}

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
