'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Calendar, X, AlertTriangle, Edit2, ShieldAlert, ShieldCheck, ShieldAlert as ShieldIcon, Star } from 'lucide-react'
import QuickEditBookingModal from '@/app/dashboard/vehicles/[id]/history/components/QuickEditBookingModal'
import { updateBookingStatus } from '@/app/actions'
import { useToast } from '@/components/Toast'

/* ─── Types ─────────────────────────────────────────────────────── */
interface OmniBooking {
  id: string
  vehicle_id: string
  start_date: string
  end_date: string
  status?: string
  client_name?: string
  total_amount?: number
  acompte_paid?: number
  rental_days_text?: string
  departure_time?: string
  return_time?: string
  starting_km?: number | null
  return_km?: number | null
  fuel_level_pickup?: string
  fuel_level_return?: string
  lavage_pickup?: string
  lavage_return?: string
  damage_notes?: string
  actual_return_date?: string
  client_behavior_status?: string | null
  installments?: {
    id: string
    booking_id: string
    amount: number
    due_date: string
    status: 'paid' | 'unpaid'
    paid_date?: string | null
  }[]
  vehicles?: {
    id?: string
    brand?: string
    model?: string
    license_plate?: string
    price_per_day?: number
  }
  clients?: {
    id?: string
    full_name?: string
    phone?: string
    license_number?: string
    date_naissance?: string
    cin_delivre_le?: string
    permis_numero?: string
    permis_delivre_le?: string
    trust_score?: number | null
  }
}

interface GlobalCommandSearchProps {
  allBookings: OmniBooking[]
  activeAlertFilter: 'overdue' | 'balances' | 'expiring' | null
  setActiveAlertFilter: (val: 'overdue' | 'balances' | 'expiring' | null) => void
  vehicleLegalDocs?: any[]
  vehicles?: any[]
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmt = (d?: string) => {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-GB')
}

const initials = (name?: string) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
}

