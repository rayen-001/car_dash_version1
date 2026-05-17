'use client'

import { useState } from 'react'
import { Car, Plus, Edit2, Trash2, X } from 'lucide-react'
import { addVehicle, deleteVehicle } from '@/app/actions'

export default function FleetClient({ initialVehicles }: { initialVehicles: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      await deleteVehicle(id)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addVehicle(new FormData(e.currentTarget))
      setIsModalOpen(false)
    } catch (error) {
      alert('Error adding vehicle')
    }
    setLoading(false)
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>My Fleet</h1>
            <p className='subtitle'>Manage your rental vehicles, pricing, and availability.</p>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle Details</th>
                <th>Year</th>
                <th>Price / Day</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialVehicles && initialVehicles.length > 0 ? (
                initialVehicles.map((car) => (
                  <tr key={car.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar-sm" style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                          <Car size={18} />
                        </div>
                        <div>
                          <div className="fw-500">{car.brand} {car.model}</div>
                          <div className="text-xs text-muted">ID: {car.id.substring(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{car.year}</td>
                    <td>${car.price_per_day}</td>
                    <td>
                      {car.availability ? (
                        <span className="status-badge active">Available</span>
                      ) : (
                        <span className="status-badge inactive">Rented</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn text-danger" title="Delete" onClick={() => handleDelete(car.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                      <Car size={48} style={{ opacity: 0.5, color: 'var(--text-muted)' }} />
                      <p>You haven't added any vehicles yet.</p>
                      <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsModalOpen(true)}>Add Your First Vehicle</button>
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
              <h2>Add New Vehicle</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Brand</label>
                <input type="text" name="brand" required placeholder="e.g. Mercedes-Benz" className="form-input" />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input type="text" name="model" required placeholder="e.g. G-Class" className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" name="year" required placeholder="2024" min="1900" max="2100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Price per Day ($)</label>
                  <input type="number" name="price_per_day" required placeholder="150" min="0" step="0.01" className="form-input" />
                </div>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" name="availability" defaultChecked id="avail" />
                <label htmlFor="avail" style={{ margin: 0 }}>Available for rent immediately</label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
