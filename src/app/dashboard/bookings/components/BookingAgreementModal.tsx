'use client'

/**
 * Phase 16.4 — Bilingual Tunisian rental contract (BookingAgreementModal).
 *
 * Full rewrite to structurally mirror the agency's standard paper lease form.
 * Key principles:
 *
 *  • Strict A4 portrait (210 × 297 mm) bounded layout.
 *  • Asymmetrical grid: 58% left + 42% right.
 *  • Bilingual (FR / AR) labels via <BiLabel>, RTL-aware.
 *  • Settings-driven header (FR-left / Logo-center / AR-right).
 *  • Serial number derived stably from booking.id.
 *  • 3-tier fuel telemetry: pickup gauge, return gauge, damage-tracker frame.
 *  • 9-row financial ledger.
 *  • Dual print mode: color-on vs monochrome toggle.
 *
 * Multi-tenant isolation: no DB writes from this component. Receives `booking`
 * + `businessSettings` as props.
 */

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { Booking, BusinessSettings } from '@/types'
import BiLabel from '@/lib/contracts/BilingualLabel'
import SectionHeader from '@/lib/contracts/SectionHeader'
import TunisianPlate from '@/lib/contracts/TunisianPlate'
import FuelGauge from '@/lib/contracts/FuelGauge'
import { useLanguage } from '@/lib/i18n'

interface BookingAgreementModalProps {
  booking: Booking | null
  businessSettings: BusinessSettings
  onClose: () => void
}

const ARABIC_FONT_STACK = "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif"

/** Format a YYYY-MM-DD or ISO string into DD/MM/YYYY without timezone drift. */
function fmtDate(s?: string | null): string {
  if (!s) return ''
  const parts = s.split('T')[0].split('-')
  if (parts.length !== 3) return s
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/** Stable 6-char serial derived from booking ID. */
function serialFromId(id: string): string {
  const hex = id.replace(/-/g, '').toUpperCase()
  return hex.slice(-6)
}

function CompactProlongation({
  index,
  stamp,
}: {
  index: number
  stamp: string
}) {
  return (
    <div className="compact-prolongation-row">
      <div className="compact-prolongation-main">
        <div className="compact-prolongation-title">
          <span>PROLONGATION {index}</span>
          <span dir="rtl" lang="ar">التمديد</span>
        </div>

        <div className="compact-prolongation-dates">
          <div className="compact-date-field">
            <strong>Du / من يوم :</strong>
            <span />
          </div>

          <div className="compact-date-field">
            <strong>Au / إلى يوم :</strong>
            <span />
          </div>
        </div>
      </div>

      <div className="compact-stamp-box">
        {stamp}
      </div>
    </div>
  )
}

function useFitContractToA4(deps: any[] = []) {
  const pageRef = useRef<HTMLDivElement>(null)
  const termsBoxRef = useRef<HTMLDivElement>(null)
  const termsTextRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    const termsBox = termsBoxRef.current
    const termsText = termsTextRef.current
    if (!page || !termsBox || !termsText) return

    let raf = 0

    const fit = () => {
      page.classList.remove('contract-too-long')

      let baseFont = 7.8
      let gap = 2.0
      let termsFont = 10.0
      let termsLine = 1.12
      let signatureH = 10.0

      const applyVars = () => {
        page.style.setProperty('--base-font', `${baseFont.toFixed(1)}pt`)
        page.style.setProperty('--gap', `${gap.toFixed(1)}mm`)
        page.style.setProperty('--terms-font', `${termsFont.toFixed(1)}pt`)
        page.style.setProperty('--terms-line', `${termsLine}`)
        page.style.setProperty('--signature-h', `${signatureH.toFixed(1)}mm`)
      }

      applyVars()
      void page.offsetHeight

      // 1) Ken page overflow min fixed content, compacti chwaya
      for (let i = 0; i < 40; i++) {
        const pageOverflow = page.scrollHeight > page.clientHeight + 1
        if (!pageOverflow) break

        if (gap > 1.1) {
          gap -= 0.1
        } else if (signatureH > 7.0) {
          signatureH -= 0.3
        } else if (baseFont > 7.1) {
          baseFont -= 0.1
        } else {
          break
        }

        applyVars()
        void page.offsetHeight
      }

      // 2) Remarque starts BIG. Shrink only if it overflows.
      termsFont = 10.0
      termsLine = 1.12
      applyVars()
      void page.offsetHeight

      for (let i = 0; i < 80; i++) {
        const termsOverflow = termsText.scrollHeight > termsBox.clientHeight + 1
        const pageOverflow = page.scrollHeight > page.clientHeight + 1

        if (!termsOverflow && !pageOverflow) break

        if (termsFont > 4.8) {
          termsFont -= 0.2
          termsLine = termsFont < 5.6 ? 1.03 : 1.08
          applyVars()
          void page.offsetHeight
        } else {
          page.classList.add('contract-too-long')
          break
        }
      }
    }

    const scheduleFit = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }

    scheduleFit()

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleFit)
    }

    window.addEventListener('beforeprint', fit)
    window.addEventListener('resize', scheduleFit)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('beforeprint', fit)
      window.removeEventListener('resize', scheduleFit)
    }
  }, deps)

  return { pageRef, termsBoxRef, termsTextRef }
}

