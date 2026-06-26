'use client'

import { Car, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import styles from '../history.module.css'
import { useLanguage } from '@/lib/i18n'

interface Vehicle {
  id: string
  brand: string
  model: string
  year?: number
  license_plate?: string
  color?: string
  availability?: boolean
  images?: string[]
  price_per_day: number
}

interface VehicleIdentityCardProps {
  vehicle: Vehicle
  totalRentals: number
  totalRevenue: number
  totalExpenses?: number
  netProfit?: number
}

export default function VehicleIdentityCard({
  vehicle,
  totalRentals,
  totalRevenue,
  totalExpenses = 0,
  netProfit = 0,
}: VehicleIdentityCardProps) {
  const { lang } = useLanguage()

  const imageUrl = vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : null
  const isProfit = netProfit >= 0

  return (
    <div className={`${styles['identity-card']} glass-panel`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className={styles['vehicle-thumbnail']}
        />
      ) : (
        <div className={styles['vehicle-thumbnail-placeholder']}>
          <Car size={32} />
        </div>
      )}

      <div className={styles['identity-meta']}>
        <h2 className={styles['identity-name']}>
          {vehicle.brand} {vehicle.model}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <div className={styles['identity-plate']}>
            {vehicle.license_plate || (lang === 'fr' ? 'SANS PLAQUE' : 'NO PLATE')}
          </div>

          <div className={styles['identity-tags']}>
            {vehicle.year && <span className={styles['identity-tag']}>{vehicle.year}</span>}
            {vehicle.color && <span className={styles['identity-tag']}>{vehicle.color}</span>}
            <span className={styles['identity-tag']}>
              {vehicle.price_per_day} {lang === 'fr' ? 'DT/Jour' : 'DT/Day'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles['identity-kpis']}>
        {/* Gross Revenue — from bookings only */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingUp size={12} style={{ color: '#4ade80' }} />
            {lang === 'fr' ? 'Revenu Brut' : 'Gross Revenue'}
          </div>
          <div className={styles['kpi-value']} style={{ color: '#4ade80' }}>
            {totalRevenue.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
          </div>
        </div>

        {/* Total Costs — vehicle-linked expenses */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingDown size={12} style={{ color: '#f87171' }} />
            {lang === 'fr' ? 'Coûts Alloués' : 'Allocated Costs'}
          </div>
          <div className={styles['kpi-value']} style={{ color: '#f87171' }}>
            {totalExpenses.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
          </div>
        </div>

        {/* Net Profit = Gross Revenue - Expenses */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <DollarSign size={12} style={{ color: isProfit ? 'var(--accent-gold)' : '#fb923c' }} />
            {lang === 'fr' ? 'Bénéfice Net' : 'Net Profit'}
          </div>
          <div
            className={styles['kpi-value']}
            style={{ color: isProfit ? 'var(--accent-gold)' : '#fb923c', fontWeight: 800 }}
          >
            {isProfit ? '+' : ''}{netProfit.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
          </div>
        </div>

        {/* Rentals count */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']}>
            {lang === 'fr' ? 'Réservations' : 'Bookings'}
          </div>
          <div className={styles['kpi-value']} style={{ fontSize: '1.15rem' }}>
            {totalRentals} {lang === 'fr' ? 'locations' : 'rentals'}
          </div>
        </div>
      </div>
    </div>
  )
}
