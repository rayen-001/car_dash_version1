/**
 * Fuel gauge component used in the printed Tunisian rental contract.
 *
 *   E   ¼   ½   ¾   F
 *   ○   ○   ●   ○   ○        ← solid dot on the matched level
 *
 * Three modes:
 *   mode="pickup"  — labelled "Carburant (Départ)" / "وقود (الخروج)"
 *   mode="return"  — labelled "Carburant (Retour)" / "وقود (العودة)"
 *   mode="damage"  — empty grid for hand-marked damage notes (E - - - - F)
 *
 * Scale follows the existing 0/2/4/6/8 8-point fuel scale used by the
 * vehicle_handovers table. Pass `scale` from
 * vehicle_handovers[0].pickup_fuel or .return_fuel.
 */

import React from 'react'

interface FuelGaugeProps {
  mode: 'pickup' | 'return' | 'damage'
  /** 0/2/4/6/8 — null/undefined means unfilled */
  scale?: number | null
}

const ARABIC_FONT_STACK = "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif"

// Map 8-point scale → index 0..4 across [E, ¼, ½, ¾, F]
function scaleToIndex(scale?: number | null): number {
  if (scale === undefined || scale === null) return -1
  if (scale <= 0) return 0
  if (scale <= 2) return 1
  if (scale <= 4) return 2
  if (scale <= 6) return 3
  return 4
}

export default function FuelGauge({ mode, scale }: FuelGaugeProps) {
  const labelFr =
    mode === 'pickup' ? 'Carburant (Départ)'
    : mode === 'return' ? 'Carburant (Retour)'
    : 'État (Carrosserie)'
  const labelAr =
    mode === 'pickup' ? 'الوقود (الخروج)'
    : mode === 'return' ? 'الوقود (العودة)'
    : 'الحالة'

  const activeIndex = scaleToIndex(scale)
  const ticks = mode === 'damage' ? null : ['E', '¼', '½', '¾', 'F']

  return (
    <div
      style={{
        border: '1px solid #000',
        borderRadius: '4px',
        padding: '0.35rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: '7.5pt',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#000',
        }}
      >
        <span>{labelFr}</span>
        <span dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT_STACK, fontWeight: 700 }}>{labelAr}</span>
      </div>

      {ticks ? (
        <>
          {/* Tick labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              fontSize: '8pt',
              fontWeight: 700,
              textAlign: 'center',
              color: '#000',
            }}
          >
            {ticks.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
          {/* Dot row — solid on active, hollow otherwise */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              textAlign: 'center',
            }}
          >
            {ticks.map((_, i) => (
              <span key={i} style={{ display: 'inline-flex', justifyContent: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: '1.2px solid #000',
                    background: i === activeIndex ? '#000' : 'transparent',
                  }}
                />
              </span>
            ))}
          </div>
        </>
      ) : (
        /* Damage tracker: empty horizontal rule for handwritten notes */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.15rem 0.25rem',
            fontSize: '8pt',
            fontWeight: 700,
          }}
        >
          <span>E</span>
          <span style={{ flex: 1, margin: '0 0.5rem', borderTop: '1px dashed #555' }} />
          <span>F</span>
        </div>
      )}
    </div>
  )
}
