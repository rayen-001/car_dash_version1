'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import styles from '../history.module.css'

interface VehicleItem {
  id: string
  brand: string
  model: string
  license_plate?: string
  availability?: boolean
  year?: number
}

interface MatriculeSearchBarProps {
  vehiclesList: VehicleItem[]
  currentLicensePlate: string
}

export default function MatriculeSearchBar({ vehiclesList, currentLicensePlate }: MatriculeSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(currentLicensePlate || '')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter vehicles based on query
  const filteredVehicles = vehiclesList.filter((v) => {
    const term = query.toLowerCase()
    return (
      v.license_plate?.toLowerCase().includes(term) ||
      v.brand.toLowerCase().includes(term) ||
      v.model.toLowerCase().includes(term)
    )
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (vehicleId: string, plate: string) => {
    setQuery(plate)
    setIsOpen(false)
    router.push(`/dashboard/vehicles/${vehicleId}/history`)
  }

  return (
    <div className={styles['command-bar']} ref={dropdownRef}>
      <div 
        className={styles['command-bar-input-wrap']} 
        onClick={() => setIsOpen(true)}
      >
        <Search size={20} className={styles['command-bar-icon']} />
        <input
          type="text"
          className={styles['command-bar-input']}
          placeholder="TYPE LICENSE PLATE (MATRICULE) OR VEHICLE NAME TO SEARCH..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
        />
        <span className={styles['command-bar-hint']}>Press Esc to close</span>
      </div>

      {isOpen && filteredVehicles.length > 0 && (
        <div className={styles['command-dropdown']}>
          {filteredVehicles.map((v) => (
            <div
              key={v.id}
              className={styles['command-dropdown-item']}
              onClick={() => handleSelect(v.id, v.license_plate || '')}
            >
              <div className={styles['dd-plate']}>
                {v.license_plate || 'NO PLATE'}
              </div>
              <div>
                <div className={styles['dd-name']}>{v.brand} {v.model}</div>
                <div className={styles['dd-meta']}>{v.year || 'N/A'}</div>
              </div>
              <div 
                className={`${styles['dd-status-dot']} ${v.availability ? styles['available'] : styles['rented']}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
