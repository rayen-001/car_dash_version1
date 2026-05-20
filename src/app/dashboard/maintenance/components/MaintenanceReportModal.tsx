import { Printer } from 'lucide-react'
import { BusinessSettings } from '@/types'

interface MaintenanceReportModalProps {
  records: any[]
  businessSettings: BusinessSettings | null
  onClose: () => void
  filters: {
    vehicle: string
    searchQuery: string
  }
  stats: {
    totalCost: number
    overdue: number
    upcoming: number
  }
}

export default function MaintenanceReportModal({
  records,
  businessSettings,
  onClose,
  filters,
  stats
}: MaintenanceReportModalProps) {
  const currentSettings = {
    business_name: businessSettings?.business_name || 'RentCar Premium',
    logo_url: businessSettings?.logo_url || '',
    phone: businessSettings?.phone || '',
    address: businessSettings?.address || '',
    currency: 'DT',
    rental_terms: businessSettings?.rental_terms || ''
  }

  return (
    <div className="modal-overlay print-report-container" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{
        maxWidth: '850px',
        width: '95%',
        background: '#ffffff',
        color: '#1a1a1a',
        border: '1px solid #cbd5e1',
        boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
        padding: '3rem',
        overflowY: 'auto',
        maxHeight: '90vh'
      }}>
        {/* Header with Print action */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '2.5rem'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            Maintenance Report ready for Printing / PDF generation.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ background: '#d4b46a', color: '#000000', fontWeight: 600 }} onClick={() => window.print()}>
               <Printer size={16} />
               <span>Print / Save as PDF</span>
            </button>
            <button className="btn-secondary" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={onClose}>
               Close
            </button>
          </div>
        </div>

        {/* Printable Report Page Layout */}
        <div className="print-content" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}>
          
          {/* Header structure matching Rental Contract */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              {currentSettings.logo_url && (
                <img src={currentSettings.logo_url} alt="Logo" style={{ height: '48px', width: 'auto', marginBottom: '0.75rem', objectFit: 'contain' }} />
              )}
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.5px' }}>
                {currentSettings.business_name}
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {currentSettings.address} | Tel: {currentSettings.phone}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                border: '1.5px solid #0f172a',
                padding: '0.4rem 0.85rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                color: '#0f172a',
                letterSpacing: '0.5px'
              }}>
                Maintenance Log
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
                Date Generated: <strong>{new Date().toLocaleDateString()}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>
                Currency: <strong>{currentSettings.currency || 'DT'}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Filter Criteria block */}
            <div style={{ border: '1px solid #cbd5e1', padding: '1rem 1.25rem', borderRadius: '6px', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.5rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>
                Report Scope
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', color: '#475569' }}>
                <div>Vehicle Filter: <strong style={{ color: '#0f172a' }}>{filters.vehicle}</strong></div>
                <div>Search Query: <strong style={{ color: '#0f172a' }}>{filters.searchQuery || 'None'}</strong></div>
              </div>
            </div>

            {/* Summary Statistics block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cost</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                  {stats.totalCost.toFixed(2)} {currentSettings.currency}
                </div>
              </div>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center', background: stats.overdue > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent', borderColor: stats.overdue > 0 ? '#ef4444' : '#cbd5e1' }}>
                <span style={{ fontSize: '0.75rem', color: stats.overdue > 0 ? '#ef4444' : '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overdue Services</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: stats.overdue > 0 ? '#ef4444' : '#0f172a', marginTop: '0.25rem' }}>
                  {stats.overdue}
                </div>
              </div>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upcoming (30d)</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                  {stats.upcoming}
                </div>
              </div>
            </div>

            {/* Maintenance List Breakdown */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Vehicle</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Last Service</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Next Service Due</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No maintenance records match the active filters.
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => {
                      const vName = record.vehicles 
                        ? `${record.vehicles.brand} ${record.vehicles.model}` 
                        : 'Associated Vehicle'
                      
                      // Calculate service state
                      const serviceDate = new Date(record.service_date)
                      const nextDue = new Date(serviceDate)
                      nextDue.setMonth(nextDue.getMonth() + 6)
                      const today = new Date()
                      const diffTime = nextDue.getTime() - today.getTime()
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      const isOverdue = diffDays < 0

                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>
                            {vName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#1e293b' }}>
                            {new Date(record.service_date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {record.description}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: isOverdue ? '#ef4444' : '#16a34a', fontWeight: 600 }}>
                            {nextDue.toLocaleDateString()} {isOverdue ? '(OVERDUE)' : '(DUE SOON)'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                            {record.cost.toFixed(2)} {currentSettings.currency}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <div style={{
                border: '1.5px solid #0f172a',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                background: '#f8fafc',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                gap: '2rem'
              }}>
                <span style={{ color: '#475569' }}>TOTAL COST SUMMARY:</span>
                <span style={{ color: '#0f172a' }}>{stats.totalCost.toFixed(2)} {currentSettings.currency}</span>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '4rem', fontSize: '0.8rem' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', textAlign: 'center', color: '#64748b' }}>
                Prepared By: ___________________________
              </div>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', textAlign: 'center', color: '#64748b' }}>
                Inspector Signature: ___________________________
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}
