'use client'

import { AlertOctagon, Phone, Edit, MessageSquare, Calendar } from 'lucide-react'
import styles from '../history.module.css'
import { useLanguage } from '@/lib/i18n'

interface Booking {
  id: string
  client_name: string
  client_phone?: string
  start_date: string
  end_date: string
  pickup_time?: string
  return_time?: string
  total_amount: number
  amount_paid?: number
  accident_reported?: boolean
  owner_remarks?: string
  status: string
}

interface BookingHistoryCardProps {
  booking: Booking
  onEditBooking: (booking: Booking) => void
}

export default function BookingHistoryCard({ booking, onEditBooking }: BookingHistoryCardProps) {
  const { lang } = useLanguage()

  // Extract initials for the avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Financial calculations
  const total = Number(booking.total_amount) || 0
  const paid = Number(booking.amount_paid) || 0
  const remaining = Math.max(0, total - paid)

  // Formatting dates
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const translateStatus = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'confirmed') return lang === 'fr' ? 'Confirmée' : 'Confirmed'
    if (s === 'pending') return lang === 'fr' ? 'En attente' : 'Pending'
    if (s === 'completed') return lang === 'fr' ? 'Terminée' : 'Completed'
    if (s === 'cancelled') return lang === 'fr' ? 'Annulée' : 'Cancelled'
    return status
  }

  return (
    <div className={`${styles['booking-card']} ${booking.accident_reported ? styles['has-incident'] : ''}`}>
      {/* Header */}
      <div className={styles['booking-card-header']}>
        <div className={styles['booking-client-info']}>
          <div className={styles['client-avatar-circle']}>
            {getInitials(booking.client_name)}
          </div>
          <div>
            <div className={styles['client-avatar-name']}>{booking.client_name}</div>
            {booking.client_phone && (
              <div className={styles['client-phone']}>
                <Phone size={10} style={{ display: 'inline', marginRight: '4px' }} />
                {booking.client_phone}
              </div>
            )}
          </div>
        </div>

        <div className={styles['booking-card-badges']}>
          {booking.accident_reported && (
            <span className={styles['incident-badge']}>
              <AlertOctagon size={12} />
              {lang === 'fr' ? 'Accident / Dégât' : 'Accident / Damage'}
            </span>
          )}
          <span 
            className={`${styles['legal-badge']} ${
              booking.status === 'confirmed' ? styles['active'] : 
              booking.status === 'pending' ? styles['expiring'] : 
              booking.status === 'completed' ? styles['active'] : styles['expired']
            }`}
          >
            {translateStatus(booking.status)}
          </span>
          <button 
            className="icon-btn" 
            title={lang === 'fr' ? 'Modifier les détails de la réservation' : 'Edit Booking Details'}
            onClick={() => onEditBooking(booking)}
            style={{ marginLeft: '0.25rem' }}
          >
            <Edit size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={styles['booking-card-body']}>
        {/* Dates & Times */}
        <div className={styles['booking-dates-row']}>
          <div className={styles['date-block']}>
            <span className={styles['date-block-label']}>{lang === 'fr' ? 'Départ' : 'Pick up'}</span>
            <span className={styles['date-block-value']}>{formatDate(booking.start_date)}</span>
            <span className={styles['date-block-time']}>{booking.pickup_time || '10:00'}</span>
          </div>
          
          <div className={styles['date-divider']}>
            <Calendar size={14} />
          </div>

          <div className={styles['date-block']} style={{ textAlign: 'right' }}>
            <span className={styles['date-block-label']}>{lang === 'fr' ? 'Retour' : 'Return'}</span>
            <span className={styles['date-block-value']}>{formatDate(booking.end_date)}</span>
            <span className={styles['date-block-time']}>{booking.return_time || '10:00'}</span>
          </div>
        </div>

        {/* Financial Row */}
        <div className={styles['financial-row']}>
          <div className={styles['fin-item']}>
            <span className={styles['fin-label']}>{lang === 'fr' ? 'Total' : 'Total'}</span>
            <span className={`${styles['fin-value']} ${styles['total']}`}>{total.toFixed(2)} DT</span>
          </div>
          <div className={styles['fin-item']}>
            <span className={styles['fin-label']}>{lang === 'fr' ? 'Payé' : 'Paid'}</span>
            <span className={`${styles['fin-value']} ${styles['paid']}`}>{paid.toFixed(2)} DT</span>
          </div>
          <div className={styles['fin-item']}>
            <span className={styles['fin-label']}>{lang === 'fr' ? 'Solde' : 'Balance'}</span>
            <span className={`${styles['fin-value']} ${styles['remaining']} ${remaining === 0 ? styles['zero'] : styles['due']}`}>
              {remaining.toFixed(2)} DT
            </span>
          </div>
        </div>

        {/* Owner Remarks */}
        {booking.owner_remarks && (
          <div className={styles['remarks-row']}>
            <MessageSquare size={14} className={styles['remarks-icon']} />
            <div>
              <strong>{lang === 'fr' ? 'Remarques du propriétaire :' : 'Owner remarks:'}</strong> {booking.owner_remarks}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
