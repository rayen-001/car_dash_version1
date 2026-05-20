'use client'

import { AlertTriangle, Clock, CreditCard, Car } from 'lucide-react'
import styles from '../dashboard.module.css'

interface AlertStripProps {
  allBookings: any[]
  vehicles: any[]
}

export default function AlertStrip({ allBookings = [], vehicles = [] }: AlertStripProps) {
  const todayObj = new Date()
  const year = todayObj.getFullYear()
  const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const dayStr = String(todayObj.getDate()).padStart(2, '0')
  const today = `${year}-${monthStr}-${dayStr}`

  // 1. Overdue Returns
  const overdueReturns = allBookings.filter(
    (b) => b.end_date < today && b.status === 'confirmed'
  )

  // 2. Returns Today
  const returnsToday = allBookings.filter(
    (b) => b.end_date === today && b.status === 'confirmed'
  )

  // 3. Pending Payments
  const pendingPayments = allBookings.filter(
    (b) => b.status === 'confirmed' && b.payment_status === 'pending'
  )

  // 4. Low Fleet Alert
  const activeRentals = allBookings.filter(
    (b) => b.start_date <= today && b.end_date >= today && b.status === 'confirmed'
  )
  const fleetSize = vehicles.length
  const lowFleet = fleetSize > 0 && activeRentals.length >= fleetSize

  if (
    overdueReturns.length === 0 &&
    returnsToday.length === 0 &&
    pendingPayments.length === 0 &&
    !lowFleet
  ) {
    return null // Don't render anything if there are no alerts
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
      
      {overdueReturns.length > 0 && (
        <div className={`${styles['alert-banner']} ${styles['alert-critical']}`}>
          <div className={styles['alert-icon']}><AlertTriangle size={18} /></div>
          <div className={styles['alert-content']}>
            <strong>Critical:</strong> You have {overdueReturns.length} vehicle(s) that are overdue for return. Please contact the clients immediately.
          </div>
        </div>
      )}

      {lowFleet && (
        <div className={`${styles['alert-banner']} ${styles['alert-warning']}`}>
          <div className={styles['alert-icon']}><Car size={18} /></div>
          <div className={styles['alert-content']}>
            <strong>Fleet Capacity:</strong> All vehicles are currently booked. You have 0 available cars today.
          </div>
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className={`${styles['alert-banner']} ${styles['alert-warning']}`}>
          <div className={styles['alert-icon']}><CreditCard size={18} /></div>
          <div className={styles['alert-content']}>
            <strong>Payments:</strong> You have {pendingPayments.length} confirmed booking(s) with pending payments.
          </div>
        </div>
      )}

      {returnsToday.length > 0 && (
        <div className={`${styles['alert-banner']} ${styles['alert-info']}`}>
          <div className={styles['alert-icon']}><Clock size={18} /></div>
          <div className={styles['alert-content']}>
            <strong>Reminders:</strong> {returnsToday.length} vehicle(s) are scheduled to be returned today.
          </div>
        </div>
      )}

    </div>
  )
}
