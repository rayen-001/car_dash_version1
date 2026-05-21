'use client'

import { useMemo } from 'react'
import { AlertTriangle, Clock, CreditCard, FileText } from 'lucide-react'
import styles from '../dashboard.module.css'

interface AlertStripProps {
  allBookings: any[]
  vehicleLegalDocs?: any[]
  vehicles?: any[]
  activeAlertFilter: 'overdue' | 'balances' | 'expiring' | null
  setActiveAlertFilter: (val: 'overdue' | 'balances' | 'expiring' | null) => void
}

export default function AlertStrip({
  allBookings = [],
  vehicleLegalDocs = [],
  vehicles = [],
  activeAlertFilter,
  setActiveAlertFilter
}: AlertStripProps) {
  const alerts = useMemo(() => {
    const activeAlerts = []
    const todayStr = new Date().toISOString().split('T')[0]
    const todayObj = new Date()

    // 1. Overdue Returns (Past end_date, not completed/cancelled)
    const overdueBookings = allBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false
      return b.end_date < todayStr
    })
    
    if (overdueBookings.length > 0) {
      activeAlerts.push({
        id: 'overdue',
        type: 'danger',
        icon: <AlertTriangle size={18} />,
        title: 'Overdue Returns',
        message: `${overdueBookings.length} vehicle(s) are overdue for return.`
      })
    }

    // 2. Returns Today
    const returnsToday = allBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false
      return b.end_date === todayStr
    })

    if (returnsToday.length > 0) {
      activeAlerts.push({
        id: 'returns-today',
        type: 'info',
        icon: <Clock size={18} />,
        title: 'Returns Today',
        message: `${returnsToday.length} vehicle(s) arriving back today.`
      })
    }

    // 3. Pending Payments / Reste > 0
    const pendingPayments = allBookings.filter(b => {
      if (b.status === 'cancelled') return false
      const total = Number(b.total_amount) || 0
      const acompte = Number(b.acompte_paid) || 0
      return (total - acompte) > 0
    })

    if (pendingPayments.length > 0) {
      const totalReste = pendingPayments.reduce((sum, b) => sum + (Number(b.total_amount) - Number(b.acompte_paid)), 0)
      activeAlerts.push({
        id: 'pending-payments',
        type: 'warning',
        icon: <CreditCard size={18} />,
        title: 'Pending Balances',
        message: `${pendingPayments.length} booking(s) owe a total of ${totalReste.toFixed(2)} DT.`
      })
    }

    // 4. Expiring Legal Docs (Within 7 days)
    const expiringDocs = vehicleLegalDocs.filter(doc => {
      if (!doc.expiry_date) return false
      const expDate = new Date(doc.expiry_date)
      const diffTime = expDate.getTime() - todayObj.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 7 && diffDays >= 0
    })

    if (expiringDocs.length > 0) {
      activeAlerts.push({
        id: 'expiring-docs',
        type: 'warning-doc',
        icon: <FileText size={18} />,
        title: 'Expiring Documents',
        message: `${expiringDocs.length} legal document(s) expiring within 7 days.`
      })
    }

    return activeAlerts
  }, [allBookings, vehicleLegalDocs])

  const filterMap: Record<string, 'overdue' | 'balances' | 'expiring'> = {
    'overdue': 'overdue',
    'pending-payments': 'balances',
    'expiring-docs': 'expiring'
  }

  if (alerts.length === 0) return null

  return (
    <div className={styles['alert-strip-container']} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
      {alerts.map(alert => {
        let bgColor = 'rgba(229, 193, 125, 0.05)'
        let borderColor = 'rgba(229, 193, 125, 0.2)'
        let iconColor = 'var(--accent-gold)'
        
        if (alert.type === 'danger') {
          bgColor = 'rgba(239, 68, 68, 0.1)'
          borderColor = 'rgba(239, 68, 68, 0.3)'
          iconColor = '#ef4444'
        } else if (alert.type === 'warning' || alert.type === 'warning-doc') {
          bgColor = 'rgba(245, 158, 11, 0.1)'
          borderColor = 'rgba(245, 158, 11, 0.3)'
          iconColor = '#f59e0b'
        } else if (alert.type === 'info') {
          bgColor = 'rgba(56, 189, 248, 0.1)'
          borderColor = 'rgba(56, 189, 248, 0.3)'
          iconColor = '#38bdf8'
        }

        const filterKey = filterMap[alert.id]
        const isActive = filterKey && activeAlertFilter === filterKey

        let cardBorder = `1px solid ${borderColor}`
        let cardBoxShadow = 'none'

        if (isActive) {
          cardBorder = '1px solid #E5C17D'
          cardBoxShadow = '0 0 15px rgba(229, 193, 125, 0.4)'
        }

        return (
          <div
            key={alert.id}
            className="glass-panel"
            onClick={() => {
              if (filterKey) {
                setActiveAlertFilter(isActive ? null : filterKey)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1.25rem',
              background: bgColor,
              border: cardBorder,
              boxShadow: cardBoxShadow,
              borderRadius: '12px',
              cursor: filterKey ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ color: iconColor, marginTop: '0.1rem' }}>
              {alert.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <strong style={{ color: '#fff', fontSize: '0.95rem', letterSpacing: '0.5px' }}>{alert.title}</strong>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: '1.4' }}>{alert.message}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
