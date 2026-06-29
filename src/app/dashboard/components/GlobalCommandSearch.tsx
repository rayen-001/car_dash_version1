'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Calendar, X, AlertTriangle, Edit2, ShieldAlert, ShieldCheck, ShieldAlert as ShieldIcon, Star, Plane, Hotel, MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { Edit } from 'lucide-react'
import { ClientNoteScoreModal, ClientInternalNoteBadge, ClientEffectiveScoreBadge } from '@/components/ClientNoteScoreModal'
import Fuse from 'fuse.js'
import QuickEditBookingModal from '@/app/dashboard/vehicles/[id]/history/components/QuickEditBookingModal'
import { updateBookingStatus } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { Booking, Vehicle, Client } from '@/types'
import { formatFuelFraction, calculateFuelDelta, calculateDrivenMileage } from '@/app/dashboard/bookings/components/HandoverCalculators'
import { calculateTrustScore } from '@/lib/trustScore'

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function isNonNameQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  // Contains any digit (matches phone, CIN, passport, dates, numbers)
  if (/\d/.test(trimmed)) return true
  // Contains "TN" or "tn" (matches plates)
  if (trimmed.toLowerCase().includes('tn')) return true
  return false
}

/* ─── Types ─────────────────────────────────────────────────────── */
interface OmniBooking {
  id: string
  client_id?: string
  vehicle_id: string
  start_date: string
  end_date: string
  created_at?: string
  status?: string
  client_name?: string
  total_amount?: number
  acompte_paid?: number
  rental_days_text?: string
  pickup_time?: string
  departure_time?: string  // legacy alias — DB column is pickup_time
  return_time?: string
  // Phase 17a — off-site Handover / Delivery
  handover_location?: string | null
  handover_datetime?: string | null
  starting_km?: number | null
  return_km?: number | null
  vehicle_handovers?: {
    pickup_km?: number | null
    return_km?: number | null
    pickup_fuel?: number | null
    return_fuel?: number | null
    pickup_cleanliness?: string | null
    return_cleanliness?: string | null
  }[]
  fuel_level_pickup?: string
  fuel_level_return?: string
  lavage_pickup?: string
  lavage_return?: string
  damage_notes?: string
  import_raw_data?: any
  actual_return_date?: string
  client_behavior_status?: string | null
  installments?: {
    id: string
    booking_id: string
    amount: number
    due_date: string
    status: 'paid' | 'unpaid'
    paid_date?: string | null
  }[]
  vehicles?: {
    id?: string
    brand?: string
    model?: string
    license_plate?: string
    price_per_day?: number
  }
  primary_client?: {
    id?: string
    full_name?: string
    phone?: string
    license_number?: string
    cin?: string
    address?: string
    date_naissance?: string
    cin_delivre_le?: string
    permis_numero?: string
    permis_delivre_le?: string
    trust_score?: number | null
    manual_score_adjustment?: number | null
    internal_note?: string | null
  }
  secondary_client?: {
    id?: string
    full_name?: string
    phone?: string
    license_number?: string
    cin?: string
    address?: string
    date_naissance?: string
    cin_delivre_le?: string
    permis_numero?: string
    permis_delivre_le?: string
    trust_score?: number | null
    manual_score_adjustment?: number | null
    internal_note?: string | null
  }
}

interface GlobalCommandSearchProps {
  allBookings: OmniBooking[]
  setAllBookings?: React.Dispatch<React.SetStateAction<OmniBooking[]>>
  activeAlertFilter: 'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null
  setActiveAlertFilter: (val: 'overdue' | 'balances' | 'expiring' | 'returns-today' | 'pickups-today' | 'tranches' | 'latest-250' | null) => void
  vehicleLegalDocs?: any[]
  vehicles?: any[]
  operationDateFrom?: string
  setOperationDateFrom?: (val: string) => void
  operationDateTo?: string
  setOperationDateTo?: (val: string) => void
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmt = (d?: string) => {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-GB')
}

const initials = (name?: string) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
}

const getClientRiskProfile = (
  clientId: string | undefined,
  clientName: string | undefined,
  allBookings: OmniBooking[]
) => {
  if (!clientId && !clientName) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  // Filter bookings for this client (excluding cancelled)
  const clientBookings = allBookings.filter(b => {
    if (clientId && b.primary_client?.id === clientId) return true
    if (clientId && b.secondary_client?.id === clientId) return true
    if (clientName && (b.client_name === clientName || b.secondary_client?.full_name === clientName)) return true
    return false
  }).filter(b => b.status !== 'cancelled')

  if (clientBookings.length === 0) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const { trustScore, hasCriminalOverride } = calculateTrustScore(clientBookings as any, todayStr)

  // Find manual_score_adjustment from joined primary_client or secondary_client
  let manualAdj: number | null = null
  const bookingWithClient = allBookings.find(b => 
    (clientId && b.primary_client?.id === clientId) || 
    (clientId && b.secondary_client?.id === clientId) ||
    (clientName && b.primary_client?.full_name === clientName) ||
    (clientName && b.secondary_client?.full_name === clientName)
  )
  if (bookingWithClient) {
    if (clientId) {
      if (bookingWithClient.primary_client?.id === clientId) {
        manualAdj = bookingWithClient.primary_client.manual_score_adjustment ?? null
      } else if (bookingWithClient.secondary_client?.id === clientId) {
        manualAdj = bookingWithClient.secondary_client.manual_score_adjustment ?? null
      }
    } else if (clientName) {
      if (bookingWithClient.primary_client?.full_name === clientName) {
        manualAdj = bookingWithClient.primary_client.manual_score_adjustment ?? null
      } else if (bookingWithClient.secondary_client?.full_name === clientName) {
        manualAdj = bookingWithClient.secondary_client.manual_score_adjustment ?? null
      }
    }
  }

  // Calculate effective score
  const baselineScore = trustScore
  let score = baselineScore
  if (manualAdj !== null && baselineScore !== null) {
    score = Math.max(0, Math.min(100, baselineScore + Number(manualAdj)))
  } else if (manualAdj !== null && baselineScore === null) {
    score = Math.max(0, Math.min(100, Number(manualAdj)))
  }

  let riskLevel: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'very_high_risk' | 'criminal'
  
  if (hasCriminalOverride || score === null || score < 15.0) {
    riskLevel = 'criminal'
  } else if (score >= 92.0) {
    riskLevel = 'very_low_risk'
  } else if (score >= 80.0) {
    riskLevel = 'low_risk'
  } else if (score >= 60.0) {
    riskLevel = 'medium_risk'
  } else if (score >= 45.0) {
    riskLevel = 'high_risk'
  } else {
    riskLevel = 'very_high_risk'
  }

  return { score, riskLevel }
}

