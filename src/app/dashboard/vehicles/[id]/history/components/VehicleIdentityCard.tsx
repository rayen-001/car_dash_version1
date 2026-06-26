'use client'

import { Car, TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react'
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
  caBrut: number          // sum(total_amount) — montant contractuel
  revenuEncaisse: number  // acompte_paid + paid installments — cash réel
  totalExpenses?: number  // coûts alloués (ne réduit PAS le revenue)
  netProfit?: number      // revenuEncaisse - totalExpenses
}

export default function VehicleIdentityCard({
  vehicle,
  totalRentals,
  caBrut,
  revenuEncaisse,
  totalExpenses = 0,
  netProfit = 0,
}: VehicleIdentityCardProps) {
  const { lang } = useLanguage()

  const imageUrl = vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : null
  const isProfit = netProfit >= 0
  const fmt = (n: number) => n.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

        {/* 1. CA Brut — montant contractuel */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Receipt size={12} style={{ color: 'rgba(229,193,125,0.6)' }} />
            {lang === 'fr' ? 'CA Brut Contrats' : 'Gross Contract Revenue'}
          </div>
          <div className={styles['kpi-value']} style={{ color: 'rgba(229,193,125,0.8)', fontSize: '1rem' }}>
            {fmt(caBrut)} DT
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.1rem' }}>
            {lang === 'fr' ? 'Total contrats signés' : 'Total signed contracts'}
          </div>
        </div>

        {/* 2. Revenu Encaissé — cash réel */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingUp size={12} style={{ color: '#4ade80' }} />
            {lang === 'fr' ? 'Revenu Encaissé' : 'Cash Collected'}
          </div>
          <div className={styles['kpi-value']} style={{ color: '#4ade80' }}>
            {fmt(revenuEncaisse)} DT
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.1rem' }}>
            {lang === 'fr' ? 'Acompte + tranches payées' : 'Deposit + paid instalments'}
          </div>
        </div>

        {/* 3. Coûts Alloués — dépenses liées au véhicule */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingDown size={12} style={{ color: '#f87171' }} />
            {lang === 'fr' ? 'Coûts Alloués' : 'Allocated Costs'}
          </div>
          <div className={styles['kpi-value']} style={{ color: '#f87171' }}>
            {fmt(totalExpenses)} DT
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.1rem' }}>
            {lang === 'fr' ? 'Dépenses liées à ce véhicule' : 'Expenses linked to this vehicle'}
          </div>
        </div>

        {/* 4. Bénéfice Net Réel = encaissé - coûts */}
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <DollarSign size={12} style={{ color: isProfit ? 'var(--accent-gold)' : '#fb923c' }} />
            {lang === 'fr' ? 'Bénéfice Net Réel' : 'Real Net Profit'}
          </div>
          <div className={styles['kpi-value']} style={{ color: isProfit ? 'var(--accent-gold)' : '#fb923c', fontWeight: 800 }}>
            {isProfit ? '+' : ''}{fmt(netProfit)} DT
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.1rem' }}>
            {lang === 'fr' ? 'Encaissé − Coûts' : 'Cash collected − Costs'}
          </div>
        </div>

        {/* Reservations count */}
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
