'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Car, Check } from 'lucide-react'

interface Vehicle {
  id: string
  brand: string
  model: string
  license_plate: string
  year?: number | string | null
}

interface VehicleSearchDropdownProps {
  vehicles: Vehicle[]
  selectedVehicleId: string
  onChange: (id: string) => void
  lang: 'fr' | 'en'
  placeholderAll?: string
  width?: string
}

export default function VehicleSearchDropdown({
  vehicles,
  selectedVehicleId,
  onChange,
  lang,
  placeholderAll,
  width = '240px'
}: VehicleSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Labels based on lang
  const defaultAllLabel = lang === 'fr' ? 'Tous les véhicules' : 'All Fleet Vehicles'
  const finalAllLabel = placeholderAll || defaultAllLabel
  const searchPlaceholder = lang === 'fr' ? 'Rechercher par matricule...' : 'Search by plate...'

  // Find active vehicle
  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId)
  const activeLabel = activeVehicle
    ? `${activeVehicle.brand} ${activeVehicle.model} (${activeVehicle.license_plate})`
    : finalAllLabel

  // Normalize helper to strip spaces and dashes
  const normalize = (str: string) => {
    return (str || '').toLowerCase().replace(/[\s-]/g, '')
  }

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const q = normalize(search)
    if (!q) return true

    const plateRaw = (v.license_plate || '').toLowerCase()
    const plateNorm = normalize(v.license_plate)
    const brand = (v.brand || '').toLowerCase()
    const model = (v.model || '').toLowerCase()

    return (
      plateRaw.includes(q) ||
      plateNorm.includes(q) ||
      brand.includes(q) ||
      model.includes(q)
    )
  })

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle escape key to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small timeout to guarantee DOM is updated
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearch('')
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width }}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(20, 16, 14, 0.95)',
          border: '1px solid rgba(229, 193, 125, 0.3)',
          borderRadius: '8px',
          color: '#fff',
          padding: '0.42rem 0.75rem',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Car size={13} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeLabel}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--accent-gold)', marginLeft: '0.25rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.25rem',
            width: '100%',
            minWidth: '260px',
            background: 'rgba(10, 8, 7, 0.98)',
            border: '1px solid rgba(229, 193, 125, 0.35)',
            borderRadius: '8px',
            padding: '0.4rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
            zIndex: 9999,
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Header */}
          <div style={{ position: 'relative', marginBottom: '0.4rem' }}>
            <Search size={12} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(229,193,125,0.45)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(229,193,125,0.18)',
                borderRadius: '6px',
                color: '#fff',
                padding: '0.35rem 0.5rem 0.35rem 1.65rem',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Options List */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.15rem',
            }}
          >
            {/* "All" Option (Always visible at the top) */}
            <button
              type="button"
              onClick={() => {
                onChange('all')
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.45rem 0.6rem',
                borderRadius: '6px',
                background: selectedVehicleId === 'all' ? 'rgba(229,193,125,0.12)' : 'transparent',
                border: 'none',
                color: selectedVehicleId === 'all' ? 'var(--accent-gold)' : '#fff',
                fontSize: '0.78rem',
                fontWeight: selectedVehicleId === 'all' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(229,193,125,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = selectedVehicleId === 'all' ? 'rgba(229,193,125,0.12)' : 'transparent'
              }}
            >
              <span>🚗 {finalAllLabel}</span>
              {selectedVehicleId === 'all' && <Check size={12} style={{ color: 'var(--accent-gold)' }} />}
            </button>

            {/* Filtered Vehicles */}
            {filteredVehicles.map((v) => {
              const isSelected = selectedVehicleId === v.id
              const label = `${v.brand} ${v.model} (${v.license_plate})`
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onChange(v.id)
                    setIsOpen(false)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(229,193,125,0.12)' : 'transparent',
                    border: 'none',
                    color: isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.85)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(229,193,125,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? 'rgba(229,193,125,0.12)' : 'transparent'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {isSelected && <Check size={12} style={{ color: 'var(--accent-gold)' }} />}
                </button>
              )
            })}

            {/* No matches */}
            {filteredVehicles.length === 0 && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', padding: '0.5rem 0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                {lang === 'fr' ? 'Aucun véhicule trouvé' : 'No vehicles found'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
