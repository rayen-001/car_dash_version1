'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import styles from '../history.module.css'
import { useToast } from '@/components/Toast'
import { renewVehicleDocument } from '@/app/actions'
import { useLanguage } from '@/lib/i18n'

interface LegalDoc {
  id: string
  doc_type: 'assurance' | 'visite_technique' | 'laissez_passer'
  expiry_date: string
  notes?: string
}

interface LegalComplianceGridProps {
  legalDocs: LegalDoc[]
  vehicleId: string
  onEditDoc: (docType: 'assurance' | 'visite_technique' | 'laissez_passer') => void
}

export default function LegalComplianceGrid({ legalDocs, vehicleId, onEditDoc }: LegalComplianceGridProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const { lang } = useLanguage()

  // Default Presets Matrix:
  // - Assurance: Default 6 Months, alternative 1 Year
  // - Visite Technique / Laissez-Passer: Default 1 Year, alternative 6 Months
  const [durations, setDurations] = useState<Record<string, '6m' | '1y'>>({
    assurance: '6m',
    visite_technique: '1y',
    laissez_passer: '1y'
  })

  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [tempRenewedDocs, setTempRenewedDocs] = useState<Record<string, { expiry_date: string }>>({})

  const handleConfirmRenewal = async (type: 'assurance' | 'visite_technique' | 'laissez_passer') => {
    setLoadingType(type)
    
    // Calculate custom expiry offset strictly based on current date
    const now = new Date()
    const chosenDuration = durations[type]
    if (chosenDuration === '6m') {
      now.setMonth(now.getMonth() + 6)
    } else {
      now.setMonth(now.getMonth() + 12)
    }
    
    const calculatedExpiryDate = now.toISOString().split('T')[0]

    // Flips status indicator badge instantly in-memory for sub-millisecond dynamic response
    setTempRenewedDocs(prev => ({
      ...prev,
      [type]: { expiry_date: calculatedExpiryDate }
    }))

    try {
      await renewVehicleDocument(vehicleId, type, calculatedExpiryDate)
      showToast(
        lang === 'fr'
          ? `Document renouvelé avec succès pour ${chosenDuration === '6m' ? '6 Mois' : '1 An'} !`
          : `Document successfully renewed for ${chosenDuration === '6m' ? '6 Months' : '1 Year'}!`,
        'success'
      )
      router.refresh()
    } catch (err: any) {
      showToast(err.message || (lang === 'fr' ? 'Échec du renouvellement du document.' : 'Failed to renew document.'), 'error')
      // Rollback on action failure
      setTempRenewedDocs(prev => {
        const next = { ...prev }
        delete next[type]
        return next
      })
    } finally {
      setLoadingType(type === 'assurance' ? null : null) // Keep simple
      setLoadingType(null)
    }
  }

  const getDocStatus = (docType: string) => {
    const tempDoc = tempRenewedDocs[docType]
    const doc = tempDoc 
      ? { doc_type: docType, expiry_date: tempDoc.expiry_date, notes: lang === 'fr' ? 'Renouvelé Auto Rapidement' : 'Quick Auto-Renewed' } 
      : legalDocs.find((d) => d.doc_type === docType)

    if (!doc) {
      return { 
        label: lang === 'fr' ? 'Manquant' : 'Missing', 
        class: 'missing', 
        cardClass: 'missing-card', 
        dateStr: lang === 'fr' ? 'Non enregistré' : 'Not Logged' 
      }
    }

    const expiryDate = new Date(doc.expiry_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const timeDiff = expiryDate.getTime() - today.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

    const formattedExpiryDate = expiryDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')

    if (daysDiff < 0) {
      return { 
        label: lang === 'fr' ? 'Expiré' : 'Expired', 
        class: 'expired', 
        cardClass: 'expired-card',
        dateStr: formattedExpiryDate,
        notes: doc.notes
      }
    } else if (daysDiff <= 30) {
      return { 
        label: lang === 'fr' ? `Expire dans ${daysDiff} jours` : `Expiring in ${daysDiff} days`, 
        class: 'expiring', 
        cardClass: 'expiring-card',
        dateStr: formattedExpiryDate,
        notes: doc.notes
      }
    } else {
      return { 
        label: lang === 'fr' ? `🟢 Conforme / Actif (reste ${daysDiff} j)` : `🟢 Compliant / Active (${daysDiff} days left)`, 
        class: 'active', 
        cardClass: 'active-card',
        dateStr: formattedExpiryDate,
        notes: doc.notes
      }
    }
  }

  const docTypes: { type: 'assurance' | 'visite_technique' | 'laissez_passer'; title: string }[] = [
    { type: 'assurance', title: lang === 'fr' ? 'Assurance' : 'Insurance (Assurance)' },
    { type: 'visite_technique', title: lang === 'fr' ? 'Visite Technique' : 'Technical Inspection' },
    { type: 'laissez_passer', title: lang === 'fr' ? 'Autorisation de Transport' : 'Transport Authorization' }
  ]

  return (
    <div className={styles['legal-grid']}>
      {docTypes.map(({ type, title }) => {
        const status = getDocStatus(type)
        return (
          <div 
            key={type} 
            className={`${styles['legal-card']} ${styles[status.cardClass]} glass-panel`}
            onClick={() => onEditDoc(type)}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              minHeight: '230px',
              padding: '1.5rem',
              transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            <div>
              <div className={styles['legal-card-top']}>
                <span className={styles['legal-doc-label']}>{title}</span>
                <span className={`${styles['legal-badge']} ${styles[status.class]}`}>
                  {status.label}
                </span>
              </div>

              <h3 className={styles['legal-doc-name']}>
                {type === 'assurance' ? (lang === 'fr' ? "Police d'Assurance" : 'Assurance Policy') : type === 'visite_technique' ? 'Visite Technique' : 'Laissez-Passer'}
              </h3>

              <div className={styles['legal-expiry']}>
                {lang === 'fr' ? "Date d'expiration :" : 'Expiry Date:'} <strong>{status.dateStr}</strong>
              </div>

              {status.notes && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(229, 193, 125, 0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.2rem' }}>
                  Note: {status.notes}
                </div>
              )}
            </div>

            <div>
              {(status.label === 'Missing' || status.label === 'Expired' || status.label === 'Manquant' || status.label === 'Expiré') && (
                <div 
                  style={{ 
                    marginTop: '1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.6rem',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(229, 193, 125, 0.2)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                      {lang === 'fr' ? 'Durée de renouvellement :' : 'Renewal Coverage:'}
                    </span>
                    <select
                      value={durations[type]}
                      onChange={(e) => {
                        setDurations(prev => ({ ...prev, [type]: e.target.value as '6m' | '1y' }))
                      }}
                      style={{
                        background: 'rgba(18, 14, 12, 0.95)',
                        border: '1px solid rgba(229, 193, 125, 0.3)',
                        color: '#fff',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {type === 'assurance' ? (
                        <>
                          <option value="6m">{lang === 'fr' ? '6 Mois' : '6 Months'}</option>
                          <option value="1y">{lang === 'fr' ? '1 An' : '1 Year'}</option>
                        </>
                      ) : (
                        <>
                          <option value="1y">{lang === 'fr' ? '1 An' : '1 Year'}</option>
                          <option value="6m">{lang === 'fr' ? '6 Mois' : '6 Months'}</option>
                        </>
                      )}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleConfirmRenewal(type)}
                    disabled={loadingType === type}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid var(--accent-gold)',
                      background: 'linear-gradient(90deg, rgba(229, 193, 125, 0.08), rgba(229, 193, 125, 0.18))',
                      color: 'var(--accent-gold)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {loadingType === type ? (lang === 'fr' ? 'Enregistrement...' : 'Saving...') : (lang === 'fr' ? '⚡ Confirmer le Renouvellement' : '⚡ Confirm Renewal')}
                  </button>
                </div>
              )}

              <div className={styles['legal-card-action']} style={{ marginTop: '0.75rem' }}>
                <Clock size={12} />
                <span>{lang === 'fr' ? 'Mettre à jour les détails' : 'Update details'}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
