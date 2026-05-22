'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, X, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Landmark,
  Search, FileText, AlertCircle, Clock
} from 'lucide-react'
import { addExpense, updateExpense, deleteExpense } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import ExpenseReportModal from './components/ExpenseReportModal'
import { BusinessSettings } from '@/types'

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
  category: 'rental_revenue' | 'maintenance' | 'fuel' | 'insurance' | 'cleaning' | 'incident' | 'other'
  description: string
  entity: string
  vehicleLabel: string
  licensePlate: string
  amount: number
  rawRef: 'booking' | 'expense' | 'maintenance'
  installments: Installment[]   // sorted by due_date ASC
  totalOwed: number             // sum of unpaid installments
  hasOverdue: boolean           // any unpaid tranche past today
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
      borderTop: '1px solid rgba(229,193,125,0.07)',
    }}>
      {installments.map((tr, idx) => {
        const isPaid = tr.status === 'paid'
        const isOverdue = !isPaid && tr.due_date < today
        const amt = Number(tr.amount).toFixed(2)
        const dateLabel = isPaid
          ? `Paid ${fmtDate(tr.paid_date || tr.due_date)}`
          : isOverdue
            ? `Overdue · ${tr.due_date}`
            : `Due: ${tr.due_date}`

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
              background: isPaid
                ? 'rgba(16,185,129,0.09)'
                : isOverdue
                  ? 'rgba(239,68,68,0.09)'
                  : 'rgba(229,193,125,0.07)',
              border: `1px solid ${isPaid ? 'rgba(16,185,129,0.25)' : isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(229,193,125,0.15)'}`,
              color: isPaid ? '#10b981' : isOverdue ? '#f87171' : 'rgba(229,193,125,0.7)',
            }}
          >
            {isPaid ? '🟢' : isOverdue ? '🔴' : '⚪'}
            <span>Tranche #{idx + 1}</span>
            <span style={{ opacity: 0.8 }}>({amt} DT)</span>
            <span style={{
              color: isOverdue ? '#ef4444' : isPaid ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.35)',
              fontWeight: isOverdue ? 800 : 600,
            }}>
              — {dateLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpensesClient({
  initialExpenses,
  initialMaintenance,
  initialBookings,
  vehicles,
  businessSettings,
}: {
  initialExpenses: any[]
  initialMaintenance: any[]
  initialBookings: any[]
  vehicles: any[]
  businessSettings: BusinessSettings | null
}) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const TODAY = todayStr()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen]     = useState(false)
  const [editingExpense, setEditingExpense]  = useState<any>(null)
  const [loading, setLoading]               = useState(false)

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

    // 1. Booking inflows
    for (const b of initialBookings) {
      const paid = Number(b.acompte_paid) || 0
      if (paid <= 0) continue
      const date = isoDate(b.actual_return_date || b.created_at || b.start_date)
      const v = b.vehicles as any
      const rawInstallments: Installment[] = Array.isArray(b.installments) ? b.installments : []
      const sortedInstallments = [...rawInstallments].sort((a, b) =>
        a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0
      )
      const totalOwed = sortedInstallments
        .filter(t => t.status === 'unpaid')
        .reduce((s, t) => s + Number(t.amount), 0)
      const hasOverdue = sortedInstallments.some(t => t.status === 'unpaid' && t.due_date < TODAY)

      const plate = buildPlateLabel(v)
      const modelLabel = buildVehicleLabel(v)
      const entityLabel = b.client_name || 'Client'

      rows.push({
        id: `booking-${b.id}`,
        date,
        type: 'inflow',
        category: 'rental_revenue',
        description: plate
          ? `Rental Revenue — ${entityLabel} · [ TN | ${plate} ]`
          : `Rental Revenue — ${entityLabel}`,
        entity: entityLabel,
        vehicleLabel: modelLabel,
        licensePlate: plate,
        amount: paid,
        rawRef: 'booking',
        installments: sortedInstallments,
        totalOwed,
        hasOverdue,
      })
    }

    // 2. Expense outflows
    for (const e of initialExpenses) {
      const date = isoDate(e.created_at)
      const cat = e.category as string
      const v = e.vehicles as any
      const plate = buildPlateLabel(v)
      const modelLabel = buildVehicleLabel(v)
      rows.push({
        id: `expense-${e.id}`,
        date,
        type: 'outflow',
        category: (cat in CATEGORY_META ? cat : 'other') as LedgerRow['category'],
        description: e.description || e.category || 'Expense',
        entity: v ? modelLabel : 'General',
        vehicleLabel: v ? modelLabel : 'General',
        licensePlate: plate,
        amount: Number(e.amount) || 0,
        rawRef: 'expense',
        installments: [],
        totalOwed: 0,
        hasOverdue: false,
      })
    }

    // 3. Maintenance outflows
    for (const m of initialMaintenance) {
      const date = isoDate(m.service_date || m.created_at)
      const v = m.vehicles as any
      const plate = buildPlateLabel(v)
      const modelLabel = buildVehicleLabel(v)
      rows.push({
        id: `maintenance-${m.id}`,
        date,
        type: 'outflow',
        category: 'maintenance',
        description: m.description || 'Maintenance Service',
        entity: v ? modelLabel : 'Vehicle',
        vehicleLabel: v ? modelLabel : 'Vehicle',
        licensePlate: plate,
        amount: Number(m.cost) || 0,
        rawRef: 'maintenance',
        installments: [],
        totalOwed: 0,
        hasOverdue: false,
      })
    }

    return rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  }, [initialBookings, initialExpenses, initialMaintenance, TODAY])

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

      // Smart search intercept for installment-based queries
      if (isOverdueQuery) {
        return inWindow && typeMatch && row.hasOverdue
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
  }, [allRows, dateWindow, typeFilter, searchQuery, TODAY])

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

  // ─── Expense Form ─────────────────────────────────────────────────────────
  const ExpenseForm = ({ defaultValues, onSubmit, submitLabel }: {
    defaultValues?: any
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    submitLabel: string
  }) => (
    <form onSubmit={onSubmit} className="modal-form">
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
      <div className="form-group">
        <label>Description</label>
        <input type="text" name="description" placeholder="e.g. Monthly car wash" className="form-input" defaultValue={defaultValues?.description || ''} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Amount (DT)</label>
          <input type="number" name="amount" required placeholder="50" min="0" step="0.01" className="form-input" defaultValue={defaultValues?.amount || ''} />
        </div>
        <div className="form-group">
          <label>Link to Vehicle (Optional)</label>
          <select name="vehicle_id" className="form-input" defaultValue={defaultValues?.vehicle_id || ''}>
            <option value="">-- General Expense --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
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
            <h1 className="page-title">Cash Flow Ledger</h1>
            <p className="subtitle">Unified inflows, outflows & installment tranche timelines.</p>
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
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '6px',
              color: '#fff', padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark', outline: 'none',
            }} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.5)' }}>To</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '6px',
              color: '#fff', padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark', outline: 'none',
            }} />
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

      {/* ── 3 KPI Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>

        {/* Inflow */}
        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(16,185,129,0.25)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(16,185,129,0.06)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#10b981,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(16,185,129,0.7)', fontWeight: 700 }}>Net Cash In</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#10b981', letterSpacing: '-0.02em' }}>
            +{totalInflow.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {filtered.filter(r => r.type === 'inflow').length} inflow transactions
          </div>
          {totalOwedInPeriod > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24',
              padding: '0.2rem 0.55rem', borderRadius: '20px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              width: 'fit-content', marginTop: '0.15rem',
            }}>
              <Clock size={11} />
              Owed: {totalOwedInPeriod.toFixed(2)} DT pending
            </div>
          )}
        </div>

        {/* Outflow */}
        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: '1px solid rgba(239,68,68,0.22)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(239,68,68,0.05)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#ef4444,transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(239,68,68,0.7)', fontWeight: 700 }}>Fleet Ops Out</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: '#ef4444', letterSpacing: '-0.02em' }}>
            -{totalOutflow.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {filtered.filter(r => r.type === 'outflow').length} outflow transactions
          </div>
        </div>

        {/* Liquid Position */}
        <div style={{
          padding: '1.5rem 1.75rem', background: 'rgba(10,8,7,0.8)',
          border: `1px solid ${netPosition >= 0 ? 'rgba(229,193,125,0.35)' : 'rgba(239,68,68,0.35)'}`,
          borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.5rem',
          boxShadow: netPosition >= 0 ? '0 4px 28px rgba(229,193,125,0.12)' : '0 4px 28px rgba(239,68,68,0.1)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: netPosition >= 0 ? 'linear-gradient(90deg,var(--accent-gold),transparent)' : 'linear-gradient(90deg,#ef4444,transparent)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={16} style={{ color: netPosition >= 0 ? 'var(--accent-gold)' : '#ef4444' }} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: netPosition >= 0 ? 'rgba(229,193,125,0.7)' : 'rgba(239,68,68,0.7)', fontWeight: 700 }}>
              Liquid Position
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em', color: netPosition >= 0 ? 'var(--accent-gold)' : '#f87171' }}>
            {netPosition >= 0 ? '+' : ''}{netPosition.toFixed(2)} DT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {netPosition >= 0 ? '✅ Positive cash flow' : '⚠️ Net cash deficit'}
          </div>
          {overdueRowCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.72rem', fontWeight: 700, color: '#f87171',
              padding: '0.2rem 0.55rem', borderRadius: '20px',
              background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.25)',
              width: 'fit-content', marginTop: '0.15rem',
            }}>
              <AlertCircle size={11} />
              {overdueRowCount} contract{overdueRowCount > 1 ? 's' : ''} with overdue tranches
            </div>
          )}
        </div>
      </div>

      {/* ── Search + Type Filter Bar ──────────────────────────────────────── */}
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

        {/* Quick filter chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['overdue', 'due today'].map(chip => (
            <button
              key={chip}
              onClick={() => setSearchQuery(searchQuery === chip ? '' : chip)}
              style={{
                padding: '0.45rem 0.9rem', borderRadius: '20px', border: '1px solid',
                borderColor: searchQuery === chip ? 'rgba(239,68,68,0.5)' : 'rgba(229,193,125,0.15)',
                background: searchQuery === chip ? 'rgba(239,68,68,0.1)' : 'rgba(229,193,125,0.05)',
                color: searchQuery === chip ? '#f87171' : 'rgba(229,193,125,0.5)',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
                fontFamily: 'var(--font-body)', textTransform: 'capitalize',
              }}
            >
              {chip === 'overdue' ? '🔴' : '⏰'} {chip}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', background: 'rgba(10,8,7,0.7)', border: '1px solid rgba(229,193,125,0.1)', borderRadius: '9px', padding: '0.25rem', gap: '0.2rem' }}>
          {(['all', 'inflow', 'outflow'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '0.45rem 1rem', borderRadius: '7px', border: '1px solid',
              borderColor: typeFilter === t ? (t === 'inflow' ? 'rgba(16,185,129,0.4)' : t === 'outflow' ? 'rgba(239,68,68,0.4)' : 'rgba(229,193,125,0.3)') : 'transparent',
              background: typeFilter === t ? (t === 'inflow' ? 'rgba(16,185,129,0.12)' : t === 'outflow' ? 'rgba(239,68,68,0.1)' : 'rgba(229,193,125,0.12)') : 'transparent',
              color: typeFilter === t ? (t === 'inflow' ? '#10b981' : t === 'outflow' ? '#f87171' : 'var(--accent-gold)') : 'rgba(229,193,125,0.45)',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
              fontFamily: 'var(--font-body)',
            }}>
              {t === 'all' ? 'All' : t === 'inflow' ? '↑ Inflows' : '↓ Outflows'}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.4)', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--accent-gold)' }}>{filtered.length}</strong> records
        </div>
      </div>

      {/* ── Unified Ledger Grid ───────────────────────────────────────────── */}
      <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: '2rem' }}>

        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '105px 150px 1fr 130px 115px 115px 72px',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid rgba(229,193,125,0.1)',
          background: 'rgba(229,193,125,0.03)',
        }}>
          {['Date', 'Category', 'Description & Tranches', 'Entity', 'Inflow', 'Outflow', ''].map((h, i) => (
            <div key={i} style={{
              fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1.5px', color: 'rgba(229,193,125,0.4)',
              textAlign: i >= 4 ? 'right' : 'left',
            }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3.5rem 1rem', color: 'rgba(229,193,125,0.35)' }}>
            <span style={{ fontSize: '2.5rem' }}>📊</span>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No transactions found for this period.</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>
              Try "overdue", "due today", a date like "2026-05-22", or adjust the date range.
            </p>
          </div>
        ) : (
          filtered.map((row, idx) => {
            const meta  = CATEGORY_META[row.category] || CATEGORY_META.other
            const isExp = row.rawRef === 'expense'
            const hasInstallments = row.installments.length > 0

            return (
              <div key={row.id} style={{
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(229,193,125,0.05)' : 'none',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,193,125,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '105px 150px 1fr 130px 115px 115px 72px',
                  padding: hasInstallments ? '0.9rem 1.5rem 0.5rem' : '0.9rem 1.5rem',
                  alignItems: 'flex-start',
                }}>
                  {/* Date */}
                  <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, paddingTop: '0.15rem' }}>
                    {fmtDate(row.date)}
                  </div>

                  {/* Category badge */}
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.22rem 0.55rem',
                      borderRadius: '20px', background: meta.bg, color: meta.color,
                      border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
                    }}>
                      {meta.emoji} {meta.label}
                    </span>
                    {row.hasOverdue && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.63rem', fontWeight: 800, color: '#f87171',
                        marginTop: '0.3rem', marginLeft: '0.1rem',
                      }}>
                        <AlertCircle size={10} /> Overdue
                      </div>
                    )}
                  </div>

                  {/* Description + Installment Roadmap */}
                  <div style={{ paddingRight: '0.75rem' }}>
                    <div style={{ fontSize: '0.83rem', color: '#ffffff', fontWeight: 600, lineHeight: 1.35 }}>
                      {row.description}
                    </div>
                    {hasInstallments && (
                      <InstallmentRoadmap installments={row.installments} today={TODAY} />
                    )}
                  </div>

                  {/* Entity */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', paddingRight: '0.5rem', paddingTop: '0.05rem' }}>
                    {row.type === 'inflow' ? (
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg,rgba(229,193,125,0.3),rgba(197,160,89,0.15))',
                        border: '1px solid rgba(229,193,125,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-gold)',
                      }}>
                        {getInitials(row.entity)}
                      </div>
                    ) : (
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                        background: meta.bg, border: `1px solid ${meta.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                      }}>
                        {meta.emoji}
                      </div>
                    )}
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.entity}
                      </div>
                      {row.licensePlate && (
                        <div style={{
                          fontSize: '0.65rem', fontFamily: "'Courier New', monospace",
                          color: 'var(--accent-gold)', fontWeight: 700,
                          background: 'rgba(229,193,125,0.08)', border: '1px solid rgba(229,193,125,0.15)',
                          borderRadius: '4px', padding: '0.05rem 0.35rem', display: 'inline-block', marginTop: '0.15rem',
                        }}>
                          {row.licensePlate}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inflow */}
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', paddingTop: '0.1rem' }}>
                    {row.type === 'inflow'
                      ? <span style={{ color: '#10b981' }}>+{row.amount.toFixed(2)} DT</span>
                      : <span style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>}
                  </div>

                  {/* Outflow */}
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', paddingTop: '0.1rem' }}>
                    {row.type === 'outflow'
                      ? <span style={{ color: '#f87171' }}>-{row.amount.toFixed(2)} DT</span>
                      : <span style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem', paddingTop: '0.1rem' }}>
                    {isExp ? (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => {
                          const exp = initialExpenses.find(e => `expense-${e.id}` === row.id)
                          if (exp) setEditingExpense(exp)
                        }}><Edit2 size={13} /></button>
                        <button className="icon-btn text-danger" title="Delete" onClick={() => {
                          const exp = initialExpenses.find(e => `expense-${e.id}` === row.id)
                          if (exp) handleDelete(exp.id)
                        }}><Trash2 size={13} /></button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.2)' }}>
                        {row.rawRef === 'booking' ? '📄' : '🔧'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline owed-amount strip for booking rows with unpaid tranches */}
                {row.type === 'inflow' && row.totalOwed > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.4rem 1.5rem 0.7rem',
                    borderTop: '1px dashed rgba(229,193,125,0.06)',
                  }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      color: 'rgba(251,191,36,0.7)',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      <Clock size={11} />
                      Owed: <span style={{ color: '#fbbf24' }}>{row.totalOwed.toFixed(2)} DT</span> remaining
                    </div>
                    {row.hasOverdue && (
                      <div style={{
                        fontSize: '0.68rem', fontWeight: 800, color: '#f87171',
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.15rem 0.5rem', borderRadius: '20px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      }}>
                        <AlertCircle size={10} /> Past due — action required
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Footer Totals Strip */}
        {filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '105px 150px 1fr 130px 115px 115px 72px',
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid rgba(229,193,125,0.15)',
            background: 'rgba(229,193,125,0.04)',
            alignItems: 'center',
          }}>
            {/* Left section: labels */}
            <div style={{ gridColumn: 'span 4', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(229,193,125,0.45)' }}>
                Period Totals
              </span>
              {totalOwedInPeriod > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.18rem 0.55rem', borderRadius: '20px',
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                  color: '#fbbf24',
                }}>
                  <Clock size={11} />
                  Owed: {totalOwedInPeriod.toFixed(2)} DT
                </span>
              )}
              {overdueRowCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.18rem 0.55rem', borderRadius: '20px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171',
                }}>
                  <AlertCircle size={11} />
                  {overdueRowCount} overdue
                </span>
              )}
            </div>

            {/* Inflow total */}
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#10b981', fontSize: '0.95rem' }}>
              +{totalInflow.toFixed(2)} DT
            </div>

            {/* Outflow total */}
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#f87171', fontSize: '0.95rem' }}>
              -{totalOutflow.toFixed(2)} DT
            </div>
            <div />
          </div>
        )}
      </div>

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
