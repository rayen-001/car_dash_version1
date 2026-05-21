'use client'

import { useMemo, useState } from 'react'
import { Search, Edit2 } from 'lucide-react'
import styles from '../history.module.css'
import QuickEditBookingModal from './QuickEditBookingModal'

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
  clients?: Client
  vehicles?: Vehicle
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
                      <div><span className={styles['lbl']}>Dep:</span> {formatDate(booking.start_date)} {booking.departure_time || ''}</div>
                      <div><span className={styles['lbl']}>Ret:</span> {formatDate(booking.end_date)} {booking.return_time || ''}</div>
                      <div className={styles['cumulative-days']}>{booking.rental_days_text || '—'} Days</div>
                    </td>

                    {/* Financials */}
                    <td className={`${styles['col-financials']} ${styles['dense-stack']}`}>
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
                    </td>

                    {/* Condition Delta */}
                    <td className={`${styles['col-condition']} ${styles['dense-stack']}`}>
                      {/* Lavage delta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>💧</span>
                        <span className={styles['cond-tag']}>{lavageLabel(booking.lavage_pickup)}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                        <span className={styles['cond-tag']} style={{ background: booking.lavage_return === 'dirty' ? 'rgba(239,68,68,0.12)' : undefined }}>
                          {lavageLabel(booking.lavage_return) || '—'}
                        </span>
                      </div>
                      {/* KM delta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>🛣️</span>
                        <span className={styles['cond-tag']}>{booking.starting_km ?? '—'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                        <span className={styles['cond-tag']}>
                          {booking.return_km !== undefined && booking.return_km !== null ? `${booking.return_km} km` : '-- km'}
                        </span>
                      </div>
                      {/* Fuel delta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>⛽</span>
                        <span className={styles['cond-tag']}>{booking.fuel_level_pickup || '—'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                        <span className={styles['cond-tag']}>{booking.fuel_level_return || '—'}</span>
                      </div>
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
