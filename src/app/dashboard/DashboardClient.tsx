'use client'

import { useState } from 'react'
import styles from './dashboard.module.css'
import DashboardStats from './components/DashboardStats'
import DashboardCalendar from './components/DashboardCalendar'
import DashboardCharts from './components/DashboardCharts'
import TodayOperations from './components/TodayOperations'
import AlertStrip from './components/AlertStrip'
import GlobalCommandSearch from './components/GlobalCommandSearch'
import FleetPerformanceMatrix from './components/FleetPerformanceMatrix'
import { Landmark, ArrowDownRight, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

interface DashboardClientProps {
  stats: {
    revenueYTD: number
    expensesYTD: number
    netProfitYTD: number
    fleetSize: number
    activeRentals: number
    utilizationRate: number
    outstandingLiabilities: number
    riskSignalsCount: number
    targetYear: number
  }
  recentBookings: any[]
  vehicles?: any[]
  allBookings?: any[]
  vehicleLegalDocs?: any[]
  expenses?: any[]
  maintenance?: any[]
}

export default function DashboardClient({
  stats,
  recentBookings,
  vehicles = [],
  allBookings = [],
  vehicleLegalDocs = [],
  expenses = [],
  maintenance = []
}: DashboardClientProps) {
  const { t, lang } = useLanguage()
  // 1. Shared state for interactive operational alert drilling
  const [activeAlertFilter, setActiveAlertFilter] = useState<'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null>(null)

  // 2. Strict Cash-Basis Daily Shift Reconciliation Engine (May 21, 2026 Handover)
  const localToday = new Date()
  const yStr = localToday.getFullYear()
  const mStr = String(localToday.getMonth() + 1).padStart(2, '0')
  const dStr = String(localToday.getDate()).padStart(2, '0')
  const todayDateString = `${yStr}-${mStr}-${dStr}`

  const matchToday = (dateField?: string) => {
    if (!dateField) return false
    if (dateField.startsWith(todayDateString)) return true
    const d = new Date(dateField)
    return (
      d.getFullYear() === localToday.getFullYear() &&
      (d.getMonth() + 1) === (localToday.getMonth() + 1) &&
      d.getDate() === localToday.getDate()
    )
  }

  // Daily Cash Intake (strictly collected upfront deposit collections paid today)
  const dailyCashIntake = allBookings
    .filter(b => matchToday(b.created_at))
    .reduce((sum, b) => sum + (Number(b.acompte_paid) || 0), 0)

  // Daily Expenses (strictly cash/bank outflows committed today)
  const dailyExpensesOutflow = expenses
    .filter(e => matchToday(e.created_at))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const dailyMaintenanceOutflow = maintenance
    .filter(m => matchToday(m.service_date) || matchToday(m.created_at))
    .reduce((sum, m) => sum + (Number(m.cost) || 0), 0)

  const totalDailyExpenses = dailyExpensesOutflow + dailyMaintenanceOutflow
  const netCashPosition = dailyCashIntake - totalDailyExpenses

  return (
    <div className={styles['owner-dashboard']}>
      <div className={styles['header-section']} style={{ position: 'relative', overflow: 'visible' }}>
        <h1 className={styles['page-title']}>{t('dashboard.title')}</h1>
        <p className={styles['subtitle']}>{t('dashboard.subtitle')}</p>

        {/* Beautiful Dotted Gold World Map Watermark matching reference photo */}
        <svg className={styles['world-map-watermark']} viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
          position: 'absolute',
          top: '-30px',
          right: '20px',
          width: '420px',
          height: '160px',
          opacity: 0.12,
          pointerEvents: 'none',
          zIndex: 1
        }}>
          <g fill="#C5A059">
            {/* North America */}
            <circle cx="80" cy="80" r="3" /><circle cx="100" cy="70" r="3" /><circle cx="120" cy="75" r="3" />
            <circle cx="90" cy="95" r="3" /><circle cx="110" cy="90" r="3" /><circle cx="130" cy="85" r="3" />
            <circle cx="100" cy="115" r="3" /><circle cx="120" cy="110" r="3" /><circle cx="140" cy="105" r="3" />
            <circle cx="150" cy="120" r="3" /><circle cx="170" cy="130" r="3" /><circle cx="190" cy="125" r="3" />

            {/* South America */}
            <circle cx="210" cy="190" r="3" /><circle cx="230" cy="205" r="3" /><circle cx="220" cy="225" r="3" />
            <circle cx="240" cy="245" r="3" /><circle cx="250" cy="265" r="3" /><circle cx="260" cy="285" r="3" />

            {/* Europe */}
            <circle cx="420" cy="70" r="3" /><circle cx="440" cy="65" r="3" /><circle cx="460" cy="75" r="3" />
            <circle cx="430" cy="90" r="3" /><circle cx="450" cy="85" r="3" /><circle cx="470" cy="95" r="3" />

            {/* Africa */}
            <circle cx="450" cy="150" r="3" /><circle cx="470" cy="165" r="3" /><circle cx="460" cy="185" r="3" />
            <circle cx="480" cy="205" r="3" /><circle cx="490" cy="225" r="3" /><circle cx="510" cy="245" r="3" />
            <circle cx="520" cy="265" r="3" />

            {/* Asia */}
            <circle cx="620" cy="60" r="3" /><circle cx="640" cy="55" r="3" /><circle cx="660" cy="65" r="3" />
            <circle cx="630" cy="80" r="3" /><circle cx="650" cy="75" r="3" /><circle cx="670" cy="85" r="3" />
            <circle cx="690" cy="90" r="3" /><circle cx="710" cy="95" r="3" /><circle cx="730" cy="100" r="3" />
            <circle cx="660" cy="115" r="3" /><circle cx="680" cy="110" r="3" /><circle cx="700" cy="120" r="3" />
            <circle cx="720" cy="130" r="3" /><circle cx="740" cy="140" r="3" /><circle cx="760" cy="135" r="3" />

            {/* Australia */}
            <circle cx="780" cy="240" r="3" /><circle cx="800" cy="250" r="3" /><circle cx="790" cy="265" r="3" />
            <circle cx="810" cy="280" r="3" />
          </g>
        </svg>
      </div>

      <GlobalCommandSearch
        allBookings={allBookings}
        activeAlertFilter={activeAlertFilter}
        setActiveAlertFilter={setActiveAlertFilter}
        vehicleLegalDocs={vehicleLegalDocs}
        vehicles={vehicles}
      />

      <AlertStrip
        allBookings={allBookings}
        vehicles={vehicles}
        vehicleLegalDocs={vehicleLegalDocs}
        activeAlertFilter={activeAlertFilter}
        setActiveAlertFilter={setActiveAlertFilter}
      />

      {/* ── DAILY SHIFT RECONCILIATION LEDGER WIDGET (Premium Glassmorphic) ── */}
      <div className="glass-panel" style={{
        padding: '1.75rem 2rem',
        background: 'rgba(10, 8, 7, 0.85)',
        border: '1px solid rgba(229, 193, 125, 0.15)',
        borderRadius: '16px',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(0, 0, 0, 0.95)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top & Bottom Glowing Golden Caps matching stat-card standard */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, transparent 10%, var(--accent-gold-hover) 50%, transparent 90%)',
          boxShadow: '0 0 15px var(--accent-gold-hover)', opacity: 0.75
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, transparent 10%, var(--accent-gold-hover) 50%, transparent 90%)',
          boxShadow: '0 0 15px var(--accent-gold-hover)', opacity: 0.75
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(229,193,125,0.08)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold-deep) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(229,193,125,0.2)'
            }}>
              <Landmark size={18} style={{ color: '#1a1410' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                {t('dashboard.reconciliationLedger')}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'rgba(229, 193, 125, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('dashboard.reconciliationSubtitle')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(229,193,125,0.1)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontSize: '0.8rem', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>
              {t('dashboard.auditDate')}: {localToday.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {/* Daily Cash Intake (Inflow) */}
          <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.12)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(16, 185, 129, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('dashboard.dailyIntake')}
              </span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><ArrowUpRight size={14} /></span>
            </div>
            <strong style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)', color: '#10b981', letterSpacing: '-0.02em', fontWeight: 600 }}>
              + {dailyCashIntake.toFixed(2)} DT
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
              {t('dashboard.dailyIntakeDesc')}
            </span>
          </div>

          {/* Daily Expenses (Outflow) */}
          <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.12)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(239, 68, 68, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('dashboard.dailyExpenses')}
              </span>
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowDownRight size={14} /></span>
            </div>
            <strong style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)', color: '#ef4444', letterSpacing: '-0.02em', fontWeight: 600 }}>
              - {totalDailyExpenses.toFixed(2)} DT
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
              {t('dashboard.dailyExpensesDesc')}
            </span>
          </div>

          {/* Expected Drawer Balance (Net Cash Position) */}
          <div style={{
            background: 'rgba(229, 193, 125, 0.04)',
            border: '1px dashed rgba(229, 193, 125, 0.3)',
            padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('dashboard.netExpectedCash')}
              </span>
              <span style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}><ShieldCheck size={14} /></span>
            </div>
            <strong style={{ fontSize: '1.85rem', fontFamily: 'var(--font-heading)', color: '#fff', textShadow: '0 0 15px rgba(229, 193, 125, 0.25)', letterSpacing: '-0.03em', fontWeight: 800 }}>
              {netCashPosition.toFixed(2)} DT
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 500 }}>
              {t('dashboard.netExpectedCashDesc')}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <DashboardStats stats={stats} />

      <TodayOperations allBookings={allBookings} />

      <DashboardCharts recentBookings={recentBookings} allBookings={allBookings} expenses={expenses} maintenance={maintenance} />

      <FleetPerformanceMatrix 
        vehicles={vehicles} 
        allBookings={allBookings} 
        expenses={expenses} 
        maintenance={maintenance} 
        vehicleLegalDocs={vehicleLegalDocs} 
      />

      <DashboardCalendar vehicles={vehicles} allBookings={allBookings} />
    </div>
  )
}

