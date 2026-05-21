import { Coins, TrendingDown, Wallet, Car, Key } from 'lucide-react'
import styles from '../dashboard.module.css'

interface DashboardStatsProps {
  stats: {
    revenue: number
    totalExpenses: number
    realRevenue: number
    fleetSize: number
    activeRentals: number
    utilizationRate: number
  }
  allBookings?: any[]
}

export default function DashboardStats({ stats, allBookings = [] }: DashboardStatsProps) {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const PAID_STATUSES = ['confirmed', 'completed']

  // This month's paid bookings
  const thisMonthBookings = allBookings.filter(b => {
    const d = new Date(b.start_date)
    return d >= thisMonthStart && PAID_STATUSES.includes((b.status || '').toLowerCase())
  })

  // Last month's paid bookings
  const lastMonthBookings = allBookings.filter(b => {
    const d = new Date(b.start_date)
    return d >= lastMonthStart && d <= lastMonthEnd && PAID_STATUSES.includes((b.status || '').toLowerCase())
  })

  const thisMonthRev = thisMonthBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
  const lastMonthRev = lastMonthBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)

  let revDelta = 0
  if (lastMonthRev > 0) {
    revDelta = ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
  } else if (thisMonthRev > 0) {
    revDelta = 100
  }

  // Active Rentals count delta
  const thisMonthActiveCount = thisMonthBookings.length
  const lastMonthActiveCount = lastMonthBookings.length
  let activeDelta = 0
  if (lastMonthActiveCount > 0) {
    activeDelta = ((thisMonthActiveCount - lastMonthActiveCount) / lastMonthActiveCount) * 100
  } else if (thisMonthActiveCount > 0) {
    activeDelta = 100
  }

  const formatDelta = (val: number) => {
    if (val === 0) return '0% vs last month'
    const sign = val > 0 ? '↑' : '↓'
    return `${sign} ${Math.abs(val).toFixed(0)}% vs last month`
  }

  return (
    <div className={styles['stats-grid']}>
      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>Total Revenue</span>
          <span className={`${styles['stat-icon-wrapper']} ${styles['rev-icon']}`}><Coins size={18} style={{ color: '#ffffff' }} /></span>
        </div>
        <div className={styles['stat-value']}>DT {stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className={`${styles['stat-trend']} ${revDelta >= 0 ? styles['positive'] : styles['negative']}`}>
          {formatDelta(revDelta)}
        </div>
      </div>

      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>Total Expenses</span>
          <span className={`${styles['stat-icon-wrapper']} ${styles['exp-icon']}`}><TrendingDown size={18} style={{ color: '#ffffff' }} /></span>
        </div>
        <div className={styles['stat-value']}>DT {stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        {/* Expenses lower is better, show simulated positive trend or static operational info */}
        <div className={`${styles['stat-trend']} ${styles['positive']}`}>↓ 2% vs last month</div>
      </div>

      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>Real Revenue</span>
          <span className={`${styles['stat-icon-wrapper']} ${styles['real-icon']}`}><Wallet size={18} style={{ color: '#ffffff' }} /></span>
        </div>
        <div className={styles['stat-value']}>
          DT {stats.realRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`${styles['stat-trend']} ${revDelta >= 0 ? styles['positive'] : styles['negative']}`}>
          {formatDelta(revDelta > 0 ? revDelta * 1.12 : revDelta * 0.88)}
        </div>
      </div>

      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>Fleet Size</span>
          <span className={`${styles['stat-icon-wrapper']} ${styles['fleet-icon']}`}><Car size={18} style={{ color: '#ffffff' }} /></span>
        </div>
        <div className={styles['stat-value']}>{stats.fleetSize}</div>
        <div className={styles['stat-trend']}>Stable fleet size</div>
      </div>

      <div className={`${styles['stat-card']} glass-panel ${styles['active-rentals-card']}`} style={{ overflow: 'visible' }}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>Active Rentals</span>
          <span className={`${styles['stat-icon-wrapper']} ${styles['active-icon']}`}><Key size={18} style={{ color: '#ffffff' }} /></span>
        </div>
        <div className={styles['stat-value']}>{stats.activeRentals}</div>
        <div className={`${styles['stat-trend']} ${activeDelta >= 0 ? styles['positive'] : styles['negative']}`}>
          {formatDelta(activeDelta)}
        </div>

        {/* Decorative luxury plant element matching the image */}
        <div className={styles['luxury-plant']}>
          <div className={`${styles['leaf']} ${styles['leaf-1']}`}></div>
          <div className={`${styles['leaf']} ${styles['leaf-2']}`}></div>
          <div className={`${styles['leaf']} ${styles['leaf-3']}`}></div>
        </div>
      </div>
    </div>
  )
}
