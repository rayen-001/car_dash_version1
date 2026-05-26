'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, Plus, CheckCircle, XCircle, Receipt, FileText, Edit, Search, ShieldCheck, UserPlus, AlertOctagon, Plane, Hotel, MapPin } from 'lucide-react'
import { updateBookingStatus, addCoDriverToBooking } from '@/app/actions'
import { Booking, Vehicle, Client, BusinessSettings } from '@/types'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/Badge'
import BookingFormModal from './components/BookingFormModal'
import BookingInvoiceModal from './components/BookingInvoiceModal'
import BookingAgreementModal from './components/BookingAgreementModal'

export default function BookingsClient({ 
  initialBookings, 
  vehicles, 
  clients,
  businessSettings,
  vehicleLegalDocs = []
}: { 
  initialBookings: Booking[], 
  vehicles: Vehicle[], 
  clients: Client[],
  businessSettings: BusinessSettings,
  vehicleLegalDocs?: any[]
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsFormOpen(true)
    }
  }, [searchParams])

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [vehicleFilter, setVehicleFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Modals for Invoices and Agreements
  const [selectedInvoice, setSelectedInvoice] = useState<Booking | null>(null)
  const [selectedAgreement, setSelectedAgreement] = useState<Booking | null>(null)

  // Inline Co-Driver State
  const [activeCoDriverSearch, setActiveCoDriverSearch] = useState<string | null>(null)
  const [coDriverSearchQuery, setCoDriverSearchQuery] = useState('')
  const [isAddingCoDriver, setIsAddingCoDriver] = useState(false)

  const handleOpenNewModal = () => {
    setEditingBooking(null)
    setIsFormOpen(true)
  }

  const handleOpenEditModal = (booking: Booking) => {
    setEditingBooking(booking)
    setIsFormOpen(true)
  }


  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoading(true)
    try {
      await updateBookingStatus(id, newStatus)
      showToast(`Booking status updated to ${newStatus}!`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error')
    }
    setLoading(false)
  }

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'All' || vehicleFilter !== 'All' || dateFrom !== '' || dateTo !== ''

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('All')
    setVehicleFilter('All')
    setDateFrom('')
    setDateTo('')
  }

  const submitCoDriver = async (bookingId: string, clientId: string) => {
    setIsAddingCoDriver(true)
    try {
      await addCoDriverToBooking(bookingId, clientId)
      showToast('Co-Driver successfully added!', 'success')
      setActiveCoDriverSearch(null)
      setCoDriverSearchQuery('')
    } catch (err: any) {
      showToast(err.message || 'Error adding Co-Driver', 'error')
    }
    setIsAddingCoDriver(false)
  }

  // Filter logic
  const filteredBookings = initialBookings.filter((booking) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      (booking.client_name?.toLowerCase() || '').includes(searchLower) ||
      (booking.vehicles?.brand && `${booking.vehicles.brand} ${booking.vehicles.model}`.toLowerCase().includes(searchLower)) ||
      booking.id.toLowerCase().includes(searchLower)

    const matchesStatus = statusFilter === 'All' || booking.status?.toLowerCase() === statusFilter.toLowerCase()

    const matchesVehicle = vehicleFilter === 'All' || booking.vehicle_id === vehicleFilter

    const matchesDateFrom = !dateFrom || booking.start_date >= dateFrom
    const matchesDateTo = !dateTo || booking.start_date <= dateTo

    return matchesSearch && matchesStatus && matchesVehicle && matchesDateFrom && matchesDateTo
  })

  // Helper to map payment status to badge variant
  const getPaymentVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'success'
      case 'partial': return 'warning'
      case 'unpaid':
      default: return 'danger'
    }
  }

  // Helper to map deposit status to badge variant
  const getDepositVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'returned': return 'success'
      case 'held': return 'warning'
      case 'forfeited': return 'danger'
      default: return 'default'
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  // Co-Driver search autocomplete
  const filteredClients = clients.filter(c => c.full_name.toLowerCase().includes(coDriverSearchQuery.toLowerCase()))

  const getHandoverTelemetry = (booking: any) => {
    const handovers = booking.vehicle_handovers || []
    if (handovers.length === 0) return { deltaKm: null, deltaFuel: null }
    const h = handovers[0]
    let deltaKm = null
    let deltaFuel = null
    if (h.pickup_km !== null && h.return_km !== null) {
      deltaKm = h.return_km - h.pickup_km
    }
    if (h.pickup_fuel !== null && h.return_fuel !== null) {
      const fuelDiff = h.return_fuel - h.pickup_fuel
      deltaFuel = fuelDiff > 0 ? `+${fuelDiff}/8` : `${fuelDiff}/8`
    }
    return { deltaKm, deltaFuel }
  }

  const getDaysDiff = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    const diff = e.getTime() - s.getTime()
    return Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)))
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>Bookings</h1>
            <p className='subtitle'>Manage customer reservations and rental statuses.</p>
          </div>
          <button className="btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="control-bar glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by client name, vehicle, or booking ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
          </div>
          
          {hasActiveFilters && (
            <button 
              onClick={handleResetFilters} 
              className="btn-secondary" 
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          {/* Status Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '130px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Vehicle Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vehicle:</label>
            <select 
              value={vehicleFilter} 
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '160px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem' }}
            >
              <option value="All">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
              ))}
            </select>
          </div>

          {/* Date Range Picker */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Date From:</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input"
              style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem', width: '135px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Date To:</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input"
              style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem', width: '135px' }}
            />
          </div>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel master-operations-table' style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>CONTRACT</th>
                <th style={{ width: '320px' }}>CLIENT & CO-DRIVERS</th>
                <th style={{ width: '220px' }}>LEGAL DOCS</th>
                <th style={{ width: '240px' }}>VEHICLE & TELEMETRY</th>
                <th style={{ width: '160px' }}>RENTAL WINDOW</th>
                <th style={{ width: '180px' }}>FINANCIALS</th>
                <th style={{ width: '140px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings && filteredBookings.length > 0 ? (
                filteredBookings.map((booking: any) => {
                  const { deltaKm, deltaFuel } = getHandoverTelemetry(booking)
                  const totalPaid = Number(booking.acompte_paid || 0)
                  const reste = Number(booking.total_amount || 0) - totalPaid
                  const primary = booking.primary_client || { full_name: booking.client_name, phone: booking.client_phone, trust_score: null, cin: booking.client_cin_passport, license_number: booking.client_license_number }
                  const secondary = booking.secondary_client
                  const hasRisk = secondary?.trust_score !== null && secondary?.trust_score < 30

                  return (
                  <tr key={booking.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* COL 1: CONTRACT */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div className="fw-600" style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>#{booking.id.substring(0, 6).toUpperCase()}</div>
                      <Badge variant={booking.status === 'completed' ? 'success' : booking.status === 'confirmed' ? 'info' : 'warning'}>
                        {booking.status}
                      </Badge>
                    </td>

                    {/* COL 2: CLIENT & CO-DRIVER COCKPIT */}
                    <td style={{ verticalAlign: 'top', padding: '1rem' }}>
                      {/* Top: Primary Driver */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(229,193,125,0.15)', border: '1px solid rgba(229,193,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E5C17D', fontWeight: 600, fontSize: '0.85rem' }}>
                          {getInitials(primary.full_name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="fw-500" style={{ color: '#fff', fontSize: '0.95rem' }}>{primary.full_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            {primary.phone || 'No Phone'}
                          </div>
                          {primary.trust_score !== null && primary.trust_score !== undefined && primary.trust_score < 30 ? (
                            <div style={{ 
                              background: 'rgba(239,68,68,0.15)', 
                              border: '1px solid rgba(239,68,68,0.4)', 
                              color: '#ef4444', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px', 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              animation: 'pulseAlert 2s infinite'
                            }}>
                              🚨 PRIMARY RISK - REPOSSESSION FLAG
                            </div>
                          ) : (
                            <span style={{
                              background: primary.trust_score === null || primary.trust_score === undefined ? 'rgba(255,255,255,0.05)' : primary.trust_score >= 80 ? 'rgba(16,185,129,0.15)' : primary.trust_score >= 60 ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                              color: primary.trust_score === null || primary.trust_score === undefined ? 'var(--text-muted)' : primary.trust_score >= 80 ? '#10b981' : primary.trust_score >= 60 ? '#4ade80' : '#fbbf24',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: '1px solid',
                              borderColor: primary.trust_score === null || primary.trust_score === undefined ? 'rgba(255,255,255,0.1)' : primary.trust_score >= 80 ? 'rgba(16,185,129,0.3)' : primary.trust_score >= 60 ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
                            }}>
                              {primary.trust_score === null || primary.trust_score === undefined ? 'Unrated' : primary.trust_score >= 80 ? `Excellent (${primary.trust_score.toFixed(1)} DRI)` : primary.trust_score >= 60 ? `Standard (${primary.trust_score.toFixed(1)} DRI)` : `Watch (${primary.trust_score.toFixed(1)} DRI)`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Partition Line */}
                      <div style={{ borderBottom: '1px dashed rgba(229,193,125,0.15)', margin: '0.75rem 0' }} />

                      {/* Bottom: Secondary Driver */}
                      {secondary ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontWeight: 600, fontSize: '0.75rem' }}>
                            {getInitials(secondary.full_name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="fw-500" style={{ color: '#ccc', fontSize: '0.9rem' }}>{secondary.full_name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>(Co-Driver)</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                              {secondary.phone || 'No Phone'}
                            </div>
                            {secondary.trust_score !== null && secondary.trust_score !== undefined && secondary.trust_score < 30 ? (
                              <div style={{ 
                                background: 'rgba(239,68,68,0.15)', 
                                border: '1px solid rgba(239,68,68,0.4)', 
                                color: '#ef4444', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '4px', 
                                fontSize: '0.7rem', 
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                animation: 'pulseAlert 2s infinite'
                              }}>
                                🚨 CO-DRIVER RISK - INVALID INS
                              </div>
                            ) : (
                              <span style={{
                                background: secondary.trust_score === null || secondary.trust_score === undefined ? 'rgba(255,255,255,0.05)' : secondary.trust_score >= 80 ? 'rgba(16,185,129,0.15)' : secondary.trust_score >= 60 ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                                color: secondary.trust_score === null || secondary.trust_score === undefined ? 'var(--text-muted)' : secondary.trust_score >= 80 ? '#10b981' : secondary.trust_score >= 60 ? '#4ade80' : '#fbbf24',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                border: '1px solid',
                                borderColor: secondary.trust_score === null || secondary.trust_score === undefined ? 'rgba(255,255,255,0.1)' : secondary.trust_score >= 80 ? 'rgba(16,185,129,0.3)' : secondary.trust_score >= 60 ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
                              }}>
                                {secondary.trust_score === null || secondary.trust_score === undefined ? 'Unrated' : secondary.trust_score >= 80 ? `Excellent (${secondary.trust_score.toFixed(1)} DRI)` : secondary.trust_score >= 60 ? `Standard (${secondary.trust_score.toFixed(1)} DRI)` : `Watch (${secondary.trust_score.toFixed(1)} DRI)`}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          {activeCoDriverSearch === booking.id ? (
                            <div style={{ 
                              background: 'rgba(15,23,42,0.98)', 
                              backdropFilter: 'blur(12px)',
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid rgba(229,193,125,0.4)',
                              position: 'absolute',
                              top: '0',
                              left: '0',
                              width: '260px',
                              zIndex: 50,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                            }}>
                              <input 
                                type="text"
                                autoFocus
                                placeholder="Search CIN/Passport or Name..."
                                value={coDriverSearchQuery}
                                onChange={(e) => setCoDriverSearchQuery(e.target.value)}
                                className="form-input text-xs"
                                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                {filteredClients.slice(0, 5).map(c => (
                                  <div 
                                    key={c.id} 
                                    onClick={() => submitCoDriver(booking.id, c.id)}
                                    style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}
                                    className="hover-bg-glass"
                                  >
                                    <span className="fw-500">{c.full_name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>CIN: {c.cin || 'N/A'} • {c.phone}</span>
                                  </div>
                                ))}
                                {filteredClients.length === 0 && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem', textAlign: 'center' }}>No clients found.</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                <button className="text-muted text-xs hover-bg-glass px-2 py-1 rounded" onClick={() => setActiveCoDriverSearch(null)}>Cancel</button>
                                <button className="text-gold text-xs fw-500 hover-bg-glass px-2 py-1 rounded" onClick={() => { handleOpenNewModal(); setActiveCoDriverSearch(null) }}>[ ➕ Quick Create ]</button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setActiveCoDriverSearch(booking.id); setCoDriverSearchQuery('') }}
                              style={{ 
                                padding: '0.5rem 0.75rem', 
                                fontSize: '0.8rem', 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px dashed rgba(229,193,125,0.3)', 
                                color: '#E5C17D',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                width: '100%',
                                justifyContent: 'center'
                              }}
                              className="hover-bg-glass"
                            >
                              <Plus size={14} /> Add Co-Driver
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* COL 3: STATUTORY LEGAL DOCS */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                        <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>CIN</span>: {primary.cin || '-'}</div>
                        <div style={{ marginTop: '0.15rem' }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>Lic</span>: {primary.license_number || '-'}</div>
                      </div>
                      
                      {secondary && (
                        <>
                          <div style={{ borderBottom: '1px dashed rgba(229,193,125,0.12)', margin: '0.75rem 0' }} />
                          <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                            <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>CIN</span>: {secondary.cin || '-'}</div>
                            <div style={{ marginTop: '0.15rem' }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>Lic</span>: {secondary.license_number || '-'}</div>
                          </div>
                        </>
                      )}
                    </td>

                    {/* COL 4: VEHICLE TELEMETRY NODE */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ 
                        background: '#111', 
                        border: '2px solid #333', 
                        borderRadius: '4px', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        padding: '0.15rem 0.4rem',
                        marginBottom: '0.4rem'
                      }}>
                        <span style={{ borderRight: '1px solid #444', paddingRight: '0.4rem', marginRight: '0.4rem', color: '#f87171' }}>TN</span>
                        <span>{booking.vehicles?.license_plate || 'NO PLATE'}</span>
                      </div>
                      <div className="fw-500 text-sm" style={{ color: '#ccc', marginBottom: '0.4rem' }}>
                        {booking.vehicles?.brand} {booking.vehicles?.model}
                      </div>
                      <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {deltaKm !== null && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{deltaKm} km driven</span>}
                        {deltaFuel !== null && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{deltaFuel} Tank</span>}
                      </div>
                    </td>

                    {/* COL 5: RENTAL WINDOW */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.25rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} />
                        {new Date(booking.start_date).toLocaleDateString('en-GB')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                        {new Date(booking.end_date).toLocaleDateString('en-GB')}
                      </div>
                      <Badge variant="default">{getDaysDiff(booking.start_date, booking.end_date)} days</Badge>

                      {/* Phase 17a — Optional off-site Handover badge. Renders nothing
                          when handover_location is null/empty so the column stays compact. */}
                      {booking.handover_location && booking.handover_location.trim() && (() => {
                        const loc = booking.handover_location.trim()
                        const lc = loc.toLowerCase()
                        const Icon = (lc.includes('matar') || lc.includes('airport') || lc.includes('aéroport') || lc.includes('aeroport'))
                          ? Plane
                          : (lc.includes('hotel') || lc.includes('hôtel'))
                            ? Hotel
                            : MapPin
                        // Render the full DD/MM/YYYY HH:MM so the badge shows when the
                        // delivery actually happens, not just the time-of-day.
                        const hhmm = booking.handover_datetime
                          ? new Date(booking.handover_datetime).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : ''
                        return (
                          <div
                            title={`Handover · ${loc}${hhmm ? ' @ ' + hhmm : ''}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              marginTop: '0.5rem',
                              padding: '0.22rem 0.55rem',
                              background: 'linear-gradient(135deg, rgba(229,193,125,0.18) 0%, rgba(229,193,125,0.06) 100%)',
                              border: '1px solid rgba(229,193,125,0.35)',
                              borderRadius: '999px',
                              boxShadow: '0 0 14px rgba(229,193,125,0.18), inset 0 0 6px rgba(229,193,125,0.06)',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#E5C17D',
                              letterSpacing: '0.02em',
                              maxWidth: '100%',
                              width: 'fit-content',
                            }}
                          >
                            <Icon size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{loc}</span>
                            {hhmm && (
                              <>
                                <span style={{ opacity: 0.4 }}>·</span>
                                <span style={{ color: '#fff' }}>{hhmm}</span>
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* COL 6: CASH RECONCILIATION */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{booking.total_amount} DT</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Paid:</span>
                        <span style={{ color: '#4ade80' }}>{totalPaid} DT</span>
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        paddingTop: '0.4rem',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        fontWeight: 600,
                        color: reste > 0 ? '#f87171' : '#4ade80'
                      }}>
                        <span>Reste:</span>
                        <span>{reste} DT</span>
                      </div>
                    </td>

                    {/* COL 7: ACTIONS */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem', textAlign: 'right' }}>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="icon-btn text-amber" title="View Invoice / Receipt" onClick={() => setSelectedInvoice(booking)}>
                          <Receipt size={16} />
                        </button>
                        <button className="icon-btn text-gold" title="Generate Agreement" onClick={() => setSelectedAgreement(booking)}>
                          <FileText size={16} />
                        </button>
                        <button className="icon-btn text-info" title="Edit Booking" onClick={() => handleOpenEditModal(booking)}>
                          <Edit size={16} />
                        </button>
                        {booking.status !== 'confirmed' && (
                          <button className="icon-btn text-success" title="Approve" onClick={() => handleStatusChange(booking.id, 'confirmed')} disabled={loading}>
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {booking.status !== 'cancelled' && (
                          <button className="icon-btn text-danger" title="Cancel" onClick={() => handleStatusChange(booking.id, 'cancelled')} disabled={loading}>
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem 0' }}>
                      <div style={{ 
                        background: 'rgba(212, 180, 106, 0.03)', 
                        border: '1px solid rgba(212, 180, 106, 0.1)', 
                        padding: '2.5rem', 
                        borderRadius: '12px',
                        maxWidth: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem',
                        margin: '0 auto',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Calendar size={40} style={{ color: '#e5c17d', opacity: 0.8 }} />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff', letterSpacing: '0.3px' }}>No bookings found</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center' }}>
                          Manage your active reservations, invoices, and customer agreements by adding a new booking.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingFormModal
        isOpen={isFormOpen}
        editingBooking={editingBooking}
        vehicles={vehicles}
        clients={clients}
        initialBookings={initialBookings}
        vehicleLegalDocs={vehicleLegalDocs}
        onClose={() => setIsFormOpen(false)}
      />

      <BookingInvoiceModal
        booking={selectedInvoice}
        businessSettings={businessSettings}
        onClose={() => setSelectedInvoice(null)}
      />

      <BookingAgreementModal
        booking={selectedAgreement}
        businessSettings={businessSettings}
        onClose={() => setSelectedAgreement(null)}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide background layout elements, sidebar, topbar, sidebar-overlay, buttons, header */
          .sidebar,
          .topbar,
          .sidebar-overlay,
          .dashboard-page > .header-section,
          .dashboard-page > .content-grid,
          .no-print,
          .no-print *,
          .modal-header button,
          .modal-footer button,
          button {
            display: none !important;
          }

          /* Keep layout wrappers visible but flat and white */
          .layout-container,
          .main-content,
          .content-area,
          .dashboard-page {
            display: block !important;
            background: #ffffff !important;
            background-image: none !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm 12mm 8mm 12mm !important;
          }

          /* Display ONLY the active printable container */
          .print-agreement-container,
          .print-invoice-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            z-index: 99999 !important;
          }

          /* Ensure target modals render in full white flat printable layouts */
          .print-agreement-container .modal-content,
          .print-invoice-container .modal-content {
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }

          .print-content {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            color: #000000 !important;
            font-size: 11.5px !important;
            line-height: 1.35 !important;
          }

          /* Force all printed header elements to print cleanly in dark charcoal/black */
          h1, h2, h3, h4, h5, h6 {
            color: #0f172a !important;
            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;
          }

          p, span, td, div {
            color: #1e293b !important;
          }

          strong {
            color: #000000 !important;
            font-weight: bold !important;
          }

          /* Ensure borders look crisp and high contrast in black and white */
          div, table, td, th {
            border-color: #94a3b8 !important;
          }

          /* Beautiful standard margins and layout specifically to fit 1 single page nicely */
          .print-content h1 {
            font-size: 1.4rem !important;
            margin-bottom: 0.25rem !important;
          }
          
          .print-content p {
            margin-bottom: 0.6rem !important;
            font-size: 0.8rem !important;
            line-height: 1.35 !important;
          }

          .print-content .grid-layout,
          .print-content > div {
            margin-bottom: 0.75rem !important;
            gap: 0.75rem !important;
          }

          .print-content table td {
            padding: 0.25rem 0 !important;
            font-size: 0.78rem !important;
          }

          .print-content h3 {
            font-size: 0.8rem !important;
            margin-bottom: 0.4rem !important;
            padding-bottom: 0.25rem !important;
          }

          .print-content ul {
            gap: 0.25rem !important;
            margin-bottom: 0.6rem !important;
          }

          .print-content ul li {
            font-size: 0.78rem !important;
            line-height: 1.3 !important;
          }

          .print-content .signatures-row {
            margin-top: 2rem !important;
            gap: 3rem !important;
          }

          .print-content .signature-box {
            height: 28px !important;
          }
        }

        @keyframes pulseAlert {
          0% { opacity: 1; }
          50% { opacity: 0.5; box-shadow: 0 0 12px rgba(239, 68, 68, 0.4); }
          100% { opacity: 1; }
        }
      ` }} />
    </div>
  )
}
