'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { addMaintenance } from '@/app/actions'

export default function MaintenanceClient({ initialRecords, vehicles }: { initialRecords: any[], vehicles: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addMaintenance(new FormData(e.currentTarget))
      setIsModalOpen(false)
    } catch (error) {
      alert('Error adding maintenance record')
    }
    setLoading(false)
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className='header-title-row'>
          <div>
            <h1 className='page-title'>Maintenance Logs</h1>
            <p className='subtitle'>Schedule and track vehicle service history.</p>
          </div>
          <button className='btn-primary' onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Log Service</span>
          </button>
        </div>
      </div>
      
      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className='data-table'>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Service Date</th>
                <th>Description</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {initialRecords && initialRecords.length > 0 ? (
                initialRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td><span className='fw-500'>{rec.vehicles?.brand} {rec.vehicles?.model}</span></td>
                    <td>{new Date(rec.service_date).toLocaleDateString()}</td>
                    <td>{rec.description}</td>
                    <td className='fw-500'>${rec.cost}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className='text-center py-4'>No maintenance records found.</td>
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
              <h2>Log Service Record</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Select Vehicle</label>
                <select name="vehicle_id" required className="form-input">
                  <option value="">-- Choose a vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description of Service</label>
                <input type="text" name="description" required placeholder="e.g. Oil change and tire rotation" className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cost ($)</label>
                  <input type="number" name="cost" required placeholder="120" min="0" step="0.01" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Date of Service</label>
                  <input type="date" name="service_date" required className="form-input" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
