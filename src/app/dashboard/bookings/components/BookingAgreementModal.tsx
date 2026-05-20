import { Printer } from 'lucide-react'
import { Booking, BusinessSettings } from '@/types'

interface BookingAgreementModalProps {
  booking: Booking | null
  businessSettings: BusinessSettings
  onClose: () => void
}

export default function BookingAgreementModal({
  booking,
  businessSettings,
  onClose
}: BookingAgreementModalProps) {
  if (!booking) return null

  const start = new Date(booking.start_date)
  const end = new Date(booking.end_date)
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const statusLower = booking.status?.toLowerCase()
  const bookingStatus = statusLower === 'confirmed' ? 'Confirmed' : statusLower === 'pending' ? 'Pending' : 'Cancelled'
  const paymentStatus = statusLower === 'confirmed' ? 'Paid' : statusLower === 'pending' ? 'Pending' : 'Void'

  return (
    <div className="modal-overlay print-agreement-container">
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
            Agreement Document ready for Printing / PDF generation.
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

        {/* Printable Contract page layout starts here */}
        <div className="print-content" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}>
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
            <div className="text-right" style={{ textAlign: 'right' }}>
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
                Rental Contract
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
                Contract #: <strong>RC-{booking.id.substring(0, 8).toUpperCase()}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>
                Date: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '2rem' }}>
            This agreement confirms the rental arrangement between the Owner (<strong>{businessSettings.business_name}</strong>) and the Renter (<strong>{booking.client_name}</strong>) for the vehicle and dates listed below.
          </p>

          {/* 2-Column Client & Vehicle detail blocks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>1. RENTER INFORMATION</h3>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569', width: '120px' }}>Full Name:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.client_name}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Phone Number:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.client_phone || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>CIN / Passport:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.client_cin_passport || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Driver License:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.client_license_number || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Address:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b', wordBreak: 'break-word' }}>{booking.client_address || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Rental Period:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>
                      {new Date(booking.start_date).toLocaleDateString()} ({booking.pickup_time || '10:00'})
                      {' to '}
                      {new Date(booking.end_date).toLocaleDateString()} ({booking.return_time || '10:00'})
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Booking Status:</td>
                    <td style={{ padding: '0.35rem 0', fontWeight: 700, color: statusLower === 'confirmed' ? '#16a34a' : statusLower === 'pending' ? '#ca8a04' : '#dc2626' }}>{bookingStatus}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Payment Status:</td>
                    <td style={{ padding: '0.35rem 0', fontWeight: 700, color: statusLower === 'confirmed' ? '#16a34a' : statusLower === 'pending' ? '#ca8a04' : '#dc2626' }}>{paymentStatus}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px' }}>
              <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>2. VEHICLE & SECURITY DEPOSIT</h3>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569', width: '120px' }}>Brand & Model:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b', fontWeight: 600 }}>
                      {booking.vehicles?.brand} {booking.vehicles?.model}
                      {booking.vehicles?.license_plate && (
                        <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.25rem' }}>
                          ({booking.vehicles.license_plate})
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Odometer Pickup:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.starting_mileage || 0} km</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#475569' }}>Fuel at Pickup:</td>
                    <td style={{ padding: '0.35rem 0', color: '#1e293b' }}>{booking.fuel_level_pickup || 'Full'}</td>
                  </tr>
                  <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                    <td style={{ padding: '0.5rem 0 0.25rem 0', fontWeight: 600, color: '#475569' }}>Security Deposit:</td>
                    <td style={{ padding: '0.5rem 0 0.25rem 0', fontWeight: 700, color: '#0f172a' }}>
                      {booking.deposit_amount ? `${Number(booking.deposit_amount).toFixed(2)} DT` : '0.00 DT'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.2rem 0', fontWeight: 600, color: '#475569' }}>Deposit Method:</td>
                    <td style={{ padding: '0.2rem 0', color: '#1e293b' }}>{booking.deposit_type || 'Cash'} ({booking.deposit_status || 'Held'})</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rates & Totals Breakdown */}
          <div style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '6px', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>3. RENTAL FEES & CHARGES BREAKDOWN</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: 0, lineHeight: '1.6' }}>
                  The Renter agrees to pay the total sum listed below for the rental period. Any additional charges such as overdue returns, fuel shortages, or traffic violations will be billed directly to the Renter.
                </p>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#475569' }}>Daily Rate:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{(booking.vehicles?.price_per_day || (booking.total_amount / days)).toFixed(2)} DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#475569' }}>Number of Rental Days:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{days} {days > 1 ? 'Days' : 'Day'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#475569' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{booking.total_amount.toFixed(2)} DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Discounts (0%):</span>
                  <span>- 0.00 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
                  <span>Taxes & Fees (0%):</span>
                  <span>0.00 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                  <span>Final Total:</span>
                  <span>{booking.total_amount.toFixed(2)} DT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simplified essential terms */}
          <div style={{ marginBottom: '3rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.5px' }}>4. TERMS & CONDITIONS</h3>
            <ul style={{ 
              fontSize: '0.8rem', 
              color: '#334155', 
              lineHeight: '1.6', 
              paddingLeft: '1.2rem',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <li><strong>Valid Driver’s License Required:</strong> The Renter must possess and present a valid driver’s license throughout the entire rental duration.</li>
              <li><strong>Fuel Policy:</strong> The vehicle must be returned with the same fuel level as provided at pickup. A refuel surcharge will apply otherwise.</li>
              <li><strong>Damage Responsibility:</strong> The Renter accepts full financial responsibility for any physical damage, loss, or theft of the vehicle during the rental period.</li>
              <li><strong>Fines & Tickets:</strong> The Renter is solely responsible for all traffic fines, parking tickets, and toll charges incurred during the rental agreement.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="signatures-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', marginTop: '4rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Renter Signature</strong>
                <div className="signature-box" style={{ height: '45px' }}></div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: ____ / ____ / ________</span>
              </div>
            </div>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Owner Signature</strong>
                <div className="signature-box" style={{ height: '45px' }}></div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: ____ / ____ / ________</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
