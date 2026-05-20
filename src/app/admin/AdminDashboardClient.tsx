'use client'

import { Users, Car, Coins, Calendar } from 'lucide-react'
import styles from './admin.module.css'

interface AdminDashboardClientProps {
  stats: {
    totalOwners: number
    activeVehicles: number
    totalRevenue: number
    activeBookings: number
  }
}

export default function AdminDashboardClient({ stats }: AdminDashboardClientProps) {
  return (
    <div className={styles['admin-dashboard']}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>Global Overview</h1>
        <p className={styles['subtitle']}>Platform performance across all tenants</p>
      </div>

      <div className={styles['stats-grid']}>
        <div className={`${styles['stat-card']} glass-panel`}>
          <div className={styles['stat-header']}>
            <span className={styles['stat-label']}>Total Owners</span>
            <span className={styles['stat-icon']}><Users size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className={styles['stat-value']}>{stats.totalOwners}</div>
          <div className={`${styles['stat-trend']} ${styles['positive']}`}>Registered partners</div>
        </div>
        
        <div className={`${styles['stat-card']} glass-panel`}>
          <div className={styles['stat-header']}>
            <span className={styles['stat-label']}>Active Vehicles</span>
            <span className={styles['stat-icon']}><Car size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className={styles['stat-value']}>{stats.activeVehicles}</div>
          <div className={`${styles['stat-trend']} ${styles['positive']}`}>Total platform fleet</div>
        </div>

        <div className={`${styles['stat-card']} glass-panel`}>
          <div className={styles['stat-header']}>
            <span className={styles['stat-label']}>Total Revenue</span>
            <span className={styles['stat-icon']}><Coins size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className={styles['stat-value']}>${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className={`${styles['stat-trend']} ${styles['positive']}`}>Processed rentals</div>
        </div>

        <div className={`${styles['stat-card']} glass-panel`}>
          <div className={styles['stat-header']}>
            <span className={styles['stat-label']}>Active Bookings</span>
            <span className={styles['stat-icon']}><Calendar size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className={styles['stat-value']}>{stats.activeBookings}</div>
          <div className={`${styles['stat-trend']} ${styles['positive']}`}>Ongoing reservations</div>
        </div>
      </div>

      <div className={styles['charts-section']}>
        <div className={`${styles['chart-card']} glass-panel`}>
          <h3>Revenue Growth</h3>
          <div className={styles['mock-chart']}>
            <div className={styles['chart-bars']}>
              {[40, 60, 45, 80, 65, 90, 100].map((height, i) => (
                <div key={i} className={styles['bar-wrapper']}>
                  <div className={styles['bar']} style={{ height: `${height}%` }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className={`${styles['chart-card']} glass-panel ${styles['map-card'] || ''}`}>
          <h3>Global Reach</h3>
          <div className={styles['mock-map']}>
            <div className={styles['map-dots']}></div>
          </div>
        </div>
      </div>
    </div>
  )
}

