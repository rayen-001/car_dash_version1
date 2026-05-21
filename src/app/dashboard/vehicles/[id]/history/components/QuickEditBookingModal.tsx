import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { updateBookingHistoricalDetails } from '@/app/actions'
import type { Booking as GlobalBooking } from '@/types'
import styles from '../history.module.css'
import { X, Save, Loader2, Award, Calendar, ArrowRight } from 'lucide-react'

// ModalBooking: a flexible superset that both MasterOperationsGrid (global Booking)
// and GlobalCommandSearch (OmniBooking) can satisfy without structural conflicts.
// All fields are optional except id and vehicle_id, which the submit handler requires.
type ModalBooking = Partial<Omit<GlobalBooking, 'id' | 'vehicle_id' | 'vehicles'>> & {
  id: string
  vehicle_id: string
  vehicles?: {
    brand?: string
    model?: string
    year?: number
    license_plate?: string
    price_per_day?: number
  }
}

interface QuickEditBookingModalProps {
  booking: ModalBooking | null
  isOpen: boolean
  onClose: () => void
  vehiclePricePerDay?: number
}

export default function QuickEditBookingModal({
  booking,
  isOpen,
  onClose,
  vehiclePricePerDay
}: QuickEditBookingModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Resolve daily price rate (fallback sequence: prop -> nested query -> default 0)
  const pricePerDay = vehiclePricePerDay ?? booking?.vehicles?.price_per_day ?? 0

  // Calculate rental days helper
  const getRentalDays = () => {
    if (!booking?.start_date || !booking?.end_date) return 1
    const start = new Date(booking.start_date)
    const end = new Date(booking.end_date)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1
  }

  // Calculate suggested KM helper
  const getSuggestedKm = () => {
    if (!booking) return 0
    const rentalDays = getRentalDays()
    return (booking.starting_km ?? 0) + (rentalDays * 150)
  }

  // Form State - Return & Extension Phase
  const [returnKm, setReturnKm] = useState('')
  const [fuelLevelReturn, setFuelLevelReturn] = useState('Full')
  const [lavageReturn, setLavageReturn] = useState('clean_wash')
  const [activeBehaviors, setActiveBehaviors] = useState<string[]>(['clean'])
  const [behaviorFees, setBehaviorFees] = useState<Record<string, string>>({})
  const [damageNotes, setDamageNotes] = useState('')
  const [commentColor, setCommentColor] = useState<'red' | 'green'>('red')
  const [extensionDate, setExtensionDate] = useState('')
  
  // New States for Cash Ledger Update and Incident Penalties
  const [incidentPenalties, setIncidentPenalties] = useState('')
  const [amountCollectedNow, setAmountCollectedNow] = useState('')

  // Sync state when booking changes
  useEffect(() => {
    if (booking) {
      const suggested = getSuggestedKm()
      setReturnKm(booking.return_km?.toString() || suggested.toString())
      setFuelLevelReturn(booking.fuel_level_return || 'Full')
      setLavageReturn(booking.lavage_return || 'clean_wash')
      
      const initialBehaviors = booking.client_behavior_status
        ? booking.client_behavior_status.split(',').map(s => s.trim()).filter(Boolean)
        : ['clean']
      setActiveBehaviors(initialBehaviors)

      const initialFees: Record<string, string> = {}
      initialBehaviors.forEach(b => {
        if (b === 'minor_damage') {
          initialFees[b] = '100'
        } else {
          initialFees[b] = '0'
        }
      })
      setBehaviorFees(initialFees)

      const initialNotes = booking.damage_notes ?? ''
      if (initialNotes.includes('[GREEN]') || initialNotes.toLowerCase().includes('perfect normal return')) {
        setCommentColor('green')
        setDamageNotes(initialNotes.replace('[GREEN]', '').trim())
      } else {
        setCommentColor('red')
        setDamageNotes(initialNotes)
      }
      
      setExtensionDate('')
      setIncidentPenalties('')
      setAmountCollectedNow('')
      setError(null)
    }
  }, [booking])

  // Automatically calculate incident penalties based on active behaviors and their fees
  useEffect(() => {
    let total = 0
    activeBehaviors.forEach(b => {
      if (b !== 'clean') {
        const fee = parseFloat(behaviorFees[b] || '0')
        if (!isNaN(fee)) {
          total += fee
        }
      }
    })
    setIncidentPenalties(total > 0 ? total.toFixed(2) : '')
  }, [activeBehaviors, behaviorFees])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen || !booking) return null

  // Calculate extension & ledger details
  const safeEndDate   = booking.end_date   ?? ''
  const safeTotalAmt  = booking.total_amount ?? 0
  const penaltyVal    = incidentPenalties ? parseFloat(incidentPenalties) : 0
  const collectVal    = amountCollectedNow ? parseFloat(amountCollectedNow) : 0

  let deltaDays = 0
  let extraCost = 0
  let newRentalDaysText = booking.rental_days_text || ''

  if (extensionDate && safeEndDate) {
    const origDateStr = safeEndDate.split('T')[0]
    const extDateStr = extensionDate.split('T')[0]
    
    if (origDateStr !== extDateStr) {
      const origMidnight = new Date(`${origDateStr}T00:00:00`)
      const extMidnight = new Date(`${extDateStr}T00:00:00`)
      const deltaMs = extMidnight.getTime() - origMidnight.getTime()
      deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24))
    } else {
      deltaDays = 0
    }

    extraCost = deltaDays * pricePerDay

    // Compute new adjustment text format: e.g. "4+2" or "4-1"
    const baseDays = booking.rental_days_text || ''
    if (deltaDays > 0) {
      newRentalDaysText = baseDays ? `${baseDays}+${deltaDays}` : String(deltaDays)
    } else if (deltaDays < 0) {
      newRentalDaysText = baseDays ? `${baseDays}${deltaDays}` : String(deltaDays)
    } else {
      newRentalDaysText = baseDays
    }
  }

  // Real-time Dynamic Financial Ledger Recalculations
  const finalTotalAmount = Math.max(0, safeTotalAmt + extraCost + penaltyVal)
  const finalAcomptePaid = (booking.acompte_paid ?? 0) + collectVal
  const finalReste = Math.max(0, finalTotalAmount - finalAcomptePaid)
  const refundAmount = finalAcomptePaid > finalTotalAmount ? finalAcomptePaid - finalTotalAmount : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation: Return KM must be greater than or equal to starting KM (if defined)
    const retKmVal = returnKm ? parseInt(returnKm, 10) : null
    if (retKmVal !== null && booking.starting_km !== undefined && booking.starting_km !== null) {
      if (retKmVal < booking.starting_km) {
        setError(`Return KM (${retKmVal}) cannot be less than Starting KM (${booking.starting_km}).`)
        return
      }
    }

    // Validation: Return date must not be before start date
    if (extensionDate) {
      const startStr = booking.start_date ? booking.start_date.split('T')[0] : ''
      const extStr = extensionDate.split('T')[0]
      if (startStr && extStr < startStr) {
        setError('The new return date cannot be prior to the contract start date.')
        return
      }
    }
    
    startTransition(async () => {
      try {
        const finalDamageNotes = damageNotes
          ? (commentColor === 'green' ? `[GREEN] ${damageNotes}` : damageNotes)
          : null;

        const payload: any = {
          return_km: retKmVal,
          fuel_level_return: fuelLevelReturn || null,
          lavage_return: lavageReturn || null,
          client_behavior_status: activeBehaviors.length > 0 ? activeBehaviors.join(',') : 'clean',
          damage_notes: finalDamageNotes,
          status: 'completed', // Automatically complete/close the contract on submit
          
          // Ledger & Penalty fields passed to server action
          total_amount: finalTotalAmount,
          acompte_paid: finalAcomptePaid,
          amount_collected_now: collectVal,
          incident_penalties: penaltyVal,
        }

        // Apply extension or early return values if selected
        if (deltaDays !== 0) {
          payload.end_date = extensionDate
          payload.rental_days_text = newRentalDaysText
        }

        await updateBookingHistoricalDetails(booking.id, booking.vehicle_id, payload)
        
        router.refresh()
        onClose()
      } catch (err: any) {
        setError(err.message || 'Failed to update return details.')
      }
    })
  }

  // 1-Click Fast Close Preset Action
  const handleFastClose = async () => {
    setError(null)
    const suggested = getSuggestedKm()

    startTransition(async () => {
      try {
        const payload: any = {
          return_km: suggested,
          fuel_level_return: 'Full',
          lavage_return: 'clean_wash',
          client_behavior_status: 'excellent',
          damage_notes: damageNotes ? `${damageNotes}\n[Perfect normal return. Fast closed by system.]` : 'Perfect normal return. Fast closed by system.',
          status: 'completed',
          total_amount: booking.total_amount ?? 0,
          acompte_paid: booking.acompte_paid ?? 0,
          amount_collected_now: 0,
          incident_penalties: 0,
        }
        await updateBookingHistoricalDetails(booking.id, booking.vehicle_id, payload)
        router.refresh()
        onClose()
      } catch (err: any) {
        setError(err.message || 'Failed to fast close contract.')
      }
    })
  }

  // Behavior selection handler supporting multiple concurrent selections
  const handleBehaviorSelect = (val: string) => {
    if (val === 'clean') {
      setActiveBehaviors(['clean'])
      setBehaviorFees({})
    } else {
      let updated: string[] = []
      const isCurrentlyActive = activeBehaviors.includes(val)
      
      if (isCurrentlyActive) {
        updated = activeBehaviors.filter(b => b !== val)
        if (updated.length === 0) {
          updated = ['clean']
        }
      } else {
        updated = [...activeBehaviors.filter(b => b !== 'clean'), val]
      }
      
      setActiveBehaviors(updated)
      
      setBehaviorFees(prev => {
        const next = { ...prev }
        if (isCurrentlyActive) {
          delete next[val]
        } else {
          // Initialize minor_damage to '100' default, others to '0'
          next[val] = val === 'minor_damage' ? '100' : '0'
        }
        return next
      })
    }
  }

  const handleFeeChange = (behaviorKey: string, val: string) => {
    setBehaviorFees(prev => ({
      ...prev,
      [behaviorKey]: val
    }))
  }

  // Formatting date for displaying helper
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '—'
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB')
    } catch {
      return dateStr || '—'
    }
  }

  const modalJSX = (
    <div className={`${styles['modal-overlay'] || ''} modal-overlay`}>
      <div className={`${styles['edit-modal'] || ''} edit-modal glass-panel`} style={{ maxWidth: '560px' }}>
        
        <div className={styles['modal-header']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} style={{ color: 'var(--accent-gold)' }} />
            <h3 className={styles['modal-title']}>Close Contract &amp; Return Phase</h3>
          </div>
          <button onClick={onClose} className={styles['close-btn']} disabled={isPending}>
            <X size={20} />
          </button>
        </div>

        {/* Champagne-gold Fast Close Preset Button */}
        <div style={{ padding: '0.5rem 1.5rem 0' }}>
          <button
            type="button"
            onClick={handleFastClose}
            disabled={isPending}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, rgba(229,193,125,0.15) 0%, rgba(197,160,89,0.25) 100%)',
              border: '1px solid var(--accent-gold)',
              borderRadius: '8px',
              color: 'var(--accent-gold)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(229,193,125,0.1)'
            }}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : '✨'}
            Fast Close (Perfect Normal Return) — Close in 1-Click
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles['modal-form']}>
          {error && <div className={styles['error-alert']}>{error}</div>}

          {/* Baseline Info Header */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(229,193,125,0.03)', border: '1px solid rgba(229,193,125,0.08)', borderRadius: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Contract End Date:</span>
              <strong style={{ color: '#fff' }}>{safeEndDate ? formatDate(safeEndDate) : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Starting Odometer:</span>
              <strong style={{ color: '#fff' }}>{booking.starting_km ?? '—'} KM</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current Total Amount:</span>
              <strong style={{ color: 'var(--accent-gold)' }}>{booking.total_amount} DT</strong>
            </div>
          </div>

          {/* ── AUTOMATED EXTENSION ENGINE ── */}
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            background: 'rgba(229,193,125,0.04)',
            border: '1px solid rgba(229,193,125,0.15)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Calendar size={15} style={{ color: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-gold)' }}>
                Contract Duration Adjuster
              </span>
            </div>

            <div className={styles['form-group']} style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'block' }}>
                Adjust Return Date (Extend or Shorten Contract)
              </label>
              <input
                type="date"
                className={styles['form-input']}
                value={extensionDate}
                min={booking.start_date && typeof booking.start_date === 'string' ? booking.start_date.split('T')[0] : undefined}
                onChange={e => setExtensionDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Live Adjustment Preview Card */}
            {deltaDays !== 0 && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: deltaDays > 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                border: `1px dashed ${deltaDays > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: deltaDays > 0 ? '#34d399' : '#f87171',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{deltaDays > 0 ? 'Extension duration:' : 'Early return offset:'}</span>
                  <strong style={{ fontWeight: 700 }}>{deltaDays > 0 ? `+${deltaDays}` : `${deltaDays}`} Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Rental sequence update:</span>
                  <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: '#fff' }}>
                    {booking.rental_days_text || '?'} <ArrowRight size={11} style={{ display: 'inline', margin: '0 2px' }} /> {newRentalDaysText}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{deltaDays > 0 ? 'Extension cost' : 'Price deduction'} ({pricePerDay} DT/day):</span>
                  <strong style={{ fontWeight: 700 }}>{extraCost > 0 ? `+${extraCost}` : `${extraCost}`} DT</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px dashed ${deltaDays > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                  <span style={{ color: '#fff' }}>Adjusted Total Amount:</span>
                  <strong style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 800 }}>{finalTotalAmount.toFixed(2)} DT</strong>
                </div>
              </div>
            )}
          </div>

          {/* ── LIVE CASH LEDGER UPDATE ── */}
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            background: 'rgba(229,193,125,0.04)',
            border: '1px solid rgba(229,193,125,0.15)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-gold)' }}>
                💰 Live Cash Ledger Update
              </span>
            </div>

            {/* Horizontal Stacked Sub-bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(229,193,125,0.1)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.15rem' }}>Total Contract</div>
                <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{finalTotalAmount.toFixed(2)} DT</strong>
              </div>
              <div style={{ borderLeft: '1px solid rgba(229,193,125,0.15)', height: '24px', alignSelf: 'center' }}></div>
              <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.15rem' }}>Already Paid</div>
                <strong style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{finalAcomptePaid.toFixed(2)} DT</strong>
              </div>
              <div style={{ borderLeft: '1px solid rgba(229,193,125,0.15)', height: '24px', alignSelf: 'center' }}></div>
              <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.15rem' }}>Outstanding (Reste)</div>
                <strong style={{ color: finalReste > 0 ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>{finalReste.toFixed(2)} DT</strong>
              </div>
            </div>

            {/* Premium Dynamic Refund Banner */}
            {refundAmount > 0 && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
                backdropFilter: 'blur(10px)',
              }}>
                <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }}>⚠️</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <span style={{ fontWeight: 700 }}>Cash Balance Overpaid</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    Refund of <strong style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{refundAmount.toFixed(2)} DT</strong> due to client or credit log required.
                  </span>
                </div>
              </div>
            )}

            {/* Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'block' }}>
                  Incident Penalties &amp; Extra Fees (DT)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={styles['form-input']}
                    value={incidentPenalties}
                    onChange={e => setIncidentPenalties(e.target.value)}
                    placeholder="e.g. 50"
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>DT</span>
                </div>
              </div>

              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'block' }}>
                  Amount Collected Now (DT)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={styles['form-input']}
                    value={amountCollectedNow}
                    onChange={e => setAmountCollectedNow(e.target.value)}
                    placeholder="e.g. 100"
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>DT</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles['form-grid']}>
            
            {/* Odometer Return (Null-safe safety input) */}
            <div className={styles['form-group']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ margin: 0 }}>Return KM</label>
                <span style={{ fontSize: '0.7rem', color: 'rgba(229,193,125,0.7)', background: 'rgba(229,193,125,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  Suggested: {getSuggestedKm()} KM
                </span>
              </div>
              <input 
                type="number" 
                className={styles['form-input']} 
                value={returnKm} 
                onChange={e => setReturnKm(e.target.value)} 
                placeholder="Enter ending KM (e.g. 28450)" 
              />
            </div>

            {/* Fuel Level Return (Segment Toggles) */}
            <div className={styles['form-group']}>
              <label style={{ marginBottom: '0.35rem', display: 'block' }}>Fuel Level (Return)</label>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '8px' }}>
                {['Empty', '1/4', '1/2', '3/4', 'Full'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFuelLevelReturn(lvl)}
                    style={{
                      flex: '1 1 auto',
                      textAlign: 'center',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      border: '1px solid transparent',
                      background: fuelLevelReturn === lvl ? 'rgba(229, 193, 125, 0.15)' : 'transparent',
                      borderColor: fuelLevelReturn === lvl ? 'rgba(229, 193, 125, 0.3)' : 'transparent',
                      color: fuelLevelReturn === lvl ? 'var(--accent-gold)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Lavage Return (Segment Toggles) */}
            <div className={styles['form-group']}>
              <label style={{ marginBottom: '0.35rem', display: 'block' }}>Lavage Status (Return)</label>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '8px' }}>
                {[
                  { value: 'clean_wash', label: 'Clean' },
                  { value: 'average_dust', label: 'Dusty' },
                  { value: 'dirty', label: 'Dirty' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLavageReturn(item.value)}
                    style={{
                      flex: '1 1 auto',
                      textAlign: 'center',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      border: '1px solid transparent',
                      background: lavageReturn === item.value ? 'rgba(229, 193, 125, 0.15)' : 'transparent',
                      borderColor: lavageReturn === item.value ? 'rgba(229, 193, 125, 0.3)' : 'transparent',
                      color: lavageReturn === item.value ? 'var(--accent-gold)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Behavior / Damage Segment Controls */}
            <div className={`${styles['form-group']} ${styles['col-span-2']}`} style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '0.5rem', display: 'block' }}>
                Damage &amp; Behavior Segment Controls
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  {
                    value: 'clean',
                    label: '✓ No Damage',
                    desc: 'Perfect normal return or minor clean/excellent standing.',
                    color: '#10b981',
                    bg: 'rgba(16,185,129,0.05)',
                    border: 'rgba(16,185,129,0.2)'
                  },
                  {
                    value: 'dirty_return',
                    label: '🗑️ Dirty Return (-5 pts)',
                    desc: 'Excessively dirty return requiring commercial detail/wash.',
                    color: '#fbbf24',
                    bg: 'rgba(251,191,36,0.05)',
                    border: 'rgba(251,191,36,0.2)'
                  },
                  {
                    value: 'speeding',
                    label: '⚡ Speeding / Abuse (-15 pts)',
                    desc: 'Aggressive operation, extreme speeding, or telemetry violation.',
                    color: '#f59e0b',
                    bg: 'rgba(245,158,11,0.05)',
                    border: 'rgba(245,158,11,0.2)'
                  },
                  {
                    value: 'minor_damage',
                    label: '⚠ Scratch / Minor (-25 pts)',
                    desc: 'Scratch, scuff, or minor cosmetic surface blemish.',
                    color: '#ef4444',
                    bg: 'rgba(239,68,68,0.05)',
                    border: 'rgba(239,68,68,0.2)'
                  },
                  {
                    value: 'major_damage',
                    label: '💥 Structural / Major (-100 pts Hard Lock)',
                    desc: 'Structural, mechanical, or major body damage. Triggers hard lock.',
                    color: '#b91c1c',
                    bg: 'rgba(185,28,28,0.08)',
                    border: 'rgba(185,28,28,0.3)'
                  }
                ].map((opt) => {
                  const isSelected = activeBehaviors.includes(opt.value)
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleBehaviorSelect(opt.value)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '0.15rem',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: '1px solid',
                        textAlign: 'left',
                        width: '100%',
                        background: isSelected ? opt.bg : 'rgba(10, 8, 7, 0.4)',
                        borderColor: isSelected ? opt.color : 'rgba(255,255,255,0.05)',
                        boxShadow: isSelected ? `0 2px 8px ${opt.color}15` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: isSelected ? opt.color : '#ffffff'
                        }}>
                          {opt.label}
                        </span>
                        {isSelected && (
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            background: opt.color,
                            color: '#000000',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 800
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)',
                        marginBottom: isSelected && opt.value !== 'clean' ? '0.25rem' : '0'
                      }}>
                        {opt.desc}
                      </span>
                      {isSelected && opt.value !== 'clean' && (
                        <div 
                          style={{ 
                            marginTop: '0.5rem', 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            background: 'rgba(0,0,0,0.4)', 
                            padding: '0.4rem 0.6rem', 
                            borderRadius: '6px', 
                            border: '1px solid rgba(255,255,255,0.1)' 
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                            Custom Fee:
                          </span>
                          <input 
                            type="number" 
                            min="0" 
                            placeholder="0"
                            value={behaviorFees[opt.value] || ''}
                            onChange={(e) => handleFeeChange(opt.value, e.target.value)}
                            style={{
                              flex: '1',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textAlign: 'right',
                              padding: '0'
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                            DT
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Damage Notes */}
            <div className={`${styles['form-group']} ${styles['col-span-2']}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0 }}>Damage Notes / Return Remarks</label>
                <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.35)', padding: '0.2rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setCommentColor('red')}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: commentColor === 'red' ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                      color: commentColor === 'red' ? '#ef4444' : 'rgba(255,255,255,0.4)',
                      boxShadow: commentColor === 'red' ? '0 0 12px rgba(239,68,68,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                    Issue / Damage
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentColor('green')}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: commentColor === 'green' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                      color: commentColor === 'green' ? '#10b981' : 'rgba(255,255,255,0.4)',
                      boxShadow: commentColor === 'green' ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    Good Return
                  </button>
                </div>
              </div>
              <textarea 
                className={styles['form-textarea']} 
                value={damageNotes} 
                onChange={e => setDamageNotes(e.target.value)} 
                placeholder={commentColor === 'green' ? "Describe the perfect return standing, cleanliness or extra positive notes..." : "Log any scratches, damage remarks, or late return fees..."}
                rows={3}
                style={{
                  border: `1px solid ${commentColor === 'green' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                  transition: 'border-color 0.25s ease'
                }}
              />
            </div>

          </div>

          <div className={styles['modal-actions']}>
            <button type="button" onClick={onClose} className={styles['btn-secondary']} disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className={styles['btn-primary']} disabled={isPending}>
              {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isPending ? 'Closing...' : 'Close Contract & Save'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )

  return createPortal(modalJSX, document.body)
}
