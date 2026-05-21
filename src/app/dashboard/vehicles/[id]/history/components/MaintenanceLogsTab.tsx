'use client'

import { useState, useMemo } from 'react'
import { Search, X, Wrench, Calendar, User, DollarSign } from 'lucide-react'
import styles from '../history.module.css'

interface MaintenanceLog {
  id: string
  description?: string
  cost: number
  service_date: string
  mechanic_name?: string
  mechanic_notes?: string
  km_at_service?: number
  service_type?: string
}

interface MaintenanceLogsTabProps {
  maintenance: MaintenanceLog[]
}

export default function MaintenanceLogsTab({ maintenance }: MaintenanceLogsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // In-memory search filtering
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return maintenance

    const term = searchQuery.toLowerCase()
    return maintenance.filter((m) => {
      const matchDesc = m.description?.toLowerCase().includes(term)
      const matchMechanic = m.mechanic_name?.toLowerCase().includes(term)
      const matchNotes = m.mechanic_notes?.toLowerCase().includes(term)
      const matchType = m.service_type?.toLowerCase().includes(term)
      
      return matchDesc || matchMechanic || matchNotes || matchType
    })
  }, [maintenance, searchQuery])

  // Formatting date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Format type labels
  const formatType = (type?: string) => {
    if (!type) return 'General Service'
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className={styles['tab-content']}>
      {/* Nested Tab Search */}
      <div className={styles['nested-search']}>
        <Search size={18} className={styles['nested-search-icon']} />
        <input
          type="text"
          className={styles['nested-search-input']}
          placeholder="Filter logs by service details, mechanic name, notes, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            type="button" 
            className={styles['search-clear']}
            onClick={() => setSearchQuery('')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Logs Feed */}
      <div className={styles['history-feed']}>
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className={`${styles['maint-card']} glass-panel`}>
              <div className={styles['maint-card-header']}>
                <div>
                  <span className={styles['maint-type-badge']}>
                    {formatType(log.service_type)}
                  </span>
                  <h4 className={styles['maint-description']} style={{ marginTop: '0.4rem' }}>
                    {log.description || 'Routine Maintenance'}
                  </h4>
                </div>
                <div className={styles['maint-cost']}>
                  -{Number(log.cost).toFixed(2)} DT
                </div>
              </div>

              <div className={styles['maint-meta-row']}>
                <div className={styles['maint-meta-item']}>
                  <Calendar size={12} />
                  <span>Service Date: <strong>{formatDate(log.service_date)}</strong></span>
                </div>
                
                {log.km_at_service && (
                  <div className={styles['maint-meta-item']}>
                    <Wrench size={12} />
                    <span>Odometer: <strong>{log.km_at_service.toLocaleString()} KM</strong></span>
                  </div>
                )}

                {log.mechanic_name && (
                  <div className={styles['maint-meta-item']}>
                    <User size={12} />
                    <span>Mechanic: <strong>{log.mechanic_name}</strong></span>
                  </div>
                )}
              </div>

              {log.mechanic_notes && (
                <div className={styles['maint-notes']}>
                  <strong>Mechanic notes:</strong> {log.mechanic_notes}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className={styles['empty-state']}>
            <Wrench className={styles['empty-state-icon']} />
            <p>No maintenance logs found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
