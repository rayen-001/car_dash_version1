'use client'

import { useMemo, useState } from 'react'
import { Search, Edit2, Edit3, X, Check } from 'lucide-react'
import styles from '../history.module.css'
import QuickEditBookingModal from './QuickEditBookingModal'
import { updateBookingHistoricalDetails } from '@/app/actions'
import { formatFuelFraction, calculateFuelDelta, calculateDrivenMileage } from '@/app/dashboard/bookings/components/HandoverCalculators'
import { useLanguage } from '@/lib/i18n'

interface Client {
  id: string
  full_name: string
  phone?: string
  license_number?: string
  cin_delivre_le?: string
  permis_numero?: string
  permis_delivre_le?: string
  date_naissance?: string
}

interface Vehicle {
  id: string
  brand: string
  model: string
  license_plate?: string
}

interface Booking {
  id: string
  vehicle_id: string
  contract_id?: string
  start_date: string
  end_date: string
  departure_time?: string
  return_time?: string
  total_amount: number
  acompte_paid?: number
  rental_days_text?: string
  fuel_level_pickup?: string
  fuel_level_return?: string
  lavage_pickup?: string
  lavage_return?: string
  lavage_status?: string
  starting_km?: number | null
  return_km?: number | null
  client_behavior_status?: string | null
  damage_notes?: string
  vehicle_handovers?: {
    booking_id: string
    vehicle_id: string
    pickup_km?: number | null
    return_km?: number | null
    pickup_fuel?: number | null
    return_fuel?: number | null
    pickup_cleanliness?: 'Clean' | 'Dirty' | null
    return_cleanliness?: 'Clean' | 'Dirty' | null
  }[]
  clients?: Client
  vehicles?: Vehicle
  installments?: any[]
}

interface MasterOperationsGridProps {
  bookings: Booking[]
}

const LAVAGE_LABELS: Record<string, string> = {
  clean_wash:   'Clean Wash',
  average_dust: 'Average',
  dirty:        'Dirty',
}

const BEHAVIOR_LABELS: Record<string, { label: string; color: string }> = {
  excellent:    { label: '⭐ Excellent',     color: '#10b981' },
  clean:        { label: '✓ Clean',          color: '#6ee7b7' },
  speeding:     { label: '⚡ Speeding',      color: '#f59e0b' },
  minor_damage: { label: '⚠️ Minor Dmg',    color: '#fb923c' },
  major_damage: { label: '💥 Major Dmg',    color: '#ef4444' },
  dirty_return: { label: '🗑️ Dirty Return', color: '#a78bfa' },
}

/* ─── Damage Note Expandable Tag ─────────────────────────────────── */
const DamageNoteView = ({ note }: { note: string }) => {
  const [expanded, setExpanded] = useState(false)
  const { lang } = useLanguage()
  
  const isPerfect = note.toLowerCase().includes('perfect normal return') || note.includes('[GREEN]')
  const isGray = note.includes('[GRAY]')
  const cleanNotes = note.replace('[GREEN]', '').replace('[GRAY]', '').replace('[RED]', '').trim()
  
  const bgColor = isPerfect ? 'rgba(16, 185, 129, 0.12)' : isGray ? 'rgba(156, 163, 175, 0.12)' : 'rgba(239, 68, 68, 0.12)'
  const color = isPerfect ? '#10b981' : isGray ? '#9ca3af' : '#ef4444'
  const borderColor = isPerfect ? '1px solid rgba(16, 185, 129, 0.25)' : isGray ? '1px solid rgba(156, 163, 175, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
  const icon = isPerfect ? '✅' : isGray ? '💬' : '⚠️'

  const displayText = expanded 
    ? cleanNotes 
    : (cleanNotes.length > 22 ? cleanNotes.substring(0, 22) + '…' : cleanNotes)

  return (
    <span 
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setExpanded(!expanded)
      }}
      style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: bgColor, 
        color: color, 
        border: borderColor, 
        boxSizing: 'border-box',
        marginTop: '0.35rem',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: expanded ? '240px' : '180px',
        whiteSpace: expanded ? 'normal' : 'nowrap',
        wordBreak: expanded ? 'break-word' : 'normal',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      title={expanded 
        ? (lang === 'fr' ? "Cliquer pour réduire" : "Click to collapse") 
        : (lang === 'fr' ? "Cliquer pour voir la note complète" : "Click to view full note")}
    >
      <span>{icon}</span>
      <span>{displayText}</span>
    </span>
  )
}

