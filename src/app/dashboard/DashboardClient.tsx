'use client'

import { useState } from 'react'
import { Coins, TrendingDown, Wallet, Car, Key } from 'lucide-react'

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
  const [chartFilter, setChartFilter] = useState<'weekly' | 'monthly'>('weekly')

  // Interactive Calendar States
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')
  const todayDate = new Date()
  const [currentMonth, setCurrentMonth] = useState<number>(todayDate.getMonth())
  const [currentYear, setCurrentYear] = useState<number>(todayDate.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(todayDate.getDate())

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth)

  const daysArray: (number | null)[] = []
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d)
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
    setSelectedDay(null)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
    setSelectedDay(null)
  }

  const getBookingForDate = (day: number | null) => {
    if (!day) return null
    const monthStr = String(currentMonth + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateKey = `${currentYear}-${monthStr}-${dayStr}`

    return allBookings.filter(booking => {
      if (booking.status === 'cancelled') return false
      if (selectedVehicleId !== 'all' && booking.vehicle_id !== selectedVehicleId) return false
      return booking.start_date <= dateKey && booking.end_date >= dateKey
    })
  }

  const activeDayBookings = selectedDay ? getBookingForDate(selectedDay) : null
  const selectedVehicleObj = selectedVehicleId !== 'all'
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null

  return (
    <div className="owner-dashboard">
      <div className="header-section" style={{ position: 'relative', overflow: 'visible' }}>
        <h1 className="page-title">My Performance</h1>
        <p className="subtitle">Analytics and insights for your fleet</p>

        {/* Beautiful Dotted Gold World Map Watermark matching reference photo */}
        <svg className="world-map-watermark" viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
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

      {/* Stats Cards Row */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-icon-wrapper rev-icon"><Coins size={18} style={{ color: '#ffffff' }} /></span>
          </div>
          <div className="stat-value">${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-trend positive">Gross earnings</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Total Expenses</span>
            <span className="stat-icon-wrapper exp-icon"><TrendingDown size={18} style={{ color: '#ffffff' }} /></span>
          </div>
          <div className="stat-value">${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-trend negative">Standard + maintenance costs</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Real Revenue</span>
            <span className="stat-icon-wrapper real-icon"><Wallet size={18} style={{ color: '#ffffff' }} /></span>
          </div>
          <div className="stat-value">
            ${stats.realRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-trend positive">Net profit margin</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Fleet Size</span>
            <span className="stat-icon-wrapper fleet-icon"><Car size={18} style={{ color: '#ffffff' }} /></span>
          </div>
          <div className="stat-value">{stats.fleetSize}</div>
          <div className="stat-trend">Total vehicles owned</div>
        </div>

        <div className="stat-card glass-panel active-rentals-card" style={{ overflow: 'visible' }}>
          <div className="stat-header">
            <span className="stat-label">Active Rentals</span>
            <span className="stat-icon-wrapper active-icon"><Key size={18} style={{ color: '#ffffff' }} /></span>
          </div>
          <div className="stat-value">{stats.activeRentals}</div>
          <div className="stat-trend positive">{stats.utilizationRate.toFixed(1)}% utilization</div>

          {/* Decorative luxury plant element matching the image */}
          <div className="luxury-plant">
            <div className="leaf leaf-1"></div>
            <div className="leaf leaf-2"></div>
            <div className="leaf leaf-3"></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Stunning Chart + Recent Activity */}
      <div className="main-grid">
        <div className="chart-section glass-panel">
          <div className="section-header">
            <h3>Revenue History</h3>
            <div className="filters">
              <span className={`filter ${chartFilter === 'weekly' ? 'active' : ''}`} onClick={() => setChartFilter('weekly')}>Weekly</span>
              <span className={`filter ${chartFilter === 'monthly' ? 'active' : ''}`} onClick={() => setChartFilter('monthly')}>Monthly</span>
            </div>
          </div>

          <div className="premium-line-chart">
            <svg viewBox="0 0 500 220" className="chart-svg" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Grid Lines */}
              <line x1="50" y1="30" x2="480" y2="30" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
              <line x1="50" y1="80" x2="480" y2="80" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
              <line x1="50" y1="130" x2="480" y2="130" stroke="rgba(197, 160, 89, 0.04)" strokeDasharray="3,3" />
              <line x1="50" y1="180" x2="480" y2="180" stroke="rgba(197, 160, 89, 0.15)" />

              {/* Axes Labels */}
              <text x="40" y="34" fill="var(--text-muted)" fontSize="9" textAnchor="end">$5,000</text>
              <text x="40" y="84" fill="var(--text-muted)" fontSize="9" textAnchor="end">$3,000</text>
              <text x="40" y="134" fill="var(--text-muted)" fontSize="9" textAnchor="end">$1,000</text>
              <text x="40" y="184" fill="var(--text-muted)" fontSize="9" textAnchor="end">$0</text>

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
        <div className="recent-activity glass-panel">
          <div className="section-header">
            <h3>Recent Bookings</h3>
          </div>
          <div className="activity-list">
            {recentBookings && recentBookings.length > 0 ? (
              recentBookings.map((item, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-info">
                    <div className="client-name">{item.client_name}</div>
                    <div className="car-name">{item.vehicles?.brand} {item.vehicles?.model}</div>
                  </div>
                  <div className="activity-meta">
                    <div className="status-badge active">
                      {item.status}
                    </div>
                    <div className="price">${item.total_amount}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted">No bookings logged yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Availability Calendar Section */}
      <div className="calendar-section glass-panel">
        <div className="calendar-header-panel">
          <div className="calendar-title-group">
            <h3>Vehicle Availability Calendar</h3>
            <p className="subtitle">Select a vehicle to inspect fully available (empty) days and active rental sessions</p>
          </div>

          <div className="calendar-actions">
            {/* Vehicle Selector Dropdown */}
            <div className="selector-wrapper">
              <label htmlFor="vehicle-filter" className="sr-only">Filter by Vehicle</label>
              <select
                id="vehicle-filter"
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value)
                  setSelectedDay(null)
                }}
                className="vehicle-dropdown"
              >
                <option value="all">🚗 All Fleet Vehicles</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} ({v.license_plate})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Navigator Controls */}
            <div className="month-navigator">
              <button onClick={handlePrevMonth} className="nav-btn" aria-label="Previous Month">◀</button>
              <span className="current-date-label">{monthNames[currentMonth]} {currentYear}</span>
              <button onClick={handleNextMonth} className="nav-btn" aria-label="Next Month">▶</button>
            </div>
          </div>
        </div>

        <div className="calendar-layout-grid">
          {/* Left Side: Calendar Grid */}
          <div className="grid-container">
            {/* Weekdays Row */}
            <div className="weekdays-grid">
              {weekDays.map(day => (
                <div key={day} className="weekday-label">{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="days-grid">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="day-cell empty"></div>
                }

                const bookings = getBookingForDate(day)
                const isBooked = bookings && bookings.length > 0
                const isSelected = selectedDay === day

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDay(day)}
                    className={`day-cell ${isBooked ? 'booked' : 'available'} ${isSelected ? 'selected' : ''}`}
                    aria-label={`Day ${day}, ${isBooked ? 'Booked' : 'Available'}`}
                  >
                    <span className="day-number">{day}</span>
                    {isBooked ? (
                      <span className="booking-indicator-dot red" title={`${bookings.length} Booking(s)`}></span>
                    ) : (
                      <span className="booking-indicator-dot green" title="Available"></span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legends */}
            <div className="calendar-legends">
              <div className="legend-item">
                <span className="legend-color green"></span>
                <span>🟢 Disponible (Fully Empty & Ready to Rent)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color red"></span>
                <span>🔴 Booked / Occupied Slot</span>
              </div>
            </div>
          </div>

          {/* Right Side: Day Inspector / Details Panel */}
          <div className="details-panel glass-panel">
            <h4 className="panel-title">
              📅 Inspector: {selectedDay ? `${selectedDay} ${monthNames[currentMonth]} ${currentYear}` : 'Select a Day'}
            </h4>

            {selectedDay ? (
              <div className="panel-content">
                {activeDayBookings && activeDayBookings.length > 0 ? (
                  <div className="booking-details-list">
                    <p className="status-message occupied">
                      ⚠️ **Occupied Days**: {activeDayBookings.length} booking(s) cover this date.
                    </p>

                    {activeDayBookings.map((b, idx) => (
                      <div key={idx} className="inspector-booking-card">
                        <div className="card-header">
                          <span className="vehicle-tag">🚗 {b.vehicles?.brand} {b.vehicles?.model}</span>
                          <span className="status-label">{b.status}</span>
                        </div>
                        <div className="card-body">
                          <p><strong>Client:</strong> {b.client_name}</p>
                          <p><strong>Period:</strong> {b.start_date} to {b.end_date}</p>
                          <p><strong>Total:</strong> ${b.total_amount?.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-slot-congratulations">
                    <div className="sparkle-icon">🟢</div>
                    <h5>Perfectly Available!</h5>
                    <p className="available-desc">
                      This date is completely empty and ready to be booked.
                    </p>
                    {selectedVehicleObj && (
                      <div className="rate-info-card">
                        <p className="rate-title">Suggested Rental Rate</p>
                        <p className="rate-value">${selectedVehicleObj.price_per_day} <span className="rate-unit">/ day</span></p>
                      </div>
                    )}
                    <button
                      className="confirm-offer-btn"
                      onClick={() => alert(`Day ${selectedDay} is available! You can quote customers $${selectedVehicleObj ? selectedVehicleObj.price_per_day : '100'} / day.`)}
                    >
                      Share Availability / Quote
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-day-selected-prompt">
                <p>Click on any date in the calendar to check detailed fleet occupancy or print custom quotes.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .owner-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2.25rem;
          padding: 0.5rem;
        }

        .header-section {
          margin-bottom: 1.5rem;
          position: relative;
        }

        .page-title {
          font-family: var(--font-heading);
          font-size: 2.75rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 30px rgba(229, 193, 125, 0.15);
        }

        .subtitle {
          font-family: var(--font-body);
          color: rgba(229, 193, 125, 0.6);
          font-size: 1.05rem;
          letter-spacing: 0.2px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.75rem;
        }

        /* ============================================================
           STAT CARDS — Premium 3D glass with Glowing Caps
           ============================================================ */
        .stat-card {
          padding: 2.25rem 1.75rem !important;
          position: relative;
          background: rgba(10, 8, 7, 0.85) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(229, 193, 125, 0.12) !important;
          border-radius: 16px !important;
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.7),
            inset 0 0 20px rgba(0, 0, 0, 0.95) !important;
          overflow: hidden;
          transition: var(--transition);
        }

        /* Top glowing golden cap */
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 10%, var(--accent-gold-hover) 50%, transparent 90%);
          box-shadow: 0 0 15px var(--accent-gold-hover), 0 0 5px var(--accent-gold);
          opacity: 0.75;
          transition: var(--transition);
          z-index: 2;
        }

        /* Bottom glowing golden cap */
        .stat-card::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 10%, var(--accent-gold-hover) 50%, transparent 90%);
          box-shadow: 0 0 15px var(--accent-gold-hover), 0 0 5px var(--accent-gold);
          opacity: 0.75;
          transition: var(--transition);
          z-index: 2;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          border-color: rgba(229, 193, 125, 0.3) !important;
          box-shadow: 
            0 20px 45px rgba(0, 0, 0, 0.8),
            0 0 30px rgba(229, 193, 125, 0.1),
            inset 0 0 20px rgba(0, 0, 0, 0.9) !important;
        }

        .stat-card:hover::before, .stat-card:hover::after {
          opacity: 1;
          background: linear-gradient(90deg, transparent 0%, var(--accent-gold) 50%, transparent 100%);
          box-shadow: 0 0 20px var(--accent-gold), 0 0 8px #ffffff;
        }

        .stat-card.active-rentals-card {
          overflow: visible !important;
        }

        /* ============================================================
           Decorative leaf cluster — refined champagne wax-seal feel
           ============================================================ */
        .luxury-plant {
          position: absolute;
          top: -18px;
          right: -18px;
          width: 75px;
          height: 75px;
          pointer-events: none;
          z-index: 10;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
        }

        .leaf {
          position: absolute;
          background: linear-gradient(135deg, rgba(229, 193, 125, 0.45) 0%, rgba(138, 109, 53, 0.2) 100%);
          border: 1px solid rgba(229, 193, 125, 0.5);
          border-radius: 85% 0% 70% 55% / 70% 0% 85% 55%;
          box-shadow:
            inset 0 1px 0 rgba(255, 240, 200, 0.3),
            0 8px 18px rgba(0, 0, 0, 0.5);
          transform-origin: bottom left;
          backdrop-filter: blur(6px);
        }

        .leaf-1 { width: 38px; height: 38px; transform: rotate(-18deg) translate(22px, 12px); }
        .leaf-2 { width: 48px; height: 48px; transform: rotate(38deg) translate(24px, -2px); }
        .leaf-3 { width: 28px; height: 28px; transform: rotate(-58deg) translate(8px, 20px); }

        /* ============================================================
           Stat icon — embossed gem
           ============================================================ */
        .stat-icon-wrapper {
          width: 42px !important;
          height: 42px !important;
          border-radius: 12px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem !important;
          box-shadow: 
            0 8px 20px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          transition: var(--transition);
        }

        .rev-icon {
          background: linear-gradient(135deg, #10b981 0%, #064e3b 100%) !important;
          border: 1px solid rgba(16, 185, 129, 0.4) !important;
        }
        .exp-icon {
          background: linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%) !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
        }
        .real-icon {
          background: linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold-deep) 100%) !important;
          border: 1px solid rgba(229, 193, 125, 0.4) !important;
        }
        .fleet-icon {
          background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%) !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
        }
        .active-icon {
          background: linear-gradient(135deg, #f59e0b 0%, #78350f 100%) !important;
          border: 1px solid rgba(245, 158, 11, 0.4) !important;
        }

        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          color: rgba(229, 193, 125, 0.55);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 600;
          position: relative;
          z-index: 1;
        }

        .stat-value {
          font-size: 2.8rem;
          font-weight: 500;
          font-family: var(--font-heading);
          letter-spacing: -0.03em;
          margin-bottom: 0.75rem;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 50%, var(--accent-gold-deep) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 20px rgba(229, 193, 125, 0.2);
          position: relative;
          z-index: 1;
        }

        .stat-trend {
          font-size: 0.9rem;
          font-family: var(--font-body);
          color: rgba(229, 193, 125, 0.5);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          position: relative;
          z-index: 1;
        }

        .positive { color: #10b981 !important; }
        .negative { color: #ef4444 !important; }

        /* ============================================================
           MAIN GRID & PANELS
           ============================================================ */
        .main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.75rem;
        }

        @media (max-width: 1024px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        .chart-section {
          padding: 2.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .premium-line-chart {
          width: 100%;
          height: 280px;
          padding-top: 1rem;
          position: relative;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
          filter: drop-shadow(0 8px 30px rgba(229, 193, 125, 0.1));
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .section-header h3 {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .filters {
          display: flex;
          background: rgba(18, 15, 13, 0.85);
          border: 1px solid rgba(229, 193, 125, 0.15);
          border-radius: 30px;
          padding: 0.35rem;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }

        .filter {
          padding: 0.5rem 1.25rem;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 20px;
          cursor: pointer;
          color: rgba(229, 193, 125, 0.55);
          transition: var(--transition);
          letter-spacing: 0.3px;
        }

        .filter:hover {
          color: #ffffff;
        }

        .filter.active {
          background: linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold) 100%);
          color: #1a1410 !important;
          box-shadow: 
            0 4px 12px rgba(229, 193, 125, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        /* Recent Activity / Bookings */
        .recent-activity {
          padding: 2.25rem;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: rgba(18, 15, 13, 0.65);
          border-radius: 12px;
          border: 1px solid rgba(229, 193, 125, 0.08);
          transition: var(--transition);
        }

        .activity-item:hover {
          background: rgba(229, 193, 125, 0.06);
          border-color: rgba(229, 193, 125, 0.25);
          transform: translateX(4px);
        }

        .client-name {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.3rem;
          color: #ffffff;
        }

        .car-name {
          font-size: 0.85rem;
          color: rgba(229, 193, 125, 0.6);
        }

        .activity-meta {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.4rem;
        }

        .price {
          font-weight: 500;
          font-family: var(--font-heading);
          font-size: 1.2rem;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ============================================================
           CALENDAR SECTION
           ============================================================ */
        .calendar-section {
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .calendar-header-panel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
          border-bottom: 1px solid rgba(229, 193, 125, 0.12);
          padding-bottom: 1.75rem;
        }

        .calendar-title-group h3 {
          font-family: var(--font-heading);
          font-size: 1.65rem;
          font-weight: 500;
          margin-bottom: 0.35rem;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .calendar-actions {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
        }

        .vehicle-dropdown {
          background: rgba(18, 15, 13, 0.85);
          border: 1px solid rgba(229, 193, 125, 0.15);
          border-radius: 30px;
          padding: 0.75rem 1.5rem;
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 500;
          font-family: var(--font-body);
          outline: none;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .vehicle-dropdown option {
          background-color: #12100e !important;
          color: #f5f5f5 !important;
        }

        .vehicle-dropdown:focus {
          border-color: var(--accent-gold);
          box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 0 0 3px rgba(229, 193, 125, 0.25);
        }

        .month-navigator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(18, 15, 13, 0.85);
          padding: 0.4rem;
          border-radius: 30px;
          border: 1px solid rgba(229, 193, 125, 0.15);
        }

        .nav-btn {
          background: transparent;
          border: none;
          color: var(--accent-gold);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.45rem 1rem;
          border-radius: 20px;
          transition: var(--transition-fast);
        }

        .nav-btn:hover {
          background: rgba(229, 193, 125, 0.15);
        }

        .current-date-label {
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 1.05rem;
          min-width: 140px;
          text-align: center;
          letter-spacing: -0.01em;
          color: #ffffff;
        }

        .calendar-layout-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2.25rem;
        }

        @media (max-width: 900px) {
          .calendar-layout-grid {
            grid-template-columns: 1fr;
          }
        }

        .grid-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .weekdays-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--accent-gold);
          padding-bottom: 0.5rem;
        }

        .days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.65rem;
        }

        .day-cell {
          aspect-ratio: 1.15;
          background: rgba(18, 15, 13, 0.45);
          border: 1px solid rgba(229, 193, 125, 0.08);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 0.75rem;
          cursor: pointer;
          position: relative;
          transition: var(--transition);
          text-align: left;
          box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.03);
        }

        .day-cell:hover:not(.empty) {
          background: rgba(229, 193, 125, 0.06);
          border-color: rgba(229, 193, 125, 0.3);
          transform: translateY(-3px);
          box-shadow: 
            inset 0 1px 0 rgba(255, 240, 200, 0.08),
            0 10px 20px -5px rgba(0, 0, 0, 0.7);
        }

        .day-cell.empty {
          background: transparent;
          border: none;
          cursor: default;
          box-shadow: none;
        }

        .day-cell.selected {
          border-color: var(--accent-gold) !important;
          background: rgba(229, 193, 125, 0.15) !important;
          box-shadow: 
            inset 0 1px 0 rgba(255, 240, 200, 0.15),
            0 0 24px -4px rgba(229, 193, 125, 0.35) !important;
        }

        .day-number {
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 1.05rem;
          color: #ffffff;
        }

        .booking-indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          align-self: flex-end;
        }

        .booking-indicator-dot.green {
          background: #10b981;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
        }

        .booking-indicator-dot.red {
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
        }

        .calendar-legends {
          display: flex;
          gap: 1.5rem;
          margin-top: 1rem;
          font-size: 0.85rem;
          color: rgba(229, 193, 125, 0.55);
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-color.green { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
        .legend-color.red { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5); }

        /* ============================================================
           DETAILS INSPECTOR
           ============================================================ */
        .details-panel {
          padding: 2.25rem 1.75rem !important;
          background: rgba(10, 8, 7, 0.85) !important;
          border: 1px solid rgba(229, 193, 125, 0.12) !important;
          border-radius: 16px !important;
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.7),
            inset 0 0 20px rgba(0, 0, 0, 0.95) !important;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          min-height: 300px;
        }

        .panel-title {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          border-bottom: 1px solid rgba(229, 193, 125, 0.12);
          padding-bottom: 0.85rem;
          margin: 0;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .status-message {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.65rem 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .status-message.occupied {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .inspector-booking-card {
          background: rgba(18, 15, 13, 0.65);
          border: 1px solid rgba(229, 193, 125, 0.15);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.05);
        }

        .inspector-booking-card .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.85rem;
        }

        .vehicle-tag {
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 1.05rem;
          color: var(--accent-gold);
          letter-spacing: -0.01em;
        }

        .card-body p {
          margin: 0.35rem 0;
          font-size: 0.88rem;
          color: rgba(229, 193, 125, 0.6);
        }

        .empty-slot-congratulations {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem 1rem;
          gap: 0.8rem;
        }

        .sparkle-icon {
          font-size: 2.75rem;
          filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.5));
        }

        .empty-slot-congratulations h5 {
          font-family: var(--font-heading);
          font-size: 1.35rem;
          font-weight: 500;
          color: #10b981;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .available-desc {
          font-size: 0.85rem;
          color: rgba(229, 193, 125, 0.55);
          margin-bottom: 1rem;
        }

        .rate-info-card {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 1.25rem;
          border-radius: 12px;
          margin-bottom: 1rem;
          width: 100%;
        }

        .rate-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(229, 193, 125, 0.55);
          font-weight: 600;
          margin: 0 0 0.3rem 0;
        }

        .rate-value {
          font-family: var(--font-heading);
          font-size: 1.85rem;
          font-weight: 500;
          color: #10b981;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .rate-unit {
          font-size: 0.85rem;
          font-weight: 400;
          color: rgba(229, 193, 125, 0.55);
          font-family: var(--font-body);
        }

        .confirm-offer-btn {
          background: linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold) 50%, var(--accent-gold-deep) 100%) !important;
          border: none;
          border-radius: 12px;
          padding: 1rem 1.5rem;
          color: #1a1410 !important;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: var(--transition);
          width: 100%;
          box-shadow: 0 6px 16px -3px rgba(229, 193, 125, 0.35);
        }

        .confirm-offer-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -4px rgba(229, 193, 125, 0.5);
        }

        .no-day-selected-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          text-align: center;
          color: rgba(229, 193, 125, 0.5);
          font-size: 0.95rem;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
