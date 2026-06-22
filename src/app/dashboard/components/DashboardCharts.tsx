import { useState, useMemo, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'
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

export default function DashboardCharts({
  allBookings = [],
  expenses = [],
  maintenance = [],
  selectedYear
}: {
  recentBookings?: any[],
  allBookings?: any[],
  expenses?: any[],
  maintenance?: any[],
  selectedYear: number
}) {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Resolve current calendar year dynamically based on user selection
  const currentYear = selectedYear
  const currentYearPrefix = `${currentYear}-`

  // YTD P&L Data Aggregation
  const chartDataYTD = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const data = months.map(m => ({ name: m, inflows: 0, outflows: 0 }))

    const PAID_STATUSES = ['confirmed', 'completed']

    // Aggregate current-year Inflows
    allBookings.forEach(b => {
      const status = (b.status || '').toLowerCase()
      if (PAID_STATUSES.includes(status)) {
        const bDateStr = b.start_date || b.created_at
        if (bDateStr && bDateStr.startsWith(currentYearPrefix)) {
          const d = new Date(bDateStr)
          const mIndex = d.getMonth()
          const totalAmount = Number(b.total_amount) || 0
          data[mIndex].inflows += totalAmount
        }
      }
    })

    // Aggregate current-year Outflows (Expenses)
    expenses.forEach(e => {
      const eDateStr = e.created_at
      if (eDateStr && eDateStr.startsWith(currentYearPrefix)) {
        const d = new Date(eDateStr)
        const mIndex = d.getMonth()
        data[mIndex].outflows += (Number(e.amount) || 0)
      }
    })

    // Aggregate current-year Outflows (Maintenance)
    maintenance.forEach(m => {
      const mDateStr = m.service_date || m.created_at
      if (mDateStr && mDateStr.startsWith(currentYearPrefix)) {
        const d = new Date(mDateStr)
        const mIndex = d.getMonth()
        data[mIndex].outflows += (Number(m.cost) || 0)
      }
    })

    return data
  }, [allBookings, expenses, maintenance, currentYearPrefix])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel" style={{
          background: 'rgba(10, 8, 7, 0.95)',
          border: '1px solid rgba(229, 193, 125, 0.2)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#E5C17D', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {currentYear} {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', marginBottom: '4px' }}>
              <span style={{ color: entry.color, fontSize: '0.85rem' }}>{entry.name}:</span>
              <strong style={{ color: entry.color, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                {entry.value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT
              </strong>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0]
      return (
        <div className="glass-panel" style={{
          background: 'rgba(10, 8, 7, 0.95)',
          border: '1px solid rgba(229, 193, 125, 0.2)',
          padding: '10px 14px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
        }}>
          <p style={{ margin: '0 0 6px 0', color: '#E5C17D', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {t('bookingForm.bookingStatus') || 'Booking Status'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'center' }}>
            <span style={{ color: entry.payload.color, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.payload.color }} />
              {entry.name}:
            </span>
            <strong style={{ color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace' }}>
              {entry.value.toLocaleString()} {t('nav.bookings') || 'Bookings'}
            </strong>
          </div>
        </div>
      )
    }
    return null
  }

  const pieData = useMemo(() => {
    let confirmed = 0
    let completed = 0
    let pending = 0
    let cancelled = 0
    allBookings.forEach(b => {
      const bDateStr = b.start_date || b.created_at
      if (bDateStr && bDateStr.startsWith(currentYearPrefix)) {
        const status = (b.status || '').toLowerCase()
        if (status === 'confirmed') confirmed++
        else if (status === 'completed') completed++
        else if (status === 'pending') pending++
        else if (status === 'cancelled') cancelled++
      }
    })
    return [
      { name: t('status.completed'), value: completed, color: '#10b981' },
      { name: t('status.confirmed'), value: confirmed, color: '#C5A059' },
      { name: t('status.pending'), value: pending, color: '#8A6D35' },
      { name: t('status.cancelled'), value: cancelled, color: '#33291C' }
    ].filter(d => d.value > 0)
  }, [allBookings, currentYearPrefix, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div className={styles['main-grid']}>
        {/* Recharts Hydration Guard wrapper */}
        <div className={`${styles['chart-section']} glass-panel`}>
          <div className={styles['section-header']}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3>{currentYear} P&L Trend Engine</h3>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Cumulative Operating Variance
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: '280px', marginTop: '1.5rem', marginLeft: '-15px' }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDataYTD} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(229, 193, 125, 0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    name="Inflows"
                    dataKey="inflows"
                    stroke="#10B981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorInflows)"
                    activeDot={{ r: 6, fill: '#171310', stroke: '#10B981', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    name="Outflows"
                    dataKey="outflows"
                    stroke="#EF4444"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorOutflows)"
                    activeDot={{ r: 6, fill: '#171310', stroke: '#EF4444', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--accent-gold)' }}>Loading {currentYear} Engine...</span>
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart */}
        <div className={`${styles['chart-section']} glass-panel`}>
          <div className={styles['section-header']}>
            <h3>Booking Status</h3>
          </div>
          <div style={{ width: '100%', height: '240px', marginTop: '1.5rem' }}>
            {mounted ? (
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
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '0.8rem', color: 'rgba(229, 193, 125, 0.8)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--accent-gold)' }}>Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
