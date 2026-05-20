'use client'

import styles from './dashboard.module.css'
import DashboardStats from './components/DashboardStats'
import DashboardCalendar from './components/DashboardCalendar'
import DashboardCharts from './components/DashboardCharts'
import TodayOperations from './components/TodayOperations'
import AlertStrip from './components/AlertStrip'

interface DashboardClientProps {
  stats: {
    revenue: number
    totalExpenses: number
    realRevenue: number
    fleetSize: number
    activeRentals: number
    utilizationRate: number
  }
  recentBookings: any[]
  vehicles?: any[]
  allBookings?: any[]
}

export default function DashboardClient({
  stats,
  recentBookings,
  vehicles = [],
  allBookings = []
}: DashboardClientProps) {
  
  return (
    <div className={styles['owner-dashboard']}>
      <div className={styles['header-section']} style={{ position: 'relative', overflow: 'visible' }}>
        <h1 className={styles['page-title']}>My Performance</h1>
        <p className={styles['subtitle']}>Analytics and insights for your fleet</p>

        {/* Beautiful Dotted Gold World Map Watermark matching reference photo */}
        <svg className={styles['world-map-watermark']} viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
          position: 'absolute',
          top: '-30px',
          right: '20px',
          width: '420px',
          height: '160px',
          opacity: 0.12,
          pointerEvents: 'none',
          zIndex: 1
        }}>
          <g fill="#C5A059">
            {/* North America */}
            <circle cx="80" cy="80" r="3" /><circle cx="100" cy="70" r="3" /><circle cx="120" cy="75" r="3" />
            <circle cx="90" cy="95" r="3" /><circle cx="110" cy="90" r="3" /><circle cx="130" cy="85" r="3" />
            <circle cx="100" cy="115" r="3" /><circle cx="120" cy="110" r="3" /><circle cx="140" cy="105" r="3" />
            <circle cx="150" cy="120" r="3" /><circle cx="170" cy="130" r="3" /><circle cx="190" cy="125" r="3" />

            {/* South America */}
            <circle cx="210" cy="190" r="3" /><circle cx="230" cy="205" r="3" /><circle cx="220" cy="225" r="3" />
            <circle cx="240" cy="245" r="3" /><circle cx="250" cy="265" r="3" /><circle cx="260" cy="285" r="3" />

            {/* Europe */}
            <circle cx="420" cy="70" r="3" /><circle cx="440" cy="65" r="3" /><circle cx="460" cy="75" r="3" />
            <circle cx="430" cy="90" r="3" /><circle cx="450" cy="85" r="3" /><circle cx="470" cy="95" r="3" />

            {/* Africa */}
            <circle cx="450" cy="150" r="3" /><circle cx="470" cy="165" r="3" /><circle cx="460" cy="185" r="3" />
            <circle cx="480" cy="205" r="3" /><circle cx="490" cy="225" r="3" /><circle cx="510" cy="245" r="3" />
            <circle cx="520" cy="265" r="3" />

            {/* Asia */}
            <circle cx="620" cy="60" r="3" /><circle cx="640" cy="55" r="3" /><circle cx="660" cy="65" r="3" />
            <circle cx="630" cy="80" r="3" /><circle cx="650" cy="75" r="3" /><circle cx="670" cy="85" r="3" />
            <circle cx="690" cy="90" r="3" /><circle cx="710" cy="95" r="3" /><circle cx="730" cy="100" r="3" />
            <circle cx="660" cy="115" r="3" /><circle cx="680" cy="110" r="3" /><circle cx="700" cy="120" r="3" />
            <circle cx="720" cy="130" r="3" /><circle cx="740" cy="140" r="3" /><circle cx="760" cy="135" r="3" />

            {/* Australia */}
            <circle cx="780" cy="240" r="3" /><circle cx="800" cy="250" r="3" /><circle cx="790" cy="265" r="3" />
            <circle cx="810" cy="280" r="3" />
          </g>
        </svg>
      </div>

      <AlertStrip allBookings={allBookings} vehicles={vehicles} />

      {/* Stats Cards Row */}
      <DashboardStats stats={stats} allBookings={allBookings} />

      <TodayOperations allBookings={allBookings} />

      <DashboardCharts recentBookings={recentBookings} allBookings={allBookings} />

      <DashboardCalendar vehicles={vehicles} allBookings={allBookings} />
    </div>
  )
}
