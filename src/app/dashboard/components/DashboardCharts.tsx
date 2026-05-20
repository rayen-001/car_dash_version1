import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import styles from '../dashboard.module.css'
import TopClients from './TopClients'

export default function DashboardCharts({ recentBookings, allBookings = [] }: { recentBookings: any[], allBookings?: any[] }) {
  const [chartFilter, setChartFilter] = useState<'weekly' | 'monthly'>('weekly')

  const weeklyData = useMemo(() => {
    const data = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      const dayBookings = allBookings.filter(b => b.created_at?.startsWith(dateStr) && b.status !== 'cancelled')
      const total = dayBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
      data.push({ name: dayName, revenue: total })
    }
    return data
  }, [allBookings])

  const monthlyData = useMemo(() => {
    const data = []
    const today = new Date()
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - (i * 7 + 6))
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() - (i * 7))
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      const weekBookings = allBookings.filter(b => {
        if (!b.created_at || b.status === 'cancelled') return false
        const bDate = b.created_at.split('T')[0]
        return bDate >= weekStartStr && bDate <= weekEndStr
      })
      const total = weekBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
      data.push({ name: `W${4-i}`, revenue: total })
    }
    return data
  }, [allBookings])

  const chartData = chartFilter === 'weekly' ? weeklyData : monthlyData

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(26, 22, 17, 0.95)',
          border: '1px solid rgba(229, 193, 125, 0.3)',
          padding: '8px 12px',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem'
        }}>
          <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)' }}>{label || payload[0].name}</p>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--accent-gold)' }}>
            {payload[0].name === 'Confirmed' || payload[0].name === 'Pending' || payload[0].name === 'Cancelled' ? 
              `${payload[0].value} Booking(s)` : 
              `${payload[0].value} DT`}
          </p>
        </div>
      )
    }
    return null
  }

  const pieData = useMemo(() => {
    let confirmed = 0
    let pending = 0
    let cancelled = 0
    allBookings.forEach(b => {
      if (b.status === 'confirmed' || b.status === 'completed') confirmed++
      else if (b.status === 'pending') pending++
      else if (b.status === 'cancelled') cancelled++
    })
    return [
      { name: 'Confirmed', value: confirmed, color: '#C5A059' },
      { name: 'Pending', value: pending, color: '#8A6D35' },
      { name: 'Cancelled', value: cancelled, color: '#33291C' }
    ].filter(d => d.value > 0)
  }, [allBookings])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div className={styles['main-grid']}>
      <div className={`${styles['chart-section']} glass-panel`}>
        <div className={styles['section-header']}>
          <h3>Revenue History</h3>
          <div className={styles['filters']}>
            <span className={`${styles['filter']} ${chartFilter === 'weekly' ? styles['active'] : ''}`} onClick={() => setChartFilter('weekly')}>Weekly</span>
            <span className={`${styles['filter']} ${chartFilter === 'monthly' ? styles['active'] : ''}`} onClick={() => setChartFilter('monthly')}>Monthly</span>
          </div>
        </div>

        <div style={{ width: '100%', height: '240px', marginTop: '1.5rem', marginLeft: '-15px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C5A059" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#C5A059" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(197, 160, 89, 0.08)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#C5A059" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                activeDot={{ r: 6, fill: '#171310', stroke: '#C5A059', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart */}
      <div className={`${styles['chart-section']} glass-panel`}>
        <div className={styles['section-header']}>
          <h3>Booking Status</h3>
        </div>
        <div style={{ width: '100%', height: '240px', marginTop: '1.5rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle" 
                wrapperStyle={{ fontSize: '0.8rem', color: 'rgba(229, 193, 125, 0.8)' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

      {/* Row 2: Top Clients & Recent Bookings */}
      <div className={styles['main-grid']}>
        <TopClients allBookings={allBookings} />

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
      </div>
    </div>
  )
}
