import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Receipt, Printer, Gauge, Fuel } from 'lucide-react'
import { Booking, BusinessSettings } from '@/types'

interface BookingInvoiceModalProps {
  booking: Booking | null
  businessSettings: BusinessSettings
  onClose: () => void
}

export default function BookingInvoiceModal({
  booking,
  businessSettings,
  onClose
}: BookingInvoiceModalProps) {
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (booking && contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [booking])

  if (!mounted || !booking) return null

  const start = new Date(booking.start_date)
  const end = new Date(booking.end_date)
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const calculatedDiffMileage = booking.return_mileage !== undefined && booking.return_mileage !== null 
    ? Math.max(0, booking.return_mileage - (booking.starting_km ?? booking.starting_mileage ?? 0)) 
    : null
  const statusLower = booking.status?.toLowerCase()

  const translateFuel = (level?: string | null): string => {
    if (!level) return 'Plein'
    const lower = level.toLowerCase().trim()
    if (lower === 'full' || lower === 'plein') return 'Plein'
    if (lower === 'empty' || lower === 'vide') return 'Vide'
    return level.replace(/tank/gi, 'Réservoir')
  }

  return createPortal(
    <div className="modal-overlay print-invoice-container">
      <div ref={contentRef} className="modal-content" style={{
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
            Document de facture prêt pour l'impression / génération de PDF.
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

        {/* Printable Invoice Page Layout */}
        <div className="print-content" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}>
          
          {/* Header structure matching Rental Contract */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              {businessSettings.logo_url && (
                <img src={businessSettings.logo_url} alt="Logo" style={{ height: '48px', width: 'auto', marginBottom: '0.75rem', objectFit: 'contain' }} />
              )}
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.5px' }}>{businessSettings.business_name || 'RentCar Premium'}</h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {businessSettings.address} | Tél : {businessSettings.phone}
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
                Facture Officielle
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
                Facture N° : <strong>RC-{booking.id.substring(0, 8).toUpperCase()}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>
                Date d'émission : {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Two-Column Info block in White sheet style */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Coordonnées de l'Entreprise</h3>
                <p style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 600, color: '#1e293b' }}>{businessSettings.business_name}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.25rem 0', lineHeight: '1.4' }}>{businessSettings.address}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>Tél : {businessSettings.phone}</p>
              </div>

              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', position: 'relative' }}>
                <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Facturé À</h3>
                <p style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 600, color: '#1e293b' }}>{booking.client_name}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.25rem 0' }}>ID Réservation : RC-{booking.id.substring(0, 8).toUpperCase()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Statut du paiement :</span>
                  <span style={{
                    padding: '0.15rem 0.6rem',
                    borderRadius: '100px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: statusLower === 'confirmed' ? 'rgba(22, 163, 74, 0.08)' : statusLower === 'pending' ? 'rgba(202, 138, 4, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                    color: statusLower === 'confirmed' ? '#16a34a' : statusLower === 'pending' ? '#ca8a04' : '#dc2626',
                    border: `1px solid ${statusLower === 'confirmed' ? 'rgba(22, 163, 74, 0.2)' : statusLower === 'pending' ? 'rgba(202, 138, 4, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`
                  }}>
                    {statusLower === 'confirmed' ? 'Payé' : statusLower === 'pending' ? 'En attente' : 'Annulé'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rental Details breakdown */}
            <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Détails de la Location</h3>
              
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                  <div>Description du Véhicule</div>
                  <div style={{ textAlign: 'right' }}>Tarif Journalier</div>
                  <div style={{ textAlign: 'right' }}>Jours</div>
                  <div style={{ textAlign: 'right' }}>Sous-total</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', paddingBottom: '0.5rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{booking.vehicles?.brand} {booking.vehicles?.model}</div>
                  <div style={{ textAlign: 'right' }}>{(booking.vehicles?.price_per_day || (booking.total_amount / days)).toFixed(2)} DT</div>
                  <div style={{ textAlign: 'right' }}>{days} {days > 1 ? 'jours' : 'jour'}</div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{booking.total_amount.toFixed(2)} DT</div>
                </div>

                {/* Additional specifications */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem', background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      <Gauge size={12} style={{ color: '#ca8a04' }} />
                      <span>Relevés Kilométriques</span>
                    </div>
                    <div style={{ color: '#475569' }}>Départ : <strong style={{ color: '#0f172a' }}>{booking.starting_km ?? booking.starting_mileage ?? 0} km</strong></div>
                    <div style={{ color: '#475569' }}>Retour : <strong style={{ color: '#0f172a' }}>{booking.return_mileage !== undefined && booking.return_mileage !== null ? `${booking.return_mileage} km` : '-- km'}</strong></div>
                    <div style={{ color: '#16a34a', fontSize: '0.7rem', marginTop: '0.15rem', fontWeight: 700 }}>Parcouru : {calculatedDiffMileage !== null ? `${calculatedDiffMileage} km` : '-- km'}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      <Fuel size={12} style={{ color: '#ca8a04' }} />
                      <span>Niveaux de Carburant</span>
                    </div>
                    <div style={{ color: '#475569' }}>État Départ : <strong style={{ color: '#0f172a' }}>{translateFuel(booking.fuel_level_pickup)}</strong></div>
                    <div style={{ color: '#475569' }}>État Retour : <strong style={{ color: '#0f172a' }}>{translateFuel(booking.fuel_level_return)}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <div style={{ width: '260px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Tarif Journalier :</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{(booking.vehicles?.price_per_day || (booking.total_amount / days)).toFixed(2)} DT × {days} {days > 1 ? 'jours' : 'jour'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Sous-total :</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{booking.total_amount.toFixed(2)} DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Remises :</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>0.00%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.5rem' }}>
                  <span>Taxes & Frais (0%) :</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>0.00 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', color: '#0f172a' }}>
                  <span>Total Final :</span>
                  <span style={{ color: '#ca8a04' }}>{booking.total_amount.toFixed(2)} DT</span>
                </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'none' }} /> {/* dummy divider/wrapper if needed, or simply close modal-content */}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .sidebar,
              .topbar,
              .sidebar-overlay,
              .dashboard-page > .header-section,
              .dashboard-page > .content-grid,
              .no-print,
              .no-print *,
              .modal-header button,
              .modal-footer button,
              button {
                display: none !important;
              }

              .layout-container,
              .main-content,
              .content-area,
              .dashboard-page {
                display: block !important;
                background: #ffffff !important;
                background-image: none !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: 0 !important;
                height: auto !important;
              }

              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
              }

              @page {
                size: A4 portrait;
                margin: 8mm 12mm;
              }

              .print-invoice-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                display: block !important;
                z-index: 99999 !important;
              }

              .print-invoice-container .modal-content {
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 auto !important;
                max-width: 186mm !important;
                width: 186mm !important;
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
              }

              .print-content {
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                color: #000000 !important;
                font-size: 11.5px !important;
                line-height: 1.35 !important;
              }

              h1, h2, h3, h4, h5, h6 {
                color: #0f172a !important;
                margin-top: 0.25rem !important;
                margin-bottom: 0.25rem !important;
              }

              p, span, td, div {
                color: #1e293b !important;
              }

              strong {
                color: #000000 !important;
                font-weight: bold !important;
              }

              div, table, td, th {
                border-color: #94a3b8 !important;
              }

              .print-content h1 {
                font-size: 1.4rem !important;
                margin-bottom: 0.25rem !important;
              }
              
              .print-content p {
                margin-bottom: 0.6rem !important;
                font-size: 0.8rem !important;
                line-height: 1.35 !important;
              }

              .print-content .grid-layout,
              .print-content > div {
                margin-bottom: 0.75rem !important;
                gap: 0.75rem !important;
              }

              .print-content table td {
                padding: 0.25rem 0 !important;
                font-size: 0.78rem !important;
              }

              .print-content h3 {
                font-size: 0.8rem !important;
                margin-bottom: 0.4rem !important;
                padding-bottom: 0.25rem !important;
              }

              .print-content ul {
                gap: 0.25rem !important;
                margin-bottom: 0.6rem !important;
              }

              .print-content ul li {
                font-size: 0.78rem !important;
                line-height: 1.3 !important;
              }

              .print-content .signatures-row {
                margin-top: 2rem !important;
                gap: 3rem !important;
              }

              .print-content .signature-box {
                height: 28px !important;
              }
            }
          `,
        }}
      />
    </div>,
    document.body
  )
}