export default function BookingAgreementModal({
  booking,
  businessSettings,
  onClose,
}: BookingAgreementModalProps) {
  const { lang } = useLanguage()
  const isFr = lang === 'fr'

  const [mono, setMono] = useState(false)
  const [fillOptions, setFillOptions] = useState({
    locataire: true,
    conducteur1: true,
    conducteur2: true,
    carInfo: true,
    dateInfo: true,
    prixInfo: true,
  })

  const cleanValue = (value?: string | number | null) => {
    if (value === null || value === undefined) return ''
    const text = String(value).trim()
    if (!text) return ''
    const placeholders = ['n/a', 'na', 'null', 'undefined', '-']
    if (placeholders.includes(text.toLowerCase())) return ''
    return text
  }

  const showValue = (
    enabled: boolean,
    value?: string | number | null
  ) => {
    if (!enabled) return ''
    return cleanValue(value)
  }

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

  const termsText = useMemo(() => {
    return businessSettings.rental_terms?.trim() || ''
  }, [businessSettings.rental_terms])

  const serial = useMemo(() => {
    return booking ? serialFromId(booking.id) : ''
  }, [booking])

  const { pageRef, termsBoxRef, termsTextRef } = useFitContractToA4([
    mounted,
    booking !== null,
    termsText,
    booking?.client_name ?? '',
    booking?.primary_client?.full_name ?? '',
    booking?.vehicles?.license_plate ?? '',
    serial,
    fillOptions.locataire,
    fillOptions.conducteur1,
    fillOptions.conducteur2,
    fillOptions.carInfo,
    fillOptions.dateInfo,
    fillOptions.prixInfo,
  ])

  if (!mounted || !booking) return null

  const s = businessSettings
  const b = booking
  const primary = b.primary_client
  const secondary = b.secondary_client
  const v = b.vehicles
  const handover = b.vehicle_handovers && b.vehicle_handovers[0]

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

  return createPortal(
    <div className="modal-overlay print-agreement-container" style={{ background: 'rgba(15, 15, 15, 0.85)' }}>
      <div
        ref={contentRef}
        className="modal-content"
        style={{
          maxWidth: '900px',
          width: '95%',
          background: '#ffffff',
          color: '#000',
          border: '1px solid #cbd5e1',
          boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
          padding: '0',
          overflowY: 'auto',
          maxHeight: '92vh',
        }}
      >
        {/* ── Top action bar (hidden on print) ── */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
            {isFr ? 'Contrat de Location — Aperçu Impression A4' : 'Rental Agreement — A4 Print Preview'}
          </span>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="print-fill-options">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={mono}
                  onChange={(e) => setMono(e.target.checked)}
                  style={{ accentColor: '#0f172a' }}
                />
                {isFr ? 'Imprimer en monochrome' : 'Print in monochrome'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.locataire}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, locataire: e.target.checked }))
                  }
                />
                {isFr ? 'Locataire' : 'Renter'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.conducteur1}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, conducteur1: e.target.checked }))
                  }
                />
                {isFr ? 'Conducteur 1' : 'Driver 1'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.conducteur2}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, conducteur2: e.target.checked }))
                  }
                />
                {isFr ? 'Conducteur 2' : 'Driver 2'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.carInfo}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, carInfo: e.target.checked }))
                  }
                />
                {isFr ? 'Info véhicule' : 'Car info'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.dateInfo}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, dateInfo: e.target.checked }))
                  }
                />
                {isFr ? 'Info dates' : 'Date info'}
              </label>

              <label className="print-option-toggle no-print">
                <input
                  type="checkbox"
                  checked={fillOptions.prixInfo}
                  onChange={(e) =>
                    setFillOptions(prev => ({ ...prev, prixInfo: e.target.checked }))
                  }
                />
                {isFr ? 'Info prix' : 'Price info'}
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="btn-primary"
                style={{ background: '#e5c17d', color: '#000', fontWeight: 700, padding: '0.5rem 0.95rem', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>{isFr ? 'Imprimer / PDF' : 'Print / PDF'}</span>
              </button>
              <button
                className="btn-secondary"
                style={{ background: '#e2e8f0', color: '#1e293b', fontWeight: 600, padding: '0.5rem 0.85rem', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={onClose}
              >
                <X size={15} />
                {isFr ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Contract root — print-target ── */}
        <div
          ref={pageRef}
          className={`contract-root contract-a4 ${mono ? 'mono' : ''}`}
        >
          {/* ── HEADER (3 zones) ── */}
          <div className="contract-header">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.05fr 0.9fr 1.05fr',
                gap: '0.6rem',
                alignItems: 'start',
                borderBottom: '2px solid #000',
                paddingBottom: '0.6rem',
              }}
            >
              {/* Left: French agency block */}
              <div>
                <div style={{ fontSize: '13pt', fontWeight: 900, letterSpacing: '0.02em', color: '#000' }}>
                  {s.business_name || orDots()}
                </div>
                <div style={{ fontSize: '8pt', marginTop: '0.2rem', lineHeight: 1.4 }}>
                  {s.siege_social_fr_1 ? (
                    <div><strong>Siège social:</strong> {s.siege_social_fr_1}</div>
                  ) : (
                    <div><strong>Siège social:</strong> {orDots()}</div>
                  )}
                  {s.siege_social_fr_2 ? (
                    <div>{s.siege_social_fr_2}</div>
                  ) : s.address ? (
                    <div>{s.address}</div>
                  ) : (
                    <div>{orDots()}</div>
                  )}
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>Matricule Fiscale:</strong> {s.matricule_fiscal || orDots()}
                  </div>
                  <div>☎ {s.phone || orDots()}{s.phone_secondary ? ` / ${s.phone_secondary}` : ''}</div>
                </div>
              </div>

              {/* Center: logo + bilingual contract title + serial */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', textAlign: 'center', gap: '0.25rem' }}>
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt="Logo"
                    style={{ height: '40px', maxWidth: '110px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ height: '40px', width: '40px', borderRadius: '50%', border: '1.5px solid #000', display: 'grid', placeItems: 'center', fontSize: '10pt', fontWeight: 900 }}>
                    {(s.business_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.05rem' }}>
                  <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, fontSize: '14pt', fontWeight: 900 }}>
                    عقد كراء
                  </div>
                  <div style={{ fontSize: '11pt', fontWeight: 900, letterSpacing: '0.02em' }}>
                    Contrat de Location
                  </div>
                </div>
                <div
                  className="serial-red"
                  style={{ color: '#dc2626', fontSize: '11pt', fontWeight: 900, marginTop: '0.15rem', letterSpacing: '0.04em' }}
                >
                  N° {serial}
                </div>
              </div>

              {/* Right: Arabic agency block (RTL) */}
              <div dir="rtl" lang="ar" style={{ textAlign: 'right', fontFamily: ARABIC_FONT_STACK }}>
                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#000' }}>
                  {s.business_name_ar || orDots()}
                </div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem', lineHeight: 1.5 }}>
                  <div><strong>المقر الرئيسي:</strong> {s.siege_social_ar_1 || orDots()}</div>
                  <div>{s.siege_social_ar_2 || orDots()}</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>المعرف الجبائي:</strong> {s.matricule_fiscal || orDots()}
                  </div>
                  <div>☎ {s.phone || orDots()}{s.phone_secondary ? ` / ${s.phone_secondary}` : ''}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── BODY GRID ── */}
          <div className="contract-main">
            {/* ─────────── LEFT COLUMN ─────────── */}
            <div className="contract-left-col">
              {/* LOCATAIRE / RENTER */}
              <section className="contract-section page-break-avoid">
                <SectionHeader fr="LOCATAIRE / RENTER" ar="المستأجر" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <BiLabel fr="Nom complet / Full name" ar="الإسم الكامل" value={showValue(fillOptions.locataire, b.client_name || primary?.full_name)} />
                  <BiLabel fr="Raison sociale" ar="" value={showValue(fillOptions.locataire, null)} />
                </div>
              </section>

              {/* 1er Conducteur */}
              <section className="contract-section page-break-avoid">
                <SectionHeader fr="1er Conducteur / Primary Driver" ar="السائق الأول" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <BiLabel fr="Nom et prénom" ar="إسم ولقب الكاري" value={showValue(fillOptions.conducteur1, b.client_name || primary?.full_name)} />
                  <BiLabel
                    fr="Date et lieu de naissance"
                    ar="تاريخ الولادة"
                    value={showValue(
                      fillOptions.conducteur1,
                      primary?.date_naissance
                        ? `${fmtDate(primary.date_naissance)}${primary.lieu_naissance ? ' — ' + primary.lieu_naissance : ''}`
                        : null
                    )}
                  />
                  <BiLabel fr="Adresse" ar="العنوان" value={showValue(fillOptions.conducteur1, b.client_address || primary?.address)} />
                  <BiLabel fr="Tél" ar="الهاتف" value={showValue(fillOptions.conducteur1, b.client_phone || primary?.phone)} />
                  <BiLabel fr="Pièces Identité (CIN)" ar="ع ت وطنية عدد" value={showValue(fillOptions.conducteur1, b.client_cin_passport || primary?.cin)} />
                  <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={showValue(fillOptions.conducteur1, fmtDate(primary?.cin_delivre_le))} />
                  <BiLabel fr="N° du permis" ar="رقم رخصة السياقة" value={showValue(fillOptions.conducteur1, b.client_license_number || primary?.permis_numero || primary?.license_number)} />
                  <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={showValue(fillOptions.conducteur1, fmtDate(primary?.permis_delivre_le))} />
                </div>
              </section>

              {/* 2ème Conducteur */}
              <section className={`contract-section page-break-avoid ${!secondary || !secondary.full_name ? 'co-driver-empty' : ''}`}>
                <SectionHeader fr="2ème Conducteur / Co-Driver" ar="السائق الثاني" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <BiLabel fr="Nom et prénom" ar="إسم ولقب الكاري" value={showValue(fillOptions.conducteur2, secondary?.full_name)} />
                  <BiLabel
                    fr="Date et lieu de naissance"
                    ar="تاريخ الولادة"
                    value={showValue(
                      fillOptions.conducteur2,
                      secondary?.date_naissance
                        ? `${fmtDate(secondary.date_naissance)}${secondary.lieu_naissance ? ' — ' + secondary.lieu_naissance : ''}`
                        : null
                    )}
                  />
                  <BiLabel fr="Adresse" ar="العنوان" value={showValue(fillOptions.conducteur2, b.secondary_client_address || secondary?.address)} />
                  <BiLabel fr="Tél" ar="الهاتف" value={showValue(fillOptions.conducteur2, b.secondary_client_phone || secondary?.phone)} />
                  <BiLabel fr="Pièces Identité (CIN)" ar="ع ت وطنية عدد" value={showValue(fillOptions.conducteur2, b.secondary_client_cin_passport || secondary?.cin)} />
                  <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={showValue(fillOptions.conducteur2, fmtDate(secondary?.cin_delivre_le))} />
                  <BiLabel fr="N° du permis" ar="رقم رخصة السياقة" value={showValue(fillOptions.conducteur2, b.secondary_client_license_number || secondary?.permis_numero || secondary?.license_number)} />
                  <BiLabel fr="Délivré le" ar="تاريخ إصدارها" value={showValue(fillOptions.conducteur2, fmtDate(secondary?.permis_delivre_le))} />
                </div>
              </section>

              {/* Compact Prolongations */}
              <div className="compact-prolongations">
                <CompactProlongation index={1} stamp="C1" />
                <CompactProlongation index={2} stamp="C2" />
              </div>
            </div>

            {/* ─────────── RIGHT COLUMN ─────────── */}
            <div className="contract-right-col">
              {/* Vehicle capsule */}
              <section className="contract-section page-break-avoid" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <BiLabel fr="Marque et type" ar="النوع" value={showValue(fillOptions.carInfo, v ? `${v.brand} ${v.model}` : null)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>Immatriculation</span>
                  <span className="tunisian-plate" style={{ display: 'flex', justifyContent: 'center' }}>
                    {fillOptions.carInfo ? (
                      <TunisianPlate plate={cleanValue(v?.license_plate)} variant="paper" size="md" />
                    ) : (
                      <span className="empty-plate-line" />
                    )}
                  </span>
                  <span dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, fontWeight: 700 }}>الرقم</span>
                </div>
              </section>

              {/* Departure + return time-tracking */}
              <section className="contract-section page-break-avoid" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {/* Departure Row */}
                <div
                  className="logistical-date-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)',
                    alignItems: 'baseline',
                    gap: '0.25rem',
                    width: '100%',
                    letterSpacing: '-0.02em',
                  }}
                >
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: '#000' }}>Date & heure départ</span>
                  <span
                    style={{
                      borderBottom: '1px dotted #555',
                      minHeight: '1em',
                      paddingLeft: '0.15rem',
                      paddingRight: '0.15rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      textAlign: 'center',
                      color: '#000',
                    }}
                  >
                    {showValue(fillOptions.dateInfo, `${fmtDate(b.start_date)} - ${b.pickup_time || '10:00'}`)}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    style={{
                      fontFamily: ARABIC_FONT_STACK,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
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
                    gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)',
                    alignItems: 'baseline',
                    gap: '0.25rem',
                    width: '100%',
                    letterSpacing: '-0.02em',
                  }}
                >
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: '#000' }}>Date & heure retour</span>
                  <span
                    style={{
                      borderBottom: '1px dotted #555',
                      minHeight: '1em',
                      paddingLeft: '0.15rem',
                      paddingRight: '0.15rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      textAlign: 'center',
                      color: '#000',
                    }}
                  >
                    {showValue(fillOptions.dateInfo, `${fmtDate(b.end_date)} - ${b.return_time || '10:00'}`)}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    style={{
                      fontFamily: ARABIC_FONT_STACK,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: '#000',
                    }}
                  >
                    تاريخ و ساعة الدخول
                  </span>
                </div>

                <BiLabel fr="Kilomètre de départ" ar="رقم العداد عند الخروج" value={showValue(fillOptions.dateInfo, pickupKm !== null ? `${pickupKm} KM` : null)} />
                <BiLabel fr="Kilomètre de retour" ar="رقم العداد عند العودة" value={showValue(fillOptions.dateInfo, returnKm !== null ? `${returnKm} KM` : null)} />
              </section>

              {/* Cleaning checks */}
              <section className="contract-section page-break-avoid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="print-empty-checkbox" />
                  <span>Lavage Intérieur</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="print-empty-checkbox" />
                  <span>Lavage Extérieur</span>
                </label>
              </section>

              {/* 9-row Financial ledger */}
              <section className="contract-section page-break-avoid" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <BiLabel dense fr="Cautionnement et franchise" ar="الضمان" value={showValue(fillOptions.prixInfo, `${franchise.toFixed(3)} DT`)} />
                <BiLabel dense fr="Payable par" ar="يدفع من قبل" value={showValue(fillOptions.prixInfo, null)} />
                <BiLabel dense fr="Total des jours" ar="مجموع الأيام" value={showValue(fillOptions.prixInfo, `${days}`)} />
                <BiLabel dense fr="Prix H.T." ar="السعر" value={showValue(fillOptions.prixInfo, `${subTotal.toFixed(3)} DT`)} />
                <div style={{ fontSize: '6.8pt', textAlign: 'center', color: '#444', fontStyle: 'italic', margin: '0.08rem 0' }}>
                  Ces tarifs sont pour un forfait de {kmPerDay} KM / jour
                </div>
                <BiLabel dense fr="Sous total" ar="" value={showValue(fillOptions.prixInfo, `${subTotal.toFixed(3)} DT`)} />
                <BiLabel dense fr={`T.V.A (${tvaRate}%)`} ar="" value={showValue(fillOptions.prixInfo, `${tvaAmount.toFixed(3)} DT`)} />
                <BiLabel dense fr="Divers / accident" ar="" value={showValue(fillOptions.prixInfo, null)} />
                <BiLabel dense fr="Acompte versé" ar="" value={showValue(fillOptions.prixInfo, `${acompte.toFixed(3)} DT`)} />
                <BiLabel dense fr="Remboursement" ar="" value={showValue(fillOptions.prixInfo, null)} />
                <div style={{ borderTop: '1.5px solid #000', marginTop: '0.15rem', paddingTop: '0.15rem' }}>
                  <BiLabel dense fr="Total T.T.C" ar="" value={showValue(fillOptions.prixInfo, `${totalAmount.toFixed(3)} DT`)} />
                  <BiLabel dense fr="Reste dû" ar="" value={showValue(fillOptions.prixInfo, `${reste.toFixed(3)} DT`)} />
                </div>
                <div style={{ fontSize: '6.8pt', textAlign: 'right', color: '#444', marginTop: '0.08rem', fontFamily: 'monospace' }}>
                  {fillOptions.prixInfo ? `Daily Rate: ${dailyRate.toFixed(3)} DT × ${days} day(s)` : '\u00A0'}
                </div>
              </section>

              {/* 3-tier fuel telemetry */}
              <div className="fuel-gauge-array" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <FuelGauge mode="pickup" scale={handover?.pickup_fuel} />
                <FuelGauge mode="return" scale={handover?.return_fuel} />
                <FuelGauge mode="damage" />
              </div>
            </div>
          </div>

          {/* ── DISCLAIMER / FINE PRINT ── */}
          <div ref={termsBoxRef} className="contract-terms disclaimer-box page-break-avoid">
            <div ref={termsTextRef} className="terms-text">
              {/* Top section: Text + OUI Checkbox Targets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'flex-start' }}>
                {termsText.length > 0 ? (
                  <div
                    dir="auto"
                    style={{
                      whiteSpace: 'pre-wrap',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {termsText}
                  </div>
                ) : (
                  <div>
                    <strong>Remarque :</strong> En cas de vol et dérapage, le locataire est seul responsable.
                    La suppression de franchise de <strong>{franchise.toFixed(3)} DT</strong> à la charge du
                    locataire moyen d&apos;un supplément de <strong>{lateFee.toFixed(3)} DT</strong> par heure
                    de location. Ces tarifs sont pour un forfait de <strong>{kmPerDay} Km par jour</strong>.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'center', fontWeight: 800, flexShrink: 0 }}>
                  <span>→ OUI</span>
                  <span>→ OUI</span>
                </div>
              </div>

              {/* Bottom section: Permanent Bilingual Acceptance Sign-offs */}
              <div style={{ marginTop: '0.3rem', borderTop: '1px dashed #000', paddingTop: '0.3rem' }}>
                <div style={{ fontStyle: 'italic' }}>
                  Je reconnais et accepte les conditions générales de location figurant ci-contre et au verso de ce contrat.
                </div>
                <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, marginTop: '0.15rem', fontStyle: 'italic' }}>
                  أصرح بشرفي أني قد اطلعت على الشروط العامة المكتوبة لكراء السيارات على ظهر هذا العقد وأتعهد بإرجاع السيارة في الآجال والمكان المحددين أعلاه
                </div>
              </div>
            </div>
          </div>

          {/* ── SIGNATURES ── */}
          <div className="contract-signatures signatures-row signatures-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.3rem', textAlign: 'center' }}>
                <strong>Signature Gérant</strong>
                <div className="signature-box" style={{ border: '1px dashed #ccc', marginTop: '0.3rem' }} />
              </div>
            </div>
            <div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.3rem', textAlign: 'center' }}>
                <strong>Signature Client</strong>
                <div className="signature-box" style={{ border: '1px dashed #ccc', marginTop: '0.3rem' }} />
              </div>
            </div>
          </div>

          {/* ── BOTTOM BAR ── */}
          <div className="contract-bottom-bar">
            CE CONTRAT DOIT ÊTRE PRÉSENTÉ À TOUT CONTRÔLE DE POLICE — CONSERVER-LE BIEN
            {s.email && ` — ✉ ${s.email}`}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 portrait;
              margin: 0;
            }

            .contract-a4 {
              width: 210mm;
              height: 297mm;
              padding: 8mm;
              position: relative;
              box-sizing: border-box;
              background: #fff;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              margin: 0 auto;

              --base-font: 7.8pt;
              --gap: 2mm;
              --terms-font: 10pt;
              --terms-line: 1.12;
              --signature-h: 10mm;

              color: #000;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .contract-a4 * {
              box-sizing: border-box;
            }

            .contract-header,
            .contract-main,
            .contract-signatures,
            .contract-bottom-bar {
              flex: 0 0 auto;
            }

            .contract-header {
              margin-bottom: var(--gap);
            }

            .contract-main {
              min-height: 0;
              display: grid;
              grid-template-columns: 58% 42%;
              gap: var(--gap);
              font-size: var(--base-font);
              line-height: 1.18;
            }

            .contract-left-col,
            .contract-right-col {
              display: flex;
              flex-direction: column;
              gap: calc(var(--gap) * 0.85);
              min-height: 0;
            }

            .contract-section {
              border: 1px solid #000;
              background: #fff;
              padding: 1.3mm 1.8mm;
            }

            .contract-section .section-banner {
              margin: -1.3mm -1.8mm 1.2mm -1.8mm;
            }

            .contract-main label,
            .contract-main span,
            .contract-main strong {
              font-size: var(--base-font) !important;
              line-height: 1.18 !important;
            }

            .contract-main .section-banner span {
              font-size: calc(var(--base-font) * 1.08) !important;
            }

            .contract-main .section-banner span[dir="rtl"] {
              font-size: calc(var(--base-font) * 1.22) !important;
            }

            .bilabel-normal {
              line-height: 1.2;
            }

            .bilabel-dense {
              line-height: 1.12;
            }

            .bilabel-normal,
            .bilabel-dense {
              --bilabel-gap: 1mm;
            }

            .contract-main .bilabel-dense span,
            .contract-main .bilabel-dense label,
            .contract-main .bilabel-dense strong {
              font-size: calc(var(--base-font) * 0.92) !important;
              line-height: 1.12 !important;
            }

            .compact-prolongations {
              display: flex;
              flex-direction: column;
              gap: 1.1mm;
              margin-top: var(--gap);
            }

            .compact-prolongation-row {
              display: grid;
              grid-template-columns: 1fr 20mm;
              border: 1px solid #000;
              min-height: 14mm;
              overflow: hidden;
              background: #fff;
            }

            .compact-prolongation-main {
              display: flex;
              flex-direction: column;
              min-width: 0;
            }

            .compact-prolongation-title {
              height: 5.2mm;
              background: #2548b8;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 2mm;
              font-weight: 800;
              font-size: calc(var(--base-font) * 0.95);
              letter-spacing: 0.2px;
            }

            .compact-prolongation-title span {
              color: #fff !important;
            }

            .compact-prolongation-dates {
              flex: 1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2mm;
              align-items: center;
              padding: 1.5mm 2mm;
            }

            .compact-date-field {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 1.2mm;
              align-items: end;
              min-width: 0;
              font-size: calc(var(--base-font) * 0.95);
              white-space: nowrap;
            }

            .compact-date-field span {
              display: block;
              border-bottom: 1px dotted #333;
              min-width: 0;
              height: 3.2mm;
            }

            .compact-stamp-box {
              border-left: 1px solid #000;
              background: #f5f5f5;
              color: #777;
              font-size: 9.5pt;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .contract-terms {
              flex: 1 1 auto;
              min-height: 20mm;
              margin-top: var(--gap);
              border: 1px solid #000;
              padding: 1.3mm 1.7mm;
              overflow: hidden;
              display: flex;
            }

            .terms-text {
              flex: 1 1 auto;
              height: 100%;
              overflow: hidden;
              font-size: var(--terms-font);
              line-height: var(--terms-line);
            }

            .contract-signatures {
              margin-top: var(--gap);
            }

            .contract-signatures .signature-box {
              height: var(--signature-h) !important;
            }

            .contract-bottom-bar {
              margin-top: var(--gap);
              background: #000;
              color: #fff;
              text-align: center;
              font-size: 7.5pt;
              font-weight: bold;
              padding: 2mm;
            }

            .contract-a4.mono * {
              color: #000 !important;
              background: #fff !important;
              border-color: #000 !important;
            }

            .contract-a4.mono .section-banner,
            .contract-a4.mono .footer-banner,
            .contract-a4.mono .contract-bottom-bar,
            .contract-a4.mono .compact-prolongation-title {
              background: #000 !important;
              color: #fff !important;
            }

            .contract-a4.mono .section-banner *,
            .contract-a4.mono .footer-banner *,
            .contract-a4.mono .contract-bottom-bar *,
            .contract-a4.mono .compact-prolongation-title * {
              color: #fff !important;
              background: transparent !important;
            }

            .contract-too-long::after {
              content: "Contract content too long for one A4 page";
              position: absolute;
              top: 2mm;
              right: 2mm;
              background: #b00020;
              color: #fff;
              font-size: 7pt;
              padding: 1mm 2mm;
              z-index: 9999;
            }

            .print-fill-options {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              flex-wrap: wrap;
            }

            .print-option-toggle {
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              font-size: 0.9rem;
              white-space: nowrap;
              color: #334155;
              cursor: pointer;
              user-select: none;
            }

            .print-option-toggle input {
              accent-color: #0f172a;
              cursor: pointer;
            }

            .empty-plate-line {
              display: inline-block;
              width: 38mm;
              border-bottom: 1px dotted #555;
              height: 4mm;
            }

            .print-empty-checkbox {
              display: inline-block;
              width: 3.2mm;
              height: 3.2mm;
              border: 1px solid #000;
              background: #fff;
              vertical-align: middle;
              margin-right: 1.2mm;
            }

            @media print {
              .contract-too-long::after {
                display: none !important;
              }

              html,
              body {
                width: 210mm;
                height: 297mm;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                background: #fff !important;
              }

              body * {
                visibility: hidden !important;
              }

              body > *:not(.print-agreement-container) {
                display: none !important;
              }

              .print-agreement-container,
              .print-agreement-container *,
              .contract-a4,
              .contract-a4 * {
                visibility: visible !important;
              }

              .no-print,
              .no-print * {
                display: none !important;
                visibility: hidden !important;
              }

              .print-agreement-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: hidden !important;
                background: #fff !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
              }

              .modal-content {
                position: static !important;
                width: 210mm !important;
                height: 297mm !important;
                max-width: none !important;
                max-height: none !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: hidden !important;
                box-shadow: none !important;
                border: none !important;
                background: #fff !important;
              }

              .contract-a4 {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                padding: 8mm !important;
                margin: 0 !important;
                overflow: hidden !important;
                page-break-before: avoid !important;
                page-break-after: avoid !important;
                break-before: avoid !important;
                break-after: avoid !important;
              }
            }
          `,
        }}
      />
    </div>,
    document.body
  )
}
