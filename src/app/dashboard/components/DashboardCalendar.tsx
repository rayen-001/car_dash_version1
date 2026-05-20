import { useState } from 'react'
import styles from '../dashboard.module.css'

export default function DashboardCalendar({ vehicles = [], allBookings = [] }: { vehicles?: any[], allBookings?: any[] }) {
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
    <div className={`${styles['calendar-section']} glass-panel`}>
      <div className={styles['calendar-header-panel']}>
        <div className={styles['calendar-title-group']}>
          <h3>Vehicle Availability Calendar</h3>
          <p className={styles['subtitle']}>Select a vehicle to inspect fully available (empty) days and active rental sessions</p>
        </div>

        <div className={styles['calendar-actions']}>
          {/* Vehicle Selector Dropdown */}
          <div className={styles['selector-wrapper']}>
            <label htmlFor="vehicle-filter" className="sr-only">Filter by Vehicle</label>
            <select
              id="vehicle-filter"
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value)
                setSelectedDay(null)
              }}
              className={styles['vehicle-dropdown']}
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
          <div className={styles['month-navigator']}>
            <button onClick={handlePrevMonth} className={styles['nav-btn']} aria-label="Previous Month">◀</button>
            <span className={styles['current-date-label']}>{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={handleNextMonth} className={styles['nav-btn']} aria-label="Next Month">▶</button>
          </div>
        </div>
      </div>

      <div className={styles['calendar-layout-grid']}>
        {/* Left Side: Calendar Grid */}
        <div className={styles['grid-container']}>
          {/* Weekdays Row */}
          <div className={styles['weekdays-grid']}>
            {weekDays.map(day => (
              <div key={day} className={styles['weekday-label']}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles['days-grid']}>
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className={`${styles['day-cell']} ${styles['empty']}`}></div>
              }

              const bookings = getBookingForDate(day)
              const isBooked = bookings && bookings.length > 0
              const isSelected = selectedDay === day

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  className={`${styles['day-cell']} ${isBooked ? styles['booked'] : styles['available']} ${isSelected ? styles['selected'] : ''}`}
                  aria-label={`Day ${day}, ${isBooked ? 'Booked' : 'Available'}`}
                >
                  <span className={styles['day-number']}>{day}</span>
                  {isBooked ? (
                    <span className={`${styles['booking-indicator-dot']} ${styles['red']}`} title={`${bookings.length} Booking(s)`}></span>
                  ) : (
                    <span className={`${styles['booking-indicator-dot']} ${styles['green']}`} title="Available"></span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legends */}
          <div className={styles['calendar-legends']}>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-color']} ${styles['green']}`}></span>
              <span>🟢 Disponible (Fully Empty & Ready to Rent)</span>
            </div>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-color']} ${styles['red']}`}></span>
              <span>🔴 Booked / Occupied Slot</span>
            </div>
          </div>
        </div>

        {/* Right Side: Day Inspector / Details Panel */}
        <div className={`${styles['details-panel']} glass-panel`}>
          <h4 className={styles['panel-title']}>
            📅 Inspector: {selectedDay ? `${selectedDay} ${monthNames[currentMonth]} ${currentYear}` : 'Select a Day'}
          </h4>

          {selectedDay ? (
            <div className={styles['panel-content']}>
              {activeDayBookings && activeDayBookings.length > 0 ? (
                <div className={styles['booking-details-list']}>
                  <p className={`${styles['status-message']} ${styles['occupied']}`}>
                    ⚠️ **Occupied Days**: {activeDayBookings.length} booking(s) cover this date.
                  </p>

                  {activeDayBookings.map((b, idx) => (
                    <div key={idx} className={styles['inspector-booking-card']}>
                      <div className={styles['card-header']}>
                        <span className={styles['vehicle-tag']}>🚗 {b.vehicles?.brand} {b.vehicles?.model}</span>
                        <span className={styles['status-label']}>{b.status}</span>
                      </div>
                      <div className={styles['card-body']}>
                        <p><strong>Client:</strong> {b.client_name}</p>
                        <p><strong>Period:</strong> {b.start_date} to {b.end_date}</p>
                        <p><strong>Total:</strong> {b.total_amount?.toLocaleString()} DT</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles['empty-slot-congratulations']}>
                  <div className={styles['sparkle-icon']}>🟢</div>
                  <h5>Perfectly Available!</h5>
                  <p className={styles['available-desc']}>
                    This date is completely empty and ready to be booked.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className={styles['no-day-selected-prompt']}>
              <p>Click on any date in the calendar to check detailed fleet occupancy or print custom quotes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
