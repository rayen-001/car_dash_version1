/**
 * Bilingual label row used throughout the printed Tunisian rental contract.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ French label : ........................... : Arabic equivalent   │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The dotted leader between French and Arabic is the same convention used on
 * the paper form. When `value` is provided it replaces the dotted leader with
 * the actual data. When `value` is empty/null, the dotted leader stays so the
 * operator can hand-write it on the printout.
 *
 * The Arabic span gets `dir="rtl"` and a font stack that prefers Naskh /
 * Tahoma / Arial so right-to-left renders correctly in print.
 */

import React from 'react'

interface BiLabelProps {
  fr: string
  ar: string
  value?: string | null | React.ReactNode
  /** Tighter line-height for ultra-dense rows (e.g. financial table). */
  dense?: boolean
}

const ARABIC_FONT_STACK = "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif"

export default function BiLabel({ fr, ar, value, dense }: BiLabelProps) {
  const hasValue = value !== undefined && value !== null && value !== ''
  return (
    <div
      className={dense ? 'bilabel-dense' : 'bilabel-normal'}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)',
        alignItems: 'baseline',
        gap: 'var(--bilabel-gap, 0.4rem)',
      }}
    >
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fr}</span>
      <span
        className="bilabel-value"
        style={{
          borderBottom: '1px dotted #555',
          minHeight: '1em',
          paddingLeft: '0.25rem',
          paddingRight: '0.25rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: hasValue ? 600 : 400,
        }}
      >
        {hasValue ? value : ''}
      </span>
      <span
        dir="rtl"
        lang="ar"
        style={{
          fontFamily: ARABIC_FONT_STACK,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          fontSize: dense ? '9pt' : '10pt',
        }}
      >
        {ar}
      </span>
    </div>
  )
}
