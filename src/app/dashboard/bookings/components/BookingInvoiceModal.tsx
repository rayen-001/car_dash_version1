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
  if (!booking) return null

  const start = new Date(booking.start_date)
  const end = new Date(booking.end_date)
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const calculatedDiffMileage = booking.return_mileage !== undefined && booking.return_mileage !== null 
    ? Math.max(0, booking.return_mileage - (booking.starting_mileage || 0)) 
    : null
  const statusLower = booking.status?.toLowerCase()

  return (
    <div className="modal-overlay print-invoice-container">
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
            Invoice Document ready for Printing / PDF generation.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ background: '#d4b46a', color: '#000000', fontWeight: 600 }} onClick={() => window.print()}>
               <Printer size={16} />
               <span>Print / Save as PDF</span>
            </button>
            <button className="btn-secondary" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={onClose}>
               Close
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
                {businessSettings.address} | Tel: {businessSettings.phone}
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
                Official Invoice
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
                Invoice #: <strong>RC-{booking.id.substring(0, 8).toUpperCase()}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>
                Date Issued: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Two-Column Info block in White sheet style */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Business Details</h3>
                <p style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 600, color: '#1e293b' }}>{businessSettings.business_name}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.25rem 0', lineHeight: '1.4' }}>{businessSettings.address}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>Tel: {businessSettings.phone}</p>
              </div>

              <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', position: 'relative' }}>
                <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Billed To</h3>
                <p style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 600, color: '#1e293b' }}>{booking.client_name}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.25rem 0' }}>Booking ID: RC-{booking.id.substring(0, 8).toUpperCase()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Payment Status:</span>
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
                    {statusLower === 'confirmed' ? 'Paid' : statusLower === 'pending' ? 'Pending' : 'Void'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rental Details breakdown */}
            <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>Rental Breakdown</h3>
              
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                  <div>Vehicle Description</div>
                  <div style={{ textAlign: 'right' }}>Daily Rate</div>
                  <div style={{ textAlign: 'right' }}>Days</div>
                  <div style={{ textAlign: 'right' }}>Subtotal</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', paddingBottom: '0.5rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{booking.vehicles?.brand} {booking.vehicles?.model}</div>
                  <div style={{ textAlign: 'right' }}>{(booking.vehicles?.price_per_day || (booking.total_amount / days)).toFixed(2)} DT</div>
                  <div style={{ textAlign: 'right' }}>{days} {days > 1 ? 'Days' : 'Day'}</div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{booking.total_amount} DT</div>
                </div>

                {/* Additional specifications */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem', background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      <Gauge size={12} style={{ color: '#ca8a04' }} />
                      <span>Odometer Logs</span>
                    </div>
                    <div style={{ color: '#475569' }}>Start: <strong style={{ color: '#0f172a' }}>{booking.starting_mileage ?? 0} km</strong></div>
                    <div style={{ color: '#475569' }}>Return: <strong style={{ color: '#0f172a' }}>{booking.return_mileage !== undefined && booking.return_mileage !== null ? `${booking.return_mileage} km` : '-- km'}</strong></div>
                    <div style={{ color: '#16a34a', fontSize: '0.7rem', marginTop: '0.15rem', fontWeight: 700 }}>Driven: {calculatedDiffMileage !== null ? `${calculatedDiffMileage} km` : '-- km'}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      <Fuel size={12} style={{ color: '#ca8a04' }} />
                      <span>Fuel Records</span>
                    </div>
                    <div style={{ color: '#475569' }}>Pickup Status: <strong style={{ color: '#0f172a' }}>{booking.fuel_level_pickup || 'Full'}</strong></div>
                    <div style={{ color: '#475569' }}>Return Status: <strong style={{ color: '#0f172a' }}>{booking.fuel_level_return || 'Full'}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <div style={{ width: '260px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Daily Rate:</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{(booking.vehicles?.price_per_day || (booking.total_amount / days)).toFixed(2)} DT × {days} days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Subtotal:</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{booking.total_amount} DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Discounts:</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>0.00%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.5rem' }}>
                  <span>Taxes & Fees (0%):</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>0.00 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', color: '#0f172a' }}>
                  <span>Final Total:</span>
                  <span style={{ color: '#ca8a04' }}>{booking.total_amount} DT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
