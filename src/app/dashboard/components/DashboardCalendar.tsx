import { useState, useMemo } from 'react'
import { X, Calendar, ShieldAlert, Sparkles, ChevronRight, Ban, User, Coins } from 'lucide-react'
import styles from '../dashboard.module.css'
import { useRouter } from 'next/navigation'

interface Installment {
  id: string
  amount: number
  due_date: string
  status: 'paid' | 'unpaid'
  paid_date?: string | null
}

interface Booking {
  id: string
  vehicle_id: string
  client_name: string
  start_date: string
  end_date: string
  status: string
  total_amount?: number
  vehicles?: {
    brand: string
    model: string
    license_plate: string
  }
}

interface Vehicle {
  id: string
  brand: string
  model: string
  license_plate: string
}

interface VehicleAvailabilityState {
  vehicle: Vehicle
  category: 'A' | 'B' | 'C'
  totalDays: number
  availableDays: number
  occupiedDays: Set<string>
}

// Helper to generate all YYYY-MM-DD date strings in a range (inclusive)
function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = []
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return []
  }
  
  const current = new Date(start)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export default function DashboardCalendar({ 
  vehicles = [], 
  allBookings = [] 
}: { 
  vehicles?: Vehicle[]
  allBookings?: Booking[] 
}) {
  const router = useRouter()
  // Interactive Calendar States
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')
  const todayDate = new Date()
  const [currentMonth, setCurrentMonth] = useState<number>(todayDate.getMonth())
  const [currentYear, setCurrentYear] = useState<number>(todayDate.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(todayDate.getDate())

  // Phase 19 state
  const [inquiryStartDate, setInquiryStartDate] = useState<string>('')
  const [inquiryEndDate, setInquiryEndDate] = useState<string>('')
  const [highlightVehicleId, setHighlightVehicleId] = useState<string | null>(null)

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

  const getBookingForDate = (day: number | null, vehicleFilterId: string = selectedVehicleId) => {
    if (!day) return null
    const monthStr = String(currentMonth + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateKey = `${currentYear}-${monthStr}-${dayStr}`

    return allBookings.filter(booking => {
      if (booking.status === 'cancelled') return false
      if (vehicleFilterId !== 'all' && booking.vehicle_id !== vehicleFilterId) return false
      return booking.start_date <= dateKey && booking.end_date >= dateKey
    })
  }

  const targetVehicleId = highlightVehicleId && highlightVehicleId !== 'all' ? highlightVehicleId : selectedVehicleId
  const activeDayBookings = selectedDay ? getBookingForDate(selectedDay, targetVehicleId) : null

  // ── Phase 19 Range Inquiry Calculations ─────────────────────────────────
  const inquiryDates = useMemo<string[]>(() => {
    if (!inquiryStartDate || !inquiryEndDate) return []
    return getDatesInRange(inquiryStartDate, inquiryEndDate)
  }, [inquiryStartDate, inquiryEndDate])

  const vehicleAvailabilityStates = useMemo<VehicleAvailabilityState[]>(() => {
    if (inquiryDates.length === 0) return []

    const states: VehicleAvailabilityState[] = []
    const D_total = inquiryDates.length

    for (const v of vehicles) {
      const vBookings = allBookings.filter(
        b => b.vehicle_id === v.id && b.status !== 'cancelled'
      )

      let occupiedCount = 0
      const occupiedDays = new Set<string>()

      for (const date of inquiryDates) {
        const isOccupied = vBookings.some(
          b => b.start_date <= date && b.end_date >= date
        )
        if (isOccupied) {
          occupiedCount++
          occupiedDays.add(date)
        }
      }

      const D_available = D_total - occupiedCount
      let category: 'A' | 'B' | 'C'
      if (D_available === D_total) {
        category = 'A'
      } else if (D_available === 0) {
        category = 'C'
      } else {
        category = 'B'
      }

      states.push({
        vehicle: v,
        category,
        totalDays: D_total,
        availableDays: D_available,
        occupiedDays,
      })
    }

    // Sort hierarchically: A (Green), B (Orange), C (Red)
    return states.sort((a, b) => {
      const order = { A: 1, B: 2, C: 3 }
      if (order[a.category] !== order[b.category]) {
        return order[a.category] - order[b.category]
      }
      const nameA = `${a.vehicle.brand} ${a.vehicle.model}`.toLowerCase()
      const nameB = `${b.vehicle.brand} ${b.vehicle.model}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [vehicles, allBookings, inquiryDates])

  return (
    <div className={`${styles['calendar-section']} glass-panel`} style={{ padding: '1.75rem' }}>
      <div className={styles['calendar-header-panel']} style={{ marginBottom: '2rem' }}>
        <div className={styles['calendar-title-group']}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff, #c5a059)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Vehicle Availability Calendar
          </h3>
          <p className={styles['subtitle']} style={{ color: 'rgba(255, 255, 255, 0.45)', marginTop: '0.25rem' }}>
            Select a vehicle to inspect fully available (empty) days and active rental sessions
          </p>
        </div>

        <div className={styles['calendar-actions']} style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
          {/* Vehicle Selector Dropdown */}
          <div className={styles['selector-wrapper']} style={{ position: 'relative' }}>
            <label htmlFor="vehicle-filter" className="sr-only">Filter by Vehicle</label>
            <select
              id="vehicle-filter"
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value)
                setSelectedDay(null)
              }}
              className={styles['vehicle-dropdown']}
              style={{
                minWidth: '220px',
                borderColor: 'rgba(229,193,125,0.25)'
              }}
            >
              <option value="all">🚗 All Fleet Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.license_plate})
                </option>
              ))}
            </select>
          </div>

          {/* Phase 19: Date Range Picker Control Strip */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            alignItems: 'center', 
            background: 'rgba(10,8,7,0.5)', 
            padding: '0.5rem 1.1rem', 
            borderRadius: '30px', 
            border: '1px solid rgba(229,193,125,0.25)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 0 1px rgba(229,193,125,0.1)'
          }}>
            <span style={{ fontSize: '0.82rem', color: '#E5C17D', fontWeight: 800, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} style={{ color: '#E5C17D' }} /> Inquiry Range:
            </span>
            <input 
              type="date" 
              value={inquiryStartDate} 
              onChange={e => {
                setInquiryStartDate(e.target.value)
                setHighlightVehicleId(null)
              }} 
              style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '20px',
                color: '#fff', padding: '0.45rem 0.85rem', fontSize: '0.85rem', colorScheme: 'dark', outline: 'none',
                fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s', cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.4)', fontWeight: 700 }}>to</span>
            <input 
              type="date" 
              value={inquiryEndDate} 
              onChange={e => {
                setInquiryEndDate(e.target.value)
                setHighlightVehicleId(null)
              }} 
              style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '20px',
                color: '#fff', padding: '0.45rem 0.85rem', fontSize: '0.85rem', colorScheme: 'dark', outline: 'none',
                fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s', cursor: 'pointer'
              }}
            />
            {(inquiryStartDate || inquiryEndDate) && (
              <button
                onClick={() => {
                  setInquiryStartDate('')
                  setInquiryEndDate('')
                  setHighlightVehicleId(null)
                }}
                style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0.4rem', borderRadius: '50%', marginLeft: '0.25rem', transition: 'all 0.2s',
                  width: '24px', height: '24px'
                }}
                title="Reset Inquiry"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Month Navigator Controls */}
          <div className={styles['month-navigator']} style={{ marginLeft: 'auto' }}>
            <button onClick={handlePrevMonth} className={styles['nav-btn']} aria-label="Previous Month">◀</button>
            <span className={styles['current-date-label']}>{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={handleNextMonth} className={styles['nav-btn']} aria-label="Next Month">▶</button>
          </div>
        </div>
      </div>

      <div className={styles['calendar-layout-grid']}>
        {/* Left Side: Calendar Grid */}
        <div className={styles['grid-container']} style={{ background: 'rgba(10,8,7,0.35)', border: '1px solid rgba(229,193,125,0.08)', borderRadius: '16px', padding: '1.25rem' }}>
          {/* Weekdays Row */}
          <div className={styles['weekdays-grid']} style={{ borderBottom: '1px dashed rgba(229,193,125,0.12)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            {weekDays.map(day => (
              <div key={day} className={styles['weekday-label']} style={{ fontWeight: 800, color: '#E5C17D', opacity: 0.85 }}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles['days-grid']}>
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className={`${styles['day-cell']} ${styles['empty']}`}></div>
              }

              const targetVehicleId = highlightVehicleId && highlightVehicleId !== 'all' ? highlightVehicleId : selectedVehicleId
              const bookings = getBookingForDate(day, targetVehicleId)
              const isBooked = bookings && bookings.length > 0
              const isSelected = selectedDay === day

              // Check if date falls in highlighted vehicle's occupied days
              const monthStr = String(currentMonth + 1).padStart(2, '0')
              const dayStr = String(day).padStart(2, '0')
              const dateKey = `${currentYear}-${monthStr}-${dayStr}`
              
              // Only apply highlight styling if this date is in the inquiry range
              const isInInquiryRange = inquiryDates.includes(dateKey)
              
              const isOccupiedByHighlight = highlightVehicleId && isInInquiryRange && allBookings.some(b => 
                b.vehicle_id === highlightVehicleId && 
                b.status !== 'cancelled' && 
                b.start_date <= dateKey && 
                b.end_date >= dateKey
              )
              const isAvailableByHighlight = highlightVehicleId && isInInquiryRange && !isOccupiedByHighlight

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  className={`${styles['day-cell']} ${isSelected ? styles['selected'] : ''}`}
                  style={{
                    position: 'relative',
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                    ...(isOccupiedByHighlight ? { 
                      border: '1.5px dashed #fb923c', 
                      boxShadow: '0 0 10px rgba(251,146,60,0.35)',
                      transform: 'scale(0.96)',
                      background: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.02))',
                      outline: 'none',
                      zIndex: 10
                    } : {}),
                    ...(isAvailableByHighlight ? { 
                      border: '1.5px dashed #10b981', 
                      boxShadow: '0 0 10px rgba(16,185,129,0.25)',
                      transform: 'scale(0.96)',
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.01))',
                      outline: 'none',
                      zIndex: 10
                    } : {})
                  }}
                  aria-label={`Day ${day}, ${isBooked ? 'Booked' : 'Available'}`}
                >
                  <span className={styles['day-number']}>{day}</span>
                  {isBooked ? (
                    <span 
                      className={`${styles['booking-indicator-dot']} ${styles['red']}`} 
                      style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: '0 0 6px #ef4444',
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px'
                      }} 
                      title={`${bookings.length} Booking(s)`}
                    />
                  ) : (
                    <span 
                      className={`${styles['booking-indicator-dot']} ${styles['green']}`} 
                      style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 6px #10b981',
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px'
                      }} 
                      title="Available (Fully Empty)"
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legends */}
          <div className={styles['calendar-legends']} style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(229,193,125,0.08)' }}>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-color']} ${styles['green']}`} style={{ width: '8px', height: '8px', boxShadow: '0 0 8px #10b981', background: '#10b981', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>🟢 Available (Fully Empty)</span>
            </div>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-color']} ${styles['red']}`} style={{ width: '8px', height: '8px', boxShadow: '0 0 8px #ef4444', background: '#ef4444', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>🔴 Booked / Occupied Slot</span>
            </div>
            {highlightVehicleId && (
              <div className={styles['legend-item']} style={{ marginLeft: 'auto', display: 'flex', gap: '0.85rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ 
                    display: 'inline-block', width: '12px', height: '12px', 
                    border: '1.5px dashed #10b981', marginRight: '6px',
                    borderRadius: '3px', verticalAlign: 'middle',
                    boxShadow: '0 0 4px rgba(16,185,129,0.5)'
                  }}></span>
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>Green Dashed: Available</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ 
                    display: 'inline-block', width: '12px', height: '12px', 
                    border: '1.5px dashed #fb923c', marginRight: '6px',
                    borderRadius: '3px', verticalAlign: 'middle',
                    boxShadow: '0 0 4px rgba(251,146,60,0.5)'
                  }}></span>
                  <span style={{ fontSize: '0.78rem', color: '#fb923c', fontWeight: 700 }}>Orange Dashed: Occupied</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Day Inspector / Date Inquiry Panel */}
        <div className={`${styles['details-panel']} glass-panel`} style={{ 
          display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '450px',
          background: 'rgba(10,8,7,0.45)', border: '1px solid rgba(229,193,125,0.12)',
          borderRadius: '16px', padding: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
        }}>
          {inquiryDates.length > 0 ? (
            <>
              <div style={{ borderBottom: '1px dashed rgba(229,193,125,0.2)', paddingBottom: '1rem', marginBottom: '0.25rem' }}>
                <h4 className={styles['panel-title']} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#E5C17D' }}>
                  <Calendar size={18} style={{ color: '#E5C17D' }} /> Inquiry Matrix
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{inquiryStartDate}</span>
                  <ChevronRight size={10} style={{ color: 'rgba(229,193,125,0.4)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{inquiryEndDate}</span>
                  <span style={{ 
                    fontSize: '0.68rem', color: '#E5C17D', background: 'rgba(229,193,125,0.1)', 
                    padding: '0.15rem 0.45rem', borderRadius: '4px', marginLeft: 'auto', fontWeight: 700 
                  }}>
                    {inquiryDates.length} Days
                  </span>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.85rem', 
                overflowY: 'auto', 
                flex: 1, 
                paddingRight: '0.4rem',
                maxHeight: '380px'
              }} className="custom-scrollbar">
                {vehicleAvailabilityStates.map(({ vehicle, category, totalDays, availableDays }) => {
                  const isActive = highlightVehicleId === vehicle.id
                  const availabilityPercent = Math.round((availableDays / totalDays) * 100)

                  return (
                    <div 
                      key={vehicle.id} 
                      style={{
                        padding: '1rem',
                        background: isActive 
                          ? 'linear-gradient(135deg, rgba(229,193,125,0.08), rgba(197,160,89,0.03))' 
                          : 'rgba(10,8,7,0.3)',
                        border: isActive ? '1.5px solid #e5c17d' : '1px solid rgba(229,193,125,0.08)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: isActive ? '0 4px 20px rgba(229,193,125,0.1), inset 0 0 1px rgba(229,193,125,0.15)' : 'none',
                        transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (isActive) {
                          router.push(
                            `/dashboard/bookings?openAdd=true&vehicle_id=${vehicle.id}&start_date=${inquiryStartDate}&end_date=${inquiryEndDate}`
                          )
                        } else {
                          setHighlightVehicleId(vehicle.id)
                        }
                      }}
                      title={isActive ? "Click again to book this vehicle instantly" : "Click to inspect this vehicle's calendar occupancy"}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🚗 {vehicle.brand} {vehicle.model}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(229,193,125,0.55)', fontFamily: 'monospace', marginTop: '0.15rem', fontWeight: 600 }}>
                            {vehicle.license_plate}
                          </span>
                        </div>
                        
                        {/* Custom glowing status badge elements */}
                        {category === 'A' && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.45rem 0.85rem', borderRadius: '999px',
                            background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.35)',
                            color: '#34d399', fontSize: '0.78rem', fontWeight: 800,
                            letterSpacing: '0.01em',
                            textShadow: '0 0 12px rgba(16,185,129,0.3)',
                            boxShadow: '0 0 15px rgba(16,185,129,0.15), inset 0 0 4px rgba(16,185,129,0.05)',
                            whiteSpace: 'nowrap', flexShrink: 0
                          }}>
                            <Sparkles size={11} />
                            Disponible
                          </div>
                        )}

                        {category === 'B' && (
                          <div
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                              padding: '0.45rem 0.85rem', borderRadius: '999px',
                              background: isActive ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.08)',
                              border: isActive ? '1.5px solid #f97316' : '1.5px solid rgba(249,115,22,0.35)',
                              color: '#fb923c', fontSize: '0.78rem', fontWeight: 800,
                              whiteSpace: 'nowrap', flexShrink: 0,
                              boxShadow: isActive ? '0 0 15px rgba(249,115,22,0.3)' : 'none',
                            }}
                          >
                            <ShieldAlert size={11} />
                            {availableDays}/{totalDays} Jours Dispo
                          </div>
                        )}

                        {category === 'C' && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.45rem 0.85rem', borderRadius: '999px',
                            background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)',
                            color: '#f87171', fontSize: '0.78rem', fontWeight: 700,
                            whiteSpace: 'nowrap', flexShrink: 0
                          }}>
                            <Ban size={11} />
                            Occupé
                          </div>
                        )}
                      </div>

                      {/* Visual Availability Ratio Progress Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
                          <span>Disponibilité</span>
                          <span style={{ color: category === 'A' ? '#34d399' : category === 'B' ? '#fb923c' : '#f87171' }}>
                            {availabilityPercent}%
                          </span>
                        </div>
                        <div className={styles['mini-progress-track']}>
                          <div 
                            className={`${styles['mini-progress-bar']} ${
                              category === 'A' ? styles['green'] : category === 'B' ? styles['orange'] : styles['red']
                            }`}
                            style={{ width: `${availabilityPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <h4 className={styles['panel-title']} style={{ fontSize: '1.1rem', fontWeight: 800, color: '#E5C17D', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Calendar size={18} /> Inspector: {selectedDay ? `${selectedDay} ${monthNames[currentMonth]} ${currentYear}` : 'Select a Day'}
              </h4>

              {selectedDay ? (
                <div className={styles['panel-content']} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {activeDayBookings && activeDayBookings.length > 0 ? (
                    <div className={`${styles['booking-details-list']} custom-scrollbar`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
                      <div style={{ 
                        fontSize: '0.82rem', 
                        background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.02) 100%)', 
                        borderLeft: '3px solid #ef4444', 
                        borderTop: '1px solid rgba(239,68,68,0.15)',
                        borderRight: '1px solid rgba(239,68,68,0.15)',
                        borderBottom: '1px solid rgba(239,68,68,0.15)',
                        padding: '0.75rem 1rem', 
                        borderRadius: '8px', 
                        color: '#f87171', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        letterSpacing: '0.01em',
                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.05)'
                      }}>
                        <ShieldAlert size={14} style={{ color: '#ef4444', flexShrink: 0 }} /> 
                        <span>{activeDayBookings.length} session(s) de location en cours</span>
                      </div>

                      {activeDayBookings.map((b, idx) => (
                        <div 
                          key={idx} 
                          className={styles['inspector-booking-card']} 
                          style={{ 
                            background: 'linear-gradient(135deg, rgba(38,30,24,0.4) 0%, rgba(18,14,12,0.55) 100%)', 
                            border: '1px solid rgba(229,193,125,0.12)', 
                            borderRadius: '12px', 
                            padding: '1rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.65rem',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                            transition: 'all 0.25s ease-in-out'
                          }}
                        >
                          <div className={styles['card-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className={styles['vehicle-tag']} style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                              🚗 {b.vehicles?.brand} {b.vehicles?.model}
                            </span>
                            <span className={`status-badge ${b.status?.toLowerCase()}`} style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              {b.status}
                            </span>
                          </div>
                          
                          <div className={styles['card-body']} style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.55rem', 
                            fontSize: '0.8rem', 
                            color: 'rgba(255,255,255,0.7)',
                            borderTop: '1px solid rgba(229,193,125,0.06)',
                            paddingTop: '0.75rem',
                            marginTop: '0.2rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <User size={13} style={{ color: '#E5C17D', flexShrink: 0 }} />
                              <span style={{ color: 'rgba(255,255,255,0.45)', marginRight: '0.25rem' }}>Client:</span>
                              <span style={{ color: '#ffffff', fontWeight: 600 }}>{b.client_name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <Calendar size={13} style={{ color: '#E5C17D', flexShrink: 0 }} />
                              <span style={{ color: 'rgba(255,255,255,0.45)', marginRight: '0.25rem' }}>Period:</span>
                              <span style={{ color: '#ffffff', fontWeight: 600 }}>{b.start_date} ➔ {b.end_date}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <Coins size={13} style={{ color: '#E5C17D', flexShrink: 0 }} />
                              <span style={{ color: 'rgba(255,255,255,0.45)', marginRight: '0.25rem' }}>Total:</span>
                              <span style={{ color: '#E5C17D', fontWeight: 800 }}>{b.total_amount?.toLocaleString()} DT</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles['empty-slot-congratulations']} style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(16,185,129,0.03)', border: '1px dashed rgba(16,185,129,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                      <div className={styles['sparkle-icon']} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center', fontSize: '1.25rem', boxShadow: '0 0 15px rgba(16,185,129,0.2)' }}>🟢</div>
                      <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>Perfectly Available!</h5>
                      <p className={styles['available-desc']} style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                        This date is completely empty and ready to be booked.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles['no-day-selected-prompt']} style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flex: 1 }}>
                  <Calendar size={32} style={{ opacity: 0.3, color: '#E5C17D' }} />
                  <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.5 }}>Click on any date in the calendar to check detailed fleet occupancy or print custom quotes.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