/* ─── Damage Note Expandable Tag ─────────────────────────────────── */
const DamageNoteView = ({ note }: { note: string }) => {
  const [expanded, setExpanded] = useState(false)
  
  const isPerfect = note.toLowerCase().includes('perfect normal return') || note.includes('[GREEN]')
  const isGray = note.includes('[GRAY]')
  const cleanNotes = note.replace('[GREEN]', '').replace('[GRAY]', '').replace('[RED]', '').trim()
  
  const bgColor = isPerfect ? 'rgba(16, 185, 129, 0.12)' : isGray ? 'rgba(156, 163, 175, 0.12)' : 'rgba(239, 68, 68, 0.12)'
  const color = isPerfect ? '#10b981' : isGray ? '#9ca3af' : '#ef4444'
  const border = isPerfect ? '1px solid rgba(16, 185, 129, 0.25)' : isGray ? '1px solid rgba(156, 163, 175, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
  const icon = isPerfect ? '✅' : isGray ? '💬' : '⚠️'

  const displayText = expanded 
    ? cleanNotes 
    : (cleanNotes.length > 22 ? cleanNotes.substring(0, 22) + '…' : cleanNotes)

  return (
    <span 
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setExpanded(!expanded)
      }}
      style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: bgColor, 
        color: color, 
        border: border,
        boxSizing: 'border-box',
        marginTop: '0.25rem',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: expanded ? '240px' : '180px',
        whiteSpace: expanded ? 'normal' : 'nowrap',
        wordBreak: expanded ? 'break-word' : 'normal',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      title={expanded ? "Click to collapse" : "Click to view full note"}
    >
      <span>{icon}</span>
      <span>{displayText}</span>
    </span>
  )
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function GlobalCommandSearch({
  allBookings,
  setAllBookings,
  activeAlertFilter,
  setActiveAlertFilter,
  vehicleLegalDocs = [],
  vehicles = [],
  operationDateFrom = '',
  setOperationDateFrom = () => {},
  operationDateTo = '',
  setOperationDateTo = () => {}
}: GlobalCommandSearchProps) {
  const { t, lang } = useLanguage()
  const [textQuery, setTextQuery]       = useState('')
  const [smartSearchEnabled, setSmartSearchEnabled] = useState(false)
  const [interceptDate, setInterceptDate] = useState('')
  const [returnFrom, setReturnFrom] = useState('')
  const [returnTo, setReturnTo] = useState('')
  const [editingBooking, setEditingBooking] = useState<OmniBooking | null>(null)
  const [noteScoreModalClient, setNoteScoreModalClient] = useState<any | null>(null)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)

  // Pagination states
  const itemsPerPage = 10
  const [currentPage, setCurrentPage] = useState(1)

  // Reset currentPage to 1 when filters or toggle changes
  useEffect(() => {
    setCurrentPage(1)
  }, [textQuery, interceptDate, returnFrom, returnTo, activeAlertFilter, smartSearchEnabled])

  // Smooth scroll to top of search results on active filter or page change
  useEffect(() => {
    const searchElement = document.querySelector('.omni-search-bar')
    if (searchElement) {
      searchElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeAlertFilter, currentPage])

  const isActive = textQuery.trim() !== '' || interceptDate !== '' || returnFrom !== '' || returnTo !== '' || activeAlertFilter !== null
  const isFineMode = textQuery.trim() !== '' || interceptDate !== '' || returnFrom !== '' || returnTo !== ''

  const expiringDocs = useMemo(() => {
    const todayObj = new Date()
    todayObj.setHours(0, 0, 0, 0)
    
    const docs = (vehicleLegalDocs || [])
      .filter(doc => {
        if (!doc.expiry_date) return false
        const expDate = new Date(doc.expiry_date)
        const diffTime = expDate.getTime() - todayObj.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays <= 7 && diffDays >= 0
      })
      .map(doc => {
        const vehicle = vehicles.find(v => v.id === doc.vehicle_id)
        const expDate = new Date(doc.expiry_date)
        const diffTime = expDate.getTime() - todayObj.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        // Find if this vehicle has an active booking today
        const tyStr = todayObj.getFullYear()
        const tmStr = String(todayObj.getMonth() + 1).padStart(2, '0')
        const tdStr = String(todayObj.getDate()).padStart(2, '0')
        const todayStr = `${tyStr}-${tmStr}-${tdStr}`
        const activeBooking = allBookings.find(b => {
          if (b.status === 'cancelled') return false
          return b.vehicle_id === doc.vehicle_id && b.start_date <= todayStr && b.end_date >= todayStr
        })

        return {
          id: doc.id,
          type: 'doc',
          doc_type: doc.doc_type,
          expiry_date: doc.expiry_date,
          diffDays,
          vehicle,
          activeBooking
        }
      })

    const tyStr = todayObj.getFullYear()
    const tmStr = String(todayObj.getMonth() + 1).padStart(2, '0')
    const tdStr = String(todayObj.getDate()).padStart(2, '0')
    const todayStr = `${tyStr}-${tmStr}-${tdStr}`

    const mechAlerts: any[] = []
    vehicles.forEach(car => {
      const current = car.current_km || 0
      const nextOil = car.next_vidange_km || (car.last_vidange_km ? car.last_vidange_km + 10000 : null)
      const nextPads = car.next_pads_km || (car.last_pads_km ? car.last_pads_km + 30000 : null)
      
      const activeBooking = allBookings.find(b => {
        if (b.status === 'cancelled') return false
        return b.vehicle_id === car.id && b.start_date <= todayStr && b.end_date >= todayStr
      })

      if (nextOil && (nextOil - current <= 1000)) {
        mechAlerts.push({
          id: `mech-oil-${car.id}`,
          type: 'vidange',
          remainingKm: nextOil - current,
          vehicle: car,
          activeBooking
        })
      }
      if (nextPads && (nextPads - current <= 1000)) {
        mechAlerts.push({
          id: `mech-pads-${car.id}`,
          type: 'pads',
          remainingKm: nextPads - current,
          vehicle: car,
          activeBooking
        })
      }
    })

    return [...docs, ...mechAlerts]
  }, [vehicleLegalDocs, vehicles, allBookings])

  /* ── Core dual-mode filter engine ── */
  const normalizePhone = (raw?: string): string => {
    if (!raw) return ''
    return raw
      .replace(/^\+216/, '')   // strip Tunisian country code
      .replace(/\D/g, '')      // strip all non-digit characters
      .trim()
  }



  const filteredExpiringDocs = useMemo(() => {
    if (!textQuery.trim()) return expiringDocs

    const q = textQuery.toLowerCase().trim()
    return expiringDocs.filter(doc => {
      const matchPlate = doc.vehicle?.license_plate?.toLowerCase()?.includes(q) ?? false
      const matchBrand = doc.vehicle?.brand?.toLowerCase()?.includes(q)         ?? false
      const matchModel = doc.vehicle?.model?.toLowerCase()?.includes(q)         ?? false
      
      const matchName  = doc.activeBooking?.clients?.full_name?.toLowerCase()?.includes(q) ?? 
                         doc.activeBooking?.client_name?.toLowerCase()?.includes(q)        ?? false
      const matchCin   = doc.activeBooking?.clients?.license_number?.toLowerCase()?.includes(q) ?? false

      const normalizedStoredPhone = normalizePhone(doc.activeBooking?.clients?.phone)
      const normalizedQuery       = normalizePhone(textQuery)
      const matchPhone = normalizedQuery.length >= 4
        ? normalizedStoredPhone.includes(normalizedQuery)
        : (doc.activeBooking?.clients?.phone?.toLowerCase()?.includes(q) ?? false)

      const matchId    = doc.activeBooking?.id?.toLowerCase()?.includes(q)      ?? false

      return matchPlate || matchBrand || matchModel ||
             matchName  || matchCin   || matchPhone || matchId
    })
  }, [expiringDocs, textQuery])

  const results = useMemo<OmniBooking[]>(() => {
    if (!textQuery.trim() && !interceptDate && !returnFrom && !returnTo && !activeAlertFilter) return []

    // Timezone-safe local today calculation
    const localToday = new Date()
    const yStr = localToday.getFullYear()
    const mStr = String(localToday.getMonth() + 1).padStart(2, '0')
    const dStr = String(localToday.getDate()).padStart(2, '0')
    const todayStr = `${yStr}-${mStr}-${dStr}`

    let filtered = allBookings

    if (activeAlertFilter) {
      if (activeAlertFilter === 'overdue') {
        filtered = filtered.filter(b => {
          if (b.status === 'completed' || b.status === 'cancelled') return false
          return b.end_date < todayStr
        })
      } else if (activeAlertFilter === 'returns-today') {
        filtered = filtered.filter(b => {
          if (b.status === 'completed' || b.status === 'cancelled') return false
          return b.end_date === todayStr
        })
      } else if (activeAlertFilter === 'pickups-today') {
        filtered = filtered.filter(b => {
          if (b.status === 'cancelled') return false
          return b.start_date === todayStr
        })
      } else if (activeAlertFilter === 'balances') {
        filtered = filtered.filter(b => {
          if (b.status === 'cancelled') return false
          const total = Number(b.total_amount) || 0
          const baseAcompte = Number(b.acompte_paid) || 0
          const paidInstallmentsSum = (b.installments || [])
            .filter((t: any) => t.status === 'paid')
            .reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
          const acompte = baseAcompte + paidInstallmentsSum
          return (total - acompte) > 0
        })
      } else if (activeAlertFilter === 'expiring') {
        const expiringVehicleIds = new Set(
          vehicleLegalDocs
            .filter(doc => {
              if (!doc.expiry_date || !doc.vehicle_id) return false
              const expDate = new Date(doc.expiry_date)
              const todayObj = new Date(localToday.getFullYear(), localToday.getMonth(), localToday.getDate())
              const expObj = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate())
              const diffTime = expObj.getTime() - todayObj.getTime()
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              return diffDays <= 7 && diffDays >= 0
            })
            .map(doc => doc.vehicle_id)
        )
        filtered = filtered.filter(b => b.vehicle_id && expiringVehicleIds.has(b.vehicle_id))
      } else if (activeAlertFilter === 'tranches') {
        filtered = filtered.filter(b => b.installments && b.installments.length > 0)
      } else if (activeAlertFilter === 'latest-250') {
        const sortedAll = [...allBookings].sort((a, b) => {
          // Sort by Excel csv_line descending (highest line number/most recent first)
          const lineA = (a.import_raw_data as any)?.csv_line ?? 0
          const lineB = (b.import_raw_data as any)?.csv_line ?? 0
          if (lineA !== 0 || lineB !== 0) {
            return lineB - lineA
          }
          
          // Fallback to created_at for manual/new bookings
          const ca = a.created_at || ''
          const cb = b.created_at || ''
          return cb.localeCompare(ca)
        })
        filtered = sortedAll.slice(0, 250)
      }
    }

    const bookingsAfterAlertAndDates = filtered.filter(b => {
      // ── GATE 1: Date interception (traffic-fine mode or tranches mode) ──
      if (interceptDate) {
        if (activeAlertFilter === 'tranches') {
          const hasTrancheOnDate = b.installments?.some((inst: any) => inst.due_date === interceptDate)
          if (!hasTrancheOnDate) return false
        } else {
          const sd = b.start_date ?? ''
          const ed = b.end_date   ?? ''
          if (!sd || !ed) return false
          const withinPeriod = interceptDate >= sd && interceptDate <= ed
          if (!withinPeriod) return false
        }
      }

      // ── GATE 1.5: Return Date Range interception ──
      if (returnFrom || returnTo) {
        const ed = b.end_date ?? ''
        if (!ed) return false
        if (returnFrom && ed < returnFrom) return false
        if (returnTo && ed > returnTo) return false
      }
      return true
    })

    const normQuery = normalizeText(textQuery)
    const isFuzzyActive = smartSearchEnabled && normQuery.length >= 3 && !isNonNameQuery(textQuery)

    let fuzzyBookingIds = new Set<string>()
    let fuzzyScoreMap = new Map<string, { matchPercent: number; isExactMatch: boolean }>()

    if (isFuzzyActive) {
      const fuzzyIndexData = bookingsAfterAlertAndDates.map((booking) => {
        const primary = booking.primary_client || {
          full_name: booking.client_name
        }
        const secondary = booking.secondary_client
        return {
          booking,
          search_client_name: normalizeText(booking.client_name || ''),
          search_primary_name: normalizeText(primary.full_name || ''),
          search_secondary_name: normalizeText(secondary?.full_name || '')
        }
      })

      const fuse = new Fuse(fuzzyIndexData, {
        keys: ['search_client_name', 'search_primary_name', 'search_secondary_name'],
        threshold: 0.45,
        includeScore: true,
        minMatchCharLength: 3
      })

      const resultsFuse = fuse.search(normQuery)
      resultsFuse.forEach((res) => {
        const matchPercent = Math.round((1 - (res.score ?? 1)) * 100)
        if (matchPercent >= 55) {
          const isExactMatch = 
            res.item.search_client_name === normQuery ||
            res.item.search_primary_name === normQuery ||
            res.item.search_secondary_name === normQuery

          fuzzyBookingIds.add(res.item.booking.id)
          fuzzyScoreMap.set(res.item.booking.id, { matchPercent, isExactMatch })
        }
      })
    }

    const matched = bookingsAfterAlertAndDates.filter((b) => {
      const getStrictMatch = (booking: OmniBooking) => {
        const q = textQuery.toLowerCase().trim()
        if (!q) return true

        const matchPlate = booking.vehicles?.license_plate?.toLowerCase()?.includes(q) ?? false
        const matchBrand = booking.vehicles?.brand?.toLowerCase()?.includes(q)         ?? false
        const matchModel = booking.vehicles?.model?.toLowerCase()?.includes(q)         ?? false
        const nameWords = q.split(/\s+/).filter(w => w.length >= 1)
        const matchName = nameWords.length > 0 && nameWords.every(word => 
          booking.primary_client?.full_name?.toLowerCase()?.includes(word) ||
          booking.client_name?.toLowerCase()?.includes(word) ||
          booking.secondary_client?.full_name?.toLowerCase()?.includes(word)
        )
        const matchCin   = booking.primary_client?.license_number?.toLowerCase()?.includes(q) ?? false

        const normalizedStoredPhone = normalizePhone(booking.primary_client?.phone)
        const normalizedQuery       = normalizePhone(textQuery)
        const matchPhone = normalizedQuery.length >= 4
          ? normalizedStoredPhone.includes(normalizedQuery)
          : (booking.primary_client?.phone?.toLowerCase()?.includes(q) ?? false)

        const matchId    = booking.id?.toLowerCase()?.includes(q)      ?? false

        return matchPlate || matchBrand || matchModel ||
               matchName  || matchCin   || matchPhone || matchId
      }

      if (isFuzzyActive) {
        return fuzzyBookingIds.has(b.id) || getStrictMatch(b)
      }

      return getStrictMatch(b)
    })

    // Sort:
    // 1. exact/strict matches first
    // 2. fuzzy matches after by matchPercent descending
    // 3. date descending
    if (isFuzzyActive) {
      return [...matched].sort((a, b) => {
        const fuzzyA = fuzzyScoreMap.get(a.id)
        const fuzzyB = fuzzyScoreMap.get(b.id)

        const isExactA = !fuzzyA || fuzzyA.isExactMatch
        const isExactB = !fuzzyB || fuzzyB.isExactMatch

        if (isExactA && !isExactB) return -1
        if (!isExactA && isExactB) return 1

        const percentA = fuzzyA?.matchPercent ?? 100
        const percentB = fuzzyB?.matchPercent ?? 100

        if (percentB !== percentA) {
          return percentB - percentA
        }

        const da = a.start_date || ''
        const db = b.start_date || ''
        if (da !== db) return db.localeCompare(da)
        return b.id.localeCompare(a.id)
      })
    }

    if (activeAlertFilter === 'latest-250') {
      return [...matched].sort((a, b) => {
        const ca = a.created_at || ''
        const cb = b.created_at || ''
        if (ca !== cb) return cb.localeCompare(ca)
        const da = a.start_date || ''
        const db = b.start_date || ''
        return db.localeCompare(da)
      })
    }

    return [...matched].sort((a, b) => {
      const da = a.start_date || ''
      const db = b.start_date || ''
      if (da !== db) return db.localeCompare(da)
      return b.id.localeCompare(a.id)
    })
  }, [allBookings, textQuery, interceptDate, activeAlertFilter, vehicleLegalDocs, returnFrom, returnTo, smartSearchEnabled])

  const totalItems = results.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1

  // Clamp currentPage if results count changes and it becomes invalid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalItems, totalPages, currentPage])

  // Paginated Results
  const paginatedResults = useMemo(() => {
    return results.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [results, currentPage, itemsPerPage])

  const clearAll = () => {
    setTextQuery('')
    setInterceptDate('')
    setReturnFrom('')
    setReturnTo('')
    setActiveAlertFilter(null)
  }

  const emptyMsg = useMemo(() => {
    if (!isActive) return null
    if (activeAlertFilter === 'expiring') {
      if (filteredExpiringDocs.length > 0) return null
      if (textQuery.trim()) {
        return `No expiring documents match "${textQuery}".`
      }
      return `No legal documents currently match the expiring filter.`
    }
    if (results.length > 0) return null
    if (activeAlertFilter) {
      const name =
        activeAlertFilter === 'overdue' ? 'Overdue Returns' :
        activeAlertFilter === 'balances' ? 'Pending Balances' :
        activeAlertFilter === 'returns-today' ? 'Returns Today' :
        activeAlertFilter === 'pickups-today' ? 'Pickups Today' :
        activeAlertFilter === 'tranches' ? 'Scheduled Tranches' :
        activeAlertFilter === 'latest-250' ? (lang === 'fr' ? 'Dernières 250 Réservations' : 'Latest 250 Bookings') :
        'Expiring Vehicle Documents'
      if (textQuery.trim()) {
        return `No bookings matching "${textQuery}" under the "${name}" alert filter.`
      }
      return `No bookings currently match the "${name}" alert filter.`
    }
    if (textQuery && interceptDate)
      return `No contract for "${textQuery}" was active on ${fmt(interceptDate)}.`
    if (interceptDate && !textQuery)
      return `No active rentals found on ${fmt(interceptDate)}.`
    if ((returnFrom || returnTo) && !textQuery)
      return `No returns scheduled between ${fmt(returnFrom)} and ${fmt(returnTo)}.`
    return `No contracts found matching "${textQuery}".`
  }, [isActive, results.length, textQuery, interceptDate, activeAlertFilter, filteredExpiringDocs.length, returnFrom, returnTo])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
      <style>{`
        @keyframes omni-pulse-crimson {
          0% {
            box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.7);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        @keyframes omni-glow-emerald {
          0% {
            box-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
          }
          100% {
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
          }
        }
        @keyframes omni-glow-criminal {
          0% {
            box-shadow: 0 0 4px #ff0055;
          }
          100% {
            box-shadow: 0 0 14px #ff0055;
          }
        }
        @keyframes omni-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Search Bar & Toggle Row ── */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
        <div className="omni-search-bar" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          background: 'rgba(10, 8, 7, 0.92)',
          border: `1px solid ${interceptDate ? 'rgba(245,158,11,0.5)' : 'rgba(229,193,125,0.22)'}`,
          borderRadius: '14px',
          boxShadow: interceptDate
            ? '0 0 0 3px rgba(245,158,11,0.12), 0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(0,0,0,0.5)',
          transition: 'border-color 0.25s, box-shadow 0.25s',
          minWidth: '280px',
        }}>
          <Search size={20} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
          <input
            type="text"
            value={textQuery}
            onChange={e => setTextQuery(e.target.value)}
            placeholder="Search by plate, name, CIN, phone, brand, model..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '1rem',
              fontFamily: 'var(--font-body)',
              minWidth: 0,
            }}
          />

          <div className="omni-divider" style={{ width: '1px', height: '28px', background: 'rgba(229,193,125,0.15)', flexShrink: 0 }} />

          <Calendar size={18} style={{ color: interceptDate ? '#f59e0b' : 'rgba(229,193,125,0.5)', flexShrink: 0 }} />
          <div className="omni-date-container" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: 'rgba(229,193,125,0.5)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
              Incident Date
            </span>
            <input
              type="date"
              value={interceptDate}
              onChange={e => setInterceptDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: interceptDate ? '#f59e0b' : 'rgba(255,255,255,0.6)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                colorScheme: 'dark',
                padding: 0,
              }}
            />
          </div>

          <div className="omni-divider" style={{ width: '1px', height: '28px', background: 'rgba(229,193,125,0.15)', flexShrink: 0, marginLeft: '0.5rem', marginRight: '0.5rem' }} />

          <div className="omni-date-container" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: 'rgba(229,193,125,0.5)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
              Return From
            </span>
            <input
              type="date"
              value={returnFrom}
              onChange={e => setReturnFrom(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: returnFrom ? '#10b981' : 'rgba(255,255,255,0.6)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                colorScheme: 'dark',
                padding: 0,
              }}
            />
          </div>

          <div className="omni-date-container" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginLeft: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', color: 'rgba(229,193,125,0.5)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
              Return To
            </span>
            <input
              type="date"
              value={returnTo}
              onChange={e => setReturnTo(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: returnTo ? '#10b981' : 'rgba(255,255,255,0.6)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                colorScheme: 'dark',
                padding: 0,
              }}
            />
          </div>

          {isActive && (
            <button
              onClick={clearAll}
              style={{
                background: 'rgba(229,193,125,0.1)',
                border: '1px solid rgba(229,193,125,0.2)',
                borderRadius: '6px',
                color: 'rgba(229,193,125,0.7)',
                cursor: 'pointer',
                padding: '0.3rem',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Smart Name Suggestions Toggle */}
        <button
          onClick={() => setSmartSearchEnabled(prev => !prev)}
          className={`btn-secondary ${smartSearchEnabled ? 'active-gold' : ''}`}
          style={{
            padding: '0.9rem 1.25rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: smartSearchEnabled ? '1px solid #E5C17D' : '1px solid rgba(255, 255, 255, 0.1)',
            background: smartSearchEnabled ? 'rgba(229, 193, 125, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            color: smartSearchEnabled ? '#E5C17D' : 'var(--text-muted)',
            borderRadius: '14px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: smartSearchEnabled ? '#E5C17D' : 'rgba(255,255,255,0.2)',
              display: 'inline-block',
              boxShadow: smartSearchEnabled ? '0 0 8px #E5C17D' : 'none',
            }}
          />
          {lang === 'fr' ? 'Suggestions de noms' : 'Smart Name Suggestions'}
        </button>
      </div>

      {/* ── Active Alert Filter Banner ── */}
      {activeAlertFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          background: 'rgba(229, 193, 125, 0.05)',
          border: '1px solid rgba(229, 193, 125, 0.25)',
          borderRadius: '10px',
          fontSize: '0.9rem',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#E5C17D',
              boxShadow: '0 0 8px #E5C17D'
            }} />
            <span>
              Drilling active: Showing bookings matching <strong>
                {activeAlertFilter === 'overdue' && 'Overdue Returns'}
                {activeAlertFilter === 'balances' && 'Pending Balances'}
                {activeAlertFilter === 'returns-today' && 'Returns Today'}
                {activeAlertFilter === 'pickups-today' && 'Pickups Today'}
                {activeAlertFilter === 'expiring' && 'Expiring Vehicle Documents'}
                {activeAlertFilter === 'tranches' && 'Scheduled Tranches'}
                {activeAlertFilter === 'latest-250' && (lang === 'fr' ? 'Dernières 250 Réservations' : 'Latest 250 Bookings')}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setActiveAlertFilter(null)}
            style={{
              background: 'rgba(229, 193, 125, 0.1)',
              border: '1px solid rgba(229, 193, 125, 0.3)',
              borderRadius: '6px',
              color: '#E5C17D',
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s',
            }}
          >
            Clear Filter [X]
          </button>
        </div>
      )}

      {/* ── Traffic-Fine Mode Banner ── */}
      {interceptDate && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.65rem 1rem',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#f59e0b',
        }}>
          <AlertTriangle size={16} />
          <span>
            <strong>Traffic-Fine Mode</strong> — Showing all active contracts on{' '}
            <strong>{fmt(interceptDate)}</strong>
            {textQuery && <> for <strong>"{textQuery}"</strong></>}
          </span>
        </div>
      )}

      {/* ── Results ── */}

      {/* ── EXPIRING DOCS OVERRIDE: High-Density Legal Document Alert List ── */}
      {activeAlertFilter === 'expiring' && filteredExpiringDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(229,193,125,0.45)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {filteredExpiringDocs.length} Item{filteredExpiringDocs.length > 1 ? 's' : ''} Requiring Immediate Attention
          </p>
          {filteredExpiringDocs.map(doc => {
            let docLabel = ''
            let urgency = 'caution'
            let statusText = ''
            
            if (doc.type === 'doc') {
              docLabel = doc.doc_type === 'assurance' ? 'Insurance (Assurance)' : doc.doc_type === 'visite_technique' ? 'Technical Inspection (Visite)' : doc.doc_type === 'laissez_passer' ? 'Transport Authorization (Laissez-Passer)' : doc.doc_type
              urgency = doc.diffDays <= 2 ? 'critical' : doc.diffDays <= 4 ? 'warning' : 'caution'
              statusText = doc.diffDays === 0 ? 'Expiring Today' : `Expiring in ${doc.diffDays} Days`
            } else {
              docLabel = doc.type === 'vidange' ? 'Oil Change (Vidange)' : 'Brake Pads'
              urgency = doc.remainingKm <= 200 ? 'critical' : doc.remainingKm <= 500 ? 'warning' : 'caution'
              statusText = doc.remainingKm <= 0 ? 'Overdue!' : `Due in ${doc.remainingKm} km`
            }

            const urgencyColor = urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#E5C17D'
            const urgencyBg = urgency === 'critical' ? 'rgba(239,68,68,0.06)' : urgency === 'warning' ? 'rgba(245,158,11,0.06)' : 'rgba(229,193,125,0.04)'
            const urgencyBorder = urgency === 'critical' ? 'rgba(239,68,68,0.25)' : urgency === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(229,193,125,0.2)'
            const isExpanded = expandedDocId === doc.id
            const plate = doc.vehicle?.license_plate || 'NO PLATE'
            const brand = doc.vehicle?.brand || '—'
            const model = doc.vehicle?.model || '—'

            return (
              <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${urgencyBorder}`, boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${urgencyBorder}` }}>
                {/* ── Main Document Row ── */}
                <div
                  onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto auto',
                    alignItems: 'center',
                    gap: '1.25rem',
                    padding: '1.1rem 1.4rem',
                    background: urgencyBg,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Vehicle Identity */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                        {plate}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#fff' }}>
                        {brand} {model}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{docLabel}</span>
                  </div>

                  {/* Expiry / Due Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{doc.type === 'doc' ? 'Expires' : 'Target'}</span>
                    <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                      {doc.type === 'doc' 
                        ? new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : `${(doc.vehicle.current_km + doc.remainingKm).toLocaleString()} km`
                      }
                    </span>
                  </div>

                  {/* Countdown Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '20px',
                    background: urgency === 'critical' ? 'rgba(239,68,68,0.12)' : urgency === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(229,193,125,0.1)',
                    border: `1px solid ${urgencyColor}40`,
                    animation: urgency === 'critical' ? 'pulse-urgency 1.8s ease-in-out infinite' : 'none',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgencyColor, boxShadow: `0 0 6px ${urgencyColor}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: urgencyColor, whiteSpace: 'nowrap' }}>
                      {statusText}
                    </span>
                  </div>

                  {/* Deployment Status Pill */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '20px',
                    background: doc.activeBooking ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                    border: `1px solid ${doc.activeBooking ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: doc.activeBooking ? '#f87171' : '#34d399', fontWeight: 600 }}>
                      {doc.activeBooking ? '🔴 On Road' : '🟢 In Garage'}
                    </span>
                  </div>

                  {/* Expand Toggle */}
                  <div style={{ color: 'rgba(229,193,125,0.5)', fontSize: '0.8rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s', userSelect: 'none' }}>
                    ▼
                  </div>
                </div>

                {/* ── Inline Deployment Drawer ── */}
                {isExpanded && (
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    background: 'rgba(10,8,7,0.92)',
                    borderTop: '1px solid rgba(229,193,125,0.1)',
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'rgba(229,193,125,0.5)', display: 'block', marginBottom: '0.85rem' }}>
                      Current Asset Deployment Status
                    </span>

                    {doc.activeBooking ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                        {/* Driver */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Current Driver</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #E5C17D, #8a6d35)',
                              color: '#1a1410', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                            }}>
                              {(doc.activeBooking.primary_client?.full_name || 'UN').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                            </div>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                              {doc.activeBooking.primary_client?.full_name || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        {/* Phone */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Phone</span>
                          <span style={{ color: '#fff', fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            {doc.activeBooking.primary_client?.phone || '—'}
                          </span>
                        </div>

                        {/* Estimated Return */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Est. Return</span>
                          <span style={{ color: '#E5C17D', fontWeight: 600, fontSize: '0.88rem' }}>
                            {new Date(doc.activeBooking.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {doc.activeBooking.return_time ? ` @ ${doc.activeBooking.return_time}` : ''}
                          </span>
                        </div>

                        {/* Booking ID */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Contract</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-gold)', background: 'rgba(229,193,125,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                            #{doc.activeBooking.id?.substring(0, 6).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.85rem 1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🟢</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.9rem' }}>Asset Inside Garage — Ready for Maintenance</div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.15rem' }}>
                            Vehicle is not currently assigned to any active booking. Schedule maintenance now.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Standard Booking Results (non-expiring filters) ── */}
      {activeAlertFilter !== 'expiring' && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {paginatedResults.map(booking => (
            <OmniResultCard
              key={booking.id}
              booking={booking}
              isFineHighlight={!!interceptDate}
              onEdit={() => setEditingBooking(booking)}
              allBookings={allBookings}
              setAllBookings={setAllBookings}
              onOpenNotesModal={setNoteScoreModalClient}
            />
          ))}

          {/* Pagination Controls */}
          {totalItems > itemsPerPage && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.85rem 1.25rem', marginTop: '1rem', borderRadius: '12px',
              background: 'rgba(38, 30, 24, 0.4)', border: '1px solid var(--border-color)',
              flexWrap: 'wrap', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
            }} className="glass-panel no-print">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {lang === 'fr' ? (
                  <>Affichage de <span style={{ color: '#fff', fontWeight: 600 }}>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)} à {Math.min(totalItems, currentPage * itemsPerPage)}</span> sur <span style={{ color: '#fff', fontWeight: 600 }}>{totalItems}</span> résultats</>
                ) : (
                  <>Showing <span style={{ color: '#fff', fontWeight: 600 }}>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(totalItems, currentPage * itemsPerPage)}</span> of <span style={{ color: '#fff', fontWeight: 600 }}>{totalItems}</span> matches</>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, justifyContent: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover-bg-glass"
                >
                  {lang === 'fr' ? 'Précédent' : 'Previous'}
                </button>
                {Array.from({ length: Math.min(9, totalPages) }, (_, idx) => {
                  let p = idx + 1;
                  if (currentPage > 5 && totalPages > 9) {
                    p = currentPage - 5 + idx;
                    if (p + (8 - idx) > totalPages) {
                      p = totalPages - 8 + idx;
                    }
                  }
                  const active = currentPage === p
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      style={{
                        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                        background: active ? 'rgba(229,193,125,0.12)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(229,193,125,0.45)' : 'rgba(255,255,255,0.08)'}`,
                        color: active ? '#ae9260' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      className="hover-bg-glass"
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: currentPage === totalPages ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover-bg-glass"
                >
                  {lang === 'fr' ? 'Suivant' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {emptyMsg && !(activeAlertFilter === 'expiring' && filteredExpiringDocs.length > 0) && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(229,193,125,0.45)',
          fontSize: '0.9rem',
          background: 'rgba(10,8,7,0.5)',
          border: '1px dashed rgba(229,193,125,0.12)',
          borderRadius: '12px',
        }}>
          {emptyMsg}
        </div>
      )}

      {/* ── Quick-Edit Return Modal ── */}
      <QuickEditBookingModal
        booking={editingBooking as any}
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
        vehiclePricePerDay={editingBooking?.vehicles?.price_per_day}
        onBookingUpdated={(updatedBooking) => {
          if (setAllBookings) {
            setAllBookings((prev) =>
              prev.map((b) => (b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b))
            )
          }
        }}
      />

      {noteScoreModalClient && (
        <ClientNoteScoreModal
          isOpen={!!noteScoreModalClient}
          onClose={() => setNoteScoreModalClient(null)}
          client={noteScoreModalClient}
          onClientUpdated={(updatedClient) => {
            if (setAllBookings) {
              setAllBookings((prev) =>
                prev.map((b) => {
                  let updatedBooking = { ...b }
                  if (updatedBooking.primary_client && updatedBooking.primary_client.id === updatedClient.id) {
                    updatedBooking.primary_client = {
                      ...updatedBooking.primary_client,
                      internal_note: updatedClient.internal_note,
                      manual_score_adjustment: updatedClient.manual_score_adjustment,
                      trust_score: updatedClient.trust_score
                    }
                  }
                  if (updatedBooking.secondary_client && updatedBooking.secondary_client.id === updatedClient.id) {
                    updatedBooking.secondary_client = {
                      ...updatedBooking.secondary_client,
                      internal_note: updatedClient.internal_note,
                      manual_score_adjustment: updatedClient.manual_score_adjustment,
                      trust_score: updatedClient.trust_score
                    }
                  }
                  return updatedBooking
                })
              )
            }
          }}
        />
      )}
    </div>
  )
}

