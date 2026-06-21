import { TrendingDown, TrendingUp, AlertOctagon, Car, Wallet } from 'lucide-react'
import Link from 'next/link'
import styles from '../dashboard.module.css'
import { useLanguage } from '@/lib/i18n'

interface DashboardStatsProps {
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
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useLanguage()
  const isNetProfitNegative = stats.netProfitYTD < 0
  const profitColor = isNetProfitNegative ? '#EF4444' : '#E5C17D'
  const formattedProfit = Math.abs(stats.netProfitYTD).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const profitPrefix = isNetProfitNegative ? '-' : ''

  return (
    <div className={styles['stats-grid']} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>

      {/* CARD 1: Net Fleet Profit (Current Year P&L) */}
      <div className={`${styles['stat-card']} glass-panel`} style={{ position: 'relative', overflow: 'hidden' }}>
        {isNetProfitNegative && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#EF4444', boxShadow: '0 0 15px #EF4444' }} />
        )}
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>{t('dashboard.netFleetProfit')} {stats.targetYear}</span>
          <span className={styles['stat-icon-wrapper']} style={{ background: isNetProfitNegative ? 'rgba(239,68,68,0.1)' : 'rgba(229,193,125,0.1)' }}>
            {isNetProfitNegative ? <TrendingDown size={18} style={{ color: '#EF4444' }} /> : <TrendingUp size={18} style={{ color: '#E5C17D' }} />}
          </span>
        </div>
        <div className={styles['stat-value']} style={{ color: profitColor, textShadow: isNetProfitNegative ? '0 0 10px rgba(239,68,68,0.5)' : 'none' }}>
          {profitPrefix}{formattedProfit} DT
        </div>
        <div className={styles['stat-trend']} style={{ color: 'rgba(255,255,255,0.5)' }}>
          {t('dashboard.ytdRevenue')}: {stats.revenueYTD.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT
        </div>
      </div>

      {/* CARD 2: Real-Time Fleet Utilization Rate */}
      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>{t('dashboard.fleetUtilization')}</span>
          <span className={styles['stat-icon-wrapper']} style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Car size={18} style={{ color: '#ffffff' }} />
          </span>
        </div>
        <div className={styles['stat-value']} style={{ color: '#ffffff' }}>
          {stats.utilizationRate.toFixed(1)}%
        </div>
        <div className={styles['stat-trend']} style={{ color: 'rgba(255,255,255,0.5)' }}>
          {stats.activeRentals} / {stats.fleetSize} {t('dashboard.activeVehicles')}
        </div>
      </div>

      {/* CARD 3: Cumulative Outstanding Liabilities */}
      <div className={`${styles['stat-card']} glass-panel`}>
        <div className={styles['stat-header']}>
          <span className={styles['stat-label']}>{t('dashboard.resteTotale')}</span>
          <span className={styles['stat-icon-wrapper']} style={{ background: 'rgba(229,193,125,0.1)' }}>
            <Wallet size={18} style={{ color: '#E5C17D' }} />
          </span>
        </div>
        <div className={styles['stat-value']} style={{ color: '#E5C17D' }}>
          {stats.outstandingLiabilities.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT
        </div>
        <div className={styles['stat-trend']} style={{ color: 'rgba(255,255,255,0.5)' }}>
          {t('dashboard.uncollectedTranches')}
        </div>
      </div>

      {/* CARD 4: Pending Fleet Risk Signals */}
      <Link href="/dashboard/fleet" style={{ textDecoration: 'none' }}>
        <div className={`${styles['stat-card']} glass-panel`} style={{ cursor: 'pointer', transition: 'all 0.2s', border: stats.riskSignalsCount > 0 ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
          {stats.riskSignalsCount > 0 && (
             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#EF4444', boxShadow: '0 0 15px #EF4444' }} />
          )}
          <div className={styles['stat-header']}>
            <span className={styles['stat-label']}>{t('dashboard.fleetRiskSignals')}</span>
            <span className={styles['stat-icon-wrapper']} style={{ background: stats.riskSignalsCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)' }}>
              <AlertOctagon size={18} style={{ color: stats.riskSignalsCount > 0 ? '#EF4444' : '#ffffff' }} />
            </span>
          </div>
          <div className={styles['stat-value']} style={{ color: stats.riskSignalsCount > 0 ? '#EF4444' : '#ffffff' }}>
            {stats.riskSignalsCount} {t('dashboard.activeSignals')}
          </div>
          <div className={styles['stat-trend']} style={{ color: 'rgba(255,255,255,0.5)' }}>
            {t('dashboard.clickToViewCompliance')}
          </div>
        </div>
      </Link>
    </div>
  )
}
