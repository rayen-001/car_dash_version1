import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { updateBookingHistoricalDetails } from '@/app/actions'
import type { Booking as GlobalBooking } from '@/types'
import styles from '../history.module.css'
import { X, Save, Loader2, Award, Calendar, ArrowRight, MapPin, Clock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

// ModalBooking: a flexible superset that both MasterOperationsGrid (global Booking)
// and GlobalCommandSearch (OmniBooking) can satisfy without structural conflicts.
// All fields are optional except id and vehicle_id, which the submit handler requires.
type ModalBooking = Partial<Omit<GlobalBooking, 'id' | 'vehicle_id' | 'vehicles'>> & {
  id: string
  vehicle_id: string
  installments?: any[]
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
  const { lang } = useLanguage()

  // Resolve daily price rate (fallback sequence: prop -> nested query -> default 0)
  const rawPrice = vehiclePricePerDay !== undefined && vehiclePricePerDay !== null
    ? vehiclePricePerDay
    : (booking?.vehicles?.price_per_day ?? 0)
  const pricePerDay = typeof rawPrice === 'number' && !isNaN(rawPrice) ? rawPrice : parseFloat(rawPrice as any) || 0

  // Calculate rental days helper
  const getRentalDays = () => {
    if (!booking?.start_date || !booking?.end_date) return 1
    const start = new Date(booking.start_date)
    const end = new Date(booking.end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1
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
  const [commentColor, setCommentColor] = useState<'red' | 'green' | 'gray'>('red')
  const [extensionDate, setExtensionDate] = useState('')

  // Logistics Handover States
  const [handoverLocation, setHandoverLocation] = useState('')
  const [handoverDate, setHandoverDate] = useState('')
  const [handoverTime, setHandoverTime] = useState('')
  
  // New States for Cash Ledger Update and Incident Penalties
  const [baseTotalAmt, setBaseTotalAmt] = useState('')
  const [baseAcomptePaid, setBaseAcomptePaid] = useState('')
  const [incidentPenalties, setIncidentPenalties] = useState('')
  const [amountCollectedNow, setAmountCollectedNow] = useState('')

  // Sync state when booking changes
  useEffect(() => {
    if (booking) {
      const suggested = getSuggestedKm()
      setReturnKm(booking.return_km?.toString() || suggested.toString())
      setFuelLevelReturn(booking.fuel_level_return || 'Full')
      setLavageReturn(booking.lavage_return || 'clean_wash')
      
      const initialBehaviors = booking.client_behavior_status && typeof booking.client_behavior_status === 'string'
        ? booking.client_behavior_status.split(',').map(s => s.trim()).filter(Boolean)
        : ['clean']
      setActiveBehaviors(initialBehaviors)

      const initialFees: Record<string, string> = {}
      initialBehaviors.forEach(b => {
        initialFees[b] = '0'
      })
      setBehaviorFees(initialFees)

      const initialNotes = booking.damage_notes ?? ''
      if (initialNotes.includes('[GREEN]') || initialNotes.toLowerCase().includes('perfect normal return')) {
        setCommentColor('green')
        setDamageNotes(initialNotes.replace('[GREEN]', '').trim())
      } else if (initialNotes.includes('[GRAY]')) {
        setCommentColor('gray')
        setDamageNotes(initialNotes.replace('[GRAY]', '').trim())
      } else {
        setCommentColor('red')
        setDamageNotes(initialNotes)
      }
      
      setExtensionDate('')
      setIncidentPenalties('')
      setAmountCollectedNow('')
      setBaseTotalAmt(booking.total_amount?.toString() || '0')
      setBaseAcomptePaid(booking.acompte_paid?.toString() || '0')
      
      // Hydrate Logistics Handover fields
      setHandoverLocation(booking.handover_location || '')
      if (booking.handover_datetime) {
        setHandoverDate(booking.handover_datetime.split('T')[0])
        const parts = booking.handover_datetime.split('T')
        if (parts.length > 1) {
          const timePart = parts[1].slice(0, 5)
          setHandoverTime(timePart === '00:00' ? '' : timePart)
        } else {
          setHandoverTime('')
        }
      } else {
        setHandoverDate('')
        setHandoverTime('')
      }

      setError(null)
    }
  }, [booking])

  // Automatically calculate incident penalties based on active behaviors and their fees
  useEffect(() => {
    let total = 0
    activeBehaviors.forEach(b => {
      if (b !== 'clean') {
        const val = behaviorFees[b]
        let fee = 0
        if (typeof val === 'number') {
          fee = val
        } else if (typeof val === 'string' && val.trim() !== '') {
          const parsed = parseFloat(val.trim())
          fee = !isNaN(parsed) ? parsed : 0
        }
        total += fee
      }
    })
    
    // If we have any active infractions, display the total (even if it's 0)
    const hasInfractions = activeBehaviors.some(b => b !== 'clean')
    if (hasInfractions) {
      setIncidentPenalties(total.toFixed(2))
    } else {
      setIncidentPenalties('')
    }
  }, [activeBehaviors, behaviorFees])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen || !booking) return null

  // Calculate extension & ledger details
  const safeEndDate   = booking.end_date   ?? ''
  const safeTotalAmt  = parseFloat(baseTotalAmt) || 0

  const safeAcomptePaid = parseFloat(baseAcomptePaid) || 0

  const parsedPenalty = parseFloat(incidentPenalties)
  const penaltyVal    = !isNaN(parsedPenalty) ? parsedPenalty : 0

  const parsedCollect = parseFloat(amountCollectedNow)
  const collectVal    = !isNaN(parsedCollect) ? parsedCollect : 0

  const paidInstallmentsSum = booking.installments
    ? booking.installments.filter((t: any) => t.status === 'paid').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
    : 0

  let deltaDays = 0
  let extraCost = 0
  let newRentalDaysText = booking.rental_days_text || ''

  if (extensionDate && typeof extensionDate === 'string' && safeEndDate && typeof safeEndDate === 'string') {
    const origDateStr = safeEndDate.split('T')[0]
    const extDateStr = extensionDate.split('T')[0]
    
    if (origDateStr !== extDateStr) {
      const origMidnight = new Date(`${origDateStr}T00:00:00`)
      const extMidnight = new Date(`${extDateStr}T00:00:00`)
      if (!isNaN(origMidnight.getTime()) && !isNaN(extMidnight.getTime())) {
        const deltaMs = extMidnight.getTime() - origMidnight.getTime()
        deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24))
      }
    } else {
      deltaDays = 0
    }

    if (!isNaN(deltaDays)) {
      extraCost = deltaDays * pricePerDay
    }

    let baseDaysNum = 0;
    if (booking.start_date && safeEndDate) {
      const origStartDate = new Date(booking.start_date.split('T')[0] + 'T00:00:00')
      const origEndDate = new Date(safeEndDate.split('T')[0] + 'T00:00:00')
      if (!isNaN(origStartDate.getTime()) && !isNaN(origEndDate.getTime())) {
        baseDaysNum = Math.round((origEndDate.getTime() - origStartDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    }
    const baseDays = baseDaysNum > 0 ? baseDaysNum.toString() : (booking.rental_days_text || '')

    const finalDays = baseDaysNum + deltaDays;
    if (deltaDays > 0) {
      newRentalDaysText = baseDays ? `${baseDays}+${deltaDays}=${finalDays}` : String(deltaDays)
    } else if (deltaDays < 0) {
      newRentalDaysText = baseDays ? `${baseDays}${deltaDays}=${finalDays}` : String(deltaDays)
    } else {
      newRentalDaysText = baseDays
    }
  }

  // Real-time Dynamic Financial Ledger Recalculations
  const finalTotalAmount = Math.max(0, safeTotalAmt + extraCost + penaltyVal)
  const totalPaidPreview = safeAcomptePaid + paidInstallmentsSum + collectVal
  const finalReste = Math.max(0, finalTotalAmount - totalPaidPreview)
  const refundAmount = totalPaidPreview > finalTotalAmount ? totalPaidPreview - finalTotalAmount : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation: Return KM must be greater than or equal to starting KM (if defined)
    const parsedKm = returnKm ? parseInt(returnKm, 10) : null
    const retKmVal = parsedKm !== null && !isNaN(parsedKm) ? parsedKm : null
    
    if (retKmVal !== null && booking.starting_km !== undefined && booking.starting_km !== null) {
      if (retKmVal < booking.starting_km) {
        setError(
          lang === 'fr'
            ? `Le kilométrage de retour (${retKmVal}) ne peut pas être inférieur au kilométrage de départ (${booking.starting_km}).`
            : `Return KM (${retKmVal}) cannot be less than Starting KM (${booking.starting_km}).`
        )
        return
      }
    }

    // Validation: Return date must not be before start date
    if (extensionDate) {
      const startStr = booking.start_date ? booking.start_date.split('T')[0] : ''
      const extStr = extensionDate.split('T')[0]
      if (startStr && extStr < startStr) {
        setError(
          lang === 'fr'
            ? 'La nouvelle date de retour ne peut pas être antérieure à la date de début du contrat.'
            : 'The new return date cannot be prior to the contract start date.'
        )
        return
      }
    }
    
    // Validation: Do not allow overpayment
    if (refundAmount > 0) {
      setError(
        lang === 'fr'
          ? `Impossible de collecter plus que le solde restant. Trop-perçu de ${refundAmount.toFixed(2)} DT.`
          : `Cannot collect more than the remaining balance. Overpaid by ${refundAmount.toFixed(2)} DT.`
      )
      return
    }
    
    startTransition(async () => {
      try {
        const finalDamageNotes = damageNotes
          ? (commentColor === 'green' ? `[GREEN] ${damageNotes}` : (commentColor === 'gray' ? `[GRAY] ${damageNotes}` : damageNotes))
          : null;

        const handoverDatetimeMerged = handoverDate
          ? (handoverTime ? `${handoverDate}T${handoverTime}:00` : `${handoverDate}T00:00:00`)
          : null

        const payload: any = {
          return_km: retKmVal,
          fuel_level_return: fuelLevelReturn || null,
          lavage_return: lavageReturn || null,
          client_behavior_status: activeBehaviors.length > 0 ? activeBehaviors.join(',') : 'clean',
          damage_notes: finalDamageNotes,
          status: 'completed', // Automatically complete/close the contract on submit
          
          // Ledger & Penalty fields passed to server action
          total_amount: finalTotalAmount,
          acompte_paid: safeAcomptePaid,
          amount_collected_now: collectVal,
          incident_penalties: penaltyVal,

          // Handover logistics fields
          handover_location: handoverLocation || null,
          handover_datetime: handoverDatetimeMerged,
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
        setError(err.message || (lang === 'fr' ? 'Échec de la mise à jour des détails de retour.' : 'Failed to update return details.'))
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
          client_behavior_status: 'clean',
          damage_notes: damageNotes ? `${damageNotes}\n[Perfect normal return. Fast closed by system.]` : (lang === 'fr' ? 'Retour normal parfait. Clôturé rapidement par le système.' : 'Perfect normal return. Fast closed by system.'),
          status: 'completed',
          total_amount: safeTotalAmt,
          acompte_paid: safeAcomptePaid,
          amount_collected_now: 0,
          incident_penalties: 0,
        }
        await updateBookingHistoricalDetails(booking.id, booking.vehicle_id, payload)
        router.refresh()
        onClose()
      } catch (err: any) {
        setError(err.message || (lang === 'fr' ? 'Échec de la clôture rapide du contrat.' : 'Failed to fast close contract.'))
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
          // Initialize all behavior custom fees to '0' by default
          next[val] = '0'
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
      return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')
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
            <h3 className={styles['modal-title']}>
              {lang === 'fr' ? 'Clôture du Contrat & Phase de Retour' : 'Close Contract & Return Phase'}
            </h3>
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
            {lang === 'fr'
              ? 'Clôture Rapide (Retour Normal Parfait) — Clôturer en 1-Clic'
              : 'Fast Close (Perfect Normal Return) — Close in 1-Click'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles['modal-form']}>
          {error && <div className={styles['error-alert']}>{error}</div>}

          {/* Baseline Info Header */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(229,193,125,0.03)', border: '1px solid rgba(229,193,125,0.08)', borderRadius: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>{lang === 'fr' ? 'Date de fin du contrat :' : 'Contract End Date:'}</span>
              <strong style={{ color: '#fff' }}>{safeEndDate ? formatDate(safeEndDate) : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>{lang === 'fr' ? 'Kilométrage de départ :' : 'Starting Odometer:'}</span>
              <strong style={{ color: '#fff' }}>{booking.starting_km ?? '—'} KM</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{lang === 'fr' ? 'Montant total actuel :' : 'Current Total Amount:'}</span>
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
                {lang === 'fr' ? 'Ajustement de la Durée du Contrat' : 'Contract Duration Adjuster'}
              </span>
            </div>

            <div className={styles['form-group']} style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'block' }}>
                {lang === 'fr' ? 'Ajuster la date de retour (Prolonger ou raccourcir le contrat)' : 'Adjust Return Date (Extend or Shorten Contract)'}
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
                  <span>{deltaDays > 0 ? (lang === 'fr' ? 'Durée de prolongation :' : 'Extension duration:') : (lang === 'fr' ? 'Décalage de retour anticipé :' : 'Early return offset:')}</span>
                  <strong style={{ fontWeight: 700 }}>{deltaDays > 0 ? `+${deltaDays}` : `${deltaDays}`} {lang === 'fr' ? 'jours' : 'Days'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{lang === 'fr' ? 'Mise à jour de la séquence de location :' : 'Rental sequence update:'}</span>
                  <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: '#fff' }}>
                    {booking.rental_days_text || '?'} <ArrowRight size={11} style={{ display: 'inline', margin: '0 2px' }} /> {newRentalDaysText}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{deltaDays > 0 ? (lang === 'fr' ? 'Coût de prolongation' : 'Extension cost') : (lang === 'fr' ? 'Déduction de prix' : 'Price deduction')} ({pricePerDay} {lang === 'fr' ? 'DT/jour' : 'DT/day'}):</span>
                  <strong style={{ fontWeight: 700 }}>{extraCost > 0 ? `+${extraCost}` : `${extraCost}`} DT</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px dashed ${deltaDays > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                  <span style={{ color: '#fff' }}>{lang === 'fr' ? 'Montant total ajusté :' : 'Adjusted Total Amount:'}</span>
                  <strong style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 800 }}>{finalTotalAmount.toFixed(2)} DT</strong>
                </div>
              </div>
            )}
          </div>

          {/* ── LOGISTICS HANDOVER SECTION ── */}
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            background: 'rgba(229,193,125,0.04)',
            border: '1px solid rgba(229,193,125,0.15)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <MapPin size={15} style={{ color: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-gold)' }}>
                {lang === 'fr' ? 'Remise Logistique (Optionnel)' : 'Logistics Handover (Optional)'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <MapPin size={11} /> {lang === 'fr' ? 'Lieu de Remise' : 'Handover Location'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tunis Carthage Airport, Hotel Laico, Sousse"
                  className={styles['form-input']}
                  value={handoverLocation}
                  onChange={(e) => setHandoverLocation(e.target.value)}
                  style={{ margin: 0 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={11} /> {lang === 'fr' ? 'Date de Remise' : 'Handover Date'}
                </label>
                <input
                  type="date"
                  className={styles['form-input']}
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  style={{ margin: 0, colorScheme: 'dark' }}
                  onClick={(e) => { try { e.currentTarget.showPicker() } catch {} }}
                />
              </div>

              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={11} /> {lang === 'fr' ? 'Heure de Remise (Optionnel)' : 'Handover Hour (Optional)'}
                </label>
                <input
                  type="time"
                  className={styles['form-input']}
                  value={handoverTime}
                  onChange={(e) => setHandoverTime(e.target.value)}
                  style={{ margin: 0, colorScheme: 'dark' }}
                  onClick={(e) => { try { e.currentTarget.showPicker() } catch {} }}
                />
              </div>
            </div>

            {handoverLocation && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: 'rgba(229,193,125,0.7)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.7)' }} />
                <span>
                  {lang === 'fr'
                    ? 'Cette réservation affichera un badge de livraison sur la grille des opérations et le tableau des réservations.'
                    : 'This booking will surface a delivery badge on the Operations grid and Bookings table.'}
                </span>
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
                {lang === 'fr' ? '💰 Mise à jour en Direct du Grand Livre de Caisse' : '💰 Live Cash Ledger Update'}
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
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.35rem' }}>
                  {lang === 'fr' ? 'Total Contrat' : 'Total Contract'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    value={baseTotalAmt}
                    onChange={(e) => setBaseTotalAmt(e.target.value)}
                    style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.85rem', width: '70px', textAlign: 'center', padding: '0.1rem', borderRadius: '4px', outline: 'none' }}
                  />
                  <span style={{ color: '#fff', fontSize: '0.85rem', marginLeft: '0.25rem' }}>DT</span>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(229,193,125,0.15)', height: '24px', alignSelf: 'center' }}></div>
              <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.35rem' }}>
                  {lang === 'fr' ? 'Déjà Payé' : 'Already Paid'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    value={baseAcomptePaid}
                    onChange={(e) => setBaseAcomptePaid(e.target.value)}
                    style={{ background: 'transparent', border: '1px dashed rgba(229,193,125,0.3)', color: 'var(--accent-gold)', fontSize: '0.85rem', width: '70px', textAlign: 'center', padding: '0.1rem', borderRadius: '4px', outline: 'none', fontWeight: 700 }}
                  />
                  <span style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', marginLeft: '0.25rem', fontWeight: 700 }}>DT</span>
                </div>
                {paidInstallmentsSum > 0 && (
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>
                    + {paidInstallmentsSum.toFixed(2)} {lang === 'fr' ? 'tranches' : 'installments'}
                  </div>
                )}
              </div>
              <div style={{ borderLeft: '1px solid rgba(229,193,125,0.15)', height: '24px', alignSelf: 'center' }}></div>
              <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.15rem' }}>
                  {lang === 'fr' ? 'Reste à Payer (Reste)' : 'Outstanding (Reste)'}
                </div>
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
                  <span style={{ fontWeight: 700 }}>{lang === 'fr' ? 'Solde de Caisse Trop-Perçu' : 'Cash Balance Overpaid'}</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {lang === 'fr' 
                      ? <>Remboursement de <strong style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{refundAmount.toFixed(2)} DT</strong> dû au client ou crédit requis.</>
                      : <>Refund of <strong style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{refundAmount.toFixed(2)} DT</strong> due to client or credit log required.</>}
                  </span>
                </div>
              </div>
            )}

            {/* Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles['form-group']} style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem', display: 'block' }}>
                  {lang === 'fr' ? "Pénalités d'Incident & Frais Supp. (DT)" : 'Incident Penalties & Extra Fees (DT)'}
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
                  {lang === 'fr' ? 'Montant Encaissé Maintenant (DT)' : 'Amount Collected Now (DT)'}
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
                <label style={{ margin: 0 }}>{lang === 'fr' ? 'Kilométrage Retour' : 'Return KM'}</label>
                <span style={{ fontSize: '0.7rem', color: 'rgba(229,193,125,0.7)', background: 'rgba(229,193,125,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  {lang === 'fr' ? `Suggéré : ${getSuggestedKm()} KM` : `Suggested: ${getSuggestedKm()} KM`}
                </span>
              </div>
              <input 
                type="number" 
                className={styles['form-input']} 
                value={returnKm} 
                onChange={e => setReturnKm(e.target.value)} 
                placeholder={lang === 'fr' ? 'Saisir kilométrage de retour' : 'Enter ending KM (e.g. 28450)'} 
              />
            </div>

            {/* Fuel Level Return (Segment Toggles) */}
            <div className={styles['form-group']}>
              <label style={{ marginBottom: '0.35rem', display: 'block' }}>
                {lang === 'fr' ? 'Niveau de Carburant (Retour)' : 'Fuel Level (Return)'}
              </label>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '8px' }}>
                {['Empty', '1/4', '1/2', '3/4', 'Full'].map((lvl) => {
                  const label = lvl === 'Empty' ? (lang === 'fr' ? 'Vide' : 'Empty') : lvl === 'Full' ? (lang === 'fr' ? 'Plein' : 'Full') : lvl;
                  return (
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
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lavage Return (Segment Toggles) */}
            <div className={styles['form-group']}>
              <label style={{ marginBottom: '0.35rem', display: 'block' }}>
                {lang === 'fr' ? 'État du Lavage (Retour)' : 'Lavage Status (Return)'}
              </label>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '8px' }}>
                {[
                  { value: 'clean_wash', label: lang === 'fr' ? 'Propre' : 'Clean' },
                  { value: 'average_dust', label: lang === 'fr' ? 'Moyen' : 'Dusty' },
                  { value: 'dirty', label: lang === 'fr' ? 'Sale' : 'Dirty' }
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
                {lang === 'fr' ? 'Contrôles des Segments de Dégâts & Comportement' : 'Damage & Behavior Segment Controls'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  {
                    value: 'clean',
                    label: lang === 'fr' ? '✓ Aucun Dégât' : '✓ No Damage',
                    desc: lang === 'fr' ? 'Retour normal parfait ou standing propre/excellent.' : 'Perfect normal return or minor clean/excellent standing.',
                    color: '#10b981',
                    bg: 'rgba(16,185,129,0.05)',
                    border: 'rgba(16,185,129,0.2)'
                  },
                  {
                    value: 'dirty_return',
                    label: lang === 'fr' ? '🗑️ Retour Sale (-5 pts)' : '🗑️ Dirty Return (-5 pts)',
                    desc: lang === 'fr' ? 'Retour excessivement sale nécessitant un lavage commercial.' : 'Excessively dirty return requiring commercial detail/wash.',
                    color: '#fbbf24',
                    bg: 'rgba(251,191,36,0.05)',
                    border: 'rgba(251,191,36,0.2)'
                  },
                  {
                    value: 'speeding',
                    label: lang === 'fr' ? '⚡ Vitesse / Abus (-15 pts)' : '⚡ Speeding / Abuse (-15 pts)',
                    desc: lang === 'fr' ? 'Conduite agressive, vitesse extrême ou violation de la télémétrie.' : 'Aggressive operation, extreme speeding, or telemetry violation.',
                    color: '#f59e0b',
                    bg: 'rgba(245,158,11,0.05)',
                    border: 'rgba(245,158,11,0.2)'
                  },
                  {
                    value: 'minor_damage',
                    label: lang === 'fr' ? '⚠ Égratignure / Mineur (-25 pts)' : '⚠ Scratch / Minor (-25 pts)',
                    desc: lang === 'fr' ? 'Égratignure ou imperfection cosmétique mineure en surface.' : 'Scratch, scuff, or minor cosmetic surface blemish.',
                    color: '#ef4444',
                    bg: 'rgba(239,68,68,0.05)',
                    border: 'rgba(239,68,68,0.2)'
                  },
                  {
                    value: 'major_damage',
                    label: lang === 'fr' ? '💥 Structurel / Majeur (-100 pts)' : '💥 Structural / Major (-100 pts Hard Lock)',
                    desc: lang === 'fr' ? 'Dommages structurels, mécaniques ou de carrosserie majeurs. Verrouillage.' : 'Structural, mechanical, or major body damage. Triggers hard lock.',
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
                            {lang === 'fr' ? 'ACTIF' : 'ACTIVE'}
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
                            {lang === 'fr' ? 'Frais Personnalisés :' : 'Custom Fee:'}
                          </span>
                          <input 
                            type="number" 
                            min="0" 
                            placeholder="0"
                            value={behaviorFees[opt.value] !== undefined && behaviorFees[opt.value] !== null ? behaviorFees[opt.value] : ''}
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
                <label style={{ margin: 0 }}>
                  {lang === 'fr' ? 'Notes de Dégâts / Remarques de Retour' : 'Damage Notes / Return Remarks'}
                </label>
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
                    {lang === 'fr' ? 'Problème / Dégât' : 'Issue / Damage'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentColor('gray')}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: commentColor === 'gray' ? 'rgba(156, 163, 175, 0.16)' : 'transparent',
                      color: commentColor === 'gray' ? '#9ca3af' : 'rgba(255,255,255,0.4)',
                      boxShadow: commentColor === 'gray' ? '0 0 12px rgba(156,163,175,0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }}></span>
                    {lang === 'fr' ? 'Note Générale' : 'General Note'}
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
                    {lang === 'fr' ? 'Bon Retour' : 'Good Return'}
                  </button>
                </div>
              </div>
              <textarea 
                className={styles['form-textarea']} 
                value={damageNotes} 
                onChange={e => setDamageNotes(e.target.value)} 
                placeholder={
                  commentColor === 'green'
                    ? (lang === 'fr' ? "Décrire l'état de retour parfait, la propreté ou autres remarques..." : "Describe the perfect return standing, cleanliness or extra positive notes...")
                    : commentColor === 'gray'
                    ? (lang === 'fr' ? "Enregistrer des notes générales, remarques ou commentaires..." : "Log any general notes, remarks, or comments...")
                    : (lang === 'fr' ? "Enregistrer des égratignures, remarques de dégâts ou frais de retour tardif..." : "Log any scratches, damage remarks, or late return fees...")
                }
                rows={3}
                style={{
                  border: `1px solid ${commentColor === 'green' ? 'rgba(16, 185, 129, 0.3)' : commentColor === 'gray' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                  transition: 'border-color 0.25s ease'
                }}
              />
            </div>

          </div>

          <div className={styles['modal-actions']}>
            <button type="button" onClick={onClose} className={styles['btn-secondary']} disabled={isPending}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button type="submit" className={styles['btn-primary']} disabled={isPending}>
              {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isPending 
                ? (lang === 'fr' ? 'Clôture...' : 'Closing...') 
                : (lang === 'fr' ? 'Clôturer le Contrat & Enregistrer' : 'Close Contract & Save')}
            </button>
          </div>
        </form>

      </div>
    </div>
  )

  return createPortal(modalJSX, document.body)
}
