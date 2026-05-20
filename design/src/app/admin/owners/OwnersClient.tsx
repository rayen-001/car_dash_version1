'use client'

import { useState } from 'react'
import { Users, Trash2, X, Plus } from 'lucide-react'
import { addOwner, deleteOwner } from '@/app/actions'

export default function OwnersClient({ initialOwners }: { initialOwners: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to completely delete this Owner account and all their fleet data? This cannot be undone.')) {
      setLoading(true)
      try {
        await deleteOwner(id)
      } catch (e) {
        alert('Error deleting owner')
      }
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addOwner(new FormData(e.currentTarget))
      setIsModalOpen(false)
    } catch (error: any) {
      alert(error.message || 'Error adding owner')
    }
    setLoading(false)
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>Manage Owners</h1>
            <p className='subtitle'>View and control all rental business accounts on the platform.</p>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Users size={18} />
            <span>Add New Owner</span>
          </button>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company / Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialOwners && initialOwners.length > 0 ? (
                initialOwners.map((owner) => (
                  <tr key={owner.id}>
                    <td>
                      <div className="user-info">
                        <div className="avatar-sm">{owner.full_name?.charAt(0).toUpperCase() || 'O'}</div>
                        <div>
                          <div className="fw-500">{owner.company_name || owner.full_name || 'Unnamed Company'}</div>
                          <div className="text-xs text-muted">ID: {owner.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td>{owner.email}</td>
                    <td>
                      <span className="status-badge active">Active</span>
                    </td>
                    <td>{new Date(owner.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn text-danger" title="Delete Owner" onClick={() => handleDelete(owner.id)} disabled={loading}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-4">No owners found.</td>
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
              <h2>Add New Business Owner</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Company Name</label>
                <input type="text" name="company_name" required placeholder="e.g. Apex Car Rental" className="form-input" />
              </div>
              <div className="form-group">
                <label>Owner Full Name</label>
                <input type="text" name="full_name" required placeholder="John Doe" className="form-input" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" name="email" required placeholder="owner@company.com" className="form-input" />
              </div>
              <div className="form-group">
                <label>Access Password</label>
                <input type="password" name="password" required minLength={6} placeholder="••••••••" className="form-input" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Registering...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
