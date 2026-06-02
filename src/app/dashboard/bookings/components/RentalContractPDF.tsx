'use client'

/**
 * Phase 16.4 — Pure Tunisian rental contract template (no modal chrome).
 *
 * Same layout as BookingAgreementModal but designed to be embedded inside any
 * full-page route (e.g. /dashboard/bookings/[id]/contract/print) so the
 * operator can hit Ctrl+P / Save-as-PDF directly without a modal in the way.
 *
 * Shares ZERO duplicated logic with BookingAgreementModal — both pull the
 * same data shape, both delegate visual primitives to the same shared
 * components in src/lib/contracts/*. Only difference is the surrounding
 * chrome.
 *
 * Optional `mono` prop forces monochrome ink-efficient print mode.
 */

import { Booking, BusinessSettings } from '@/types'
import BiLabel from '@/lib/contracts/BilingualLabel'
import SectionHeader from '@/lib/contracts/SectionHeader'
import TunisianPlate from '@/lib/contracts/TunisianPlate'
import FuelGauge from '@/lib/contracts/FuelGauge'

interface RentalContractPDFProps {
  booking: Booking
  businessSettings: BusinessSettings
  mono?: boolean
}

const ARABIC_FONT_STACK = "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif"

function fmtDate(s?: string | null): string {
  if (!s) return ''
  const parts = s.split('T')[0].split('-')
  if (parts.length !== 3) return s
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function serialFromId(id: string): string {
  return id.replace(/-/g, '').toUpperCase().slice(-6)
}

export default function RentalContractPDF({ booking, businessSettings, mono }: RentalContractPDFProps) {
  const s = businessSettings
  const b = booking
  const primary = b.primary_client
  const secondary = b.secondary_client
  const v = b.vehicles
  const handover = b.vehicle_handovers && b.vehicle_handovers[0]

  const serial = serialFromId(b.id)
  const days = Math.max(
    1,
    Math.ceil((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / (1000 * 60 * 60 * 24))
  )
  const totalAmount = Number(b.total_amount) || 0
  const acompte = Number(b.acompte_paid) || 0
  const reste = Math.max(0, totalAmount - acompte)
  const tvaRate = Number(s.tva_rate) || 0
  const tvaAmount = tvaRate > 0 ? +(totalAmount * (tvaRate / (100 + tvaRate))).toFixed(3) : 0
  const subTotal = +(totalAmount - tvaAmount).toFixed(3)
  const dailyRate = totalAmount > 0 ? +(totalAmount / days).toFixed(3) : (v?.price_per_day || 0)

  const pickupKm = b.starting_km ?? b.starting_mileage ?? handover?.pickup_km ?? null
  const returnKm = b.return_km ?? b.return_mileage ?? handover?.return_km ?? null

  const franchise = Number(s.franchise_amount) || 1000
  const lateFee = Number(s.late_fee_per_hour) || 10
  const kmPerDay = Number(s.km_per_day) || 250

  const orDots = (v?: string | null | number) =>
    v === undefined || v === null || v === '' ? '..............................' : String(v)

  return (
    <>
      <div
        className={`contract-root contract-print-envelope ${mono ? 'mono' : ''}`}
        style={{
          color: '#000',
          background: '#fff',
          fontFamily: "'Inter', 'Arial', sans-serif",
          fontSize: '9pt',
          padding: '8mm',
          lineHeight: 1.35,
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
        }}
      >
        {/* HEADER */}
        <div
          className="contract-header page-break-avoid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 0.9fr 1.05fr',
            gap: '0.6rem',
            alignItems: 'start',
            borderBottom: '2px solid #000',
            paddingBottom: '0.6rem',
            marginBottom: '0.8rem',
          }}
        >
          <div>
            <div style={{ fontSize: '13pt', fontWeight: 900, letterSpacing: '0.02em' }}>{s.business_name || orDots()}</div>
            <div style={{ fontSize: '8pt', marginTop: '0.2rem', lineHeight: 1.4 }}>
              <div><strong>Siège social:</strong> {s.siege_social_fr_1 || s.address || orDots()}</div>
              {s.siege_social_fr_2 && <div>{s.siege_social_fr_2}</div>}
              <div style={{ marginTop: '0.25rem' }}><strong>Matricule Fiscale:</strong> {s.matricule_fiscal || orDots()}</div>
              <div>☎ {s.phone || orDots()}{s.phone_secondary ? ` / ${s.phone_secondary}` : ''}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.25rem' }}>
            {s.logo_url ? (
              <img src={s.logo_url} alt="Logo" style={{ height: '40px', maxWidth: '110px', objectFit: 'contain' }} />
            ) : (
              <div style={{ height: '40px', width: '40px', borderRadius: '50%', border: '1.5px solid #000', display: 'grid', placeItems: 'center', fontSize: '10pt', fontWeight: 900 }}>
                {(s.business_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, fontSize: '14pt', fontWeight: 900 }}>عقد كراء</div>
            <div style={{ fontSize: '11pt', fontWeight: 900 }}>Contrat de Location</div>
            <div className="serial-red" style={{ color: '#dc2626', fontSize: '11pt', fontWeight: 900, marginTop: '0.15rem', letterSpacing: '0.04em' }}>
              N° {serial}
            </div>
          </div>

          <div dir="rtl" lang="ar" style={{ textAlign: 'right', fontFamily: ARABIC_FONT_STACK }}>
            <div style={{ fontSize: '13pt', fontWeight: 900 }}>{s.business_name_ar || orDots()}</div>
            <div style={{ fontSize: '9pt', marginTop: '0.2rem', lineHeight: 1.5 }}>
              <div><strong>المقر الرئيسي:</strong> {s.siege_social_ar_1 || orDots()}</div>
              <div>{s.siege_social_ar_2 || orDots()}</div>
              <div style={{ marginTop: '0.25rem' }}><strong>المعرف الجبائي:</strong> {s.matricule_fiscal || orDots()}</div>
              <div>☎ {s.phone || orDots()}{s.phone_secondary ? ` / ${s.phone_secondary}` : ''}</div>
            </div>
          </div>
        </div>

        {/* BODY GRID 7/5 */}
        <div className="body-grid" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000' }}>
              <SectionHeader fr="LOCATAIRE / RENTER" ar="المستأجر" />
              <div style={{ padding: '0.4rem 0.6rem' }}>
                <BiLabel fr="Nom complet / Full name" ar="الإسم الكامل" value={b.client_name || primary?.full_name} />
                <BiLabel fr="Raison sociale" ar="" value={null} />
              </div>
            </section>

            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000' }}>
              <SectionHeader fr="1er Conducteur / Primary Driver" ar="السائق الأول" />
              <div style={{ padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
                <BiLabel fr="Nom et prénom" ar="إسم ولقب الكاري" value={b.client_name || primary?.full_name} />
                <BiLabel fr="Date et lieu de naissance" ar="تاريخ الولادة" value={primary?.date_naissance ? `${fmtDate(primary.date_naissance)}${primary.lieu_naissance ? ' — ' + primary.lieu_naissance : ''}` : null} />
                <BiLabel fr="Adresse" ar="العنوان" value={b.client_address || primary?.address} />
                <BiLabel fr="Tél" ar="الهاتف" value={b.client_phone || primary?.phone} />
                <BiLabel fr="Pièces Identité (CIN)" ar="ع ت وطنية عدد" value={b.client_cin_passport || primary?.cin} />
                <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={fmtDate(primary?.cin_delivre_le)} />
                <BiLabel fr="N° du permis" ar="رقم رخصة السياقة" value={b.client_license_number || primary?.permis_numero || primary?.license_number} />
                <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={fmtDate(primary?.permis_delivre_le)} />
              </div>
            </section>

            <section className={`contract-section page-break-avoid ${!secondary || !secondary.full_name ? 'co-driver-empty' : ''}`} style={{ border: '1px solid #000' }}>
              <SectionHeader fr="2ème Conducteur / Co-Driver" ar="السائق الثاني" />
              <div style={{ padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
                <BiLabel fr="Nom et prénom" ar="إسم ولقب الكاري" value={secondary?.full_name} />
                <BiLabel fr="Date et lieu de naissance" ar="تاريخ الولادة" value={secondary?.date_naissance ? `${fmtDate(secondary.date_naissance)}${secondary.lieu_naissance ? ' — ' + secondary.lieu_naissance : ''}` : null} />
                <BiLabel fr="Adresse" ar="العنوان" value={b.secondary_client_address || secondary?.address} />
                <BiLabel fr="Tél" ar="الهاتف" value={b.secondary_client_phone || secondary?.phone} />
                <BiLabel fr="Pièces Identité (CIN)" ar="ع ت وطنية عدد" value={b.secondary_client_cin_passport || secondary?.cin} />
                <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={fmtDate(secondary?.cin_delivre_le)} />
                <BiLabel fr="N° du permis" ar="رقم رخصة السياقة" value={b.secondary_client_license_number || secondary?.permis_numero || secondary?.license_number} />
                <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={fmtDate(secondary?.permis_delivre_le)} />
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000', padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
              <BiLabel fr="Marque et type" ar="النوع" value={v ? `${v.brand} ${v.model}` : null} />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '9pt', fontWeight: 600 }}>Immatriculation</span>
                <span className="tunisian-plate" style={{ display: 'flex', justifyContent: 'center' }}>
                  <TunisianPlate plate={v?.license_plate} variant="paper" size="md" />
                </span>
                <span dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, fontSize: '10pt', fontWeight: 700 }}>الرقم</span>
              </div>
            </section>

            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000', padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
              {/* Departure Row */}
              <div
                className="logistical-date-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'baseline',
                  gap: '0.25rem',
                  width: '100%',
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ fontSize: '7.5pt', fontWeight: 600, whiteSpace: 'nowrap', color: '#000' }}>Date & heure départ</span>
                <span
                  style={{
                    borderBottom: '1px dotted #555',
                    minHeight: '1em',
                    paddingLeft: '0.15rem',
                    paddingRight: '0.15rem',
                    overflow: 'visible',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    fontSize: '8.5pt',
                    textAlign: 'center',
                    color: '#000',
                  }}
                >
                  {`${fmtDate(b.start_date)} - ${b.pickup_time || '10:00'}`}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  style={{
                    fontFamily: ARABIC_FONT_STACK,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    fontSize: '8pt',
                    color: '#000',
                  }}
                >
                  تاريخ و ساعة الخروج
                </span>
              </div>

              {/* Return Row */}
              <div
                className="logistical-date-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'baseline',
                  gap: '0.25rem',
                  width: '100%',
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ fontSize: '7.5pt', fontWeight: 600, whiteSpace: 'nowrap', color: '#000' }}>Date & heure retour</span>
                <span
                  style={{
                    borderBottom: '1px dotted #555',
                    minHeight: '1em',
                    paddingLeft: '0.15rem',
                    paddingRight: '0.15rem',
                    overflow: 'visible',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    fontSize: '8.5pt',
                    textAlign: 'center',
                    color: '#000',
                  }}
                >
                  {`${fmtDate(b.end_date)} - ${b.return_time || '10:00'}`}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  style={{
                    fontFamily: ARABIC_FONT_STACK,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    fontSize: '8pt',
                    color: '#000',
                  }}
                >
                  تاريخ و ساعة الدخول
                </span>
              </div>

              <BiLabel fr="Kilomètre de départ" ar="رقم العداد عند الخروج" value={null} />
              <BiLabel fr="Kilomètre de retour" ar="رقم العداد عند العودة" value={null} />
            </section>

            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000', padding: '0.4rem 0.6rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '8.5pt' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1.2px solid #000', background: b.lavage_pickup === 'clean_wash' ? '#000' : 'transparent' }} />
                <span>Lavage Intérieur</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1.2px solid #000', background: b.lavage_return === 'clean_wash' ? '#000' : 'transparent' }} />
                <span>Lavage Extérieur</span>
              </label>
            </section>

            <section className="contract-section page-break-avoid" style={{ border: '1px solid #000', padding: '0.45rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              <BiLabel dense fr="Cautionnement et franchise" ar="الضمان" value={`${franchise.toFixed(3)} DT`} />
              <BiLabel dense fr="Payable par" ar="يدفع من قبل" value={null} />
              <BiLabel dense fr="Total des jours" ar="مجموع الأيام" value={`${days}`} />
              <BiLabel dense fr="Prix H.T." ar="السعر" value={`${subTotal.toFixed(3)} DT`} />
              <div style={{ fontSize: '7pt', textAlign: 'center', color: '#444', fontStyle: 'italic', margin: '0.15rem 0' }}>
                Ces tarifs sont pour un forfait de {kmPerDay} KM / jour
              </div>
              <BiLabel dense fr="Sous total" ar="" value={`${subTotal.toFixed(3)} DT`} />
              <BiLabel dense fr={`T.V.A (${tvaRate}%)`} ar="" value={`${tvaAmount.toFixed(3)} DT`} />
              <BiLabel dense fr="Divers / accident" ar="" value={null} />
              <BiLabel dense fr="Acompte versé" ar="" value={`${acompte.toFixed(3)} DT`} />
              <BiLabel dense fr="Remboursement" ar="" value={null} />
              <div style={{ borderTop: '1.5px solid #000', marginTop: '0.2rem', paddingTop: '0.2rem' }}>
                <BiLabel dense fr="Total T.T.C" ar="" value={`${totalAmount.toFixed(3)} DT`} />
                <BiLabel dense fr="Reste dû" ar="" value={`${reste.toFixed(3)} DT`} />
              </div>
              <div style={{ fontSize: '7.5pt', textAlign: 'right', color: '#444', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                Daily Rate: {dailyRate.toFixed(3)} DT × {days} day(s)
              </div>
            </section>

            <div className="fuel-gauge-array" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FuelGauge mode="pickup" scale={handover?.pickup_fuel} />
              <FuelGauge mode="return" scale={handover?.return_fuel} />
              <FuelGauge mode="damage" />
            </div>
          </div>
        </div>

        {/* PROLONGATION */}
        <div className="prolongation-section" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[1, 2].map((n) => (
            <div key={n} className="prolongation-row page-break-avoid" style={{ border: '1px solid #000' }}>
              <SectionHeader fr={`Prolongation ${n} (${n})`} ar="التمديد" />
              <div className="prolongation-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.5rem', padding: '0.4rem 0.6rem', alignItems: 'center', fontSize: '8.5pt' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                  <strong>Du / من يوم :</strong>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555' }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                  <strong>Au / إلى يوم :</strong>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555' }}>&nbsp;</span>
                </div>
                <div style={{ border: '1px solid #000', textAlign: 'center', padding: '0.2rem 0.4rem', fontWeight: 800 }}>
                  C{n}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DISCLAIMER */}
        <div className="disclaimer-box page-break-avoid" style={{ marginTop: '0.6rem', border: '1.5px solid #000', padding: '0.55rem 0.7rem', fontSize: '8pt', lineHeight: 1.3 }}>
          {/* Top section: Text (Dynamic or Default) + OUI Checkbox Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: s.rental_terms && s.rental_terms.trim() ? '1fr' : '1fr auto', gap: '0.6rem', alignItems: 'flex-start' }}>
            {s.rental_terms && s.rental_terms.trim() ? (
              <div 
                dir="auto" 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '7.5pt', 
                  lineHeight: '1.15', 
                  letterSpacing: '-0.01em', 
                  maxHeight: '90px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}
              >
                {s.rental_terms.trim()}
              </div>
            ) : (
              <div style={{ fontSize: '7.5pt', lineHeight: '1.2' }}>
                <strong>Remarque :</strong> En cas de vol et dérapage, le locataire est seul responsable.
                La suppression de franchise de <strong>{franchise.toFixed(3)} DT</strong> à la charge du
                locataire moyen d&apos;un supplément de <strong>{lateFee.toFixed(3)} DT</strong> par heure
                de location. Ces tarifs sont pour un forfait de <strong>{kmPerDay} Km par jour</strong>.
              </div>
            )}
            
            {!(s.rental_terms && s.rental_terms.trim()) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'center', fontWeight: 800, fontSize: '8pt', flexShrink: 0 }}>
                <span>→ OUI</span>
                <span>→ OUI</span>
              </div>
            )}
          </div>

          {/* Bottom section: Permanent Bilingual Acceptance Sign-offs */}
          <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #000', paddingTop: '0.4rem' }}>
            <div style={{ fontSize: '7.5pt', fontStyle: 'italic', lineHeight: '1.2' }}>
              Je reconnais et accepte les conditions générales de location figurant ci-contre et au verso de ce contrat.
            </div>
            <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, marginTop: '0.2rem', fontSize: '8.5pt', fontStyle: 'italic', lineHeight: '1.2' }}>
              أصرح بشرفي أني قد اطلعت على الشروط العامة المكتوبة لكراء السيارات على ظهر هذا العقد وأتعهد بإرجاع السيارة في الآجال والمكان المحددين أعلاه
            </div>
          </div>
        </div>

        {/* SIGNATURES */}
        <div className="signatures-section signatures-row" style={{ marginTop: '0.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', fontSize: '9pt' }}>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '0.4rem', textAlign: 'center' }}>
              <strong>Signature Gérant</strong>
              <div className="signature-box" style={{ height: '38px' }} />
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '0.4rem', textAlign: 'center' }}>
              <strong>Signature Client</strong>
              <div className="signature-box" style={{ height: '38px' }} />
            </div>
          </div>
        </div>

        {/* FOOTER BANNER */}
        <div
          className="footer-banner"
          style={{
            marginTop: '0.7rem',
            background: '#000',
            color: '#fff',
            padding: '0.55rem 0.75rem',
            textAlign: 'center',
            fontSize: '8.5pt',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Ce contrat doit ÊTRE PRÉSENTÉ À TOUT CONTRÔLE DE POLICE — CONSERVER-LE BIEN
          {s.email && (
            <div style={{ marginTop: '0.25rem', fontWeight: 600, fontSize: '8pt', textTransform: 'none', letterSpacing: 'normal' }}>
              ✉ {s.email}
            </div>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              html, body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .no-print, .no-print * {
                display: none !important;
              }

              @page {
                size: A4 portrait;
                margin: 0 !important; /* Disables browser header/footer text pollution */
              }

              .contract-print-envelope {
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                min-height: 297mm !important;
                padding: 5mm 8mm !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: hidden !important;
                background: #FFFFFF !important;
                color: #000000 !important;
                font-family: 'Inter', 'Arial', sans-serif;
                font-size: 8.5pt !important;
                transform: scale(0.92) !important;
                transform-origin: top center !important;
              }

              .contract-print-envelope .section-banner { 
                background: #1e40af !important; 
                color: #fff !important; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              
              .contract-print-envelope .serial-red { 
                color: #dc2626 !important;
                font-size: 11pt !important;
              }
              
              .contract-print-envelope .footer-banner { 
                background: #000 !important; 
                color: #fff !important; 
              }
              
              .contract-print-envelope.mono * { 
                color: #000 !important; 
                background: #fff !important; 
                border-color: #000 !important; 
              }
              
              .contract-print-envelope.mono .section-banner { 
                background: #000 !important; 
                color: #fff !important; 
              }
              
              .contract-print-envelope.mono .footer-banner { 
                background: #000 !important; 
                color: #fff !important; 
              }
              
              .contract-print-envelope.mono .serial-red { 
                color: #000 !important; 
              }

              /* In-Form Structural Micro-Compacts */
              
              /* 1. Empty Co-Driver Box Height-Shaving */
              .contract-print-envelope .co-driver-empty {
                margin-bottom: 0px !important;
              }
              .contract-print-envelope .co-driver-empty .section-banner {
                padding: 0.1rem 0.4rem !important;
              }
              .contract-print-envelope .co-driver-empty .section-banner span {
                font-size: 7.5pt !important;
              }
              .contract-print-envelope .co-driver-empty div,
              .contract-print-envelope .co-driver-empty span,
              .contract-print-envelope .co-driver-empty label {
                font-size: 7pt !important;
                line-height: 1.0 !important;
                padding-top: 0px !important;
                padding-bottom: 0px !important;
                margin-top: 0px !important;
                margin-bottom: 0px !important;
              }

              /* 2. Fuel Gauge Array Compression */
              .contract-print-envelope .fuel-gauge-array {
                gap: 0.1rem !important;
              }
              .contract-print-envelope .fuel-gauge-array > div {
                padding: 0.15rem 0.35rem !important;
                gap: 0.05rem !important;
                margin-bottom: 0px !important;
              }
              .contract-print-envelope .fuel-gauge-array > div > div:first-child {
                font-size: 7pt !important;
              }
              .contract-print-envelope .fuel-gauge-array > div > div:first-child span {
                font-size: 7pt !important;
              }
              .contract-print-envelope .fuel-gauge-array > div > div:nth-child(2) {
                font-size: 7.5pt !important;
              }
              .contract-print-envelope .fuel-gauge-array div div span span {
                width: 8px !important;
                height: 8px !important;
              }

              /* 3. Global Text Scaling Override */
              .contract-print-envelope label,
              .contract-print-envelope span,
              .contract-print-envelope strong {
                font-size: 8pt !important;
                line-height: 1.1 !important;
              }
              .contract-print-envelope .section-banner span {
                font-size: 8.5pt !important;
                line-height: 1.2 !important;
              }

              /* 4. Defensive Header and Component Preservation */
              .contract-print-envelope .contract-header div,
              .contract-print-envelope .contract-header span,
              .contract-print-envelope .contract-header strong {
                font-size: unset !important;
                line-height: unset !important;
              }
              .contract-print-envelope .footer-banner,
              .contract-print-envelope .footer-banner div {
                font-size: 8.5pt !important;
                line-height: 1.2 !important;
              }
              .contract-print-envelope .tunisian-plate * {
                font-size: inherit !important;
                line-height: inherit !important;
              }

              /* 5. Logistical Date Row Override to prevent truncation */
              .contract-print-envelope .logistical-date-row {
                letter-spacing: -0.03em !important;
              }
              .contract-print-envelope .logistical-date-row span:first-child {
                font-size: 7.5pt !important;
              }
              .contract-print-envelope .logistical-date-row span:nth-child(2) {
                font-size: 8.5pt !important;
                font-weight: 700 !important;
              }
              .contract-print-envelope .logistical-date-row span:last-child {
                font-size: 8pt !important;
              }
            }
          `,
        }}
      />
    </>
  )
}