const getClientRiskProfile = (
  clientId: string | undefined,
  clientName: string | undefined,
  allBookings: OmniBooking[]
) => {
  if (!clientId && !clientName) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  // Filter bookings for this client (excluding cancelled)
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

  const getDaysDiff = (d1Str: string, d2Str: string): number => {
    const d1 = new Date(d1Str.split('T')[0] + 'T00:00:00')
    const d2 = new Date(d2Str.split('T')[0] + 'T00:00:00')
    const diffTime = d2.getTime() - d1.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  }

  let returnHygiene = 100
  let totalContractValue = 0
  let totalOverdueUnpaid = 0
  let hasCriminalOverride = false
  let behaviorPenalty = 0

  const completedBookingsCount = clientBookings.filter(b => b.status === 'completed').length
  const loyaltyBonus = Math.min(20, completedBookingsCount * 2.5)

  clientBookings.forEach((b) => {
    const isCompleted = b.status === 'completed'
    const scheduledEnd = b.end_date
    const totalAmt = Number(b.total_amount) || 0
    const paidAmt = Number(b.acompte_paid) || 0
    const balance = totalAmt - paidAmt
    const installments = b.installments || []
    const hasInstallments = Array.isArray(installments) && installments.length > 0

    if (b.status === 'pending') {
      return
    }

    totalContractValue += totalAmt

    if (hasInstallments) {
      installments.forEach((inst: any) => {
        const amt = Number(inst.amount) || 0
        if (inst.status === 'unpaid') {
          if (getDaysDiff(inst.due_date, todayStr) > 0) {
            totalOverdueUnpaid += amt
          }
        }
      })
    } else {
      const isConfirmed = b.status === 'confirmed'
      const isOverdue = isConfirmed && (getDaysDiff(scheduledEnd, todayStr) > 0)
      if ((isCompleted || isOverdue) && balance > 0) {
        totalOverdueUnpaid += balance
      }
    }

    if (isCompleted) {
      const actualEnd = b.actual_return_date || scheduledEnd
      const lateDays = getDaysDiff(scheduledEnd, actualEnd)
      if (lateDays > 0) {
        returnHygiene -= Math.min(75, 4 * Math.pow(lateDays, 1.3))
      }
    } else if (b.status === 'confirmed') {
      const overdueDays = getDaysDiff(scheduledEnd, todayStr)
      if (overdueDays > 0) {
        let hasUnpaidDebt = false
        if (hasInstallments) {
          hasUnpaidDebt = installments.some(
            (inst: any) => inst.status === 'unpaid' && getDaysDiff(inst.due_date, todayStr) > 0
          )
        } else {
          hasUnpaidDebt = balance > 0
        }

        if (overdueDays >= 5 && hasUnpaidDebt) {
          hasCriminalOverride = true
        } else {
          returnHygiene -= overdueDays * 8
        }
      }
    }

    if (b.client_behavior_status) {
      const infractions = b.client_behavior_status.split(',').map((s: string) => s.trim()).filter(Boolean);
      
      infractions.forEach((infraction: string) => {
        let baseInfraction = 0
        let isPermanent = false

        if (infraction === 'dirty_return') {
          baseInfraction = 5
        } else if (infraction === 'speeding') {
          baseInfraction = 15
        } else if (infraction === 'minor_damage') {
          baseInfraction = 25
        } else if (infraction === 'major_damage') {
          baseInfraction = 100
          isPermanent = true
          hasCriminalOverride = true
        }

        if (baseInfraction > 0) {
          if (isPermanent) {
            behaviorPenalty += baseInfraction
          } else {
            const infractionDate = b.actual_return_date || b.end_date || todayStr
            const daysSince = Math.max(0, getDaysDiff(infractionDate, todayStr))
            const decayFactor = Math.max(0, 1 - daysSince / 90)
            behaviorPenalty += baseInfraction * decayFactor
          }
        }
      });
    }
  })

  returnHygiene = Math.max(0, Math.min(100, returnHygiene))

  const overdueDebtRatio = totalContractValue > 0 ? (totalOverdueUnpaid / totalContractValue) : 0
  const paymentHygiene = 100 - Math.min(100, overdueDebtRatio * 120)

  let score = (0.40 * returnHygiene) + (0.40 * paymentHygiene) - behaviorPenalty + loyaltyBonus

  if (hasCriminalOverride) {
    score = 0
  }

  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10))

  let riskLevel: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'very_high_risk' | 'criminal'
  
  if (hasCriminalOverride || score < 15.0) {
    riskLevel = 'criminal'
  } else if (score >= 92.0) {
    riskLevel = 'very_low_risk'
  } else if (score >= 80.0) {
    riskLevel = 'low_risk'
  } else if (score >= 60.0) {
    riskLevel = 'medium_risk'
  } else if (score >= 45.0) {
    riskLevel = 'high_risk'
  } else {
    riskLevel = 'very_high_risk'
  }

  return { score, riskLevel }
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function GlobalCommandSearch({
  allBookings,
  activeAlertFilter,
  setActiveAlertFilter,
  vehicleLegalDocs = [],
  vehicles = []
}: GlobalCommandSearchProps) {
  const [textQuery, setTextQuery]       = useState('')
  const [interceptDate, setInterceptDate] = useState('')
  const [editingBooking, setEditingBooking] = useState<OmniBooking | null>(null)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)

  const isActive = textQuery.trim() !== '' || interceptDate !== '' || activeAlertFilter !== null
  const isFineMode = textQuery.trim() !== '' || interceptDate !== ''

  const expiringDocs = useMemo(() => {
    const todayObj = new Date()
    todayObj.setHours(0, 0, 0, 0)
    
    return (vehicleLegalDocs || [])
      .filter(doc => {
        if (!doc.expiry_date) return false
        const expDate = new Date(doc.expiry_date)
        const diffTime = expDate.getTime() - todayObj.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays <= 7 && diffDays >= 0
      })
      .map(doc => {
        const vehicle = vehicles.find(v => v.id === doc.vehicle_id)
        const expDate = new Date(doc.expiry_date)
        const diffTime = expDate.getTime() - todayObj.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        // Find if this vehicle has an active booking today
        const tyStr = todayObj.getFullYear()
        const tmStr = String(todayObj.getMonth() + 1).padStart(2, '0')
        const tdStr = String(todayObj.getDate()).padStart(2, '0')
        const todayStr = `${tyStr}-${tmStr}-${tdStr}`
        const activeBooking = allBookings.find(b => {
          if (b.status === 'cancelled') return false
          return b.vehicle_id === doc.vehicle_id && b.start_date <= todayStr && b.end_date >= todayStr
        })

        return {
          id: doc.id,
          doc_type: doc.doc_type,
          expiry_date: doc.expiry_date,
          diffDays,
          vehicle,
          activeBooking
        }
      })
  }, [vehicleLegalDocs, vehicles, allBookings])

  /* ── Core dual-mode filter engine ── */
  const normalizePhone = (raw?: string): string => {
    if (!raw) return ''
    return raw
      .replace(/^\+216/, '')   // strip Tunisian country code
      .replace(/\D/g, '')      // strip all non-digit characters
      .trim()
  }

  const filteredExpiringDocs = useMemo(() => {
    if (!textQuery.trim()) return expiringDocs

    const q = textQuery.toLowerCase().trim()
    return expiringDocs.filter(doc => {
      const matchPlate = doc.vehicle?.license_plate?.toLowerCase()?.includes(q) ?? false
      const matchBrand = doc.vehicle?.brand?.toLowerCase()?.includes(q)         ?? false
      const matchModel = doc.vehicle?.model?.toLowerCase()?.includes(q)         ?? false
      
      const matchName  = doc.activeBooking?.clients?.full_name?.toLowerCase()?.includes(q) ?? 
                         doc.activeBooking?.client_name?.toLowerCase()?.includes(q)        ?? false
      const matchCin   = doc.activeBooking?.clients?.license_number?.toLowerCase()?.includes(q) ?? false

      const normalizedStoredPhone = normalizePhone(doc.activeBooking?.clients?.phone)
      const normalizedQuery       = normalizePhone(textQuery)
      const matchPhone = normalizedQuery.length >= 4
        ? normalizedStoredPhone.includes(normalizedQuery)
        : (doc.activeBooking?.clients?.phone?.toLowerCase()?.includes(q) ?? false)

      const matchId    = doc.activeBooking?.id?.toLowerCase()?.includes(q)      ?? false

      return matchPlate || matchBrand || matchModel ||
             matchName  || matchCin   || matchPhone || matchId
    })
  }, [expiringDocs, textQuery])

  const results = useMemo<OmniBooking[]>(() => {
    if (!textQuery.trim() && !interceptDate && !activeAlertFilter) return []

    // Timezone-safe local today calculation
    const localToday = new Date()
    const yStr = localToday.getFullYear()
    const mStr = String(localToday.getMonth() + 1).padStart(2, '0')
    const dStr = String(localToday.getDate()).padStart(2, '0')
    const todayStr = `${yStr}-${mStr}-${dStr}`

    let filtered = allBookings

    if (activeAlertFilter) {
      if (activeAlertFilter === 'overdue') {
        filtered = filtered.filter(b => {
          if (b.status === 'completed' || b.status === 'cancelled') return false
          return b.end_date < todayStr
        })
      } else if (activeAlertFilter === 'balances') {
        filtered = filtered.filter(b => {
          if (b.status === 'cancelled') return false
          const total = Number(b.total_amount) || 0
          const acompte = Number(b.acompte_paid) || 0
          return (total - acompte) > 0
        })
      } else if (activeAlertFilter === 'expiring') {
        const expiringVehicleIds = new Set(
          vehicleLegalDocs
            .filter(doc => {
              if (!doc.expiry_date || !doc.vehicle_id) return false
              const expDate = new Date(doc.expiry_date)
              const todayObj = new Date(localToday.getFullYear(), localToday.getMonth(), localToday.getDate())
              const expObj = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate())
              const diffTime = expObj.getTime() - todayObj.getTime()
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              return diffDays <= 7 && diffDays >= 0
            })
            .map(doc => doc.vehicle_id)
        )
        filtered = filtered.filter(b => b.vehicle_id && expiringVehicleIds.has(b.vehicle_id))
      }
    }

    return filtered.filter(b => {
      // ── GATE 1: Date interception (traffic-fine mode) ──
      if (interceptDate) {
        const sd = b.start_date ?? ''
        const ed = b.end_date   ?? ''
        if (!sd || !ed) return false
        const withinPeriod = interceptDate >= sd && interceptDate <= ed
        if (!withinPeriod) return false
      }

      // ── GATE 2: Omni-text (7 dimensions, fully null-safe) ──
      if (!textQuery.trim()) return true
      const q = textQuery.toLowerCase().trim()

      const matchPlate = b.vehicles?.license_plate?.toLowerCase()?.includes(q) ?? false
      const matchBrand = b.vehicles?.brand?.toLowerCase()?.includes(q)         ?? false
      const matchModel = b.vehicles?.model?.toLowerCase()?.includes(q)         ?? false
      const matchName  = b.clients?.full_name?.toLowerCase()?.includes(q)      ?? false
      const matchCin   = b.clients?.license_number?.toLowerCase()?.includes(q) ?? false

      const normalizedStoredPhone = normalizePhone(b.clients?.phone)
      const normalizedQuery       = normalizePhone(textQuery)
      const matchPhone = normalizedQuery.length >= 4
        ? normalizedStoredPhone.includes(normalizedQuery)
        : (b.clients?.phone?.toLowerCase()?.includes(q) ?? false)

      const matchId    = b.id?.toLowerCase()?.includes(q)      ?? false

      return matchPlate || matchBrand || matchModel ||
             matchName  || matchCin   || matchPhone || matchId
    })
  }, [allBookings, textQuery, interceptDate, activeAlertFilter, vehicleLegalDocs])

  const clearAll = () => {
    setTextQuery('')
    setInterceptDate('')
    setActiveAlertFilter(null)
  }

  const emptyMsg = useMemo(() => {
    if (!isActive) return null
    if (activeAlertFilter === 'expiring') {
      if (filteredExpiringDocs.length > 0) return null
      if (textQuery.trim()) {
        return `No expiring documents match "${textQuery}".`
      }
      return `No legal documents currently match the expiring filter.`
    }
    if (results.length > 0) return null
    if (activeAlertFilter) {
      const name = activeAlertFilter === 'overdue' ? 'Overdue Returns' : activeAlertFilter === 'balances' ? 'Pending Balances' : 'Expiring Vehicle Documents'
      if (textQuery.trim()) {
        return `No bookings matching "${textQuery}" under the "${name}" alert filter.`
      }
      return `No bookings currently match the "${name}" alert filter.`
    }
    if (textQuery && interceptDate)
      return `No contract for "${textQuery}" was active on ${fmt(interceptDate)}.`
    if (interceptDate && !textQuery)
      return `No active rentals found on ${fmt(interceptDate)}.`
    return `No contracts found matching "${textQuery}".`
  }, [isActive, results.length, textQuery, interceptDate, activeAlertFilter, filteredExpiringDocs.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
      <style>{`
        @keyframes omni-pulse-crimson {
          0% {
            box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.7);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        @keyframes omni-glow-emerald {
          0% {
            box-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
          }
          100% {
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
          }
        }
        @keyframes omni-glow-criminal {
          0% {
            box-shadow: 0 0 4px #ff0055;
          }
          100% {
            box-shadow: 0 0 14px #ff0055;
          }
        }
        @keyframes omni-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Search Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.9rem 1.25rem',
        background: 'rgba(10, 8, 7, 0.92)',
        border: `1px solid ${interceptDate ? 'rgba(245,158,11,0.5)' : 'rgba(229,193,125,0.22)'}`,
        borderRadius: '14px',
        boxShadow: interceptDate
          ? '0 0 0 3px rgba(245,158,11,0.12), 0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'border-color 0.25s, box-shadow 0.25s',
      }}>
        <Search size={20} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
        <input
          type="text"
          value={textQuery}
          onChange={e => setTextQuery(e.target.value)}
          placeholder="Search by plate, name, CIN, phone, brand, model..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '1rem',
            fontFamily: 'var(--font-body)',
            minWidth: 0,
          }}
        />

        <div style={{ width: '1px', height: '28px', background: 'rgba(229,193,125,0.15)', flexShrink: 0 }} />

        <Calendar size={18} style={{ color: interceptDate ? '#f59e0b' : 'rgba(229,193,125,0.5)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(229,193,125,0.5)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
            Incident Date
          </span>
          <input
            type="date"
            value={interceptDate}
            onChange={e => setInterceptDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: interceptDate ? '#f59e0b' : 'rgba(255,255,255,0.6)',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              colorScheme: 'dark',
              padding: 0,
            }}
          />
        </div>

        {isActive && (
          <button
            onClick={clearAll}
            style={{
              background: 'rgba(229,193,125,0.1)',
              border: '1px solid rgba(229,193,125,0.2)',
              borderRadius: '6px',
              color: 'rgba(229,193,125,0.7)',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Active Alert Filter Banner ── */}
      {activeAlertFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          background: 'rgba(229, 193, 125, 0.05)',
          border: '1px solid rgba(229, 193, 125, 0.25)',
          borderRadius: '10px',
          fontSize: '0.9rem',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#E5C17D',
              boxShadow: '0 0 8px #E5C17D'
            }} />
            <span>
              Drilling active: Showing bookings matching <strong>
                {activeAlertFilter === 'overdue' && 'Overdue Returns'}
                {activeAlertFilter === 'balances' && 'Pending Balances'}
                {activeAlertFilter === 'expiring' && 'Expiring Vehicle Documents'}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setActiveAlertFilter(null)}
            style={{
              background: 'rgba(229, 193, 125, 0.1)',
              border: '1px solid rgba(229, 193, 125, 0.3)',
              borderRadius: '6px',
              color: '#E5C17D',
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s',
            }}
          >
            Clear Filter [X]
          </button>
        </div>
      )}

      {/* ── Traffic-Fine Mode Banner ── */}
      {interceptDate && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.65rem 1rem',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#f59e0b',
        }}>
          <AlertTriangle size={16} />
          <span>
            <strong>Traffic-Fine Mode</strong> — Showing all active contracts on{' '}
            <strong>{fmt(interceptDate)}</strong>
            {textQuery && <> for <strong>"{textQuery}"</strong></>}
          </span>
        </div>
      )}

      {/* ── Results ── */}

      {/* ── EXPIRING DOCS OVERRIDE: High-Density Legal Document Alert List ── */}
      {activeAlertFilter === 'expiring' && filteredExpiringDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(229,193,125,0.45)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {filteredExpiringDocs.length} Document{filteredExpiringDocs.length > 1 ? 's' : ''} Expiring Within 7 Days
          </p>
          {filteredExpiringDocs.map(doc => {
            const docLabel =
              doc.doc_type === 'assurance' ? 'Insurance (Assurance)' :
              doc.doc_type === 'visite_technique' ? 'Technical Inspection (Visite)' :
              doc.doc_type === 'laissez_passer' ? 'Transport Authorization (Laissez-Passer)' :
              doc.doc_type
            const urgency = doc.diffDays <= 2 ? 'critical' : doc.diffDays <= 4 ? 'warning' : 'caution'
            const urgencyColor = urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#E5C17D'
            const urgencyBg = urgency === 'critical' ? 'rgba(239,68,68,0.06)' : urgency === 'warning' ? 'rgba(245,158,11,0.06)' : 'rgba(229,193,125,0.04)'
            const urgencyBorder = urgency === 'critical' ? 'rgba(239,68,68,0.25)' : urgency === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(229,193,125,0.2)'
            const isExpanded = expandedDocId === doc.id
            const plate = doc.vehicle?.license_plate || 'NO PLATE'
            const brand = doc.vehicle?.brand || '—'
            const model = doc.vehicle?.model || '—'

            return (
              <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${urgencyBorder}`, boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${urgencyBorder}` }}>
                {/* ── Main Document Row ── */}
                <div
                  onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto auto',
                    alignItems: 'center',
                    gap: '1.25rem',
                    padding: '1.1rem 1.4rem',
                    background: urgencyBg,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Vehicle Identity */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                        {plate}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#fff' }}>
                        {brand} {model}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{docLabel}</span>
                  </div>

                  {/* Expiry Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Expires</span>
                    <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                      {new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Countdown Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '20px',
                    background: urgency === 'critical' ? 'rgba(239,68,68,0.12)' : urgency === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(229,193,125,0.1)',
                    border: `1px solid ${urgencyColor}40`,
                    animation: urgency === 'critical' ? 'pulse-urgency 1.8s ease-in-out infinite' : 'none',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgencyColor, boxShadow: `0 0 6px ${urgencyColor}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: urgencyColor, whiteSpace: 'nowrap' }}>
                      {doc.diffDays === 0 ? 'Expires TODAY' : `Expires in ${doc.diffDays} day${doc.diffDays > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Deployment Status Pill */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '20px',
                    background: doc.activeBooking ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                    border: `1px solid ${doc.activeBooking ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: doc.activeBooking ? '#f87171' : '#34d399', fontWeight: 600 }}>
                      {doc.activeBooking ? '🔴 On Road' : '🟢 In Garage'}
                    </span>
                  </div>

                  {/* Expand Toggle */}
                  <div style={{ color: 'rgba(229,193,125,0.5)', fontSize: '0.8rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s', userSelect: 'none' }}>
                    ▼
                  </div>
                </div>

                {/* ── Inline Deployment Drawer ── */}
                {isExpanded && (
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    background: 'rgba(10,8,7,0.92)',
                    borderTop: '1px solid rgba(229,193,125,0.1)',
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'rgba(229,193,125,0.5)', display: 'block', marginBottom: '0.85rem' }}>
                      Current Asset Deployment Status
                    </span>

                    {doc.activeBooking ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                        {/* Driver */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Current Driver</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #E5C17D, #8a6d35)',
                              color: '#1a1410', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                            }}>
                              {(doc.activeBooking.clients?.full_name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                            </div>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                              {doc.activeBooking.clients?.full_name || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        {/* Phone */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Phone</span>
                          <span style={{ color: '#fff', fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            {doc.activeBooking.clients?.phone || '—'}
                          </span>
                        </div>

                        {/* Estimated Return */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Est. Return</span>
                          <span style={{ color: '#E5C17D', fontWeight: 600, fontSize: '0.88rem' }}>
                            {new Date(doc.activeBooking.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {doc.activeBooking.return_time ? ` @ ${doc.activeBooking.return_time}` : ''}
                          </span>
                        </div>

                        {/* Booking ID */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Contract</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-gold)', background: 'rgba(229,193,125,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                            #{doc.activeBooking.id?.substring(0, 6).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.85rem 1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🟢</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.9rem' }}>Asset Inside Garage — Ready for Maintenance</div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.15rem' }}>
                            Vehicle is not currently assigned to any active booking. Schedule maintenance now.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Standard Booking Results (non-expiring filters) ── */}
      {activeAlertFilter !== 'expiring' && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.length > 10 && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(229,193,125,0.5)', textAlign: 'right' }}>
              Showing top 10 of {results.length} matches
            </p>
          )}
          {results.slice(0, 10).map(booking => (
            <OmniResultCard
              key={booking.id}
              booking={booking}
              isFineHighlight={!!interceptDate}
              onEdit={() => setEditingBooking(booking)}
              allBookings={allBookings}
            />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {emptyMsg && !(activeAlertFilter === 'expiring' && filteredExpiringDocs.length > 0) && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(229,193,125,0.45)',
          fontSize: '0.9rem',
          background: 'rgba(10,8,7,0.5)',
          border: '1px dashed rgba(229,193,125,0.12)',
          borderRadius: '12px',
        }}>
          {emptyMsg}
        </div>
      )}

      {/* ── Quick-Edit Return Modal ── */}
      <QuickEditBookingModal
        booking={editingBooking}
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
        vehiclePricePerDay={editingBooking?.vehicles?.price_per_day}
      />
    </div>
  )
}

/* ─── OmniResultCard ─────────────────────────────────────────────── */
function OmniResultCard({
  booking,
  isFineHighlight,
  onEdit,
  allBookings,
}: {
  booking: OmniBooking
  isFineHighlight: boolean
  onEdit: () => void
  allBookings: OmniBooking[]
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loadingStatus, setLoadingStatus] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    setLoadingStatus(true)
    try {
      await updateBookingStatus(booking.id, newStatus)
      showToast(`Booking status updated to ${newStatus} successfully!`, 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error')
    } finally {
      setLoadingStatus(false)
    }
  }

  const total   = Number(booking.total_amount) || 0
  const acompte = Number(booking.acompte_paid)  || 0
  const reste   = total - acompte
  const notes   = booking.damage_notes || ''
  const isPerfectComment = notes.toLowerCase().includes('perfect normal return') || notes.includes('[GREEN]')
  const hasDamage = Boolean(booking.damage_notes)

  const borderColor = isFineHighlight
    ? 'rgba(245,158,11,0.5)'
    : 'rgba(229,193,125,0.15)'

  const glowStyle = isFineHighlight
    ? '0 0 0 2px rgba(245,158,11,0.15), 0 8px 24px rgba(0,0,0,0.5)'
    : '0 4px 16px rgba(0,0,0,0.4)'

  // Render mathematical trust badge with security icons/stars
  const renderTrustBadge = () => {
    const { score, riskLevel } = getClientRiskProfile(booking.clients?.id, booking.client_name, allBookings)

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
        }}>
          New Client
        </span>
      )
    }

    if (riskLevel === 'criminal') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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
            animation: 'omni-glow-criminal 1.5s infinite alternate',
            width: 'fit-content'
          }}>
            <ShieldIcon size={12} style={{ fill: 'rgba(255, 68, 68, 0.2)' }} />
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
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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
            <ShieldIcon size={12} style={{ fill: 'rgba(244, 63, 94, 0.2)' }} />
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
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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
            <ShieldIcon size={12} style={{ fill: 'rgba(245, 158, 11, 0.2)' }} />
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
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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

    // very_low_risk (Elite / VIP Renter)
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
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
          animation: 'omni-glow-emerald 1.5s infinite alternate',
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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1.2fr 1fr 120px 1.2fr 130px 130px 140px 48px',
      gap: '0',
      background: 'rgba(14, 11, 9, 0.88)',
      border: `1px solid ${borderColor}`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: glowStyle,
      animation: 'omni-slidein 0.2s ease',
    }}>
      {/* Contract ID */}
      <Cell style={{ background: 'rgba(229,193,125,0.04)' }}>
        <Label>Contract</Label>
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          fontSize: '0.82rem',
          background: 'rgba(229,193,125,0.1)',
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
        }}>
          #{booking.id.substring(0, 6).toUpperCase()}
        </span>
        {hasDamage && !isPerfectComment && (
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.3rem' }}>⚠️ Damage</span>
        )}
      </Cell>

      {/* Client Main & Trust Score */}
      <Cell>
        <Label>Client</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-gold), #8a6d35)',
            color: '#1a1410', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem',
            flexShrink: 0,
          }}>
            {initials(booking.clients?.full_name)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {booking.clients?.full_name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(229,193,125,0.5)', marginBottom: '0.2rem' }}>
              {booking.clients?.phone || '—'}
            </div>
            {renderTrustBadge()}
          </div>
        </div>
      </Cell>

      {/* Legal Docs */}
      <Cell>
        <Label>Legal Docs</Label>
        <Stack>
          <Row lbl="CIN" val={booking.clients?.license_number} />
          <Row lbl="Iss" val={fmt(booking.clients?.cin_delivre_le)} />
          <Row lbl="Permis" val={booking.clients?.permis_numero} />
          <Row lbl="DOB" val={fmt(booking.clients?.date_naissance)} />
        </Stack>
      </Cell>

      {/* Vehicle */}
      <Cell>
        <Label>Vehicle</Label>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
          {booking.vehicles?.brand} {booking.vehicles?.model}
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: '0.78rem', color: '#fff',
          background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.4rem',
          borderRadius: '4px', display: 'inline-block', marginTop: '0.25rem',
        }}>
          {booking.vehicles?.license_plate || 'NO PLATE'}
        </span>
      </Cell>

      {/* Rental Period */}
      <Cell>
        <Label>Rental Period</Label>
        <Stack>
          <Row lbl="Dep" val={`${fmt(booking.start_date)} ${booking.departure_time || ''}`} />
          <Row lbl="Ret" val={`${fmt(booking.end_date)} ${booking.return_time || ''}`} />
          <span style={{
            display: 'inline-block', marginTop: '0.25rem',
            background: 'rgba(229,193,125,0.15)', color: 'var(--accent-gold)',
            padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700,
            fontSize: '0.75rem',
          }}>
            {booking.rental_days_text || '—'} days
          </span>
        </Stack>
      </Cell>

      {/* Financials */}
      <Cell>
        <Label>Financials</Label>
        <Stack>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Total</span>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{total.toFixed(0)} DT</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Acompte</span>
            <strong style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{acompte.toFixed(0)} DT</strong>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '0.5rem',
            borderTop: '1px dashed rgba(229,193,125,0.2)', paddingTop: '0.25rem', marginTop: '0.1rem',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Reste</span>
            <strong style={{ color: reste > 0 ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>
              {reste.toFixed(0)} DT
            </strong>
          </div>
        </Stack>
      </Cell>

      {/* Condition (Delta view) */}
      <Cell>
        <Label>Condition Δ</Label>
        <Stack>
          <span style={tagStyle}>⛽ {booking.fuel_level_pickup || '—'} → {booking.fuel_level_return || '—'}</span>
          <span style={tagStyle}>💧 {booking.lavage_pickup ? (booking.lavage_pickup === 'clean_wash' ? 'Clean' : booking.lavage_pickup === 'average_dust' ? 'Avg' : 'Dirty') : '—'} → {booking.lavage_return ? (booking.lavage_return === 'clean_wash' ? 'Clean' : booking.lavage_return === 'average_dust' ? 'Avg' : 'Dirty') : '—'}</span>
          <span style={tagStyle}>🛣️ {booking.starting_km ?? '—'} → {booking.return_km !== undefined && booking.return_km !== null ? `${booking.return_km} km` : '-- km'}</span>
          {hasDamage && (() => {
            const notes = booking.damage_notes || '';
            const isPerfect = notes.toLowerCase().includes('perfect normal return') || notes.includes('[GREEN]');
            const cleanNotes = notes.replace('[GREEN]', '').trim();
            return (
              <span 
                style={{ 
                  ...tagStyle, 
                  background: isPerfect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                  color: isPerfect ? '#10b981' : '#ef4444', 
                  border: isPerfect ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)', 
                  marginTop: '0.25rem' 
                }}
              >
                {isPerfect ? '✅' : '⚠️'} {cleanNotes.substring(0, 22)}{cleanNotes.length > 22 ? '…' : ''}
              </span>
            );
          })()}
        </Stack>
      </Cell>

      {/* Interactive Status Selector */}
      <Cell style={{ justifyContent: 'center' }}>
        <Label>Status</Label>
        <div style={{ position: 'relative', width: '100%', marginTop: '0.2rem' }}>
          <select
            value={booking.status?.toLowerCase() || 'pending'}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loadingStatus}
            style={{
              width: '100%',
              background: booking.status?.toLowerCase() === 'confirmed' ? 'rgba(16, 185, 129, 0.08)' :
                          booking.status?.toLowerCase() === 'completed' ? 'rgba(229, 193, 125, 0.08)' :
                          booking.status?.toLowerCase() === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' :
                          'rgba(245, 158, 11, 0.08)',
              color: booking.status?.toLowerCase() === 'confirmed' ? '#34d399' :
                     booking.status?.toLowerCase() === 'completed' ? '#E5C17D' :
                     booking.status?.toLowerCase() === 'cancelled' ? '#f87171' :
                     '#fbbf24',
              border: `1px solid ${
                booking.status?.toLowerCase() === 'confirmed' ? 'rgba(16, 185, 129, 0.3)' :
                booking.status?.toLowerCase() === 'completed' ? 'rgba(229, 193, 125, 0.3)' :
                booking.status?.toLowerCase() === 'cancelled' ? 'rgba(239, 68, 68, 0.3)' :
                'rgba(245, 158, 11, 0.3)'
              }`,
              borderRadius: '8px',
              padding: '0.4rem 0.5rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: loadingStatus ? 'not-allowed' : 'pointer',
              outline: 'none',
              appearance: 'none',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}
          >
            <option value="pending" style={{ background: '#0e0b09', color: '#fbbf24' }}>Pending</option>
            <option value="confirmed" style={{ background: '#0e0b09', color: '#34d399' }}>Confirmed</option>
            <option value="completed" style={{ background: '#0e0b09', color: '#E5C17D' }}>Completed</option>
            <option value="cancelled" style={{ background: '#0e0b09', color: '#f87171' }}>Cancelled</option>
          </select>
          {loadingStatus && (
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'omni-spin 0.6s linear infinite'
            }} />
          )}
        </div>
      </Cell>

      {/* Actions */}
      <Cell style={{ alignItems: 'center', justifyContent: 'center', background: 'rgba(229,193,125,0.03)' }}>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit()
          }}
          title="Quick Edit"
          style={{
            background: 'rgba(229,193,125,0.1)',
            border: '1px solid rgba(229,193,125,0.2)',
            borderRadius: '8px',
            color: 'var(--accent-gold)',
            cursor: 'pointer',
            padding: '0.55rem',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Edit2 size={16} />
        </button>
      </Cell>
    </div>
  )
}

/* ─── Micro helpers ─────────────────────────────────────────────── */
const Cell = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    padding: '0.85rem 0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    borderRight: '1px solid rgba(229,193,125,0.06)',
    minWidth: 0,
    ...style,
  }}>
    {children}
  </div>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    fontSize: '0.62rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'rgba(229,193,125,0.45)',
    marginBottom: '0.2rem',
  }}>
    {children}
  </span>
)

const Stack = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
    {children}
  </div>
)

const Row = ({ lbl, val }: { lbl: string; val?: string }) => (
  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
    <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.45)', fontWeight: 700, flexShrink: 0 }}>{lbl}:</span>
    <span style={{ fontSize: '0.8rem', color: '#fff' }}>{val || 'N/A'}</span>
  </div>
)

const tagStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  background: 'rgba(255,255,255,0.05)',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  color: 'rgba(255,255,255,0.75)',
  display: 'inline-block',
}
