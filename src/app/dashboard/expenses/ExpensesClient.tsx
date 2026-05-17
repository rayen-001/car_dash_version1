'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { addExpense } from '@/app/actions'

export default function ExpensesClient({ initialExpenses, vehicles }: { initialExpenses: any[], vehicles: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addExpense(new FormData(e.currentTarget))
      setIsModalOpen(false)
    } catch (error) {
      alert('Error adding expense')
    }
    setLoading(false)
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className='header-title-row'>
          <div>
            <h1 className='page-title'>Expenses</h1>
            <p className='subtitle'>Track your business expenses and operational costs.</p>
          </div>
          <button className='btn-primary' onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>
      
      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className='data-table'>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Vehicle</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {initialExpenses && initialExpenses.length > 0 ? (
                initialExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td><span className='fw-500'>{exp.category}</span></td>
                    <td>{exp.description || '-'}</td>
                    <td>{exp.vehicles ? `${exp.vehicles.brand} ${exp.vehicles.model}` : 'General / Business'}</td>
                    <td>{new Date(exp.created_at).toLocaleDateString()}</td>
                    <td className='text-danger fw-500'>-${exp.amount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className='text-center py-4'>No expenses logged.</td>
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
              <h2>Add New Expense</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Category</label>
                <select name="category" required className="form-input">
                  <option value="fuel">Fuel</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="insurance">Insurance</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" name="description" placeholder="e.g. Monthly car wash" className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" name="amount" required placeholder="50" min="0" step="0.01" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Link to Vehicle (Optional)</label>
                  <select name="vehicle_id" className="form-input">
                    <option value="">-- General Expense --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