/* ─── OmniResultCard ─────────────────────────────────────────────── */
function OmniResultCard({
  booking,
  isFineHighlight,
  onEdit,
  allBookings,
  setAllBookings,
  onOpenNotesModal,
}: {
  booking: OmniBooking
  isFineHighlight: boolean
  onEdit: () => void
  allBookings: OmniBooking[]
  setAllBookings?: React.Dispatch<React.SetStateAction<OmniBooking[]>>
  onOpenNotesModal: (client: any) => void
}) {
  const router = useRouter()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [localStatus, setLocalStatus] = useState(booking.status)

  useEffect(() => {
    setLocalStatus(booking.status)
  }, [booking.status])

  const handleStatusChange = async (newStatus: string) => {
    const oldStatus = localStatus
    setLocalStatus(newStatus)
    setLoadingStatus(true)
    try {
      const res = await updateBookingStatus(booking.id, newStatus)
      
      // Update local state without re-fetching full page
      if (res && setAllBookings) {
        setAllBookings((prev) =>
          prev.map((b) => {
            let updated = { ...b }
            if (b.id === booking.id) {
              updated.status = res.status
            }
            if (updated.primary_client && res.primaryClientId === updated.primary_client.id) {
              updated.primary_client = {
                ...updated.primary_client,
                trust_score: res.primaryClientScore
              }
            }
            if (updated.secondary_client && res.secondaryClientId === updated.secondary_client.id) {
              updated.secondary_client = {
                ...updated.secondary_client,
                trust_score: res.secondaryClientScore
              }
            }
            return updated
          })
        )
      }
      showToast(`Booking status updated to ${newStatus} successfully!`, 'success')
    } catch (err: any) {
      setLocalStatus(oldStatus)
      showToast(err.message || 'Error updating status', 'error')
    } finally {
      setLoadingStatus(false)
    }
  }

  const total   = Number(booking.total_amount) || 0
  const baseAcompte = Number(booking.acompte_paid)  || 0
  const paidInstallmentsSum = (booking.installments || [])
    .filter((t: any) => t.status === 'paid')
    .reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
  const acompte = baseAcompte + paidInstallmentsSum
  const reste   = total - acompte
  const notes   = booking.damage_notes || ''
  const isPerfectComment = notes.toLowerCase().includes('perfect normal return') || notes.includes('[GREEN]')
  const isGrayComment = notes.includes('[GRAY]')
  const hasDamage = Boolean(booking.damage_notes)

  const borderColor = isFineHighlight
    ? 'rgba(245,158,11,0.5)'
    : 'rgba(229,193,125,0.15)'

  const glowStyle = isFineHighlight
    ? '0 0 0 2px rgba(245,158,11,0.15), 0 8px 24px rgba(0,0,0,0.5)'
    : '0 4px 16px rgba(0,0,0,0.4)'

  // Render mathematical trust badge with security icons/stars
  const renderTrustBadge = (clientId?: string, clientName?: string) => {
    const { score, riskLevel } = getClientRiskProfile(clientId, clientName, allBookings)

    if (score === null) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: '0.7rem',
          fontWeight: 600,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          New Client
        </span>
      )
    }

    if (riskLevel === 'criminal') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#ff4444',
            fontSize: '0.7rem',
            fontWeight: 900,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            border: '1px solid #ff4444',
            animation: 'omni-glow-criminal 1.5s infinite alternate',
            width: 'fit-content'
          }}>
            <ShieldIcon size={12} style={{ fill: 'rgba(255, 68, 68, 0.2)' }} />
            Blacklisted / Suspended ({score.toFixed(1)} DRI)
          </span>
          <span style={{ fontSize: '0.72rem', color: '#ffb3b3', fontWeight: 600 }}>
            ⚠️ Block booking. Active contract triggers repossession flag.
          </span>
        </div>
      )
    }

    if (riskLevel === 'very_high_risk') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.45rem',
            borderRadius: '4px',
            background: 'rgba(244, 63, 94, 0.15)',
            color: '#fb7185',
            fontSize: '0.7rem',
            fontWeight: 700,
            border: '1px solid rgba(244, 63, 94, 0.5)',
            width: 'fit-content'
          }}>
            <ShieldIcon size={12} style={{ fill: 'rgba(244, 63, 94, 0.2)' }} />
            Restricted / High Risk ({score.toFixed(1)} DRI)
          </span>
          <span style={{ fontSize: '0.72rem', color: '#ffd1d7', fontWeight: 600 }}>
            Economy Tier Only, 100% Upfront Cash, Manager Co-Sign.
          </span>
        </div>
      )
    }

    if (riskLevel === 'high_risk') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            fontSize: '0.7rem',
            fontWeight: 700,
            border: '1px solid rgba(245, 158, 11, 0.5)',
            width: 'fit-content'
          }}>
            <ShieldIcon size={12} style={{ fill: 'rgba(245, 158, 11, 0.2)' }} />
            Cautionary ({score.toFixed(1)} DRI)
          </span>
          <span style={{ fontSize: '0.72rem', color: '#fde68a', fontWeight: 600 }}>
            Economy/Standard Only, Mandatory Vehicle Condition Photos.
          </span>
        </div>
      )
    }

    if (riskLevel === 'medium_risk') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            fontSize: '0.7rem',
            fontWeight: 700,
            border: '1px solid rgba(59, 130, 246, 0.5)',
            width: 'fit-content'
          }}>
            Standard ({score.toFixed(1)} DRI)
          </span>
          <span style={{ fontSize: '0.72rem', color: '#bfdbfe', fontWeight: 600 }}>
            Access to All Fleets, Standard Multi-Point Checklist.
          </span>
        </div>
      )
    }

    if (riskLevel === 'low_risk') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            fontSize: '0.7rem',
            fontWeight: 700,
            border: '1px solid rgba(16, 185, 129, 0.5)',
            width: 'fit-content'
          }}>
            Preferred ({score.toFixed(1)} DRI)
          </span>
          <span style={{ fontSize: '0.72rem', color: '#a7f3d0', fontWeight: 600 }}>
            Access to All Fleets, Standard Pricing, Minimal Checklist.
          </span>
        </div>
      )
    }

    // very_low_risk (Elite / VIP Renter)
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: 'rgba(229, 193, 125, 0.15)',
          color: 'var(--accent-gold)',
          fontSize: '0.7rem',
          fontWeight: 700,
          border: '1px solid rgba(229, 193, 125, 0.5)',
          animation: 'omni-glow-emerald 1.5s infinite alternate',
          width: 'fit-content'
        }}>
          <Star size={11} style={{ fill: 'var(--accent-gold)' }} />
          Elite / VIP Renter ({score.toFixed(1)} DRI)
        </span>
        <span style={{ fontSize: '0.72rem', color: '#fdf6e2', fontWeight: 600 }}>
          Access to Luxury Fleets (SUVs), 0% Upfront Advance Approved.
        </span>
      </div>
    )
  }

  return (
    <div className="omni-result-card" style={{
      display: 'grid',
      gridTemplateColumns: '90px 1.2fr 1fr 120px 1.2fr 130px 190px 140px 48px',
      gap: '0',
      background: 'rgba(14, 11, 9, 0.88)',
      border: `1px solid ${borderColor}`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: glowStyle,
      animation: 'omni-slidein 0.2s ease',
    }}>
      {/* Contract ID */}
      <Cell style={{ background: 'rgba(229,193,125,0.04)' }}>
        <Label>Contract</Label>
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          fontSize: '0.82rem',
          background: 'rgba(229,193,125,0.1)',
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
        }}>
          #{booking.id.substring(0, 6).toUpperCase()}
        </span>
        {hasDamage && !isPerfectComment && !isGrayComment && (
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.3rem' }}>⚠️ Damage</span>
        )}
        {hasDamage && isGrayComment && (
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.3rem' }}>💬 Note</span>
        )}
      </Cell>

      {/* Client Main & Trust Score */}
      <Cell>
        <Label>Client & Co-Drivers</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Primary Client */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-gold), #8a6d35)',
              color: '#1a1410', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem',
              flexShrink: 0,
            }}>
              {initials(booking.primary_client?.full_name)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {booking.primary_client?.full_name || 'Unknown'}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onOpenNotesModal(booking.primary_client || {
                      id: booking.client_id,
                      full_name: booking.client_name,
                      trust_score: null,
                      internal_note: null,
                      manual_score_adjustment: null
                    })
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: '#ae9260' }}
                  title={t('clientNotes.title')}
                >
                  <Edit size={12} style={{ color: 'rgba(229,193,125,0.6)' }} />
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(229,193,125,0.5)', marginBottom: '0.2rem' }}>
                {booking.primary_client?.phone || '—'}
              </div>
              <ClientInternalNoteBadge note={booking.primary_client?.internal_note} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start', marginTop: '0.25rem' }}>
                {renderTrustBadge(booking.primary_client?.id, booking.primary_client?.full_name || booking.client_name)}
              </div>
            </div>
          </div>

          {/* Secondary Client */}
          {booking.secondary_client && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(229,193,125,0.1)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a4030, #2a2010)',
                color: 'var(--accent-gold)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem',
                flexShrink: 0, border: '1px solid rgba(229,193,125,0.2)'
              }}>
                {initials(booking.secondary_client.full_name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {booking.secondary_client.full_name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (booking.secondary_client) {
                        onOpenNotesModal({
                          id: booking.secondary_client.id || '',
                          full_name: booking.secondary_client.full_name || 'Unknown',
                          trust_score: booking.secondary_client.trust_score !== undefined ? booking.secondary_client.trust_score : null,
                          internal_note: booking.secondary_client.internal_note !== undefined ? booking.secondary_client.internal_note : null,
                          manual_score_adjustment: booking.secondary_client.manual_score_adjustment !== undefined ? booking.secondary_client.manual_score_adjustment : null
                        })
                      }
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: '#ae9260' }}
                    title={t('clientNotes.title')}
                  >
                    <Edit size={11} style={{ color: 'rgba(229,193,125,0.6)' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', marginTop: '0.1rem' }}>
                  <span style={{ fontSize: '0.6rem', color: 'rgba(229,193,125,0.5)', textTransform: 'uppercase', background: 'rgba(229,193,125,0.08)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 600 }}>Co-Driver</span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(229,193,125,0.4)' }}>
                    {booking.secondary_client.phone || '—'}
                  </span>
                </div>
                <ClientInternalNoteBadge note={booking.secondary_client.internal_note} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start', marginTop: '0.25rem' }}>
                  {renderTrustBadge(booking.secondary_client.id, booking.secondary_client.full_name)}
                </div>
              </div>
            </div>
          )}
        </div>
      </Cell>

      {/* Legal Docs */}
      <Cell>
        <Label>Legal Docs</Label>
        <Stack>
          {/* Primary Client Docs — read live from joined CRM record so edits in
              /dashboard/clients reflect here on next revalidation. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <Row lbl="CIN" val={booking.primary_client?.cin} />
            <Row lbl="Iss" val={fmt(booking.primary_client?.cin_delivre_le)} />
            <Row lbl="Permis" val={booking.primary_client?.permis_numero || booking.primary_client?.license_number} />
            <Row lbl="DOB" val={fmt(booking.primary_client?.date_naissance)} />
          </div>

          {/* Secondary Client Docs */}
          {booking.secondary_client && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(229,193,125,0.1)' }}>
              <span style={{ fontSize: '0.65rem', color: 'rgba(229,193,125,0.5)' }}>CO-DRIVER</span>
              <Row lbl="CIN" val={booking.secondary_client?.cin} />
              <Row lbl="Iss" val={fmt(booking.secondary_client?.cin_delivre_le)} />
              <Row lbl="Permis" val={booking.secondary_client?.permis_numero || booking.secondary_client?.license_number} />
              <Row lbl="DOB" val={fmt(booking.secondary_client?.date_naissance)} />
            </div>
          )}
        </Stack>
      </Cell>

      {/* Vehicle */}
      <Cell>
        <Label>Vehicle</Label>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
          {booking.vehicles?.brand} {booking.vehicles?.model}
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: '0.78rem', color: '#fff',
          background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.4rem',
          borderRadius: '4px', display: 'inline-block', marginTop: '0.25rem',
        }}>
          {booking.vehicles?.license_plate || 'NO PLATE'}
        </span>
      </Cell>

      {/* Rental Period */}
      <Cell>
        <Label>Rental Period</Label>
        <Stack>
          <Row lbl="Dep" val={`${fmt(booking.start_date)} ${booking.pickup_time || booking.departure_time || ''}`} />
          <Row lbl="Ret" val={`${fmt(booking.end_date)} ${booking.return_time || ''}`} />
          <span style={{
            display: 'inline-block', marginTop: '0.25rem',
            background: 'rgba(229,193,125,0.15)', color: 'var(--accent-gold)',
            padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700,
            fontSize: '0.75rem',
            width: 'fit-content',
            whiteSpace: 'normal',
            maxWidth: '100%'
          }}>
            <span style={{ wordBreak: 'break-all' }}>
              {booking.rental_days_text || (booking.start_date && booking.end_date ? Math.round((new Date(booking.end_date.split('T')[0] + 'T00:00:00').getTime() - new Date(booking.start_date.split('T')[0] + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) : '—')}
            </span>
            <span> days</span>
          </span>

          {/* Phase 17a — Optional off-site Handover badge. Renders nothing when
              handover_location is null/empty so the cell stays compact. */}
          {booking.handover_location && booking.handover_location.trim() && (() => {
            const loc = booking.handover_location.trim()
            const lc = loc.toLowerCase()
            const Icon = (lc.includes('matar') || lc.includes('airport') || lc.includes('aéroport') || lc.includes('aeroport'))
              ? Plane
              : (lc.includes('hotel') || lc.includes('hôtel'))
                ? Hotel
                : MapPin
            // Render the full DD/MM/YYYY HH:MM so the badge shows when the
            // delivery actually happens, not just the time-of-day.
            const rawDt = booking.handover_datetime
            const hasTime = rawDt && !rawDt.includes('T00:00:00') && !rawDt.includes(' 00:00')
            const hhmm = rawDt
              ? new Date(rawDt).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  ...(hasTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
                })
              : ''
            return (
              <div
                title={`Handover · ${loc}${hhmm ? ' @ ' + hhmm : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                  marginTop: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'linear-gradient(135deg, rgba(229,193,125,0.12) 0%, rgba(229,193,125,0.04) 100%)',
                  border: '1px solid rgba(229,193,125,0.25)',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#E5C17D',
                  width: '100%',
                  maxWidth: '220px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: '#fff' }}>
                  <Icon size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.25 }}>{loc}</span>
                </div>
                {hhmm && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.68rem', paddingLeft: '1.1rem', marginTop: '0.05rem' }}>
                    <span>{hhmm}</span>
                  </div>
                )}
              </div>
            )
          })()}
        </Stack>
      </Cell>

      {/* Financials */}
      <Cell>
        <Label>Financials</Label>
        <Stack>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Total</span>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{total.toFixed(0)} DT</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Acompte</span>
            <strong style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{acompte.toFixed(0)} DT</strong>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '0.5rem',
            borderTop: '1px dashed rgba(229,193,125,0.2)', paddingTop: '0.25rem', marginTop: '0.1rem',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Reste</span>
            <strong style={{ color: reste > 0 ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>
              {reste.toFixed(0)} DT
            </strong>
          </div>
          {booking.installments && booking.installments.length > 0 && (
            <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {[...booking.installments].sort((a: any, b: any) => a.due_date > b.due_date ? 1 : -1).map((inst: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.35rem', borderRadius: '4px', borderLeft: inst.status === 'paid' ? '2px solid #10b981' : '2px solid #ef4444' }}>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                    {fmt(inst.due_date)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: inst.status === 'paid' ? '#10b981' : '#ef4444' }}>
                      {Number(inst.amount).toFixed(0)} DT
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Stack>
      </Cell>

      {/* Condition (Delta view) */}
      <Cell>
        <Label>Condition Δ</Label>
        <Stack>
          {(() => {
            const h = (booking.vehicle_handovers?.[0] || {}) as any
            const pKm = h.pickup_km ?? booking.starting_km
            const rKm = h.return_km ?? booking.return_km
            const pFuel = h.pickup_fuel
            const rFuel = h.return_fuel
            const pClean = h.pickup_cleanliness || booking.lavage_pickup
            const rClean = h.return_cleanliness || booking.lavage_return
            
            const drivenKm = calculateDrivenMileage(pKm, rKm)
            const fuelDelta = calculateFuelDelta(pFuel, rFuel)

            const formatClean = (c: string) => c === 'clean_wash' || c === 'Clean' ? 'Clean' : c === 'average_dust' ? 'Avg' : 'Dirty'

            return (
              <>
                {/* Fuel delta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                    <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>⛽</span>
                    <span style={tagStyle}>{pFuel !== undefined ? formatFuelFraction(pFuel) : (booking.fuel_level_pickup || '—')}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                    <span style={tagStyle}>{rFuel !== undefined ? formatFuelFraction(rFuel) : (booking.fuel_level_return || '—')}</span>
                  </div>
                  {fuelDelta && (
                    <div style={{ width: '100%', fontSize: '0.7rem', color: fuelDelta.color, fontWeight: 700, paddingLeft: '1.2rem', marginTop: '-0.15rem' }}>
                      {fuelDelta.text}
                    </div>
                  )}
                </div>

                {/* Wash delta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginTop: '0.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                    <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>💧</span>
                    <span style={tagStyle}>{pClean ? formatClean(pClean) : '—'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                    <span style={{...tagStyle, background: formatClean(rClean || '') === 'Dirty' ? 'rgba(239,68,68,0.12)' : tagStyle.background}}>
                      {rClean ? formatClean(rClean) : '—'}
                    </span>
                  </div>
                </div>

                {/* Odometer delta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginTop: '0.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                    <span style={{ color: 'rgba(229,193,125,0.5)', fontWeight: 700, fontSize: '0.65rem' }}>🛣️</span>
                    <span style={tagStyle}>{pKm ?? '—'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>→</span>
                    <span style={tagStyle}>{rKm !== undefined && rKm !== null ? `${rKm} km` : '-- km'}</span>
                  </div>
                  {drivenKm !== null && drivenKm > 0 && (
                    <div style={{ width: '100%', fontSize: '0.68rem', color: '#E5C17D', fontWeight: 600, paddingLeft: '1.2rem', marginTop: '-0.15rem' }}>
                      {drivenKm.toLocaleString()} km driven
                    </div>
                  )}
                </div>
              </>
            )
          })()}
          {hasDamage && <DamageNoteView note={booking.damage_notes || ''} />}
        </Stack>
      </Cell>

      {/* Interactive Status Selector */}
      <Cell style={{ justifyContent: 'center' }}>
        <Label>Status</Label>
        <div style={{ position: 'relative', width: '100%', marginTop: '0.2rem' }}>
          <select
            value={localStatus?.toLowerCase() || 'pending'}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loadingStatus}
            style={{
              width: '100%',
              background: localStatus?.toLowerCase() === 'confirmed' ? 'rgba(16, 185, 129, 0.08)' :
                          localStatus?.toLowerCase() === 'completed' ? 'rgba(229, 193, 125, 0.08)' :
                          localStatus?.toLowerCase() === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' :
                          'rgba(245, 158, 11, 0.08)',
              color: localStatus?.toLowerCase() === 'confirmed' ? '#34d399' :
                     localStatus?.toLowerCase() === 'completed' ? '#E5C17D' :
                     localStatus?.toLowerCase() === 'cancelled' ? '#f87171' :
                     '#fbbf24',
              border: `1px solid ${
                localStatus?.toLowerCase() === 'confirmed' ? 'rgba(16, 185, 129, 0.3)' :
                localStatus?.toLowerCase() === 'completed' ? 'rgba(229, 193, 125, 0.3)' :
                localStatus?.toLowerCase() === 'cancelled' ? 'rgba(239, 68, 68, 0.3)' :
                'rgba(245, 158, 11, 0.3)'
              }`,
              borderRadius: '8px',
              padding: '0.4rem 0.5rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: loadingStatus ? 'not-allowed' : 'pointer',
              outline: 'none',
              appearance: 'none',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}
          >
            <option value="pending" style={{ background: '#0e0b09', color: '#fbbf24' }}>Pending</option>
            <option value="confirmed" style={{ background: '#0e0b09', color: '#34d399' }}>Confirmed</option>
            <option value="completed" style={{ background: '#0e0b09', color: '#E5C17D' }}>Completed</option>
            <option value="cancelled" style={{ background: '#0e0b09', color: '#f87171' }}>Cancelled</option>
          </select>
          {loadingStatus && (
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'omni-spin 0.6s linear infinite'
            }} />
          )}
        </div>
      </Cell>

      {/* Actions */}
      <Cell style={{ alignItems: 'center', justifyContent: 'center', background: 'rgba(229,193,125,0.03)' }}>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit()
          }}
          title="Quick Edit"
          style={{
            background: 'rgba(229,193,125,0.1)',
            border: '1px solid rgba(229,193,125,0.2)',
            borderRadius: '8px',
            color: 'var(--accent-gold)',
            cursor: 'pointer',
            padding: '0.55rem',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Edit2 size={16} />
        </button>
      </Cell>
    </div>
  )
}

/* ─── Micro helpers ─────────────────────────────────────────────── */
const Cell = ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => (
  <div className={`omni-cell ${className || ''}`} style={{
    padding: '0.85rem 0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    borderRight: '1px solid rgba(229,193,125,0.06)',
    minWidth: 0,
    ...style,
  }}>
    {children}
  </div>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    fontSize: '0.62rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'rgba(229,193,125,0.45)',
    marginBottom: '0.2rem',
  }}>
    {children}
  </span>
)

const Stack = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
    {children}
  </div>
)

const Row = ({ lbl, val }: { lbl: string; val?: string }) => (
  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
    <span style={{ fontSize: '0.68rem', color: 'rgba(229,193,125,0.45)', fontWeight: 700, flexShrink: 0 }}>{lbl}:</span>
    <span style={{ fontSize: '0.8rem', color: '#fff' }}>{val || 'N/A'}</span>
  </div>
)

const tagStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  background: 'rgba(255,255,255,0.05)',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  color: 'rgba(255,255,255,0.75)',
  display: 'inline-block',
}
