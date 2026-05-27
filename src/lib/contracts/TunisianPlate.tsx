/**
 * Tunisian license plate frame — extracted from the 5+ inline copies scattered
 * across BookingsClient, GlobalCommandSearch, ExpensesClient, RevenuesClient,
 * MasterOperationsGrid, and the contract template. Single source of visual
 * truth for the [TN | XXX TU YYYY] badge.
 *
 * Two visual variants:
 *   variant="dark"  — gold-on-black, used inside the app (dashboard cards, etc.)
 *   variant="paper" — black-on-white, used on the printed contract
 */

import React from 'react'

interface TunisianPlateProps {
  plate?: string | null
  variant?: 'dark' | 'paper'
  size?: 'sm' | 'md' | 'lg'
}

export default function TunisianPlate({
  plate,
  variant = 'dark',
  size = 'md',
}: TunisianPlateProps) {
  const display = plate || '— — —'
  const isDark = variant === 'dark'

  const fontSize = size === 'lg' ? '1rem' : size === 'sm' ? '0.65rem' : '0.78rem'
  const padX = size === 'lg' ? '0.55rem' : size === 'sm' ? '0.3rem' : '0.5rem'
  const padY = size === 'lg' ? '0.28rem' : size === 'sm' ? '0.12rem' : '0.2rem'
  const tnSize = size === 'lg' ? '0.85rem' : size === 'sm' ? '0.55rem' : '0.65rem'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        background: isDark ? 'linear-gradient(180deg, #1f1f1f 0%, #111 100%)' : '#fff',
        border: isDark ? '1.5px solid rgba(229,193,125,0.3)' : '1.5px solid #000',
        borderRadius: '6px',
        fontFamily: "'Courier New', Courier, monospace",
        fontWeight: 800,
        color: isDark ? '#fff' : '#000',
        overflow: 'hidden',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
        fontSize,
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          background: isDark ? 'linear-gradient(135deg, #c5a059, #e5c17d)' : '#000',
          color: isDark ? '#000' : '#fff',
          padding: `${padY} ${padX}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: tnSize,
          fontWeight: 900,
          letterSpacing: '0.05em',
        }}
      >
        TN
      </span>
      <span
        style={{
          padding: `${padY} ${padX}`,
          display: 'flex',
          alignItems: 'center',
          letterSpacing: '0.05em',
          textShadow: isDark ? '0 0 4px rgba(255,255,255,0.2)' : 'none',
        }}
      >
        {display}
      </span>
    </span>
  )
}
