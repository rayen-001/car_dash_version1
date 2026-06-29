'use client'

import { useState } from 'react'
import { Plus, X, Edit2, Trash2, Loader2, Wrench, Search, Calendar, ShieldAlert, FileText } from 'lucide-react'
import { addMaintenance, updateMaintenance, deleteMaintenance } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/Badge'
import MaintenanceReportModal from './components/MaintenanceReportModal'
import { BusinessSettings } from '@/types'
import ModalPortal from '@/components/ModalPortal'

export default function MaintenanceClient({ 
  initialRecords, 
  vehicles,
  businessSettings 
}: { 
  initialRecords: any[]
  vehicles: any[]
  businessSettings: BusinessSettings | null
}) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Filter States
  const [vehicleFilter, setVehicleFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await addMaintenance(new FormData(e.currentTarget))
      setIsAddModalOpen(false)
      showToast('Service record logged successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save service record.', 'error')
    }
    setLoading(false)
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingRecord) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('id', editingRecord.id)
    try {
      await updateMaintenance(formData)
      setEditingRecord(null)
      showToast('Service record updated!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update record.', 'error')
    }
    setLoading(false)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Service Record',
      message: 'Are you sure you want to permanently delete this maintenance record?',
      confirmLabel: 'Yes, Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteMaintenance(id)
      showToast('Maintenance record deleted.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete record.', 'error')
    }
  }

  // ── Calculations & Filtering ────────────────────────────────────────────────
  const getNextServiceDate = (serviceDateStr: string) => {
    const serviceDate = new Date(serviceDateStr)
    serviceDate.setMonth(serviceDate.getMonth() + 6) // Standard 6-month interval
    return serviceDate
  }

  const getNextServiceStatus = (nextServiceDate: Date) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const compareDate = new Date(nextServiceDate)
    compareDate.setHours(0, 0, 0, 0)
    
    const diffTime = compareDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { label: `Overdue (${Math.abs(diffDays)}d ago)`, variant: 'danger' as const }
    } else if (diffDays <= 30) {
      return { label: `Due in ${diffDays}d`, variant: 'warning' as const }
    } else {
      return { label: `Due ${compareDate.toLocaleDateString()}`, variant: 'success' as const }
    }
  }

  const filteredRecords = (initialRecords || []).filter((rec) => {
    const matchesVehicle = vehicleFilter === 'All' || rec.vehicle_id === vehicleFilter
    const matchesSearch = 
      (rec.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.vehicles?.brand && `${rec.vehicles.brand} ${rec.vehicles.model}`.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesVehicle && matchesSearch
  })

  // Stats Calculations
  const totalCost = (initialRecords || []).reduce((acc, curr) => acc + Number(curr.cost || 0), 0)
  
  let overdueCount = 0
  let upcomingCount = 0
  
  ;(initialRecords || []).forEach((rec) => {
    const nextDate = getNextServiceDate(rec.service_date)
    const status = getNextServiceStatus(nextDate)
    if (status.variant === 'danger') overdueCount++
    if (status.variant === 'warning') upcomingCount++
  })

  // ── Shared form ───────────────────────────────────────────────────────────────
  const ServiceForm = ({ defaultValues, onSubmit, submitLabel }: {
    defaultValues?: any
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    submitLabel: string
  }) => (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-group">
        <label>Select Vehicle</label>
        <select name="vehicle_id" required className="form-input" defaultValue={defaultValues?.vehicle_id || ''}>
          <option value="">-- Choose a vehicle --</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Description of Service</label>
        <input
          type="text"
          name="description"
          required
          placeholder="e.g. Oil change and tire rotation"
          className="form-input"
          defaultValue={defaultValues?.description || ''}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Cost (DT)</label>
          <input
            type="number"
            name="cost"
            required
            placeholder="120"
            min="0"
            step="0.01"
            className="form-input"
            defaultValue={defaultValues?.cost || ''}
          />
        </div>
        <div className="form-group">
          <label>Date of Service</label>
          <input
            type="date"
            name="service_date"
            required
            className="form-input"
            defaultValue={defaultValues?.service_date ? defaultValues.service_date.substring(0, 10) : ''}
          />
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setEditingRecord(null) }}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  )

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className='header-title-row'>
          <div>
            <h1 className='page-title'>Maintenance Logs</h1>
            <p className='subtitle'>Schedule and track vehicle service history.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
            <button className='btn-secondary' onClick={() => setIsReportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} />
              <span>Export PDF</span>
            </button>
            <button className='btn-primary' onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              <span>Log Service</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard 
          title="Total Service Cost" 
          value={`${totalCost.toFixed(2)} DT`} 
          icon={<Wrench size={20} />} 
          trendText="All-time maintenance spend"
          trendType="neutral"
        />
        <StatCard 
          title="Overdue Services" 
          value={overdueCount} 
          icon={<ShieldAlert size={20} className={overdueCount > 0 ? 'text-danger' : ''} />} 
          trendText={overdueCount > 0 ? "Requires immediate attention" : "All services up to date"}
          trendType={overdueCount > 0 ? "negative" : "neutral"}
        />
        <StatCard 
          title="Upcoming (30 days)" 
          value={upcomingCount} 
          icon={<Calendar size={20} />} 
          trendText="Approaching 6-month threshold"
          trendType="neutral"
        />
      </div>

      {/* Filter / Search Bar */}
      <div className="control-bar glass-panel" style={{ display: 'flex', gap: '1rem', padding: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: '280px' }}>
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vehicle:</label>
          <select 
            value={vehicleFilter} 
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="form-input"
            style={{ minWidth: '180px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.75rem 1rem' }}
          >
            <option value="All">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
            ))}
          </select>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className='data-table'>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Last Service</th>
                <th>Description</th>
                <th>Next Service Due</th>
                <th>Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords && filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => {
                  const nextDate = getNextServiceDate(rec.service_date)
                  const statusInfo = getNextServiceStatus(nextDate)
                  return (
                    <tr key={rec.id}>
                      <td><span className='fw-500'>{rec.vehicles?.brand} {rec.vehicles?.model}</span></td>
                      <td>{new Date(rec.service_date).toLocaleDateString()}</td>
                      <td style={{ maxWidth: '280px' }}>{rec.description}</td>
                      <td>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className='fw-500' style={{ color: 'var(--accent-gold)' }}>{Number(rec.cost).toFixed(2)} DT</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            className="icon-btn"
                            title="Edit Record"
                            onClick={() => setEditingRecord(rec)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-btn text-danger"
                            title="Delete Record"
                            onClick={() => handleDelete(rec.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className='text-center py-4'>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
                      <Wrench size={42} style={{ opacity: 0.4, color: 'var(--text-muted)' }} />
                      <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No service records found for this selection.</p>
                      <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={() => setIsAddModalOpen(true)}>
                        Log New Service
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
        <ModalPortal>
          <div className="modal-overlay">
            <div className="modal-content glass-panel">
              <div className="modal-header">
                <h2>Log Service Record</h2>
                <button className="icon-btn" onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
              </div>
              <ServiceForm onSubmit={handleAdd} submitLabel="Save Record" />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="modal-content glass-panel">
              <div className="modal-header">
                <h2>Edit Service Record</h2>
                <button className="icon-btn" onClick={() => setEditingRecord(null)}><X size={20} /></button>
              </div>
              <ServiceForm defaultValues={editingRecord} onSubmit={handleEdit} submitLabel="Save Changes" />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* REPORT PRINT MODAL */}
      {isReportOpen && (
        <ModalPortal>
          <MaintenanceReportModal
            records={filteredRecords}
            businessSettings={businessSettings}
            onClose={() => setIsReportOpen(false)}
            filters={{
              vehicle: vehicleFilter === 'All' ? 'All Vehicles' : (vehicles.find(v => v.id === vehicleFilter) ? `${vehicles.find(v => v.id === vehicleFilter).brand} ${vehicles.find(v => v.id === vehicleFilter).model}` : 'Associated Vehicle'),
              searchQuery: searchQuery
            }}
            stats={{
              totalCost: filteredRecords.reduce((acc, curr) => acc + Number(curr.cost || 0), 0),
              overdue: overdueCount,
              upcoming: upcomingCount
            }}
          />
        </ModalPortal>
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
