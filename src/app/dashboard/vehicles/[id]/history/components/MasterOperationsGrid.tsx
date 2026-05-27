'use client'

import { useMemo, useState } from 'react'
import { Search, Edit2, Edit3, X, Check } from 'lucide-react'
import styles from '../history.module.css'
import QuickEditBookingModal from './QuickEditBookingModal'
import { updateBookingHistoricalDetails } from '@/app/actions'
import { formatFuelFraction, calculateFuelDelta, calculateDrivenMileage } from '@/app/dashboard/bookings/components/HandoverCalculators'

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

export default function MasterOperationsGrid({ bookings }: MasterOperationsGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  
  // Inline Financial Editing State
  const [editingFinId, setEditingFinId] = useState<string | null>(null)
  const [tempTotal, setTempTotal] = useState<string>('')
  const [tempAcompte, setTempAcompte] = useState<string>('')
  const [isSavingFin, setIsSavingFin] = useState(false)

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
      alert('Error updating financials')
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
    return new Date(dateStr).toLocaleDateString('en-GB')
  }

  const lavageLabel = (val?: string) => val ? (LAVAGE_LABELS[val] ?? val) : '—'

  return (
    <div className={styles['operations-grid-container']}>
      {/* 1. Global / Nested Search Bar */}
      <div className={styles['grid-search-bar']}>
        <Search size={18} className={styles['grid-search-icon']} />
        <input
          type="text"
          placeholder="Search by CIN, Contract #, Phone, Damage Notes..."
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
              <th>Contract ID</th>
              <th>Client Main</th>
              <th>Client Legal Docs</th>
              <th>Vehicle</th>
              <th>Rental Period</th>
              <th>Financials</th>
              <th>Condition Δ Delta</th>
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
                  ? BEHAVIOR_LABELS[booking.client_behavior_status]
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
                          <span className={styles['fw-bold']}>{booking.clients?.full_name || 'Unknown'}</span>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{booking.clients?.phone || 'No phone'}</span>
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
                        <span className={styles['lbl']}>CIN:</span> {booking.clients?.license_number || 'N/A'}
                        <span className={styles['lbl']} style={{ marginLeft: '0.5rem' }}>Iss:</span> {formatDate(booking.clients?.cin_delivre_le)}
                      </div>
                      <div>
                        <span className={styles['lbl']}>Permis:</span> {booking.clients?.permis_numero || 'N/A'}
                        <span className={styles['lbl']} style={{ marginLeft: '0.5rem' }}>Iss:</span> {formatDate(booking.clients?.permis_delivre_le)}
                      </div>
                      <div>
                        <span className={styles['lbl']}>DOB:</span> {formatDate(booking.clients?.date_naissance)}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td className={`${styles['col-vehicle']} ${styles['dense-stack']}`}>
                      <div className={styles['fw-bold']}>{booking.vehicles?.brand} {booking.vehicles?.model}</div>
                      <div className={styles['plate-badge']}>{booking.vehicles?.license_plate || 'NO PLATE'}</div>
                    </td>

                    {/* Rental Period */}
                    <td className={`${styles['col-period']} ${styles['dense-stack']}`}>
                      <div><span className={styles['lbl']}>Dep:</span> {formatDate(booking.start_date)} {(booking as any).pickup_time || booking.departure_time || ''}</div>
                      <div><span className={styles['lbl']}>Ret:</span> {formatDate(booking.end_date)} {booking.return_time || ''}</div>
                      <div className={styles['cumulative-days']}>{booking.rental_days_text || '—'} Days</div>
                    </td>

                    {/* Financials */}
                    <td className={`${styles['col-financials']} ${styles['dense-stack']}`}>
                      {editingFinId === booking.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(229,193,125,0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total:</span>
                            <input 
                              type="number" 
                              value={tempTotal} 
                              onChange={(e) => setTempTotal(e.target.value)}
                              style={{ width: '70px', padding: '0.15rem 0.3rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acompte:</span>
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
                            <span>Total:</span> <strong>{total.toFixed(2)} DT</strong>
                          </div>
                          <div className={styles['fin-row']}>
                            <span>Acompte:</span> <strong style={{ color: 'var(--accent-gold)' }}>{acompte.toFixed(2)} DT</strong>
                          </div>
                          <div className={`${styles['fin-row']} ${styles['fin-border-top']}`}>
                            <span>Reste:</span>
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
                        // Fallback to old flat columns if new handovers table isn't populated yet
                        const pKm = h.pickup_km ?? booking.starting_km
                        const rKm = h.return_km ?? booking.return_km
                        const pFuel = h.pickup_fuel // Will be undefined if using old string system
                        const rFuel = h.return_fuel
                        
                        const drivenKm = calculateDrivenMileage(pKm, rKm)
                        const fuelDelta = calculateFuelDelta(pFuel, rFuel)

                        return (
                          <>
                            {/* Lavage delta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                              <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>💧</span>
                              <span className={styles['cond-tag']}>{h.pickup_cleanliness || lavageLabel(booking.lavage_pickup)}</span>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                              <span className={styles['cond-tag']} style={{ background: (h.return_cleanliness || booking.lavage_return) === 'dirty' || (h.return_cleanliness || booking.lavage_return) === 'Dirty' ? 'rgba(239,68,68,0.12)' : undefined }}>
                                {h.return_cleanliness || lavageLabel(booking.lavage_return) || '—'}
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
                                  {drivenKm.toLocaleString()} km driven
                                </div>
                              )}
                            </div>

                            {/* Fuel delta */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginTop: '0.1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                                <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>⛽</span>
                                <span className={styles['cond-tag']}>
                                  {pFuel !== undefined ? formatFuelFraction(pFuel) : (booking.fuel_level_pickup || '—')}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                                <span className={styles['cond-tag']}>
                                  {rFuel !== undefined ? formatFuelFraction(rFuel) : (booking.fuel_level_return || '—')}
                                </span>
                              </div>
                              {fuelDelta && (
                                <div style={{ width: '100%', fontSize: '0.72rem', color: fuelDelta.color, fontWeight: 700, paddingLeft: '1.2rem', marginTop: '-0.1rem' }}>
                                  {fuelDelta.text}
                                </div>
                              )}
                            </div>
                          </>
                        )
                      })()}
                      
                      {booking.damage_notes && (() => {
                        const isPerfect = booking.damage_notes.toLowerCase().includes('perfect normal return') || booking.damage_notes.includes('[GREEN]');
                        const cleanNotes = booking.damage_notes.replace('[GREEN]', '').trim();
                        return (
                          <div 
                            className={styles['damage-alert']}
                            style={{
                              background: isPerfect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: isPerfect ? '#10b981' : '#ef4444',
                              borderColor: isPerfect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              marginTop: '0.35rem'
                            }}
                          >
                            <span>{isPerfect ? '✅' : '⚠️'}</span>
                            <span>{cleanNotes}</span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions — FIXED: stopPropagation prevents row-click interference */}
                    <td className={styles['col-actions']}>
                      <button
                        className="icon-btn"
                        title="Close Contract / Return"
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
                  No records found matching your search.
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
