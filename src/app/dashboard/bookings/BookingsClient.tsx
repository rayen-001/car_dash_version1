'use client'

import { useState } from 'react'
import { Calendar, Plus, CheckCircle, XCircle, X } from 'lucide-react'
import { addBooking, updateBookingStatus } from '@/app/actions'

export default function BookingsClient({ initialBookings, vehicles }: { initialBookings: any[], vehicles: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoading(true)
    try {
      await updateBookingStatus(id, newStatus)
    } catch (e) {
      alert('Error updating status')
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addBooking(new FormData(e.currentTarget))
      setIsModalOpen(false)
    } catch (error) {
      alert('Error adding booking')
    }
    setLoading(false)
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>Bookings</h1>
            <p className='subtitle'>Manage customer reservations and rental statuses.</p>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>New Booking</span>
          </button>
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialBookings && initialBookings.length > 0 ? (
                initialBookings.map((booking: any) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="fw-500">{booking.client_name}</div>
                      <div className="text-xs text-muted">ID: {booking.id.substring(0, 8)}</div>
                    </td>
                    <td>
                      <div className="fw-500">{booking.vehicles?.brand} {booking.vehicles?.model}</div>
                    </td>
                    <td>
                      <div className="text-sm">
                        {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="fw-500">${booking.total_amount}</td>
                    <td>
                      <span className={`status-badge ${booking.status === 'confirmed' ? 'active' : (booking.status === 'cancelled' ? 'inactive' : 'pending')}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {booking.status !== 'confirmed' && (
                          <button className="icon-btn text-success" title="Approve" onClick={() => handleStatusChange(booking.id, 'confirmed')} disabled={loading}><CheckCircle size={16} /></button>
                        )}
                        {booking.status !== 'cancelled' && (
                          <button className="icon-btn text-danger" title="Cancel" onClick={() => handleStatusChange(booking.id, 'cancelled')} disabled={loading}><XCircle size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                      <Calendar size={48} style={{ opacity: 0.5, color: 'var(--text-muted)' }} />
                      <p>No bookings found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Add New Booking</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Client Name</label>
                <input type="text" name="client_name" required placeholder="John Doe" className="form-input" />
              </div>
              <div className="form-group">
                <label>Select Vehicle</label>
                <select name="vehicle_id" required className="form-input">
                  <option value="">-- Choose a vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} (${v.price_per_day}/day)</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" name="start_date" required className="form-input" />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" name="end_date" required className="form-input" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Total Amount ($)</label>
                  <input type="number" name="total_amount" required placeholder="500" min="0" step="0.01" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" className="form-input">
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
