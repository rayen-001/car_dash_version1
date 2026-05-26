import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Car, CalendarDays, Clock, Shield, DollarSign, Phone, CreditCard, MapPin, FileText, Gauge, Fuel, AlertTriangle, Plus, Trash2, Coins } from 'lucide-react'
import { addBooking, updateBooking } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { Booking, Vehicle, Client } from '@/types'
import SearchableCombobox from '@/components/SearchableCombobox'

interface BookingFormModalProps {
  isOpen: boolean
  editingBooking: Booking | null
  vehicles: Vehicle[]
  clients: Client[]
  initialBookings: Booking[]
  vehicleLegalDocs?: any[]
  onClose: () => void
}

export default function BookingFormModal({
  isOpen,
  editingBooking,
  vehicles,
  clients,
  initialBookings,
  vehicleLegalDocs = [],
  onClose
}: BookingFormModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait until mounted to use portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Form states
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [secondaryClientId, setSecondaryClientId] = useState('')
  const [secondaryClientName, setSecondaryClientName] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  
  // Decoupled Pickup Phase Form states
  const [acomptePaid, setAcomptePaid] = useState('0')
  const [rentalDaysText, setRentalDaysText] = useState('')
  const [startingKm, setStartingKm] = useState('0')
  const [fuelLevelPickup, setFuelLevelPickup] = useState('Full')
  const [lavagePickup, setLavagePickup] = useState('clean_wash')

  // Legal Snapshots & Times states
  const [clientPhone, setClientPhone] = useState('')
  const [clientLicenseNumber, setClientLicenseNumber] = useState('')
  const [clientCinPassport, setClientCinPassport] = useState('')
  const [clientAddress, setClientAddress] = useState('')

  const [secondaryClientPhone, setSecondaryClientPhone] = useState('')
  const [secondaryClientLicenseNumber, setSecondaryClientLicenseNumber] = useState('')
  const [secondaryClientCinPassport, setSecondaryClientCinPassport] = useState('')
  const [secondaryClientAddress, setSecondaryClientAddress] = useState('')

  // Tunisian Legal Identity (client-level, not booking-snapshot). Captured here
  // so operators can fill them during the booking flow; upsertBooking pushes
  // them back to the clients table on save. Stored as YYYY-MM-DD strings.
  const [clientDateNaissance, setClientDateNaissance] = useState('')
  const [clientCinDelivreLe, setClientCinDelivreLe] = useState('')
  const [clientPermisNumero, setClientPermisNumero] = useState('')
  const [clientPermisDelivreLe, setClientPermisDelivreLe] = useState('')
  const [secondaryClientDateNaissance, setSecondaryClientDateNaissance] = useState('')
  const [secondaryClientCinDelivreLe, setSecondaryClientCinDelivreLe] = useState('')
  const [secondaryClientPermisNumero, setSecondaryClientPermisNumero] = useState('')
  const [secondaryClientPermisDelivreLe, setSecondaryClientPermisDelivreLe] = useState('')

  const [pickupTime, setPickupTime] = useState('10:00')
  const [returnTime, setReturnTime] = useState('10:00')

  // Phase 17a — Optional off-site Handover / Delivery (Airport, Hotel, etc.)
  // Empty string = no handover; persisted as NULL by upsertBooking.
  const [handoverLocation, setHandoverLocation] = useState('')
  const [handoverDatetime, setHandoverDatetime] = useState('')

  // Conflict info state
  const [conflictInfo, setConflictInfo] = useState<{ occupiedRange: string, freeDates: string[] } | null>(null)

  // Installments state
  const [installments, setInstallments] = useState<{ amount: number; due_date: string; status: 'paid' | 'unpaid' }[]>([])

  // NOTE: snapshot field hydration is handled inline in each combobox onChange
  // (see SearchableCombobox blocks below). We intentionally do NOT use a useEffect
  // for this, because including `clients` in the dep array would re-fire after
  // revalidation and silently overwrite any unsaved edits the user typed. The
  // editingBooking branch of the form-reset useEffect handles edit-mode hydration
  // separately (snapshot comes from the booking row, not the CRM record).

  const parsedTotal = useMemo(() => parseFloat(totalAmount) || 0, [totalAmount])
  const parsedAcompte = useMemo(() => parseFloat(acomptePaid) || 0, [acomptePaid])

  const installmentsSum = useMemo(() => {
    return installments.reduce((acc, inst) => acc + (Number(inst.amount) || 0), 0)
  }, [installments])

  const remainingToSchedule = useMemo(() => {
    return parsedTotal - parsedAcompte - installmentsSum
  }, [parsedTotal, parsedAcompte, installmentsSum])

  // Predictive Legal Document Expiry Collision Detector
  const legalDocConflicts = useMemo(() => {
    if (!vehicleId) return []
    const vehicle = vehicles.find(v => v.id === vehicleId)
    const current = vehicle?.current_km || 0
    const nextPads = (vehicle as any)?.next_service_km || 0
    const conflicts = []
    if (nextPads && (nextPads - current <= 1000)) {
      conflicts.push({ type: 'pads', label: 'Brake Pads', remainingKm: nextPads - current })
    }
    return conflicts
  }, [vehicleId, vehicles])

  // Blacklist Evaluation Engine
  const isPrimaryBlacklisted = useMemo(() => {
    if (!clientId || clientId === 'manual') return false
    const score = clients.find(c => c.id === clientId)?.trust_score
    return score !== null && score !== undefined && score < 30
  }, [clientId, clients])

  const isSecondaryBlacklisted = useMemo(() => {
    if (!secondaryClientId || secondaryClientId === 'manual') return false
    const score = clients.find(c => c.id === secondaryClientId)?.trust_score
    return score !== null && score !== undefined && score < 30
  }, [secondaryClientId, clients])

  const isBlacklisted = isPrimaryBlacklisted || isSecondaryBlacklisted

  // Automatically calculate and set rental_days_text (read-only duration)
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const calculatedDays = diffDays >= 0 ? String(diffDays) : '0'
      setRentalDaysText(calculatedDays)
    } else {
      setRentalDaysText('')
    }
  }, [startDate, endDate])

  // Sync edit state
  useEffect(() => {
    if (editingBooking) {
      setClientId(editingBooking.client_id || 'manual')
      setClientName(editingBooking.client_name || '')
      setSecondaryClientId(editingBooking.secondary_client_id || '')
      setSecondaryClientName('')
      setVehicleId(editingBooking.vehicle_id || '')
      setStartDate(editingBooking.start_date ? editingBooking.start_date.split('T')[0] : '')
      setEndDate(editingBooking.end_date ? editingBooking.end_date.split('T')[0] : '')
      setTotalAmount(editingBooking.total_amount?.toString() || '')
      
      // Decoupled fields mapping
      setAcomptePaid(editingBooking.acompte_paid?.toString() || '0')
      setRentalDaysText(editingBooking.rental_days_text || '')
      setStartingKm(editingBooking.starting_km?.toString() || '0')
      setFuelLevelPickup(editingBooking.fuel_level_pickup || 'Full')
      setLavagePickup(editingBooking.lavage_pickup || 'clean_wash')

      setClientPhone(editingBooking.client_phone || '')
      setClientLicenseNumber(editingBooking.client_license_number || '')
      setClientCinPassport(editingBooking.client_cin_passport || '')
      setClientAddress(editingBooking.client_address || '')
      
      setSecondaryClientPhone(editingBooking.secondary_client_phone || '')
      setSecondaryClientLicenseNumber(editingBooking.secondary_client_license_number || '')
      setSecondaryClientCinPassport(editingBooking.secondary_client_cin_passport || '')
      setSecondaryClientAddress(editingBooking.secondary_client_address || '')

      // Tunisian Legal Identity isn't snapshot-frozen on the booking — it's
      // intrinsic to the client. Hydrate from the current CRM record so edits
      // reflect what's on file right now (not what was true at booking time).
      const primaryClient = editingBooking.client_id
        ? (clients.find(c => c.id === editingBooking.client_id) as any)
        : null
      setClientDateNaissance(((primaryClient?.date_naissance) || '').split('T')[0] || '')
      setClientCinDelivreLe(((primaryClient?.cin_delivre_le) || '').split('T')[0] || '')
      setClientPermisNumero(primaryClient?.permis_numero || '')
      setClientPermisDelivreLe(((primaryClient?.permis_delivre_le) || '').split('T')[0] || '')

      const secondaryClientRow = editingBooking.secondary_client_id
        ? (clients.find(c => c.id === editingBooking.secondary_client_id) as any)
        : null
      setSecondaryClientDateNaissance(((secondaryClientRow?.date_naissance) || '').split('T')[0] || '')
      setSecondaryClientCinDelivreLe(((secondaryClientRow?.cin_delivre_le) || '').split('T')[0] || '')
      setSecondaryClientPermisNumero(secondaryClientRow?.permis_numero || '')
      setSecondaryClientPermisDelivreLe(((secondaryClientRow?.permis_delivre_le) || '').split('T')[0] || '')

      setPickupTime(editingBooking.pickup_time || '10:00')
      setReturnTime(editingBooking.return_time || '10:00')
      setHandoverLocation(editingBooking.handover_location || '')
      // datetime-local needs `YYYY-MM-DDTHH:MM`; Supabase returns full ISO with seconds + Z.
      setHandoverDatetime(
        editingBooking.handover_datetime
          ? editingBooking.handover_datetime.slice(0, 16)
          : ''
      )
      setConflictInfo(null)

      // Sync installments state
      setInstallments(
        editingBooking.installments
          ? editingBooking.installments.map((inst: any) => ({
              amount: inst.amount,
              due_date: inst.due_date ? inst.due_date.split('T')[0] : '',
              status: inst.status
            }))
          : []
      )
    } else {
      setClientId('')
      setClientName('')
      setSecondaryClientId('')
      setSecondaryClientName('')
      setVehicleId('')
      setStartDate('')
      setEndDate('')
      setTotalAmount('')
      setAcomptePaid('0')
      setRentalDaysText('')
      setStartingKm('0')
      setFuelLevelPickup('Full')
      setLavagePickup('clean_wash')
      setClientPhone('')
      setClientLicenseNumber('')
      setClientCinPassport('')
      setClientAddress('')
      setSecondaryClientPhone('')
      setSecondaryClientLicenseNumber('')
      setSecondaryClientCinPassport('')
      setSecondaryClientAddress('')
      setClientDateNaissance('')
      setClientCinDelivreLe('')
      setClientPermisNumero('')
      setClientPermisDelivreLe('')
      setSecondaryClientDateNaissance('')
      setSecondaryClientCinDelivreLe('')
      setSecondaryClientPermisNumero('')
      setSecondaryClientPermisDelivreLe('')
      setPickupTime('10:00')
      setReturnTime('10:00')
      setHandoverLocation('')
      setHandoverDatetime('')
      setConflictInfo(null)
      setInstallments([])
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

    const overlapping = initialBookings.find(b => 
      b.vehicle_id === vId && 
      b.status !== 'cancelled' &&
      b.id !== ignoreId &&
      b.start_date <= end && 
      b.end_date >= start
    )

    if (overlapping) {
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

    if (installments.length > 0 && Math.abs(parsedAcompte + installmentsSum - parsedTotal) > 0.05) {
      showToast(`Validation Failed: The sum of Advance (${parsedAcompte} DT) and Installments (${installmentsSum} DT) must equal the Total Amount (${parsedTotal} DT). Discrepancy: ${(parsedTotal - parsedAcompte - installmentsSum).toFixed(2)} DT`, 'error')
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
    setLoading(true) 
    setLoading(false)
  }

  if (!isOpen || !mounted) return null

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

  const modalContent = (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '850px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.5rem 2rem' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(229,193,125,0.15)', paddingBottom: '1rem', marginBottom: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(174,146,96,0.25), rgba(174,146,96,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(229,193,125,0.2)' }}>
              <FileText size={16} style={{ color: '#ae9260' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{editingBooking ? 'Edit Pickup details' : 'New Booking Contract'}</h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pickup operational &amp; client parameters creation</p>
            </div>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>

          {/* hidden fields for form submission */}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="client_name" value={clientName} />
          <input type="hidden" name="secondary_client_id" value={secondaryClientId} />
          <input type="hidden" name="secondary_client_name" value={secondaryClientName} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <input type="hidden" name="installments" value={JSON.stringify(installments)} />

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
                      // Walk-in: blank the snapshot for free typing.
                      setClientName('')
                      setClientPhone('')
                      setClientLicenseNumber('')
                      setClientCinPassport('')
                      setClientAddress('')
                      setClientDateNaissance('')
                      setClientCinDelivreLe('')
                      setClientPermisNumero('')
                      setClientPermisDelivreLe('')
                    } else if (val && opt) {
                      // Existing CRM client: hydrate ALL snapshot fields + the
                      // Tunisian Legal Identity (DOB / CIN-Issue / Permit / Permit-Issue).
                      // Edits flow back to the CRM record on save via upsertBooking.
                      const client = clients.find(c => c.id === val) as any
                      if (client) {
                        setClientName(client.full_name || '')
                        setClientPhone(client.phone || '')
                        setClientLicenseNumber(client.license_number || '')
                        setClientCinPassport(client.cin || '')
                        setClientAddress(client.address || '')
                        setClientDateNaissance((client.date_naissance || '').split('T')[0] || '')
                        setClientCinDelivreLe((client.cin_delivre_le || '').split('T')[0] || '')
                        setClientPermisNumero(client.permis_numero || '')
                        setClientPermisDelivreLe((client.permis_delivre_le || '').split('T')[0] || '')
                      }
                    } else {
                      // Combobox cleared.
                      setClientName('')
                      setClientPhone('')
                      setClientLicenseNumber('')
                      setClientCinPassport('')
                      setClientAddress('')
                      setClientDateNaissance('')
                      setClientCinDelivreLe('')
                      setClientPermisNumero('')
                      setClientPermisDelivreLe('')
                    }
                  }}
                  placeholder="Select a client..."
                  searchPlaceholder="Search client by name or phone..."
                  pinnedOption={{ value: 'manual', label: '✏️ Manual / Walk-in Client' }}
                />
                {clientId && clientId !== 'manual' && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>✓</span> <strong>{clients.find(cl => cl.id === clientId)?.full_name}</strong> selected
                    </div>
                    {(() => {
                      const c = clients.find(cl => cl.id === clientId)
                      const score = c?.trust_score
                      if (score === null || score === undefined) return <div style={{ color: 'var(--text-muted)' }}>Status: Unrated</div>
                      return (
                        <div style={{ color: score >= 60 ? '#4ade80' : score >= 30 ? '#fbbf24' : '#ef4444', fontWeight: 600 }}>
                          Status: {score >= 80 ? 'Excellent' : score >= 60 ? 'Standard' : score >= 30 ? 'Watch' : 'Blacklisted'} ({score} DRI)
                        </div>
                      )
                    })()}
                  </div>
                )}
                {clientId === 'manual' && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#ae9260' }}>✏️ Manual entry — fill name below</div>
                )}
              </div>

              {/* ── CO-DRIVER COMBOBOX ── */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><User size={11} /> Secondary / Co-Driver</label>
                <SearchableCombobox
                  options={clients.map(c => ({
                    value: c.id,
                    label: c.full_name,
                    sublabel: c.phone || '',
                    badge: c.license_number ? `Lic: ${c.license_number}` : ''
                  }))}
                  value={secondaryClientId}
                  onChange={(val, opt) => {
                    setSecondaryClientId(val)
                    if (val === 'manual') {
                      // Walk-in co-driver: blank the snapshot for free typing.
                      setSecondaryClientName('')
                      setSecondaryClientPhone('')
                      setSecondaryClientLicenseNumber('')
                      setSecondaryClientCinPassport('')
                      setSecondaryClientAddress('')
                      setSecondaryClientDateNaissance('')
                      setSecondaryClientCinDelivreLe('')
                      setSecondaryClientPermisNumero('')
                      setSecondaryClientPermisDelivreLe('')
                    } else if (val && opt) {
                      // Existing CRM client: hydrate ALL fields including the
                      // Tunisian Legal Identity. Shared-liability DRI keeps both
                      // drivers in sync via the trust score recalc on save.
                      const client = clients.find(c => c.id === val) as any
                      if (client) {
                        setSecondaryClientName(client.full_name || '')
                        setSecondaryClientPhone(client.phone || '')
                        setSecondaryClientLicenseNumber(client.license_number || '')
                        setSecondaryClientCinPassport(client.cin || '')
                        setSecondaryClientAddress(client.address || '')
                        setSecondaryClientDateNaissance((client.date_naissance || '').split('T')[0] || '')
                        setSecondaryClientCinDelivreLe((client.cin_delivre_le || '').split('T')[0] || '')
                        setSecondaryClientPermisNumero(client.permis_numero || '')
                        setSecondaryClientPermisDelivreLe((client.permis_delivre_le || '').split('T')[0] || '')
                      }
                    } else {
                      // Combobox cleared.
                      setSecondaryClientName('')
                      setSecondaryClientPhone('')
                      setSecondaryClientLicenseNumber('')
                      setSecondaryClientCinPassport('')
                      setSecondaryClientAddress('')
                      setSecondaryClientDateNaissance('')
                      setSecondaryClientCinDelivreLe('')
                      setSecondaryClientPermisNumero('')
                      setSecondaryClientPermisDelivreLe('')
                    }
                  }}
                  placeholder="Select a secondary driver..."
                  searchPlaceholder="Search client by name or phone..."
                  pinnedOption={{ value: 'manual', label: '✏️ Manual / Walk-in Client' }}
                />
                {secondaryClientId && secondaryClientId !== 'manual' && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>✓</span> <strong>{clients.find(cl => cl.id === secondaryClientId)?.full_name}</strong> selected
                    </div>
                    {(() => {
                      const c = clients.find(cl => cl.id === secondaryClientId)
                      const score = c?.trust_score
                      if (score === null || score === undefined) return <div style={{ color: 'var(--text-muted)' }}>Status: Unrated</div>
                      return (
                        <div style={{ color: score >= 60 ? '#4ade80' : score >= 30 ? '#fbbf24' : '#ef4444', fontWeight: 600 }}>
                          Status: {score >= 80 ? 'Excellent' : score >= 60 ? 'Standard' : score >= 30 ? 'Watch' : 'Blacklisted'} ({score} DRI)
                        </div>
                      )
                    })()}
                  </div>
                )}
                {secondaryClientId === 'manual' && (
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
            {(clientId === 'manual' || secondaryClientId === 'manual') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginTop: '0.85rem' }}>
                {clientId === 'manual' && (
                  <div className="form-group animate-fade-in" style={{ margin: 0 }}>
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
                {secondaryClientId === 'manual' && (
                  <div className="form-group animate-fade-in" style={{ margin: 0 }}>
                    <label style={labelStyle}>Co-Driver Name (Manual Input)</label>
                    <input
                      type="text"
                      value={secondaryClientName}
                      onChange={(e) => setSecondaryClientName(e.target.value)}
                      required
                      placeholder="e.g. Amir Ben Ahmed"
                      className="form-input"
                      style={{ margin: 0 }}
                    />
                  </div>
                )}
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

            {/* Conflict Alert (Red — Blocking) */}
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

            {/* Legal Document Expiry Warning (Amber — Non-blocking) */}
            {legalDocConflicts.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginTop: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 600, fontSize: '0.82rem' }}>
                  <Shield size={15} />
                  <span>⚠ Legal Document Expiry Warning</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.5' }}>
                  The following vehicle document(s) will <strong style={{ color: '#fbbf24' }}>expire during this rental period</strong>. The vehicle may become legally non-compliant mid-trip.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.15rem' }}>
                  {legalDocConflicts.map((doc: any) => {
                    const docLabel =
                      doc.doc_type === 'assurance' ? 'Insurance (Assurance)' :
                      doc.doc_type === 'visite_technique' ? 'Technical Inspection (Visite)' :
                      doc.doc_type === 'laissez_passer' ? 'Transport Authorization' :
                      doc.doc_type || 'Unknown Document'
                    const expiryFormatted = new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <div key={doc.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.7rem',
                        background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.15)',
                        borderRadius: '6px',
                      }}>
                        <span style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 500 }}>
                          📄 {docLabel}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#fbbf24',
                          background: 'rgba(245,158,11,0.1)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                        }}>
                          Expires {expiryFormatted}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2.5: LOGISTICS HANDOVER (OPTIONAL) ── */}
          {/* Phase 17a — off-site delivery (Airport / Hotel / etc.). Empty
              location → no badge surfaces on the dashboard or bookings table. */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <MapPin size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>
                Logistics Handover <span style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(Optional · Airport / Hotel / Custom)</span>
              </span>
            </div>
            <div style={grid2Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><MapPin size={11} /> Handover Location</label>
                <input
                  type="text"
                  name="handover_location"
                  value={handoverLocation}
                  onChange={(e) => setHandoverLocation(e.target.value)}
                  placeholder="e.g. Tunis Carthage Airport, Hotel Laico, Sousse"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Clock size={11} /> Handover Date &amp; Time</label>
                <input
                  type="datetime-local"
                  name="handover_datetime"
                  value={handoverDatetime}
                  onChange={(e) => setHandoverDatetime(e.target.value)}
                  className="form-input"
                  style={{ margin: 0, colorScheme: 'dark' }}
                />
              </div>
            </div>
            {handoverLocation && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: 'rgba(229,193,125,0.7)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.7)' }} />
                <span>This booking will surface a delivery badge on the Operations grid and Bookings table.</span>
              </div>
            )}
          </div>

          {/* ── SECTION 3: VEHICLE CONDITION (PICKUP ONLY) ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Gauge size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Vehicle Condition (Pickup State)</span>
            </div>
            <div style={grid3Style}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Gauge size={11} /> Starting km</label>
                <input
                  type="number"
                  name="starting_km"
                  value={startingKm}
                  onChange={(e) => setStartingKm(e.target.value)}
                  min="0"
                  required
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Fuel size={11} /> Fuel Level (Pickup)</label>
                <select name="fuel_level_pickup" value={fuelLevelPickup} onChange={(e) => setFuelLevelPickup(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="Empty">Empty</option>
                  <option value="1/4">1/4</option>
                  <option value="1/2">1/2</option>
                  <option value="3/4">3/4</option>
                  <option value="Full">Full</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><Fuel size={11} /> Lavage (Pickup)</label>
                <select name="lavage_pickup" value={lavagePickup} onChange={(e) => setLavagePickup(e.target.value)} className="form-input" style={{ margin: 0 }}>
                  <option value="clean_wash">Clean Wash (Lavage jdid)</option>
                  <option value="average_dust">Average (3adiya/feha 8abra)</option>
                  <option value="dirty">Dirty (Mas5a)</option>
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

            {/* Tunisian Legal Identity — client-level, syncs back to CRM record on save */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(229,193,125,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ae9260', boxShadow: '0 0 8px rgba(229,193,125,0.55)' }} />
                <span style={{ fontSize: '0.68rem', color: '#ae9260', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Tunisian Legal Identity
                </span>
                <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                  — updates the CRM record on save
                </span>
              </div>
              <div style={grid2Style}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={labelStyle}>Date of Birth (DOB)</label>
                  <input
                    type="date"
                    name="client_date_naissance"
                    value={clientDateNaissance}
                    onChange={(e) => setClientDateNaissance(e.target.value)}
                    className="form-input"
                    style={{ margin: 0, colorScheme: 'dark' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={labelStyle}>CIN Issue Date (Iss)</label>
                  <input
                    type="date"
                    name="client_cin_delivre_le"
                    value={clientCinDelivreLe}
                    onChange={(e) => setClientCinDelivreLe(e.target.value)}
                    className="form-input"
                    style={{ margin: 0, colorScheme: 'dark' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={labelStyle}>Permit Number (Permis)</label>
                  <input
                    type="text"
                    name="client_permis_numero"
                    value={clientPermisNumero}
                    onChange={(e) => setClientPermisNumero(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="form-input"
                    style={{ margin: 0 }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={labelStyle}>Permit Issue Date</label>
                  <input
                    type="date"
                    name="client_permis_delivre_le"
                    value={clientPermisDelivreLe}
                    onChange={(e) => setClientPermisDelivreLe(e.target.value)}
                    className="form-input"
                    style={{ margin: 0, colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 4.5: CO-DRIVER DETAILS (Conditional) ── */}
          {(secondaryClientId || secondaryClientName) && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <CreditCard size={14} style={{ color: '#ae9260' }} />
                <span style={sectionTitleStyle}>Co-Driver Details <span style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(Contract Snapshot)</span></span>
              </div>
              <div style={grid2Style}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={labelStyle}><Phone size={11} /> Phone Number</label>
                  <input
                    type="text"
                    name="secondary_client_phone"
                    value={secondaryClientPhone}
                    onChange={(e) => setSecondaryClientPhone(e.target.value)}
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
                    name="secondary_client_cin_passport"
                    value={secondaryClientCinPassport}
                    onChange={(e) => setSecondaryClientCinPassport(e.target.value)}
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
                    name="secondary_client_license_number"
                    value={secondaryClientLicenseNumber}
                    onChange={(e) => setSecondaryClientLicenseNumber(e.target.value)}
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
                    name="secondary_client_address"
                    value={secondaryClientAddress}
                    onChange={(e) => setSecondaryClientAddress(e.target.value)}
                    required
                    placeholder="e.g. Rue Habib Bourguiba, Tunis"
                    className="form-input"
                    style={{ margin: 0 }}
                  />
                </div>
              </div>

              {/* Co-Driver Tunisian Legal Identity — same round-trip semantics as primary */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(229,193,125,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ae9260', boxShadow: '0 0 8px rgba(229,193,125,0.55)' }} />
                  <span style={{ fontSize: '0.68rem', color: '#ae9260', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Tunisian Legal Identity
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                    — updates the co-driver's CRM record on save
                  </span>
                </div>
                <div style={grid2Style}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Date of Birth (DOB)</label>
                    <input
                      type="date"
                      name="secondary_client_date_naissance"
                      value={secondaryClientDateNaissance}
                      onChange={(e) => setSecondaryClientDateNaissance(e.target.value)}
                      className="form-input"
                      style={{ margin: 0, colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>CIN Issue Date (Iss)</label>
                    <input
                      type="date"
                      name="secondary_client_cin_delivre_le"
                      value={secondaryClientCinDelivreLe}
                      onChange={(e) => setSecondaryClientCinDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ margin: 0, colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Permit Number (Permis)</label>
                    <input
                      type="text"
                      name="secondary_client_permis_numero"
                      value={secondaryClientPermisNumero}
                      onChange={(e) => setSecondaryClientPermisNumero(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="form-input"
                      style={{ margin: 0 }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Permit Issue Date</label>
                    <input
                      type="date"
                      name="secondary_client_permis_delivre_le"
                      value={secondaryClientPermisDelivreLe}
                      onChange={(e) => setSecondaryClientPermisDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ margin: 0, colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 5: FINANCIALS ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <DollarSign size={14} style={{ color: '#ae9260' }} />
              <span style={sectionTitleStyle}>Financials</span>
            </div>
            <div style={grid3Style}>
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
                <label style={labelStyle}><DollarSign size={11} /> Acompte Paid (DT)</label>
                <input
                  type="number"
                  name="acompte_paid"
                  value={acomptePaid}
                  onChange={(e) => setAcomptePaid(e.target.value)}
                  min="0"
                  step="0.01"
                  className="form-input"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}><FileText size={11} /> Rental Days</label>
                <input
                  type="text"
                  name="rental_days_text"
                  value={rentalDaysText}
                  readOnly
                  placeholder="Auto-calculated"
                  className="form-input"
                  style={{ margin: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {/* ── INSTALLMENTS SCHEDULER ── */}
            <div style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid rgba(229,193,125,0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#ae9260', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Coins size={13} /> Tranches de Paiement
                  </h4>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Split the remaining contract balance into scheduled dates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaultAmount = remainingToSchedule > 0 ? Number(remainingToSchedule.toFixed(2)) : 0
                    const defaultDate = endDate || new Date().toISOString().split('T')[0]
                    setInstallments([...installments, { amount: defaultAmount, due_date: defaultDate, status: 'unpaid' }])
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.7rem',
                    height: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    borderColor: 'rgba(229,193,125,0.3)',
                    color: '#ae9260',
                    background: 'rgba(174,146,96,0.05)',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={12} /> Add Tranche
                </button>
              </div>

              {/* Live Status Tracker */}
              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(229,193,125,0.06)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                marginBottom: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Advance: </span>
                    <strong style={{ color: '#fff' }}>{parsedAcompte} DT</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Tranches Sum: </span>
                    <strong style={{ color: '#fff' }}>{installmentsSum.toFixed(2)} DT</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Scheduled Total: </span>
                    <strong style={{ color: '#fff' }}>{(parsedAcompte + installmentsSum).toFixed(2)} / {parsedTotal.toFixed(2)} DT</strong>
                  </div>
                </div>

                {installments.length > 0 && (
                  <div>
                    {Math.abs(remainingToSchedule) < 0.05 ? (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>✓</span> Fully Scheduled
                      </span>
                    ) : remainingToSchedule > 0 ? (
                      <span style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(245,158,11,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                        ⚠️ {remainingToSchedule.toFixed(2)} DT remaining
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                        🚨 Over-allocated by {Math.abs(remainingToSchedule).toFixed(2)} DT
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Installment Rows */}
              {installments.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '1.25rem',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed rgba(229,193,125,0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem'
                }}>
                  No scheduled tranches. Booking operates on a standard total balance ledger.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {installments.map((inst, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.2fr 1fr 40px',
                      gap: '0.6rem',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(229,193,125,0.05)',
                      padding: '0.5rem 0.6rem',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '0.2rem' }}>Montant (DT)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            value={inst.amount === 0 ? '' : inst.amount}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const updated = [...installments]
                              updated[index].amount = val
                              setInstallments(updated)
                            }}
                            placeholder="Amount in DT"
                            min="0"
                            step="0.01"
                            required
                            className="form-input"
                            style={{ margin: 0, paddingRight: '1.5rem' }}
                          />
                          <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>DT</span>
                        </div>
                      </div>

                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '0.2rem' }}>Due Date</label>
                        <input
                          type="date"
                          value={inst.due_date ? inst.due_date.split('T')[0] : ''}
                          onChange={(e) => {
                            const updated = [...installments]
                            updated[index].due_date = e.target.value
                            setInstallments(updated)
                          }}
                          required
                          onClick={(e) => { try { e.currentTarget.showPicker() } catch {} }}
                          className="form-input"
                          style={{ margin: 0 }}
                        />
                      </div>

                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '0.2rem' }}>Status</label>
                        <select
                          value={inst.status}
                          onChange={(e) => {
                            const updated = [...installments]
                            updated[index].status = e.target.value as 'paid' | 'unpaid'
                            setInstallments(updated)
                          }}
                          className="form-input"
                          style={{ margin: 0 }}
                        >
                          <option value="unpaid">❌ Unpaid</option>
                          <option value="paid">✅ Paid</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = installments.filter((_, idx) => idx !== index)
                            setInstallments(updated)
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            background: 'rgba(239, 68, 68, 0.05)',
                            color: '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Delete Tranche"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...grid2Style, marginTop: '0.85rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={labelStyle}>Booking Status</label>
                <select name="status" className="form-input" defaultValue={editingBooking?.status || 'confirmed'} style={{ margin: 0 }}>
                  <option value="confirmed">✓ Confirmed</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>
            </div>
          </div>

          {isBlacklisted && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
            }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🚨 Critical Safety Fraud
                </strong>
                <span style={{ fontSize: '0.8rem' }}>One or more assigned drivers are BLACKLISTED. Contract generation is strictly locked.</span>
              </div>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div className="modal-footer" style={{ borderTop: '1px solid rgba(229,193,125,0.12)', paddingTop: '1rem', marginTop: '0.5rem', position: 'sticky', bottom: '-1px', background: 'linear-gradient(155deg, #18130f, #110e0c)', paddingBottom: '10px', zIndex: 10, marginInline: '-10px', paddingInline: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !!conflictInfo || isBlacklisted}>
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

  return createPortal(modalContent, document.body)
}
