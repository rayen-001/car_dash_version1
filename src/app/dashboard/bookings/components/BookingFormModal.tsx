import { useState, useEffect, useRef } from 'react'
import { X, AlertTriangle, Gauge, Fuel, User, Car, CalendarDays, Clock, Shield, DollarSign, Phone, CreditCard, MapPin, FileText } from 'lucide-react'
import { addBooking, updateBooking } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { Booking, Vehicle, Client } from '@/types'
import SearchableCombobox, { ComboboxOption } from '@/components/SearchableCombobox'

interface BookingFormModalProps {
  isOpen: boolean
  editingBooking: Booking | null
  vehicles: Vehicle[]
  clients: Client[]
  initialBookings: Booking[]
  onClose: () => void
}

export default function BookingFormModal({
  isOpen,
  editingBooking,
  vehicles,
  clients,
  initialBookings,
  onClose
}: BookingFormModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  // Form states
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  
  // Fuel & Mileage Form states
  const [fuelLevelPickup, setFuelLevelPickup] = useState('Full')
  const [fuelLevelReturn, setFuelLevelReturn] = useState('Full')
  const [startingMileage, setStartingMileage] = useState('0')
  const [returnMileage, setReturnMileage] = useState('0')

  // Security Deposit Form states
  const [depositAmount, setDepositAmount] = useState('0')
  const [depositType, setDepositType] = useState('Cash')
  const [depositStatus, setDepositStatus] = useState('Held')

  // Legal Snapshots & Times states
  const [clientPhone, setClientPhone] = useState('')
  const [clientLicenseNumber, setClientLicenseNumber] = useState('')
  const [clientCinPassport, setClientCinPassport] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [pickupTime, setPickupTime] = useState('10:00')
  const [returnTime, setReturnTime] = useState('10:00')

  // Conflict info state
  const [conflictInfo, setConflictInfo] = useState<{ occupiedRange: string, freeDates: string[] } | null>(null)

  // Sync edit state
  useEffect(() => {
    if (editingBooking) {
      setClientId(editingBooking.client_id || 'manual')
      setClientName(editingBooking.client_name || '')
      setVehicleId(editingBooking.vehicle_id || '')
      setStartDate(editingBooking.start_date ? editingBooking.start_date.split('T')[0] : '')
      setEndDate(editingBooking.end_date ? editingBooking.end_date.split('T')[0] : '')
      setTotalAmount(editingBooking.total_amount?.toString() || '')
      setFuelLevelPickup(editingBooking.fuel_level_pickup || 'Full')
      setFuelLevelReturn(editingBooking.fuel_level_return || 'Full')
      setStartingMileage(editingBooking.starting_mileage?.toString() || '0')
      setReturnMileage(editingBooking.return_mileage?.toString() || '0')
      setDepositAmount(editingBooking.deposit_amount?.toString() || '0')
      setDepositType(editingBooking.deposit_type || 'Cash')
      setDepositStatus(editingBooking.deposit_status || 'Held')
      setClientPhone(editingBooking.client_phone || '')
      setClientLicenseNumber(editingBooking.client_license_number || '')
      setClientCinPassport(editingBooking.client_cin_passport || '')
      setClientAddress(editingBooking.client_address || '')
      setPickupTime(editingBooking.pickup_time || '10:00')
      setReturnTime(editingBooking.return_time || '10:00')
      setConflictInfo(null)
    } else {
      setClientId('')
      setClientName('')
      setVehicleId('')
      setStartDate('')
      setEndDate('')
      setTotalAmount('')
      setFuelLevelPickup('Full')
      setFuelLevelReturn('Full')
      setStartingMileage('0')
      setReturnMileage('0')
      setDepositAmount('0')
      setDepositType('Cash')
      setDepositStatus('Held')
      setClientPhone('')
      setClientLicenseNumber('')
      setClientCinPassport('')
      setClientAddress('')
      setPickupTime('10:00')
      setReturnTime('10:00')
      setConflictInfo(null)
    }
  }, [editingBooking, isOpen])

  // Calculate dynamic price based on vehicle's price_per_day and number of days selected
  const calculatePrice = (vId: string, start: string, end: string) => {
    if (!vId || !start || !end) return
    const vehicle = vehicles.find(v => v.id === vId)
    if (!vehicle) return

    const sDate = new Date(start)
    const eDate = new Date(end)
    const diffTime = eDate.getTime() - sDate.getTime()
    if (diffTime >= 0) {
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const days = diffDays > 0 ? diffDays : 1 // minimum 1 day
      const calculated = days * (vehicle.price_per_day || 0)
      setTotalAmount(calculated.toFixed(2))
    }
  }

  // Real-time conflict/overlap check
  const checkAvailability = (vId: string, start: string, end: string, ignoreId?: string) => {
    if (!vId || !start || !end) {
      setConflictInfo(null)
      return
    }

    // Find any overlapping bookings for this vehicle (not cancelled)
    const overlapping = initialBookings.find(b => 
      b.vehicle_id === vId && 
      b.status !== 'cancelled' &&
      b.id !== ignoreId &&
      b.start_date <= end && 
      b.end_date >= start
    )

    if (overlapping) {
      // Find empty/free days in the requested start to end range
      const startD = new Date(start)
      const endD = new Date(end)
      const freeDays: string[] = []
      
      const vehicleBookings = initialBookings.filter(b => b.vehicle_id === vId && b.status !== 'cancelled')

      let curr = new Date(startD)
      while (curr <= endD) {
        const currStr = curr.toISOString().split('T')[0]
        const isOccupied = vehicleBookings.some(b => b.start_date <= currStr && b.end_date >= currStr)
        if (!isOccupied) {
          const parts = currStr.split('-')
          freeDays.push(`${parts[2]}/${parts[1]}/${parts[0]}`)
        }
        curr.setDate(curr.getDate() + 1)
      }

      setConflictInfo({
        occupiedRange: `${new Date(overlapping.start_date).toLocaleDateString()} to ${new Date(overlapping.end_date).toLocaleDateString()} (${overlapping.client_name})`,
        freeDates: freeDays
      })
    } else {
      setConflictInfo(null)
    }
  }

  const handleVehicleChange = (vId: string) => {
    setVehicleId(vId)
    calculatePrice(vId, startDate, endDate)
    checkAvailability(vId, startDate, endDate, editingBooking?.id)
  }

  const handleStartDateChange = (start: string) => {
    setStartDate(start)
    calculatePrice(vehicleId, start, endDate)
    checkAvailability(vehicleId, start, endDate, editingBooking?.id)
  }

  const handleEndDateChange = (end: string) => {
    setEndDate(end)
    calculatePrice(vehicleId, startDate, end)
    checkAvailability(vehicleId, startDate, end, editingBooking?.id)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (conflictInfo) {
      showToast('Cannot save booking: this vehicle is already occupied during this period.', 'error')
      return
    }
    if (!clientName) {
      showToast('Please select or specify a Client Name before saving.', 'error')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (editingBooking) {
        formData.append('id', editingBooking.id)
        await updateBooking(formData)
        showToast('Booking updated successfully!', 'success')
      } else {
        await addBooking(formData)
        showToast('Booking created successfully!', 'success')
      }
      onClose()
    } catch (err: any) {
      showToast(err.message || 'Error saving booking. Please try again.', 'error')
    }
    setLoading(false)
  }

  if (!isOpen) return null

  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(229,193,125,0.08)',
    borderRadius: '12px',
    padding: '1.25rem 1.35rem',
    marginBottom: '1rem',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
    paddingBottom: '0.65rem',
    borderBottom: '1px solid rgba(229,193,125,0.12)',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#ae9260',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const grid2Style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.85rem',
  }

  const grid3Style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.85rem',
  }

  const grid4Style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '0.85rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.4rem',
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '780px', width: '95vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(229,193,125,0.15)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(174,146,96,0.25), rgba(174,146,96,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(229,193,125,0.2)' }}>
              <FileText size={16} style={{ color: '#ae9260' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{editingBooking ? 'Edit Booking' : 'New Booking'}</h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fill in all sections to create a complete rental contract</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 140px)', paddingRight: '4px' }}>

          {/* hidden fields for form submission */}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="client_name" value={clientName} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />

          {/* ── SECTION 1: CLIENT & VEHICLE ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <User size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Client &amp; Vehicle</span>
            </div>
            <div style={grid2Style}>

              {/* ── CLIENT COMBOBOX ── */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><User size={11} /> CRM Client</label>
                <SearchableCombobox
                  options={clients.map(c => ({
                    value: c.id,
                    label: c.full_name,
                    sublabel: c.phone || '',
                    badge: c.license_number ? `Lic: ${c.license_number}` : ''
                  }))}
                  value={clientId}
                  onChange={(val, opt) => {
                    setClientId(val)
                    if (val === 'manual') {
                      setClientName('')
                      setClientPhone('')
                      setClientLicenseNumber('')
                    } else if (opt) {
                      const client = clients.find(c => c.id === val)
                      if (client) {
                        setClientName(client.full_name)
                        setClientPhone(client.phone || '')
                        setClientLicenseNumber(client.license_number || '')
                      }
                    }
                  }}
                  placeholder="Select a client..."
                  searchPlaceholder="Search client by name or phone..."
                  pinnedOption={{ value: 'manual', label: '✏️ Manual / Walk-in Client' }}
                />
                {/* Show selected client badge */}
                {clientId && clientId !== 'manual' && clientName && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>✓</span> <strong>{clientName}</strong> selected from CRM
                  </div>
                )}
                {clientId === 'manual' && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#ae9260' }}>✏️ Manual entry — fill name below</div>
                )}
              </div>

              {/* ── VEHICLE COMBOBOX ── */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Car size={12} /> Vehicle
                </label>
                <SearchableCombobox
                  options={vehicles.map(v => ({
                    value: v.id,
                    label: `${v.brand} ${v.model}`,
                    sublabel: v.license_plate ? `🚘 ${v.license_plate} ${v.color ? `· ${v.color}` : ''}` : '',
                    badge: `${v.price_per_day} DT/day`
                  }))}
                  value={vehicleId}
                  onChange={(val) => handleVehicleChange(val)}
                  placeholder="Select a vehicle..."
                  searchPlaceholder="Search by brand or model..."
                />
                {vehicleId && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#10b981' }}>✓ Vehicle selected</div>
                )}
              </div>
            </div>

            {/* Manual client name input */}
            {clientId === 'manual' && (
              <div className="form-group animate-fade-in" style={{ margin: '0.85rem 0 0 0' }}>
                <label style={labelStyle}>Client Name (Manual Input)</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  placeholder="e.g. Salim Ben Ali"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
            )}
          </div>

          {/* ── SECTION 2: RENTAL PERIOD ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <CalendarDays size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Rental Period</span>
            </div>
            <div style={grid4Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>
                  <CalendarDays size={11} /> Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  onClick={(e) => { try { e.currentTarget.showPicker() } catch {} }}
                  required
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>
                  <Clock size={11} /> Pickup Time
                </label>
                <input
                  type="time"
                  name="pickup_time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  required
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>
                  <CalendarDays size={11} /> End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  onClick={(e) => { try { e.currentTarget.showPicker() } catch {} }}
                  required
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>
                  <Clock size={11} /> Return Time
                </label>
                <input
                  type="time"
                  name="return_time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  required
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
            </div>

            {/* Conflict Alert */}
            {conflictInfo && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 600, fontSize: '0.82rem' }}>
                  <AlertTriangle size={15} />
                  <span>Vehicle already booked during this period</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Occupied: <strong style={{ color: '#fca5a5' }}>{conflictInfo.occupiedRange}</strong>
                </p>
                {conflictInfo.freeDates.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, marginRight: '0.25rem' }}>Free days:</span>
                    {conflictInfo.freeDates.map((fd, idx) => (
                      <span key={idx} style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                        color: '#10b981', padding: '0.1rem 0.35rem', borderRadius: '4px'
                      }}>{fd}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 3: VEHICLE CONDITION ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Gauge size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Vehicle Condition</span>
            </div>
            <div style={grid4Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Gauge size={11} /> Starting km</label>
                <input
                  type="number"
                  name="starting_mileage"
                  value={startingMileage}
                  onChange={(e) => setStartingMileage(e.target.value)}
                  min="0"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Fuel size={11} /> Fuel (Pickup)</label>
                <select name="fuel_level_pickup" value={fuelLevelPickup} onChange={(e) => setFuelLevelPickup(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="Empty">Empty</option>
                  <option value="1/4">1/4</option>
                  <option value="1/2">1/2</option>
                  <option value="3/4">3/4</option>
                  <option value="Full">Full</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Gauge size={11} /> Return km</label>
                <input
                  type="number"
                  name="return_mileage"
                  value={returnMileage}
                  onChange={(e) => setReturnMileage(e.target.value)}
                  min="0"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Fuel size={11} /> Fuel (Return)</label>
                <select name="fuel_level_return" value={fuelLevelReturn} onChange={(e) => setFuelLevelReturn(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="Empty">Empty</option>
                  <option value="1/4">1/4</option>
                  <option value="1/2">1/2</option>
                  <option value="3/4">3/4</option>
                  <option value="Full">Full</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: RENTER DETAILS ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <CreditCard size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Renter Details <span style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(Contract Snapshot)</span></span>
            </div>
            <div style={grid2Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Phone size={11} /> Phone Number</label>
                <input
                  type="text"
                  name="client_phone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  required
                  placeholder="e.g. +216 98 765 432"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><CreditCard size={11} /> CIN / Passport ID</label>
                <input
                  type="text"
                  name="client_cin_passport"
                  value={clientCinPassport}
                  onChange={(e) => setClientCinPassport(e.target.value)}
                  required
                  placeholder="e.g. 08765432"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><FileText size={11} /> Driver's License No.</label>
                <input
                  type="text"
                  name="client_license_number"
                  value={clientLicenseNumber}
                  onChange={(e) => setClientLicenseNumber(e.target.value)}
                  required
                  placeholder="e.g. 23/456789"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><MapPin size={11} /> Full Address</label>
                <input
                  type="text"
                  name="client_address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  required
                  placeholder="e.g. Rue Habib Bourguiba, Tunis"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 5: DEPOSIT & FINANCIALS ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Shield size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Security Deposit &amp; Financials</span>
            </div>
            <div style={grid3Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Shield size={11} /> Deposit Amount (DT)</label>
                <input
                  type="number"
                  name="deposit_amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  className="form-input"
                  placeholder="e.g. 1000"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>Deposit Type</label>
                <select name="deposit_type" value={depositType} onChange={(e) => setDepositType(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>Deposit Status</label>
                <select name="deposit_status" value={depositStatus} onChange={(e) => setDepositStatus(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="Held">Held</option>
                  <option value="Returned">Returned</option>
                  <option value="Forfeited">Forfeited</option>
                </select>
              </div>
            </div>

            <div style={{ ...grid2Style, marginTop: '0.85rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><DollarSign size={11} /> Total Amount (DT)</label>
                <input
                  type="number"
                  name="total_amount"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                  placeholder="Auto-calculated"
                  min="0"
                  step="0.01"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>Booking Status</label>
                <select name="status" className="form-input" defaultValue={editingBooking?.status || 'confirmed'} style={{ margin: 0 }}>
                  <option value="confirmed">✓ Confirmed</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="modal-footer" style={{ borderTop: '1px solid rgba(229,193,125,0.12)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !!conflictInfo}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="loading-spinner"></span>
                  <span>Saving...</span>
                </div>
              ) : editingBooking ? 'Save Changes' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
