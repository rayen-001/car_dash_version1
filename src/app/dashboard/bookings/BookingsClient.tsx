'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, Plus, CheckCircle, XCircle, Receipt, FileText, Edit, Search, ShieldCheck } from 'lucide-react'
import { updateBookingStatus } from '@/app/actions'
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

  // Filter logic
  const filteredBookings = initialBookings.filter((booking) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      booking.client_name.toLowerCase().includes(searchLower) ||
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
        <div className='glass-panel table-container'>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Vehicle</th>
                <th>Dates</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings && filteredBookings.length > 0 ? (
                filteredBookings.map((booking: Booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="fw-500">{booking.client_name}</div>
                      <div className="text-xs text-muted">ID: {booking.id.substring(0, 8)}</div>
                    </td>
                    <td>
                      <div className="fw-500">
                        {booking.vehicles?.brand} {booking.vehicles?.model}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="fw-500">
                      {booking.total_amount} {businessSettings.currency || 'DT'}
                    </td>
                    <td>
                      <Badge variant={getPaymentVariant(booking.payment_status)}>
                        {booking.payment_status || 'Unpaid'}
                      </Badge>
                    </td>

                    <td>
                      <span className={`status-badge ${booking.status?.toLowerCase()}`}>
                        {booking.status?.toLowerCase() === 'completed' && (
                          <ShieldCheck size={12} style={{ fill: 'rgba(229, 193, 125, 0.15)', marginRight: '0.25rem' }} />
                        )}
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
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
                ))
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
                        <Calendar size={40} style={{ color: '#d4b46a', opacity: 0.8 }} />
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
      ` }} />
    </div>
  )
}
