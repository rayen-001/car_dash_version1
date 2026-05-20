'use client'

import styles from '../dashboard.module.css'
import TopClients from './TopClients'

interface DashboardActivityProps {
  recentBookings: any[]
  allBookings: any[]
}

export default function DashboardActivity({ recentBookings = [], allBookings = [] }: DashboardActivityProps) {
  return (
    <div className={styles['main-grid']}>
      {/* Recent Bookings List */}
      <div className={`${styles['recent-activity']} glass-panel`}>
        <div className={styles['section-header']}>
          <h3>Recent Bookings</h3>
        </div>
        <div className={styles['activity-list']}>
          {recentBookings && recentBookings.length > 0 ? (
            recentBookings.map((item, i) => (
              <div key={i} className={styles['activity-item']}>
                <div className="activity-info">
                  <div className={styles['client-name']}>{item.client_name}</div>
                  <div className={styles['car-name']}>{item.vehicles?.brand} {item.vehicles?.model}</div>
                </div>
                <div className={styles['activity-meta']}>
                  <span className={`status-badge ${item.status}`}>
                    {item.status}
                  </span>
                  <div className={styles['price']}>DT {item.total_amount}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted">No bookings logged yet.</div>
          )}
        </div>
      </div>

      {/* Top Clients Leaderboard */}
      <TopClients allBookings={allBookings} />
    </div>
  )
}
