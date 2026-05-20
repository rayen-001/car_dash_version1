'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, X, Edit2, Trash2, Loader2, CircleDollarSign, CalendarRange, Filter, Search, FileText } from 'lucide-react'
import { addExpense, updateExpense, deleteExpense } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { StatCard } from '@/components/StatCard'
import ExpenseReportModal from './components/ExpenseReportModal'
import { BusinessSettings } from '@/types'

export default function ExpensesClient({ 
  initialExpenses, 
  vehicles,
  businessSettings 
}: { 
  initialExpenses: any[]
  vehicles: any[]
  businessSettings: BusinessSettings | null
}) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddModalOpen(true)
    }
  }, [searchParams])

  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [vehicleFilter, setVehicleFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addExpense(new FormData(e.currentTarget))
      setIsAddModalOpen(false)
      showToast('Expense logged successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to log expense.', 'error')
    }
    setLoading(false)
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingExpense) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('id', editingExpense.id)
    try {
      await updateExpense(formData)
      setEditingExpense(null)
      showToast('Expense updated successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update expense.', 'error')
    }
    setLoading(false)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to permanently delete this expense record?',
      confirmLabel: 'Yes, Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteExpense(id)
      showToast('Expense record deleted.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense.', 'error')
    }
  }

  // ── Filter & Calculations ───────────────────────────────────────────────────
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  const filteredExpenses = (initialExpenses || []).filter((exp) => {
    const matchesCategory = categoryFilter === 'All' || exp.category?.toLowerCase() === categoryFilter.toLowerCase()
    const matchesVehicle = vehicleFilter === 'All' || exp.vehicle_id === vehicleFilter
    const matchesSearch = 
      (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.vehicles?.brand && `${exp.vehicles.brand} ${exp.vehicles.model}`.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCategory && matchesVehicle && matchesSearch
  })

  // Calculate Stat values
  const totalFilteredAmount = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const totalOverallAmount = (initialExpenses || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  
  const thisMonthExpenses = (initialExpenses || []).filter((exp) => {
    const expDate = new Date(exp.created_at)
    return expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth
  })
  const thisMonthAmount = thisMonthExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  // ── Shared form ───────────────────────────────────────────────────────────────
  const ExpenseForm = ({ defaultValues, onSubmit, submitLabel }: {
    defaultValues?: any
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    submitLabel: string
  }) => (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-group">
        <label>Category</label>
        <select name="category" required className="form-input" defaultValue={defaultValues?.category || 'fuel'}>
          <option value="fuel">Fuel</option>
          <option value="maintenance">Maintenance</option>
          <option value="insurance">Insurance</option>
          <option value="cleaning">Cleaning</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <input type="text" name="description" placeholder="e.g. Monthly car wash" className="form-input" defaultValue={defaultValues?.description || ''} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Amount (DT)</label>
          <input type="number" name="amount" required placeholder="50" min="0" step="0.01" className="form-input" defaultValue={defaultValues?.amount || ''} />
        </div>
        <div className="form-group">
          <label>Link to Vehicle (Optional)</label>
          <select name="vehicle_id" className="form-input" defaultValue={defaultValues?.vehicle_id || ''}>
            <option value="">-- General Expense --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setEditingExpense(null) }}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  )

  const categoryColors: Record<string, string> = {
    fuel: 'rgba(245,158,11,0.15)',
    maintenance: 'rgba(99,102,241,0.15)',
    insurance: 'rgba(16,185,129,0.15)',
    cleaning: 'rgba(14,165,233,0.15)',
    other: 'rgba(255,255,255,0.08)',
  }
  const categoryText: Record<string, string> = {
    fuel: '#f59e0b',
    maintenance: '#818cf8',
    insurance: '#10b981',
    cleaning: '#38bdf8',
    other: '#94a3b8',
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className='header-title-row'>
          <div>
            <h1 className='page-title'>Expenses</h1>
            <p className='subtitle'>Track your business expenses and operational costs.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
            <button className='btn-secondary' onClick={() => setIsReportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} />
              <span>Export PDF</span>
            </button>
            <button className='btn-primary' onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard 
          title="This Month's Expenses" 
          value={`${thisMonthAmount.toFixed(2)} DT`} 
          icon={<CalendarRange size={20} />} 
          trendText="Current Calendar Month"
          trendType="neutral"
        />
        <StatCard 
          title="Total Registered Expenses" 
          value={`${totalOverallAmount.toFixed(2)} DT`} 
          icon={<CircleDollarSign size={20} />} 
          trendText="All-time accumulated"
          trendType="neutral"
        />
        <StatCard 
          title="Filtered Expenses Total" 
          value={`${totalFilteredAmount.toFixed(2)} DT`} 
          icon={<Filter size={20} />} 
          trendText="Active filter subset"
          trendType="neutral"
        />
      </div>

      {/* Filter / Search Control Bar */}
      <div className="control-bar glass-panel" style={{ display: 'flex', gap: '1rem', padding: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by description or vehicle..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Category:</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '140px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.75rem 1rem' }}
            >
              <option value="All">All Categories</option>
              <option value="fuel">Fuel</option>
              <option value="maintenance">Maintenance</option>
              <option value="insurance">Insurance</option>
              <option value="cleaning">Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vehicle:</label>
            <select 
              value={vehicleFilter} 
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '160px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.75rem 1rem' }}
            >
              <option value="All">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
              ))}
            </select>
          </div>
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses && filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '6px',
                        background: categoryColors[exp.category] || categoryColors.other,
                        color: categoryText[exp.category] || categoryText.other,
                        textTransform: 'capitalize'
                      }}>
                        {exp.category}
                      </span>
                    </td>
                    <td>{exp.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{exp.vehicles ? `${exp.vehicles.brand} ${exp.vehicles.model}` : <span style={{ color: 'var(--text-muted)' }}>General</span>}</td>
                    <td>{new Date(exp.created_at).toLocaleDateString()}</td>
                    <td className='text-danger fw-500'>-{Number(exp.amount).toFixed(2)} DT</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          className="icon-btn"
                          title="Edit Expense"
                          onClick={() => setEditingExpense(exp)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-btn text-danger"
                          title="Delete Expense"
                          onClick={() => handleDelete(exp.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className='text-center py-4'>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
                      <span style={{ fontSize: '2.5rem' }}>💸</span>
                      <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No expenses logged yet for this selection.</p>
                      <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={() => setIsAddModalOpen(true)}>
                        Log New Expense
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Add New Expense</h2>
              <button className="icon-btn" onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
            </div>
            <ExpenseForm onSubmit={handleAdd} submitLabel="Add Expense" />
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Edit Expense</h2>
              <button className="icon-btn" onClick={() => setEditingExpense(null)}><X size={20} /></button>
            </div>
            <ExpenseForm defaultValues={editingExpense} onSubmit={handleEdit} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      {/* REPORT PRINT MODAL */}
      {isReportOpen && (
        <ExpenseReportModal
          expenses={filteredExpenses}
          businessSettings={businessSettings}
          onClose={() => setIsReportOpen(false)}
          filters={{
            category: categoryFilter,
            vehicle: vehicleFilter === 'All' ? 'All Vehicles' : (vehicles.find(v => v.id === vehicleFilter) ? `${vehicles.find(v => v.id === vehicleFilter).brand} ${vehicles.find(v => v.id === vehicleFilter).model}` : 'Associated Vehicle'),
            searchQuery: searchQuery
          }}
          stats={{
            thisMonth: thisMonthAmount,
            overall: totalOverallAmount,
            filtered: totalFilteredAmount
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        @media print {
          /* Hide background layout elements, sidebar, topbar, sidebar-overlay, buttons, header */
          .sidebar,
          .topbar,
          .sidebar-overlay,
          .dashboard-page > .header-section,
          .dashboard-page > .stats-grid,
          .dashboard-page > .control-bar,
          .dashboard-page > .table-container,
          .no-print,
          .no-print *,
          .modal-overlay:not(.print-report-container),
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
          .print-report-container {
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
          .print-report-container .modal-content {
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
        }
      ` }} />
    </div>
  )
}