export default function MasterOperationsGrid({ bookings }: MasterOperationsGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const { lang } = useLanguage()
  
  // Inline Financial Editing State
  const [editingFinId, setEditingFinId] = useState<string | null>(null)
  const [tempTotal, setTempTotal] = useState<string>('')
  const [tempAcompte, setTempAcompte] = useState<string>('')
  const [isSavingFin, setIsSavingFin] = useState(false)

  // Localized status maps
  const lavageLabels: Record<string, string> = useMemo(() => ({
    clean_wash:   lang === 'fr' ? 'Propre (Lavage jdid)' : 'Clean Wash',
    average_dust: lang === 'fr' ? 'Moyen' : 'Average',
    dirty:        lang === 'fr' ? 'Sale' : 'Dirty',
  }), [lang])

  const behaviorLabels: Record<string, { label: string; color: string }> = useMemo(() => ({
    excellent:    { label: lang === 'fr' ? '⭐ Excellent' : '⭐ Excellent',     color: '#10b981' },
    clean:        { label: lang === 'fr' ? '✓ Propre' : '✓ Clean',          color: '#6ee7b7' },
    speeding:     { label: lang === 'fr' ? '⚡ Excès de vitesse' : '⚡ Speeding',      color: '#f59e0b' },
    minor_damage: { label: lang === 'fr' ? '⚠️ Dégât mineur' : '⚠️ Minor Dmg',    color: '#fb923c' },
    major_damage: { label: lang === 'fr' ? '💥 Dégât majeur' : '💥 Major Dmg',    color: '#ef4444' },
    dirty_return: { label: lang === 'fr' ? '🗑️ Retour sale' : '🗑️ Dirty Return', color: '#a78bfa' },
  }), [lang])

  const translateCleanliness = (val?: string | null) => {
    if (!val) return '—'
    const lower = val.trim().toLowerCase()
    if (lower === 'clean') return lang === 'fr' ? 'Propre' : 'Clean'
    if (lower === 'dirty') return lang === 'fr' ? 'Sale' : 'Dirty'
    if (lower === 'average' || lower === 'average_dust') return lang === 'fr' ? 'Moyen' : 'Average'
    return lavageLabels[val] ?? val
  }

  const translateFuelLevel = (val?: string | null) => {
    if (!val) return '—'
    const trimmed = val.trim()
    const lower = trimmed.toLowerCase()
    if (lower === 'empty' || lower === 'vide') return lang === 'fr' ? 'Vide' : 'Empty'
    if (lower === 'full' || lower === 'plein') return lang === 'fr' ? 'Plein' : 'Full'
    if (lower === 'n/a') return 'N/A'
    if (lang === 'fr') {
      return trimmed.replace(/tank/gi, 'Réservoir')
    }
    return trimmed
  }

  const translateFuelDelta = (text: string) => {
    if (text === 'No Change') return lang === 'fr' ? 'Pas de changement' : 'No Change'
    if (lang === 'fr') {
      return text
        .replace(/full tank/gi, 'Réservoir Plein')
        .replace(/tank/gi, 'Réservoir')
    }
    return text
  }

  const handleSaveFinancials = async (booking: Booking) => {
    setIsSavingFin(true)
    try {
      await updateBookingHistoricalDetails(booking.id, booking.vehicle_id, {
        total_amount: parseFloat(tempTotal),
        acompte_paid: parseFloat(tempAcompte)
      })
      setEditingFinId(null)
    } catch (error) {
      console.error('Failed to update financials', error)
      alert(lang === 'fr' ? 'Erreur lors de la mise à jour des finances' : 'Error updating financials')
    } finally {
      setIsSavingFin(false)
    }
  }

  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings

    const term = searchQuery.toLowerCase()
    return bookings.filter(b => {
      const matchContract = b.id.toLowerCase().includes(term) || (b.contract_id && b.contract_id.toLowerCase().includes(term))
      const matchName   = b.clients?.full_name?.toLowerCase().includes(term)
      const matchPhone  = b.clients?.phone?.toLowerCase().includes(term)
      const matchCin    = b.clients?.license_number?.toLowerCase().includes(term)
      const matchDamage = b.damage_notes?.toLowerCase().includes(term)
      return matchContract || matchName || matchPhone || matchCin || matchDamage
    })
  }, [bookings, searchQuery])

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')
  }

  return (
    <div className={styles['operations-grid-container']}>
      {/* 1. Global / Nested Search Bar */}
      <div className={styles['grid-search-bar']}>
        <Search size={18} className={styles['grid-search-icon']} />
        <input
          type="text"
          placeholder={lang === 'fr' ? 'Rechercher par CIN, N° contrat, Téléphone, Notes de dégâts...' : 'Search by CIN, Contract #, Phone, Damage Notes...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles['grid-search-input']}
        />
      </div>

      {/* 2. Scrollable Table Wrapper */}
      <div className={styles['table-responsive-wrapper']}>
        <table className={`${styles['master-operations-table']} glass-panel`}>
          <thead>
            <tr>
              <th>{lang === 'fr' ? 'ID Contrat' : 'Contract ID'}</th>
              <th>{lang === 'fr' ? 'Client Principal' : 'Client Main'}</th>
              <th>{lang === 'fr' ? 'Documents Légaux Client' : 'Client Legal Docs'}</th>
              <th>{lang === 'fr' ? 'Véhicule' : 'Vehicle'}</th>
              <th>{lang === 'fr' ? 'Période de Location' : 'Rental Period'}</th>
              <th>{lang === 'fr' ? 'Finances' : 'Financials'}</th>
              <th>{lang === 'fr' ? 'Condition Δ Delta' : 'Condition Δ Delta'}</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredBookings.length > 0 ? (
              filteredBookings.map(booking => {
                const total   = Number(booking.total_amount) || 0
                const acompte = Number(booking.acompte_paid)  || 0
                const reste   = total - acompte
                const behavior = booking.client_behavior_status
                  ? behaviorLabels[booking.client_behavior_status]
                  : null

                return (
                  <tr key={booking.id} className={styles['master-row']}>
                    {/* Contract ID */}
                    <td className={styles['col-contract']}>
                      <span className={styles['badge-contract']}>#{booking.contract_id || booking.id.substring(0, 6).toUpperCase()}</span>
                    </td>

                    {/* Client Main */}
                    <td className={styles['col-client-main']}>
                      <div className={styles['client-flex']}>
                        <div className={styles['avatar-circle']}>{getInitials(booking.clients?.full_name)}</div>
                        <div className={styles['client-meta']}>
                          <span className={styles['fw-bold']}>{booking.clients?.full_name || (lang === 'fr' ? 'Inconnu' : 'Unknown')}</span>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{booking.clients?.phone || (lang === 'fr' ? 'Pas de téléphone' : 'No phone')}</span>
                          {behavior && (
                            <span style={{ fontSize: '0.72rem', color: behavior.color, fontWeight: 600, marginTop: '0.1rem' }}>
                              {behavior.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Client Legal Docs */}
                    <td className={`${styles['col-client-legal']} ${styles['dense-stack']}`}>
                      <div>
                        <span className={styles['lbl']}>{lang === 'fr' ? 'CIN :' : 'CIN:'}</span> {booking.clients?.license_number || 'N/A'}
                        <span className={styles['lbl']} style={{ marginLeft: '0.5rem' }}>{lang === 'fr' ? 'Émis :' : 'Iss:'}</span> {formatDate(booking.clients?.cin_delivre_le)}
                      </div>
                      <div>
                        <span className={styles['lbl']}>{lang === 'fr' ? 'Permis :' : 'Permis:'}</span> {booking.clients?.permis_numero || 'N/A'}
                        <span className={styles['lbl']} style={{ marginLeft: '0.5rem' }}>{lang === 'fr' ? 'Émis :' : 'Iss:'}</span> {formatDate(booking.clients?.permis_delivre_le)}
                      </div>
                      <div>
                        <span className={styles['lbl']}>{lang === 'fr' ? 'Né(e) :' : 'DOB:'}</span> {formatDate(booking.clients?.date_naissance)}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td className={`${styles['col-vehicle']} ${styles['dense-stack']}`}>
                      <div className={styles['fw-bold']}>{booking.vehicles?.brand} {booking.vehicles?.model}</div>
                      <div className={styles['plate-badge']}>{booking.vehicles?.license_plate || (lang === 'fr' ? 'SANS PLAQUE' : 'NO PLATE')}</div>
                    </td>

                    {/* Rental Period */}
                    <td className={`${styles['col-period']} ${styles['dense-stack']}`}>
                      <div><span className={styles['lbl']}>{lang === 'fr' ? 'Dép :' : 'Dep:'}</span> {formatDate(booking.start_date)} {(booking as any).pickup_time || booking.departure_time || ''}</div>
                      <div><span className={styles['lbl']}>{lang === 'fr' ? 'Ret :' : 'Ret:'}</span> {formatDate(booking.end_date)} {booking.return_time || ''}</div>
                      <div className={styles['cumulative-days']}>{booking.rental_days_text || '—'} {lang === 'fr' ? 'jours' : 'Days'}</div>
                    </td>

                    {/* Financials */}
                    <td className={`${styles['col-financials']} ${styles['dense-stack']}`}>
                      {editingFinId === booking.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(229,193,125,0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'fr' ? 'Total :' : 'Total:'}</span>
                            <input 
                              type="number" 
                              value={tempTotal} 
                              onChange={(e) => setTempTotal(e.target.value)}
                              style={{ width: '70px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'fr' ? 'Acompte :' : 'Acompte:'}</span>
                            <input 
                              type="number" 
                              value={tempAcompte} 
                              onChange={(e) => setTempAcompte(e.target.value)}
                              style={{ width: '70px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.2rem' }}>
                            <button onClick={() => setEditingFinId(null)} className="icon-btn" style={{ color: '#ef4444', padding: '0.2rem' }} disabled={isSavingFin}><X size={14} /></button>
                            <button onClick={() => handleSaveFinancials(booking)} className="icon-btn" style={{ color: '#10b981', padding: '0.2rem' }} disabled={isSavingFin}>
                              {isSavingFin ? <span style={{ fontSize: '10px' }}>...</span> : <Check size={14} />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative', paddingRight: '1.2rem' }}>
                          <button 
                            className="icon-btn" 
                            style={{ position: 'absolute', right: 0, top: 0, opacity: 0.5 }}
                            onClick={() => {
                              setTempTotal(total.toString())
                              setTempAcompte(acompte.toString())
                              setEditingFinId(booking.id)
                            }}
                          >
                            <Edit3 size={12} />
                          </button>
                          <div className={styles['fin-row']}>
                            <span>{lang === 'fr' ? 'Total :' : 'Total:'}</span> <strong>{total.toFixed(2)} DT</strong>
                          </div>
                          <div className={styles['fin-row']}>
                            <span>{lang === 'fr' ? 'Acompte :' : 'Acompte:'}</span> <strong style={{ color: 'var(--accent-gold)' }}>{acompte.toFixed(2)} DT</strong>
                          </div>
                          <div className={`${styles['fin-row']} ${styles['fin-border-top']}`}>
                            <span>{lang === 'fr' ? 'Reste :' : 'Reste:'}</span>
                            <strong style={{ color: reste > 0 ? '#ef4444' : '#10b981' }}>
                              {reste.toFixed(2)} DT
                            </strong>
                          </div>
                          {booking.installments && booking.installments.length > 0 && (
                            <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {[...booking.installments]
                                .sort((a: any, b: any) => a.due_date > b.due_date ? 1 : -1)
                                .map((inst: any, idx: number) => (
                                  <div
                                    key={inst.id || idx}
                                    style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      background: 'rgba(255,255,255,0.03)',
                                      padding: '0.2rem 0.35rem', borderRadius: '4px',
                                      borderLeft: inst.status === 'paid' ? '2px solid #10b981' : '2px solid #ef4444',
                                    }}
                                  >
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                                      {formatDate(inst.due_date)}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: inst.status === 'paid' ? '#10b981' : '#ef4444' }}>
                                      {Number(inst.amount).toFixed(0)} DT
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Condition Delta */}
                    <td className={`${styles['col-condition']} ${styles['dense-stack']}`}>
                      {(() => {
                        const h = (booking.vehicle_handovers?.[0] || {}) as any
                        const pKm = h.pickup_km ?? booking.starting_km
                        const rKm = h.return_km ?? booking.return_km
                        const pFuel = h.pickup_fuel
                        const rFuel = h.return_fuel
                        
                        const drivenKm = calculateDrivenMileage(pKm, rKm)
                        const fuelDelta = calculateFuelDelta(pFuel, rFuel)

                        return (
                          <>
                            {/* Lavage delta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                              <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>💧</span>
                              <span className={styles['cond-tag']}>{translateCleanliness(h.pickup_cleanliness || booking.lavage_pickup)}</span>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                              <span className={styles['cond-tag']} style={{ background: (h.return_cleanliness || booking.lavage_return) === 'dirty' || (h.return_cleanliness || booking.lavage_return) === 'Dirty' ? 'rgba(239,68,68,0.12)' : undefined }}>
                                {translateCleanliness(h.return_cleanliness || booking.lavage_return)}
                              </span>
                            </div>

                            {/* KM delta */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                                <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>🛣️</span>
                                <span className={styles['cond-tag']}>{pKm ?? '—'}</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                                <span className={styles['cond-tag']}>
                                  {rKm !== undefined && rKm !== null ? `${rKm} km` : '-- km'}
                                </span>
                              </div>
                              {drivenKm !== null && drivenKm > 0 && (
                                <div style={{ width: '100%', fontSize: '0.7rem', color: '#E5C17D', fontWeight: 600, paddingLeft: '1.2rem', marginTop: '-0.1rem' }}>
                                  {lang === 'fr' ? `${drivenKm.toLocaleString()} km parcourus` : `${drivenKm.toLocaleString()} km driven`}
                                </div>
                              )}
                            </div>

                            {/* Fuel delta */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginTop: '0.1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                                <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>⛽</span>
                                <span className={styles['cond-tag']}>
                                  {pFuel !== undefined ? translateFuelLevel(formatFuelFraction(pFuel)) : translateFuelLevel(booking.fuel_level_pickup)}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                                <span className={styles['cond-tag']}>
                                  {rFuel !== undefined ? translateFuelLevel(formatFuelFraction(rFuel)) : translateFuelLevel(booking.fuel_level_return)}
                                </span>
                              </div>
                              {fuelDelta && (
                                <div style={{ width: '100%', fontSize: '0.72rem', color: fuelDelta.color, fontWeight: 700, paddingLeft: '1.2rem', marginTop: '-0.1rem' }}>
                                  {translateFuelDelta(fuelDelta.text)}
                                </div>
                              )}
                            </div>
                          </>
                        )
                      })()}
                      
                      {booking.damage_notes && (
                        <div style={{ display: 'block' }}>
                          <DamageNoteView note={booking.damage_notes} />
                        </div>
                      )}
                    </td>

                    {/* Actions — FIXED: stopPropagation prevents row-click interference */}
                    <td className={styles['col-actions']}>
                      <button
                        className="icon-btn"
                        title={lang === 'fr' ? "Fermer le contrat / Retour" : "Close Contract / Return"}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditingBooking(booking)
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'rgba(229, 193, 125, 0.4)' }}>
                  {lang === 'fr' ? 'Aucun enregistrement trouvé correspondant à votre recherche.' : 'No records found matching your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick-Edit / Return Modal */}
      <QuickEditBookingModal
        booking={editingBooking}
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
      />
    </div>
  )
}
