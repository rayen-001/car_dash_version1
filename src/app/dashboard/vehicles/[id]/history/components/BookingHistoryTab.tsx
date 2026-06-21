'use client'

import { useState, useMemo } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import BookingHistoryCard from './BookingHistoryCard'
import styles from '../history.module.css'
import { useLanguage } from '@/lib/i18n'

interface Booking {
  id: string
  client_name: string
  client_phone?: string
  client_cin_passport?: string
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

interface BookingHistoryTabProps {
  bookings: Booking[]
  onEditBooking: (booking: Booking) => void
}

export default function BookingHistoryTab({ bookings, onEditBooking }: BookingHistoryTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { lang } = useLanguage()

  // Filter bookings in-memory
  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings

    const term = searchQuery.toLowerCase()
    return bookings.filter((b) => {
      const matchName = b.client_name?.toLowerCase().includes(term)
      const matchPhone = b.client_phone?.toLowerCase().includes(term)
      const matchCin = b.client_cin_passport?.toLowerCase().includes(term)
      const matchDate = b.start_date?.toLowerCase().includes(term) || b.end_date?.toLowerCase().includes(term)
      
      return matchName || matchPhone || matchCin || matchDate
    })
  }, [bookings, searchQuery])

  return (
    <div className={styles['tab-content']}>
      {/* Nested Tab Search */}
      <div className={styles['nested-search']}>
        <Search size={18} className={styles['nested-search-icon']} />
        <input
          type="text"
          className={styles['nested-search-input']}
          placeholder={lang === 'fr' ? 'Filtrer les réservations par nom de client, téléphone, CIN ou date...' : 'Filter bookings by client name, phone number, CIN, or date...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            type="button" 
            className={styles['search-clear']}
            onClick={() => setSearchQuery('')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Bookings Feed */}
      <div className={styles['history-feed']}>
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <BookingHistoryCard
              key={booking.id}
              booking={booking}
              onEditBooking={onEditBooking}
            />
          ))
        ) : (
          <div className={styles['empty-state']}>
            <Calendar className={styles['empty-state-icon']} />
            <p>
              {lang === 'fr' ? 'Aucune réservation trouvée correspondant à votre recherche.' : 'No bookings found matching your search.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
