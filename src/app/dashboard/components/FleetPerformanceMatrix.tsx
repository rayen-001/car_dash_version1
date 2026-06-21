import { useMemo } from 'react'
import styles from '../dashboard.module.css'
import { AlertCircle, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

interface FleetPerformanceMatrixProps {
  vehicles: any[]
  allBookings: any[]
  expenses: any[]
  maintenance: any[]
  vehicleLegalDocs: any[]
  selectedYear: number
}

export default function FleetPerformanceMatrix({
  vehicles = [],
  allBookings = [],
  expenses = [],
  maintenance = [],
  vehicleLegalDocs = [],
  selectedYear
}: FleetPerformanceMatrixProps) {
  const { t, lang } = useLanguage()

  const currentYear = selectedYear
  const currentYearPrefix = `${currentYear}-`

  const topAssets = useMemo(() => {
    const vehicleYields: Record<string, { inflows: number; outflows: number; netYield: number; vehicle: any }> = {}

    vehicles.forEach(v => {
      vehicleYields[v.id] = { inflows: 0, outflows: 0, netYield: 0, vehicle: v }
    })

    const PAID_STATUSES = ['confirmed', 'completed']

    // Aggregate current-year Inflows
    allBookings.forEach(b => {
      if (b.vehicle_id && vehicleYields[b.vehicle_id]) {
        const status = (b.status || '').toLowerCase()
        if (PAID_STATUSES.includes(status)) {
          const bDateStr = b.start_date || b.created_at
          if (bDateStr && bDateStr.startsWith(currentYearPrefix)) {
            const totalAmount = Number(b.total_amount) || 0
            vehicleYields[b.vehicle_id].inflows += totalAmount
          }
        }
      }
    })

    // Aggregate current-year Outflows (Expenses)
    expenses.forEach(e => {
      if (e.vehicle_id && vehicleYields[e.vehicle_id]) {
        const eDateStr = e.created_at
        if (eDateStr && eDateStr.startsWith(currentYearPrefix)) {
          const isClaim = ['damage_repair', 'installment_tranche', 'late_return_penalty'].includes(e.category)
          if (!isClaim) {
            vehicleYields[e.vehicle_id].outflows += (Number(e.amount) || 0)
          }
        }
      }
    })

    // Aggregate current-year Outflows (Maintenance)
    maintenance.forEach(m => {
      if (m.vehicle_id && vehicleYields[m.vehicle_id]) {
        const mDateStr = m.service_date || m.created_at
        if (mDateStr && mDateStr.startsWith(currentYearPrefix)) {
          vehicleYields[m.vehicle_id].outflows += (Number(m.cost) || 0)
        }
      }
    })

    // Calculate Net Yield
    Object.keys(vehicleYields).forEach(vid => {
      vehicleYields[vid].netYield = vehicleYields[vid].inflows - vehicleYields[vid].outflows
    })

    // Sort and take top 3
    return Object.values(vehicleYields)
      .sort((a, b) => b.netYield - a.netYield)
      .slice(0, 3)
  }, [vehicles, allBookings, expenses, maintenance, currentYearPrefix])

  const emergencies = useMemo(() => {
    const alerts: { id: string; type: 'overdue' | 'doc_critical' | 'doc_warning'; title: string; subtitle: string; urgency: number }[] = []

    const todayObj = new Date()
    const todayTime = todayObj.getTime()
    const yStr = todayObj.getFullYear()
    const mStr = String(todayObj.getMonth() + 1).padStart(2, '0')
    const dStr = String(todayObj.getDate()).padStart(2, '0')
    const todayStr = `${yStr}-${mStr}-${dStr}`

    // 1. Overdue Rentals (Highest Urgency)
    allBookings.forEach(b => {
      if ((b.status || '').toLowerCase() === 'confirmed' && b.end_date < todayStr) {
        const clientName = b.clients?.full_name || 'Unknown Client'
        const clientInitials = clientName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        alerts.push({
          id: `overdue-${b.id}`,
          type: 'overdue',
          title: lang === 'fr' 
            ? `Retour en Retard : ${b.vehicles?.brand} ${b.vehicles?.model}`
            : `Overdue Return: ${b.vehicles?.brand} ${b.vehicles?.model}`,
          subtitle: lang === 'fr'
            ? `Client ${clientInitials} - Prévu le ${b.end_date}`
            : `Client ${clientInitials} - Expected ${b.end_date}`,
          urgency: 3
        })
      }
    })

    // 2. Expiring Docs
    vehicleLegalDocs.forEach(doc => {
      if (doc.expiry_date) {
        const diffTime = new Date(doc.expiry_date).getTime() - todayTime
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        const v = vehicles.find(veh => veh.id === doc.vehicle_id)
        const vName = v ? `${v.brand} ${v.model}` : 'Unknown Vehicle'

        if (diffDays <= 7 && diffDays >= 0) {
          alerts.push({
            id: `doc-crit-${doc.id}`,
            type: 'doc_critical',
            title: lang === 'fr' ? `Critique : Expiration ${doc.doc_type}` : `Critical: ${doc.doc_type} Expiring`,
            subtitle: lang === 'fr' ? `${vName} - Dans ${diffDays} jour(s)` : `${vName} - In ${diffDays} day(s)`,
            urgency: 2
          })
        } else if (diffDays <= 30 && diffDays > 7) {
          alerts.push({
            id: `doc-warn-${doc.id}`,
            type: 'doc_warning',
            title: lang === 'fr' ? `Attention : Expiration ${doc.doc_type}` : `Warning: ${doc.doc_type} Expiring`,
            subtitle: lang === 'fr' ? `${vName} - Dans ${diffDays} jours` : `${vName} - In ${diffDays} days`,
            urgency: 1
          })
        } else if (diffDays < 0) {
           alerts.push({
            id: `doc-exp-${doc.id}`,
            type: 'doc_critical',
            title: lang === 'fr' ? `EXPIRÉ : ${doc.doc_type}` : `EXPIRED: ${doc.doc_type}`,
            subtitle: lang === 'fr'
              ? `${vName} - Expiré il y a ${Math.abs(diffDays)} jours`
              : `${vName} - Expired ${Math.abs(diffDays)} days ago`,
            urgency: 3
          })
        }
      }
    })

    return alerts.sort((a, b) => b.urgency - a.urgency).slice(0, 5)
  }, [allBookings, vehicleLegalDocs, vehicles, lang])

  return (
    <div className={styles['main-grid']}>
      {/* Left Column: High-Yield Assets Leaderboard */}
      <div className={`${styles['recent-activity']} glass-panel`} style={{ padding: '1.5rem' }}>
        <div className={styles['section-header']} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3>{t('dashboard.topAssets')}</h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {currentYear} {t('dashboard.netProfitPerformers')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {topAssets.map((asset, i) => {
            const licenseParts = asset.vehicle?.license_plate ? asset.vehicle.license_plate.split(' ') : ['000', 'TU', '0000']
            const leftPlate = licenseParts[0] || '000'
            const rightPlate = licenseParts[2] || '0000'

            return (
              <div key={asset.vehicle?.id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(229,193,125,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(229,193,125,0.2) 0%, rgba(229,193,125,0.05) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(229,193,125,0.2)', color: '#E5C17D', fontWeight: 800, fontSize: '0.85rem'
                  }}>
                    #{i + 1}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Tunisian Plate Miniature */}
                      <div style={{
                        display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #444',
                        borderRadius: '4px', overflow: 'hidden', height: 20, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.65rem'
                      }}>
                        <div style={{ padding: '0 4px', color: '#fff' }}>{leftPlate}</div>
                        <div style={{ background: '#E5C17D', color: '#000', padding: '0 4px' }}>TU</div>
                        <div style={{ padding: '0 4px', color: '#fff' }}>{rightPlate}</div>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{asset.vehicle?.brand} {asset.vehicle?.model}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <span style={{ color: '#10B981', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
                    + {asset.netYield.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                    {asset.inflows} In / {asset.outflows} Out
                  </span>
                </div>
              </div>
            )
          })}
          {topAssets.length === 0 && (
            <div className="text-center py-4 text-muted">
              {lang === 'fr' 
                ? `Aucune donnée de performance disponible pour ${currentYear}.`
                : `No ${currentYear} performance data available yet.`
              }
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Immediate Fleet Actions */}
      <div className={`${styles['recent-activity']} glass-panel`} style={{ padding: '1.5rem', background: 'rgba(10, 8, 7, 0.95)' }}>
        <div className={styles['section-header']} style={{ marginBottom: '1.5rem' }}>
           <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} style={{ color: '#EF4444' }} /> {t('dashboard.immediateInterventions')}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('dashboard.prioritizedEmergency')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {emergencies.map((alert, i) => {
            const isCritical = alert.urgency >= 2
            const accentColor = isCritical ? '#EF4444' : '#E5C17D'
            const bgGradient = isCritical
              ? 'linear-gradient(90deg, rgba(239,68,68,0.05) 0%, transparent 100%)'
              : 'linear-gradient(90deg, rgba(229,193,125,0.05) 0%, transparent 100%)'

            return (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1rem', background: bgGradient, borderRadius: '8px',
                borderLeft: `3px solid ${accentColor}`, borderTop: '1px solid rgba(255,255,255,0.03)',
                borderRight: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ marginTop: '2px' }}>
                    {isCritical ? <AlertTriangle size={16} color={accentColor} /> : <AlertCircle size={16} color={accentColor} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isCritical ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                      {alert.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      {alert.subtitle}
                    </span>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            )
          })}
          {emergencies.length === 0 && (
            <div className="text-center py-4 text-muted" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={16} style={{ color: '#10B981' }} />
              </div>
              <span>{t('dashboard.noPendingEmergencies')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
