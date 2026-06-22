'use client'

import { useMemo } from 'react'
import { AlertTriangle, Clock, CreditCard, FileText, Calendar, CarFront } from 'lucide-react'
import styles from '../dashboard.module.css'
import { useLanguage } from '@/lib/i18n'

interface AlertStripProps {
  allBookings: any[]
  vehicleLegalDocs?: any[]
  vehicles?: any[]
  activeAlertFilter: 'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null
  setActiveAlertFilter: (val: 'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null) => void
}

export default function AlertStrip({
  allBookings = [],
  vehicleLegalDocs = [],
  vehicles = [],
  activeAlertFilter,
  setActiveAlertFilter
}: AlertStripProps) {
  const { lang } = useLanguage()

  const alerts = useMemo(() => {
    const activeAlerts = []
    const localToday = new Date()
    const yStr = localToday.getFullYear()
    const mStr = String(localToday.getMonth() + 1).padStart(2, '0')
    const dStr = String(localToday.getDate()).padStart(2, '0')
    const todayStr = `${yStr}-${mStr}-${dStr}`
    const todayObj = localToday

    // 1. Pickups Today (Cars Out Today)
    const pickupsToday = allBookings.filter(b => {
      if (b.status === 'cancelled') return false
      return b.start_date === todayStr
    })

    activeAlerts.push({
      id: 'pickups-today',
      type: 'pickups',
      icon: <CarFront size={18} />,
      title: lang === 'fr' ? "Départs Aujourd'hui" : 'Pickups Today',
      message: lang === 'fr'
        ? `${pickupsToday.length} véhicule(s) à récupérer aujourd'hui.`
        : `${pickupsToday.length} vehicle(s) going out today.`
    })

    // 2. Returns Today
    const returnsToday = allBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false
      return b.end_date === todayStr
    })

    activeAlerts.push({
      id: 'returns-today',
      type: 'info',
      icon: <Clock size={18} />,
      title: lang === 'fr' ? "Retours Aujourd'hui" : 'Returns Today',
      message: lang === 'fr'
        ? `${returnsToday.length} véhicule(s) de retour aujourd'hui.`
        : `${returnsToday.length} vehicle(s) arriving back today.`
    })

    // 3. Overdue Returns (Past end_date, not completed/cancelled)
    const overdueBookings = allBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false
      return b.end_date < todayStr
    })

    activeAlerts.push({
      id: 'overdue',
      type: 'danger',
      icon: <AlertTriangle size={18} />,
      title: lang === 'fr' ? 'Retours en Retard' : 'Overdue Returns',
      message: lang === 'fr'
        ? `${overdueBookings.length} véhicule(s) en retard de restitution.`
        : `${overdueBookings.length} vehicle(s) are overdue for return.`
    })

    // 3. Pending Payments / Reste > 0
    const pendingPayments = allBookings.filter(b => {
      if (b.status === 'cancelled') return false
      const total = Number(b.total_amount) || 0
      const baseAcompte = Number(b.acompte_paid) || 0
      const paidInstallmentsSum = (b.installments || [])
        .filter((t: any) => t.status === 'paid')
        .reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      const acompte = baseAcompte + paidInstallmentsSum
      return (total - acompte) > 0
    })

    if (pendingPayments.length > 0) {
      const totalReste = pendingPayments.reduce((sum, b) => {
        const baseAcompte = Number(b.acompte_paid) || 0
        const paidInstallmentsSum = (b.installments || [])
          .filter((t: any) => t.status === 'paid')
          .reduce((sumInst: number, item: any) => sumInst + (Number(item.amount) || 0), 0)
        const acompte = baseAcompte + paidInstallmentsSum
        return sum + (Number(b.total_amount) - acompte)
      }, 0)
      activeAlerts.push({
        id: 'pending-payments',
        type: 'warning',
        icon: <CreditCard size={18} />,
        title: lang === 'fr' ? 'Créances en Attente' : 'Pending Balances',
        message: lang === 'fr'
          ? `${pendingPayments.length} réservation(s) avec un reste dû de ${totalReste.toFixed(2)} DT.`
          : `${pendingPayments.length} booking(s) owe a total of ${totalReste.toFixed(2)} DT.`
      })
    }

    // 4. Expiring Legal Docs & Maintenance (Docs within 7 days, Maintenance within 1000km)
    const expiringDocs = vehicleLegalDocs.filter(doc => {
      if (!doc.expiry_date) return false
      const expDate = new Date(doc.expiry_date)
      const diffTime = expDate.getTime() - todayObj.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 7 && diffDays >= 0
    })

    const expiringMaintenance = vehicles.filter((car: any) => {
      const current = car.current_km || 0
      const nextOil = car.next_vidange_km || (car.last_vidange_km ? car.last_vidange_km + 10000 : null)
      const nextPads = car.next_pads_km || (car.last_pads_km ? car.last_pads_km + 30000 : null)
      
      const oilExpiring = nextOil ? (nextOil - current <= 1000) : false
      const padsExpiring = nextPads ? (nextPads - current <= 1000) : false
      
      return oilExpiring || padsExpiring
    })

    const totalExpiring = expiringDocs.length + expiringMaintenance.length

    if (totalExpiring > 0) {
      activeAlerts.push({
        id: 'expiring-docs',
        type: 'warning-doc',
        icon: <FileText size={18} />,
        title: lang === 'fr' ? 'Alertes Documents & Entretien' : 'Expiring Docs & Maintenance',
        message: lang === 'fr'
          ? `${totalExpiring} élément(s) requérant une attention immédiate (Docs/Méc).`
          : `${totalExpiring} item(s) requiring immediate attention (Docs/Mech).`
      })
    }

    // 5. Scheduled Tranches
    const scheduledTranches = allBookings.filter(b => b.installments && b.installments.length > 0)

    if (scheduledTranches.length > 0) {
      const unpaidTranches = scheduledTranches.reduce((sum, b) => {
        return sum + (b.installments.filter((inst: any) => inst.status !== 'paid').length || 0)
      }, 0)
      activeAlerts.push({
        id: 'tranches',
        type: 'tranches-info',
        icon: <Calendar size={18} />,
        title: lang === 'fr' ? 'Tranches Planifiées' : 'Scheduled Tranches',
        message: lang === 'fr'
          ? `${scheduledTranches.length} client(s) avec ${unpaidTranches} tranches en attente.`
          : `${scheduledTranches.length} client(s) with ${unpaidTranches} pending scheduled payments.`
      })
    }

    // 6. Latest 250 Bookings
    activeAlerts.push({
      id: 'latest-250',
      type: 'latest-info',
      icon: <Clock size={18} />,
      title: lang === 'fr' ? 'Dernières 250 Réservations' : 'Latest 250 Bookings',
      message: lang === 'fr'
        ? 'Affiche les 250 réservations les plus récemment ajoutées.'
        : 'Shows the 250 most recently added bookings.'
    })

    return activeAlerts
  }, [allBookings, vehicleLegalDocs, vehicles, lang])

  const filterMap: Record<string, 'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250'> = {
    'overdue': 'overdue',
    'returns-today': 'returns-today',
    'pickups-today': 'pickups-today',
    'pending-payments': 'balances',
    'expiring-docs': 'expiring',
    'tranches': 'tranches',
    'latest-250': 'latest-250'
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
        } else if (alert.type === 'tranches-info') {
          bgColor = 'rgba(168, 85, 247, 0.1)'
          borderColor = 'rgba(168, 85, 247, 0.3)'
          iconColor = '#a855f7'
        } else if (alert.type === 'pickups') {
          bgColor = 'rgba(16, 185, 129, 0.1)'
          borderColor = 'rgba(16, 185, 129, 0.3)'
          iconColor = '#10b981'
        } else if (alert.type === 'latest-info') {
          bgColor = 'rgba(229, 193, 125, 0.08)'
          borderColor = 'rgba(229, 193, 125, 0.25)'
          iconColor = 'var(--accent-gold)'
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
