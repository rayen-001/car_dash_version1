/**
 * Blue section banner used at the top of each block on the printed contract.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ LOCATAIRE / RENTER                                  المستأجر    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Default: corporate blue background, white text (matches the paper form).
 * When the parent contract wrapper has the `.mono` class (monochrome print
 * mode), the @media print rules in BookingAgreementModal flip it to pure
 * black background — no extra work needed here.
 */

import React from 'react'

interface SectionHeaderProps {
  fr: string
  ar: string
}

const ARABIC_FONT_STACK = "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif"

export default function SectionHeader({ fr, ar }: SectionHeaderProps) {
  return (
    <div
      className="section-banner"
      style={{
        background: '#1e40af',
        color: '#ffffff',
        padding: '0.32rem 0.7rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '8.5pt',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderRadius: '2px',
      }}
    >
      <span>{fr}</span>
      <span
        dir="rtl"
        lang="ar"
        style={{
          fontFamily: ARABIC_FONT_STACK,
          fontSize: '10pt',
          letterSpacing: 'normal',
        }}
      >
        {ar}
      </span>
    </div>
  )
}
