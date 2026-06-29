'use client'

import { useState, useMemo, useEffect } from 'react'
import styles from './dashboard.module.css'
import DashboardStats from './components/DashboardStats'
import DashboardCalendar from './components/DashboardCalendar'
import DashboardCharts from './components/DashboardCharts'
import VehicleSearchDropdown from './components/VehicleSearchDropdown'

import AlertStrip from './components/AlertStrip'
import GlobalCommandSearch from './components/GlobalCommandSearch'
import FleetPerformanceMatrix from './components/FleetPerformanceMatrix'
import { Landmark, ArrowDownRight, ArrowUpRight, ShieldCheck, TrendingUp } from 'lucide-react'
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
  // Local reactive bookings state
  const [localBookings, setLocalBookings] = useState<any[]>(allBookings)
  useEffect(() => {
    setLocalBookings(allBookings)
  }, [allBookings])

  // 1. Shared state for interactive operational alert drilling
  const [activeAlertFilter, setActiveAlertFilter] = useState<'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null>(null)

  // 2. State for vehicle filtering
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')

  // 3. Shared state for operations center date period filtering
  const [operationDateFrom, setOperationDateFrom] = useState<string>('')
  const [operationDateTo, setOperationDateTo] = useState<string>('')

  // 3. Dynamic Year Selection and Calculations based on owner account data
  const defaultYear = useMemo(() => {
    const sysYear = new Date().getFullYear()
    if (localBookings && localBookings.length > 0) {
      const hasSysYear = localBookings.some(b => {
        const dateStr = b.start_date || b.created_at
        return dateStr && dateStr.startsWith(`${sysYear}-`)
      })
      if (hasSysYear) {
        return sysYear
      }
      let maxYear = 0
      localBookings.forEach(b => {
        const dateStr = b.start_date || b.created_at
        if (dateStr) {
          const yr = parseInt(dateStr.substring(0, 4))
          if (yr && yr > maxYear) {
            maxYear = yr
          }
        }
      })
      if (maxYear > 0) return maxYear
    }
    return sysYear
  }, [localBookings])

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)

  useEffect(() => {
    setSelectedYear(defaultYear)
  }, [defaultYear])

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>()
    const currentCalendarYear = new Date().getFullYear()
    yearsSet.add(currentCalendarYear)
    
    localBookings.forEach(b => {
      const dateStr = b.start_date || b.created_at
      if (dateStr) {
        const yr = parseInt(dateStr.substring(0, 4))
        if (yr) yearsSet.add(yr)
      }
    })
    
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [localBookings])

  // Filter arrays based on selected vehicle
  const filteredBookingsForVehicle = useMemo(() => {
    if (selectedVehicleId === 'all') return localBookings
    return localBookings.filter(b => b.vehicle_id === selectedVehicleId)
  }, [localBookings, selectedVehicleId])

  const filteredExpensesForVehicle = useMemo(() => {
    if (selectedVehicleId === 'all') return expenses
    return expenses.filter(e => e.vehicle_id === selectedVehicleId)
  }, [expenses, selectedVehicleId])

  const filteredMaintenanceForVehicle = useMemo(() => {
    if (selectedVehicleId === 'all') return maintenance
    return maintenance.filter(m => m.vehicle_id === selectedVehicleId)
  }, [maintenance, selectedVehicleId])

  const dynamicStats = useMemo(() => {
    let revenueYTD = 0
    let expensesYTD = 0
    let outstandingLiabilities = 0
    let activeRentals = 0
    let riskSignalsCount = 0

    const targetYear = selectedYear
    const today = new Date().toISOString().split('T')[0]

    // Determine vehicles to count for fleetSize
    const targetVehicles = selectedVehicleId === 'all' 
      ? vehicles 
      : vehicles.filter(v => v.id === selectedVehicleId)
    const targetVehicleIds = new Set(targetVehicles.map(v => v.id))
    const fleetSize = targetVehicles.length

    filteredBookingsForVehicle.forEach((booking) => {
      const status = (booking.status || '').toLowerCase()
      const isConfirmed = status === 'confirmed'
      const isCompleted = status === 'completed'

      if (isConfirmed || isCompleted) {
        const totalAmount = Number(booking.total_amount) || 0
        const acomptePaid = Number(booking.acompte_paid) || 0
        let paidInstallments = 0

        if (booking.installments && Array.isArray(booking.installments)) {
          booking.installments.forEach((inst: any) => {
            if (inst.status === 'paid') {
              paidInstallments += Number(inst.amount) || 0
            }
          })
        }

        const remaining = totalAmount - acomptePaid - paidInstallments
        if (remaining > 0) {
          outstandingLiabilities += remaining
        }

        // Cash-basis YTD revenue
        const acompteDateStr = booking.acompte_paid_date || booking.created_at
        const acompteYear = acompteDateStr ? new Date(acompteDateStr).getFullYear() : 0
        if (acompteYear === targetYear && acomptePaid > 0) {
          revenueYTD += acomptePaid
        }

        if (booking.installments && Array.isArray(booking.installments)) {
          booking.installments.forEach((inst: any) => {
            if (inst.status === 'paid') {
              const instAmt = Number(inst.amount) || 0
              const instDateStr = inst.paid_date || inst.due_date
              const instYear = instDateStr ? new Date(instDateStr).getFullYear() : 0
              if (instYear === targetYear) {
                revenueYTD += instAmt
              }
            }
          })
        }
      }

      if (isConfirmed && booking.start_date <= today && booking.end_date >= today && targetVehicleIds.has(booking.vehicle_id)) {
        activeRentals++
      }

      if (isConfirmed && booking.end_date < today && targetVehicleIds.has(booking.vehicle_id)) {
        riskSignalsCount++
      }
    })

    // Expenses YTD
    filteredExpensesForVehicle.forEach((e) => {
      const eDateStr = e.created_at
      const eYear = eDateStr ? new Date(eDateStr).getFullYear() : 0
      const isClaim = ['damage_repair', 'installment_tranche', 'late_return_penalty'].includes(e.category)
      if (!isClaim && eYear === targetYear) {
        expensesYTD += Number(e.amount) || 0
      }
    })

    // All stats must count expenses only. Outflows are not calculated as expenses + maintenance.
    // Mirrored maintenance expenses are already counted in the expenses table.

    // Legal docs warnings count
    const targetLegalDocs = vehicleLegalDocs.filter(doc => targetVehicleIds.has(doc.vehicle_id))
    targetLegalDocs.forEach((doc: any) => {
      if (doc.expiry_date) {
        const diffTime = new Date(doc.expiry_date).getTime() - new Date(today).getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 30) {
          riskSignalsCount++
        }
      }
    })

    const netProfitYTD = revenueYTD - expensesYTD
    const utilizationRate = fleetSize > 0 ? (activeRentals / fleetSize) * 100 : 0

    return {
      revenueYTD,
      expensesYTD,
      netProfitYTD,
      fleetSize,
      activeRentals,
      utilizationRate,
      outstandingLiabilities,
      riskSignalsCount,
      targetYear: selectedYear
    }
  }, [filteredBookingsForVehicle, filteredExpensesForVehicle, filteredMaintenanceForVehicle, selectedYear, vehicles, vehicleLegalDocs, selectedVehicleId])

  // 4. Strict Cash-Basis Daily Shift Reconciliation Engine
  const [ledgerDateStr, setLedgerDateStr] = useState<string>(() => {
    const today = new Date()
    const yStr = today.getFullYear()
    const mStr = String(today.getMonth() + 1).padStart(2, '0')
    const dStr = String(today.getDate()).padStart(2, '0')
    return `${yStr}-${mStr}-${dStr}`
  })

  const matchLedgerDate = (dateField?: string) => {
    if (!dateField) return false
    if (dateField.startsWith(ledgerDateStr)) return true
    
    const d = new Date(dateField)
    if (isNaN(d.getTime())) return false

    const parts = ledgerDateStr.split('-')
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const dy = parseInt(parts[2], 10)
      return (
        d.getFullYear() === y &&
        (d.getMonth() + 1) === m &&
        d.getDate() === dy
      )
    }
    return false
  }

  // Daily Cash Intake (strictly collected upfront deposit collections paid on selected date)
  const dailyCashIntake = filteredBookingsForVehicle
    .filter(b => matchLedgerDate(b.acompte_paid_date || b.created_at))
    .reduce((sum, b) => sum + (Number(b.acompte_paid) || 0), 0)

  // Daily Expenses (strictly cash/bank outflows committed on selected date)
  const dailyExpensesOutflow = filteredExpensesForVehicle
    .filter(e => matchLedgerDate(e.created_at))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  // All stats must count expenses only. Outflows are not calculated as expenses + maintenance.
  const totalDailyExpenses = dailyExpensesOutflow
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
        allBookings={localBookings}
        setAllBookings={setLocalBookings}
        activeAlertFilter={activeAlertFilter}
        setActiveAlertFilter={setActiveAlertFilter}
        vehicleLegalDocs={vehicleLegalDocs}
        vehicles={vehicles}
        operationDateFrom={operationDateFrom}
        setOperationDateFrom={setOperationDateFrom}
        operationDateTo={operationDateTo}
        setOperationDateTo={setOperationDateTo}
      />

      <AlertStrip
        allBookings={localBookings}
        vehicles={vehicles}
        vehicleLegalDocs={vehicleLegalDocs}
        activeAlertFilter={activeAlertFilter}
        setActiveAlertFilter={setActiveAlertFilter}
        operationDateFrom={operationDateFrom}
        operationDateTo={operationDateTo}
      />

      {/* ── FINANCIAL HUB SECTION HEADER with Year Selector ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '0.5rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid rgba(229,193,125,0.1)',
        paddingBottom: '0.75rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold-deep) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(229,193,125,0.2)'
          }}>
            <TrendingUp size={16} style={{ color: '#1a1410' }} />
          </div>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '-0.01em'
          }}>
            {lang === 'fr' ? 'Analyses & Performances Financières' : 'Financial Analytics & Performance'}
          </h2>
        </div>

        {/* Premium Vehicle Selector Dropdown */}
        <div className="no-print" style={{ zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            {lang === 'fr' ? 'Véhicule :' : 'Vehicle :'}
          </span>
          <VehicleSearchDropdown
            vehicles={vehicles || []}
            selectedVehicleId={selectedVehicleId}
            onChange={setSelectedVehicleId}
            lang={lang}
            placeholderAll={lang === 'fr' ? 'Tous les véhicules' : 'All Vehicles'}
            width="220px"
          />
        </div>

        {/* Premium Year Selector Dropdown */}
        <div className="no-print" style={{ zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            {lang === 'fr' ? 'Année :' : 'Year :'}
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              background: 'rgba(20, 16, 14, 0.95)',
              border: '1px solid rgba(229, 193, 125, 0.3)',
              borderRadius: '8px',
              color: '#fff',
              padding: '0.4rem 2rem 0.4rem 0.8rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23E5C17D%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.8rem top 50%',
              backgroundSize: '0.65rem auto',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
          >
            {availableYears.map(yr => (
              <option key={yr} value={yr} style={{ background: '#111', color: '#fff' }}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── FINANCIAL HUB MAIN GRID ── */}
      <div className={styles['main-grid']} style={{ marginBottom: '1rem' }}>
        {/* Left Column: Stats Cards */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <DashboardStats stats={dynamicStats} />
        </div>

        {/* Right Column: Daily Shift Reconciliation Ledger */}
        <div className="glass-panel" style={{
          padding: '1.5rem',
          background: 'rgba(10, 8, 7, 0.85)',
          border: '1px solid rgba(229, 193, 125, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(0, 0, 0, 0.95)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Top & Bottom Glowing Golden Caps */}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid rgba(229,193,125,0.08)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, var(--accent-gold-hover) 0%, var(--accent-gold-deep) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(229,193,125,0.2)'
              }}>
                <Landmark size={15} style={{ color: '#1a1410' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                  {t('dashboard.reconciliationLedger')}
                </h4>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              background: 'rgba(255,255,255,0.03)', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '6px', 
              border: '1px solid rgba(229,193,125,0.15)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(229,193,125,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(229,193,125,0.15)'
            }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
              <input 
                type="date"
                value={ledgerDateStr}
                onChange={(e) => setLedgerDateStr(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  margin: 0,
                  width: '95px',
                  colorScheme: 'dark'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
            {/* Daily Cash Intake (Inflow) */}
            <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.12)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(16, 185, 129, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('dashboard.dailyIntake')}
                </span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><ArrowUpRight size={12} /></span>
              </div>
              <strong style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', color: '#10b981', letterSpacing: '-0.02em', fontWeight: 600 }}>
                + {dailyCashIntake.toFixed(2)} DT
              </strong>
            </div>

            {/* Daily Expenses (Outflow) */}
            <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.12)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(239, 68, 68, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('dashboard.dailyExpenses')}
                </span>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowDownRight size={12} /></span>
              </div>
              <strong style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', color: '#ef4444', letterSpacing: '-0.02em', fontWeight: 600 }}>
                - {totalDailyExpenses.toFixed(2)} DT
              </strong>
            </div>

            {/* Expected Drawer Balance (Net Cash Position) */}
            <div style={{
              background: 'rgba(229, 193, 125, 0.04)',
              border: '1px dashed rgba(229, 193, 125, 0.3)',
              padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('dashboard.netExpectedCash')}
                </span>
                <span style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}><ShieldCheck size={12} /></span>
              </div>
              <strong style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#fff', textShadow: '0 0 15px rgba(229, 193, 125, 0.25)', letterSpacing: '-0.03em', fontWeight: 800 }}>
                {netCashPosition.toFixed(2)} DT
              </strong>
            </div>
          </div>
        </div>
      </div>

      <DashboardCharts 
        recentBookings={localBookings
          .filter(b => selectedVehicleId === 'all' || b.vehicle_id === selectedVehicleId)
          .sort((a, b) => new Date(b.created_at || b.start_date || 0).getTime() - new Date(a.created_at || a.start_date || 0).getTime())
          .slice(0, 250)
        } 
        allBookings={filteredBookingsForVehicle} 
        expenses={filteredExpensesForVehicle} 
        maintenance={filteredMaintenanceForVehicle} 
        selectedYear={selectedYear} 
      />

      <FleetPerformanceMatrix 
        vehicles={vehicles} 
        allBookings={filteredBookingsForVehicle} 
        expenses={filteredExpensesForVehicle} 
        maintenance={filteredMaintenanceForVehicle} 
        vehicleLegalDocs={vehicleLegalDocs} 
        selectedYear={selectedYear}
      />

      <DashboardCalendar 
        vehicles={selectedVehicleId === 'all' ? vehicles : vehicles.filter(v => v.id === selectedVehicleId)} 
        allBookings={filteredBookingsForVehicle} 
      />
    </div>
  )
}

