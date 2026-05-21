'use client'

import { Car } from 'lucide-react'
import styles from '../history.module.css'

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
}

export default function VehicleIdentityCard({ vehicle, totalRentals, totalRevenue }: VehicleIdentityCardProps) {
  // Use first image if available
  const imageUrl = vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : null

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
            {vehicle.license_plate || 'NO PLATE'}
          </div>
          
          <div className={styles['identity-tags']}>
            {vehicle.year && <span className={styles['identity-tag']}>{vehicle.year}</span>}
            {vehicle.color && <span className={styles['identity-tag']}>{vehicle.color}</span>}
            <span className={styles['identity-tag']}>{vehicle.price_per_day} DT/Day</span>
          </div>
        </div>
      </div>

      <div className={styles['identity-kpis']}>
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']}>Total Revenue</div>
          <div className={styles['kpi-value']}>{totalRevenue.toLocaleString()} DT</div>
        </div>
        <div className={styles['kpi-item']}>
          <div className={styles['kpi-label']}>Completed Bookings</div>
          <div className={styles['kpi-value']} style={{ fontSize: '1.15rem' }}>{totalRentals} rentals</div>
        </div>
      </div>
    </div>
  )
}
