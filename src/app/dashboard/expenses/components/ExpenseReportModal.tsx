import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { BusinessSettings } from '@/types'

interface ExpenseReportModalProps {
  expenses: any[]
  businessSettings: BusinessSettings | null
  onClose: () => void
  filters: {
    category: string
    vehicle: string
    searchQuery: string
  }
  stats: {
    thisMonth: number
    overall: number
    filtered: number
  }
}

const getCategoryLabelFR = (cat: string) => {
  switch (cat.toLowerCase()) {
    case 'rental_revenue': return 'Revenus Locatifs'
    case 'maintenance': return 'Entretien Véhicule'
    case 'fuel': return 'Carburant Flotte'
    case 'insurance': return 'Assurance'
    case 'cleaning': return 'Nettoyage'
    case 'incident': return 'Indemnité Incident'
    case 'damage_repair': return 'Réparation Dégâts'
    case 'installment_tranche': return 'Tranche de Paiement'
    case 'late_return_penalty': return 'Pénalité de Retard'
    case 'all': return 'Toutes les catégories'
    default: return cat
  }
}

export default function ExpenseReportModal({
  expenses,
  businessSettings,
  onClose,
  filters,
  stats
}: ExpenseReportModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentSettings = {
    business_name: businessSettings?.business_name || 'RentCar Premium',
    logo_url: businessSettings?.logo_url || '',
    phone: businessSettings?.phone || '',
    address: businessSettings?.address || '',
    currency: 'DT',
    rental_terms: businessSettings?.rental_terms || ''
  }

  if (!mounted) return null

  return createPortal(
    <div className="modal-overlay print-report-container" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{
        maxWidth: '850px',
        width: '95%',
        background: '#ffffff',
        color: '#1a1a1a',
        border: '1px solid #cbd5e1',
        boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
        padding: '3rem',
        overflowY: 'auto',
        maxHeight: '90vh'
      }}>
        {/* Header with Print action */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '2.5rem'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            Rapport de dépenses prêt pour l'impression / génération de PDF.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ background: '#e5c17d', color: '#000000', fontWeight: 600 }} onClick={() => window.print()}>
               <Printer size={16} />
               <span>Imprimer / Enregistrer en PDF</span>
            </button>
            <button className="btn-secondary" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={onClose}>
               Fermer
            </button>
          </div>
        </div>

        {/* Printable Report Page Layout */}
        <div className="print-content" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}>
          
          {/* Header structure matching Rental Contract */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              {currentSettings.logo_url && (
                <img src={currentSettings.logo_url} alt="Logo" style={{ height: '48px', width: 'auto', marginBottom: '0.75rem', objectFit: 'contain' }} />
              )}
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.5px' }}>
                {currentSettings.business_name}
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {currentSettings.address} | Tel: {currentSettings.phone}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                border: '1.5px solid #0f172a',
                padding: '0.4rem 0.85rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                color: '#0f172a',
                letterSpacing: '0.5px'
              }}>
                Rapport de Dépenses
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
                Date Génération : <strong>{new Date().toLocaleDateString()}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>
                Devise : <strong>{currentSettings.currency || 'DT'}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Filter Criteria block */}
            <div style={{ border: '1px solid #cbd5e1', padding: '1rem 1.25rem', borderRadius: '6px', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.5rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>
                Filtres du Rapport
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.8rem', color: '#475569' }}>
                <div>Catégorie : <strong style={{ color: '#0f172a' }}>{getCategoryLabelFR(filters.category)}</strong></div>
                <div>Véhicule : <strong style={{ color: '#0f172a' }}>{filters.vehicle === 'All Vehicles' ? 'Tous les Véhicules' : filters.vehicle}</strong></div>
                <div>Recherche : <strong style={{ color: '#0f172a' }}>{filters.searchQuery || 'Aucune'}</strong></div>
              </div>
            </div>

            {/* Summary Statistics block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ce Mois</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                  {stats.thisMonth.toFixed(2)} {currentSettings.currency}
                </div>
              </div>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Historique</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                  {stats.overall.toFixed(2)} {currentSettings.currency}
                </div>
              </div>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', textAlign: 'center', background: 'rgba(212, 180, 106, 0.05)', borderColor: '#e5c17d' }}>
                <span style={{ fontSize: '0.75rem', color: '#8a6d35', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Sélection Filtrée</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#8a6d35', marginTop: '0.25rem' }}>
                  {stats.filtered.toFixed(2)} {currentSettings.currency}
                </div>
              </div>
            </div>

            {/* Expenses List Breakdown */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Catégorie</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Véhicule</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Aucun enregistrement de dépenses ne correspond aux filtres actifs.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => {
                      const vName = expense.vehicles 
                        ? `${expense.vehicles.brand} ${expense.vehicles.model}` 
                        : expense.vehicle_id 
                          ? 'Véhicule Associé' 
                          : 'Dépense Générale'
                      return (
                        <tr key={expense.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#1e293b' }}>
                            {new Date(expense.created_at || expense.date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#1e293b', fontWeight: 600 }}>
                            {getCategoryLabelFR(expense.category)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#1e293b' }}>
                            {vName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {expense.description}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#ef4444', fontWeight: 700, textAlign: 'right' }}>
                            -{expense.amount.toFixed(2)} {currentSettings.currency}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <div style={{
                border: '1.5px solid #0f172a',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                background: '#f8fafc',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                gap: '2rem'
              }}>
                <span style={{ color: '#475569' }}>TOTAL DES DÉPENSES :</span>
                <span style={{ color: '#ef4444' }}>-{stats.filtered.toFixed(2)} {currentSettings.currency}</span>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '4rem', fontSize: '0.8rem' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', textAlign: 'center', color: '#64748b' }}>
                Préparé par : ___________________________
              </div>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', textAlign: 'center', color: '#64748b' }}>
                Signature du Gérant : ___________________________
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
