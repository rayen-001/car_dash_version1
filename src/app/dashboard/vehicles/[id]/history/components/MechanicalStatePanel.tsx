'use client'

import { Wrench, Edit } from 'lucide-react'
import styles from '../history.module.css'

interface MechanicalStateProps {
  currentKm: number | null
  oilChangeDueKm: number | null
  brakePadState: 'good' | 'worn' | 'critical' | null
  onEditMechanical: () => void
}

export default function MechanicalStatePanel({
  currentKm,
  oilChangeDueKm,
  brakePadState,
  onEditMechanical
}: MechanicalStateProps) {
  // Oil change progress calculations
  const hasOilData = currentKm !== null && oilChangeDueKm !== null
  let oilRemaining = 0
  let oilPercentage = 0
  let oilColorClass = 'safe'

  if (hasOilData) {
    oilRemaining = oilChangeDueKm! - currentKm!
    // Assume an oil change lasts 10,000 km for percentage bar
    const totalOilInterval = 10000
    const drivenSinceChange = Math.max(0, totalOilInterval - oilRemaining)
    oilPercentage = Math.min(100, Math.max(0, (oilRemaining / totalOilInterval) * 100))

    if (oilRemaining < 200) {
      oilColorClass = 'critical'
    } else if (oilRemaining < 1000) {
      oilColorClass = 'warning'
    } else {
      oilColorClass = 'safe'
    }
  }

  // Brakes formatting
  const getBrakesConfig = (state: typeof brakePadState) => {
    switch (state) {
      case 'good':
        return { label: 'Good condition', class: 'good' }
      case 'worn':
        return { label: 'Worn - Inspect soon', class: 'worn' }
      case 'critical':
        return { label: 'CRITICAL - Replace now', class: 'critical' }
      default:
        return { label: 'Not Logged', class: 'unknown' }
    }
  }
  const brakes = getBrakesConfig(brakePadState)

  return (
    <div className={`${styles['mech-panel']} glass-panel`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className={styles['mech-panel-title']}>Mechanical & Maintenance State</h3>
        <button 
          className="icon-btn" 
          title="Update Mechanical Health"
          onClick={onEditMechanical}
        >
          <Edit size={16} />
        </button>
      </div>

      <div className={styles['mech-items']}>
        {/* Current KM */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>Current Odometer</span>
            <span className={styles['mech-item-value']}>
              {currentKm !== null ? `${currentKm.toLocaleString()} KM` : 'Not Logged'}
            </span>
          </div>
        </div>

        {/* Oil Change Tracker */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>Oil Change (Vidange)</span>
            <span className={styles['mech-item-value']}>
              {hasOilData ? `Due at ${oilChangeDueKm!.toLocaleString()} KM` : 'Not Logged'}
            </span>
          </div>
          
          {hasOilData ? (
            <>
              <div className={styles['km-bar-track']}>
                <div 
                  className={`${styles['km-bar-fill']} ${styles[oilColorClass]}`}
                  style={{ width: `${oilPercentage}%` }}
                />
              </div>
              <div className={styles['mech-item-header']}>
                <span className={styles['mech-item-sub']}>
                  {oilRemaining > 0 
                    ? `${oilRemaining.toLocaleString()} KM remaining` 
                    : `OVERDUE BY ${Math.abs(oilRemaining).toLocaleString()} KM 🚨`}
                </span>
              </div>
            </>
          ) : (
            <span className={styles['mech-item-sub']}>Set odometer & target interval to monitor oil health</span>
          )}
        </div>

        {/* Brake Pad Status */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>Brake Pads Status</span>
            <span className={`${styles['brake-badge']} ${styles[brakes.class]}`}>
              <Wrench size={12} />
              {brakes.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
