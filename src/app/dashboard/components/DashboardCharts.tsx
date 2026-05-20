import { useState } from 'react'
import styles from '../dashboard.module.css'

export default function DashboardCharts({ recentBookings }: { recentBookings: any[] }) {
  const [chartFilter, setChartFilter] = useState<'weekly' | 'monthly'>('weekly')

  return (
    <div className={styles['main-grid']}>
      <div className={`${styles['chart-section']} glass-panel`}>
        <div className={styles['section-header']}>
          <h3>Revenue History</h3>
          <div className={styles['filters']}>
            <span className={`${styles['filter']} ${chartFilter === 'weekly' ? styles['active'] : ''}`} onClick={() => setChartFilter('weekly')}>Weekly</span>
            <span className={`${styles['filter']} ${chartFilter === 'monthly' ? styles['active'] : ''}`} onClick={() => setChartFilter('monthly')}>Monthly</span>
          </div>
        </div>

        <div className={styles['premium-line-chart']}>
          <svg viewBox="0 0 500 220" className={styles['chart-svg']} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Grid Lines */}
            <line x1="50" y1="30" x2="480" y2="30" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
            <line x1="50" y1="80" x2="480" y2="80" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
            <line x1="50" y1="130" x2="480" y2="130" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
            <line x1="50" y1="180" x2="480" y2="180" stroke="rgba(197, 160, 89, 0.15)" />

            {/* Axes Labels */}
            <text x="40" y="34" fill="var(--text-muted)" fontSize="9" textAnchor="end">5,000 DT</text>
            <text x="40" y="84" fill="var(--text-muted)" fontSize="9" textAnchor="end">3,000 DT</text>
            <text x="40" y="134" fill="var(--text-muted)" fontSize="9" textAnchor="end">1,000 DT</text>
            <text x="40" y="184" fill="var(--text-muted)" fontSize="9" textAnchor="end">0 DT</text>

            {/* Glowing Background Particle Wave Tracks from Image */}
            <path
              d="M 50 170 C 120 200, 190 120, 260 145 C 330 165, 400 95, 470 55"
              fill="none"
              stroke="rgba(197, 160, 89, 0.06)"
              strokeWidth="1.5"
            />
            <path
              d="M 50 150 C 120 120, 190 160, 260 110 C 330 80, 400 135, 470 65"
              fill="none"
              stroke="rgba(197, 160, 89, 0.04)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />

            {/* Chart Line Path & Fill */}
            {chartFilter === 'weekly' ? (
              <>
                <path
                  d="M 50 160 Q 120 120 190 140 T 330 90 T 470 50"
                  fill="none"
                  stroke="var(--accent-gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                <path
                  d="M 50 160 Q 120 120 190 140 T 330 90 T 470 50 L 470 180 L 50 180 Z"
                  fill="url(#chartGradient)"
                  stroke="none"
                />
                {/* Interactive Nodes with Glowing Rings */}
                <circle cx="190" cy="140" r="6" fill="#171310" stroke="var(--accent-gold)" strokeWidth="2.5" />
                <circle cx="330" cy="90" r="6" fill="#171310" stroke="var(--accent-gold)" strokeWidth="2.5" />
                <circle cx="470" cy="50" r="7" fill="var(--accent-gold)" stroke="#fff" strokeWidth="1.5" />

                {/* Axis Tags */}
                <text x="50" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Mon</text>
                <text x="120" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Tue</text>
                <text x="190" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Wed</text>
                <text x="260" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Thu</text>
                <text x="330" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Fri</text>
                <text x="400" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Sat</text>
                <text x="470" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Sun</text>
              </>
            ) : (
              <>
                <path
                  d="M 50 170 Q 150 130 250 90 T 470 45"
                  fill="none"
                  stroke="var(--accent-gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                <path
                  d="M 50 170 Q 150 130 250 90 T 470 45 L 470 180 L 50 180 Z"
                  fill="url(#chartGradient)"
                  stroke="none"
                />
                {/* Nodes */}
                <circle cx="250" cy="90" r="6" fill="#171310" stroke="var(--accent-gold)" strokeWidth="2.5" />
                <circle cx="470" cy="45" r="7" fill="var(--accent-gold)" stroke="#fff" strokeWidth="1.5" />

                <text x="50" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Week 1</text>
                <text x="190" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Week 2</text>
                <text x="330" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Week 3</text>
                <text x="470" y="202" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Week 4</text>
              </>
            )}

            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--bg-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

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
                  <span className="status-badge confirmed">
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
    </div>
  )
}
