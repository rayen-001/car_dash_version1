'use client'

import { Edit } from 'lucide-react'
import styles from '../history.module.css'
import { useLanguage } from '@/lib/i18n'

interface MechanicalStateProps {
  currentKm: number | null
  oilChangeDueKm: number | null
  nextPadsKm: number | null
  onEditMechanical: () => void
}

export default function MechanicalStatePanel({
  currentKm,
  oilChangeDueKm,
  nextPadsKm,
  onEditMechanical
}: MechanicalStateProps) {
  const { lang } = useLanguage()

  // Oil change progress calculations
  const hasOilData = currentKm !== null && oilChangeDueKm !== null
  let oilRemaining = 0
  let oilPercentage = 0
  let oilColorClass = 'safe'

  if (hasOilData) {
    oilRemaining = oilChangeDueKm! - currentKm!
    // Assume an oil change lasts 10,000 km for percentage bar
    const totalOilInterval = 10000
    oilPercentage = Math.min(100, Math.max(0, (oilRemaining / totalOilInterval) * 100))

    if (oilRemaining < 200) {
      oilColorClass = 'critical'
    } else if (oilRemaining < 1000) {
      oilColorClass = 'warning'
    } else {
      oilColorClass = 'safe'
    }
  }

  // Pads progress calculations
  const hasPadsData = currentKm !== null && nextPadsKm !== null
  let padsRemaining = 0
  let padsPercentage = 0
  let padsColorClass = 'safe'

  if (hasPadsData) {
    padsRemaining = nextPadsKm! - currentKm!
    // Assume a brake pads replacement lasts 30,000 km for percentage bar
    const totalPadsInterval = 30000
    padsPercentage = Math.min(100, Math.max(0, (padsRemaining / totalPadsInterval) * 100))

    if (padsRemaining < 500) {
      padsColorClass = 'critical'
    } else if (padsRemaining < 3000) {
      padsColorClass = 'warning'
    } else {
      padsColorClass = 'safe'
    }
  }

  return (
    <div className={`${styles['mech-panel']} glass-panel`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className={styles['mech-panel-title']}>
          {lang === 'fr' ? 'État Mécanique & Entretien' : 'Mechanical & Maintenance State'}
        </h3>
        <button 
          className="icon-btn" 
          title={lang === 'fr' ? "Modifier l'état mécanique" : "Update Mechanical Health"}
          onClick={onEditMechanical}
        >
          <Edit size={16} />
        </button>
      </div>

      <div className={styles['mech-items']}>
        {/* Current KM */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>{lang === 'fr' ? 'Kilométrage Actuel' : 'Current Odometer'}</span>
            <span className={styles['mech-item-value']}>
              {currentKm !== null ? `${currentKm.toLocaleString()} KM` : (lang === 'fr' ? 'Non enregistré' : 'Not Logged')}
            </span>
          </div>
        </div>

        {/* Oil Change Tracker */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>{lang === 'fr' ? 'Vidange Huile' : 'Oil Change (Vidange)'}</span>
            <span className={styles['mech-item-value']}>
              {hasOilData 
                ? (lang === 'fr' ? `Dû à ${oilChangeDueKm!.toLocaleString()} KM` : `Due at ${oilChangeDueKm!.toLocaleString()} KM`)
                : (lang === 'fr' ? 'Non enregistré' : 'Not Logged')}
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
                    ? (lang === 'fr' ? `${oilRemaining.toLocaleString()} KM restants` : `${oilRemaining.toLocaleString()} KM remaining`) 
                    : (lang === 'fr' ? `EN RETARD DE ${Math.abs(oilRemaining).toLocaleString()} KM 🚨` : `OVERDUE BY ${Math.abs(oilRemaining).toLocaleString()} KM 🚨`)}
                </span>
              </div>
            </>
          ) : (
            <span className={styles['mech-item-sub']}>
              {lang === 'fr' ? "Définir le kilométrage et l'intervalle cible pour surveiller la vidange" : 'Set odometer & target interval to monitor oil health'}
            </span>
          )}
        </div>

        {/* Brake Pads Tracker */}
        <div className={styles['mech-item']}>
          <div className={styles['mech-item-header']}>
            <span className={styles['mech-item-label']}>{lang === 'fr' ? 'Plaquettes de Frein' : 'Brake Pads (Plaquettes)'}</span>
            <span className={styles['mech-item-value']}>
              {hasPadsData 
                ? (lang === 'fr' ? `Dû à ${nextPadsKm!.toLocaleString()} KM` : `Due at ${nextPadsKm!.toLocaleString()} KM`)
                : (lang === 'fr' ? 'Non enregistré' : 'Not Logged')}
            </span>
          </div>
          
          {hasPadsData ? (
            <>
              <div className={styles['km-bar-track']}>
                <div 
                  className={`${styles['km-bar-fill']} ${styles[padsColorClass]}`}
                  style={{ width: `${padsPercentage}%` }}
                />
              </div>
              <div className={styles['mech-item-header']}>
                <span className={styles['mech-item-sub']}>
                  {padsRemaining > 0 
                    ? (lang === 'fr' ? `${padsRemaining.toLocaleString()} KM restants` : `${padsRemaining.toLocaleString()} KM remaining`) 
                    : (lang === 'fr' ? `EN RETARD DE ${Math.abs(padsRemaining).toLocaleString()} KM 🚨` : `OVERDUE BY ${Math.abs(padsRemaining).toLocaleString()} KM 🚨`)}
                </span>
              </div>
            </>
          ) : (
            <span className={styles['mech-item-sub']}>
              {lang === 'fr' ? "Définir le kilométrage et l'intervalle cible pour surveiller les plaquettes" : 'Set odometer & target interval to monitor brake pads health'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
