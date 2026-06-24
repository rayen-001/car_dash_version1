'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, Plus, CheckCircle, XCircle, Receipt, FileText, Edit, Search, ShieldCheck, UserPlus, AlertOctagon, Plane, Hotel, MapPin, X, Loader2 } from 'lucide-react'
import { updateBookingStatus, addCoDriverToBooking } from '@/app/actions'
import { fetchBookingsPageAction } from '@/app/actions/bookings'
import { Booking, Vehicle, Client, BusinessSettings } from '@/types'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/Badge'
import BookingFormModal from './components/BookingFormModal'
import BookingInvoiceModal from './components/BookingInvoiceModal'
import BookingAgreementModal from './components/BookingAgreementModal'
import { useLanguage } from '@/lib/i18n'
import Fuse from 'fuse.js'

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

export default function BookingsClient({ 
  initialBookings, 
  initialTotalCount = 0,
  initialTotalPages = 1,
  vehicles, 
  clients,
  businessSettings,
  vehicleLegalDocs = []
}: { 
  initialBookings: Booking[]
  initialTotalCount?: number
  initialTotalPages?: number
  vehicles: Vehicle[]
  clients: Client[]
  businessSettings: BusinessSettings
  vehicleLegalDocs?: any[]
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()
  const { t, lang } = useLanguage()

  const getStatusLabel = (status: string) => {
    const key = `status.${status.toLowerCase()}` as any
    const label = t(key)
    return label === key ? status : label
  }

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsFormOpen(true)
    }
  }, [searchParams])

  // ─── Server-side pagination state ────────────────────────────────────────
  // The server cursor (which batch of 50 rows from the DB) is called serverPage.
  // Within each batch, the user navigates local pages of 10 rows.
  const SERVER_PAGE_SIZE = 50
  const LOCAL_PAGE_SIZE = 10

  const [serverBookings, setServerBookings] = useState<Booking[]>(initialBookings)
  const [serverTotalCount, setServerTotalCount] = useState(initialTotalCount)
  const [serverTotalPages, setServerTotalPages] = useState(initialTotalPages)
  const [serverPage, setServerPage] = useState(1)
  const [isFetching, setIsFetching] = useState(false)
  // Timestamp guard: prevents stale responses from overwriting newer ones
  const lastRequestTs = useRef<number>(0)

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [smartSearchEnabled, setSmartSearchEnabled] = useState(false)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(true)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  const [statusFilter, setStatusFilter] = useState('All')
  const [vehicleFilter, setVehicleFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Local page cursor within the current server batch
  const [currentPage, setCurrentPage] = useState(1)

  // Debounce searchQuery → debouncedSearchQuery (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch from server whenever filters / server-page change
  const fetchPage = useCallback(async (page: number, query: string, status: string, vehicle: string, from: string, to: string) => {
    const ts = Date.now()
    lastRequestTs.current = ts
    setIsFetching(true)
    try {
      const result = await fetchBookingsPageAction({
        page,
        pageSize: SERVER_PAGE_SIZE,
        searchQuery: query,
        statusFilter: status,
        vehicleFilter: vehicle,
        dateFrom: from || undefined,
        dateTo: to || undefined,
      })
      // Race-condition guard: ignore stale responses
      if (lastRequestTs.current !== ts) return
      setServerBookings(result.bookings as Booking[])
      setServerTotalCount(result.totalCount)
      setServerTotalPages(result.totalPages)
    } catch (err: any) {
      if (lastRequestTs.current !== ts) return
      showToast(err.message || 'Error loading bookings', 'error')
    } finally {
      if (lastRequestTs.current === ts) setIsFetching(false)
    }
  }, [showToast])

  // When debounced query or filters change: reset to server page 1 and local page 1
  useEffect(() => {
    setServerPage(1)
    setCurrentPage(1)
    fetchPage(1, debouncedSearchQuery, statusFilter, vehicleFilter, dateFrom, dateTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, statusFilter, vehicleFilter, dateFrom, dateTo])

  // When server page changes (Next/Prev batch): fetch new batch, keep local page 1
  useEffect(() => {
    setCurrentPage(1)
    fetchPage(serverPage, debouncedSearchQuery, statusFilter, vehicleFilter, dateFrom, dateTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPage])

  // Modals for Invoices and Agreements
  const [selectedInvoice, setSelectedInvoice] = useState<Booking | null>(null)
  const [selectedAgreement, setSelectedAgreement] = useState<Booking | null>(null)

  // Inline Co-Driver State
  const [activeCoDriverSearch, setActiveCoDriverSearch] = useState<string | null>(null)
  const [coDriverSearchQuery, setCoDriverSearchQuery] = useState('')
  const [isAddingCoDriver, setIsAddingCoDriver] = useState(false)

  const handleOpenNewModal = () => {
    setEditingBooking(null)
    setIsFormOpen(true)
  }

  const handleOpenEditModal = (booking: Booking) => {
    setEditingBooking(booking)
    setIsFormOpen(true)
  }


  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoading(true)
    try {
      await updateBookingStatus(id, newStatus)
      showToast(`Booking status updated to ${newStatus}!`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error')
    }
    setLoading(false)
  }

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'All' || vehicleFilter !== 'All' || dateFrom !== '' || dateTo !== ''

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('All')
    setVehicleFilter('All')
    setDateFrom('')
    setDateTo('')
  }

  const submitCoDriver = async (bookingId: string, clientId: string) => {
    setIsAddingCoDriver(true)
    try {
      await addCoDriverToBooking(bookingId, clientId)
      showToast('Co-Driver successfully added!', 'success')
      setActiveCoDriverSearch(null)
      setCoDriverSearchQuery('')
    } catch (err: any) {
      showToast(err.message || 'Error adding Co-Driver', 'error')
    }
    setIsAddingCoDriver(false)
  }

  // ─── Fuzzy search (Smart Name Suggestions) over current server batch ─────
  const fuzzyIndexData = useMemo(() => {
    return serverBookings.map((booking) => {
      const primary = (booking as any).primary_client || {
        full_name: booking.client_name
      }
      const secondary = (booking as any).secondary_client
      return {
        booking,
        search_client_name: normalizeText(booking.client_name || ''),
        search_primary_name: normalizeText(primary.full_name || ''),
        search_secondary_name: normalizeText(secondary?.full_name || '')
      }
    })
  }, [serverBookings])

  const fuseInstance = useMemo(() => {
    return new Fuse(fuzzyIndexData, {
      keys: ['search_client_name', 'search_primary_name', 'search_secondary_name'],
      threshold: 0.45,
      includeScore: true,
      minMatchCharLength: 3
    })
  }, [fuzzyIndexData])

  const fuzzySuggestions = useMemo(() => {
    if (!smartSearchEnabled) return []
    const normQuery = normalizeText(debouncedSearchQuery)
    if (normQuery.length < 3) return []
    if (isNonNameQuery(debouncedSearchQuery)) return []

    const results = fuseInstance.search(normQuery)
    const mapped = results.map((res) => {
      const matchPercent = Math.round((1 - (res.score ?? 1)) * 100)
      const isExactMatch =
        res.item.search_client_name === normQuery ||
        res.item.search_primary_name === normQuery ||
        res.item.search_secondary_name === normQuery
      return {
        booking: res.item.booking,
        search_client_name: res.item.search_client_name,
        search_primary_name: res.item.search_primary_name,
        search_secondary_name: res.item.search_secondary_name,
        matchPercent,
        isExactMatch
      }
    }).filter(item => item.matchPercent >= 20)

    const sorted = [...mapped].sort((a, b) => {
      if (a.isExactMatch && !b.isExactMatch) return -1
      if (!a.isExactMatch && b.isExactMatch) return 1
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent
      const ca = a.booking.created_at || ''
      const cb = b.booking.created_at || ''
      if (ca !== cb) return cb.localeCompare(ca)
      return (b.booking.start_date || '').localeCompare(a.booking.start_date || '')
    })

    const seen = new Set<string>()
    const deduplicated: typeof sorted = []
    for (const item of sorted) {
      if (!seen.has(item.booking.id)) {
        seen.add(item.booking.id)
        deduplicated.push(item)
      }
    }
    return deduplicated.slice(0, 8)
  }, [fuseInstance, debouncedSearchQuery, smartSearchEnabled])

  // ─── Local display: paginate the current server batch (10 per local page) ─
  // The server already applies search+filter; we just slice locally.
  const totalLocalItems = serverBookings.length
  const localTotalPages = Math.ceil(totalLocalItems / LOCAL_PAGE_SIZE) || 1
  const paginatedBookings = useMemo(() => {
    let sortedList = [...serverBookings]

    // If query is a name search, sort the server results by match score
    if (debouncedSearchQuery.trim().length >= 3 && !isNonNameQuery(debouncedSearchQuery)) {
      const normQuery = normalizeText(debouncedSearchQuery)
      
      const fuseResults = fuseInstance.search(normQuery)
      const scoresMap = new Map<string, { score: number; isExactMatch: boolean }>()
      
      for (const res of fuseResults) {
        const isExactMatch =
          res.item.search_client_name === normQuery ||
          res.item.search_primary_name === normQuery ||
          res.item.search_secondary_name === normQuery
        scoresMap.set(res.item.booking.id, {
          score: res.score ?? 1,
          isExactMatch
        })
      }

      // Sort sortedList using the scoresMap
      sortedList.sort((a, b) => {
        const scoreA = scoresMap.get(a.id)
        const scoreB = scoresMap.get(b.id)

        const matchPercentA = scoreA ? Math.round((1 - scoreA.score) * 100) : 0
        const matchPercentB = scoreB ? Math.round((1 - scoreB.score) * 100) : 0
        const isExactA = scoreA?.isExactMatch ?? false
        const isExactB = scoreB?.isExactMatch ?? false

        if (isExactA && !isExactB) return -1
        if (!isExactA && isExactB) return 1

        if (matchPercentB !== matchPercentA) {
          return matchPercentB - matchPercentA
        }

        // Fallback to creation date descending
        const ca = a.created_at || ''
        const cb = b.created_at || ''
        if (ca !== cb) return cb.localeCompare(ca)
        return (b.start_date || '').localeCompare(a.start_date || '')
      })
    }

    return sortedList.slice(
      (currentPage - 1) * LOCAL_PAGE_SIZE,
      currentPage * LOCAL_PAGE_SIZE
    )
  }, [serverBookings, currentPage, smartSearchEnabled, debouncedSearchQuery, fuseInstance])

  // Helper to map payment status to badge variant
  const getPaymentVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'success'
      case 'partial': return 'warning'
      case 'unpaid':
      default: return 'danger'
    }
  }

  // Helper to map deposit status to badge variant
  const getDepositVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'returned': return 'success'
      case 'held': return 'warning'
      case 'forfeited': return 'danger'
      default: return 'default'
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  // Co-Driver search autocomplete
  const filteredClients = clients.filter(c => c.full_name.toLowerCase().includes(coDriverSearchQuery.toLowerCase()))

  const getHandoverTelemetry = (booking: any) => {
    const handovers = booking.vehicle_handovers || []
    if (handovers.length === 0) return { deltaKm: null, deltaFuel: null }
    const h = handovers[0]
    let deltaKm = null
    let deltaFuel = null
    if (h.pickup_km !== null && h.return_km !== null) {
      deltaKm = h.return_km - h.pickup_km
    }
    if (h.pickup_fuel !== null && h.return_fuel !== null) {
      const fuelDiff = h.return_fuel - h.pickup_fuel
      deltaFuel = fuelDiff > 0 ? `+${fuelDiff}/8` : `${fuelDiff}/8`
    }
    return { deltaKm, deltaFuel }
  }

  const getDaysDiff = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    const diff = e.getTime() - s.getTime()
    return Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)))
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>{t('bookings.title')}</h1>
            <p className='subtitle'>{t('bookings.subtitle')}</p>
          </div>
          <button className="btn-primary" onClick={handleOpenNewModal}>
            <Plus size={18} />
            <span>{t('bookings.new')}</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="control-bar glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', marginBottom: '1.5rem', overflow: 'visible', position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <div ref={searchContainerRef} style={{ flex: 1, position: 'relative', minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder={t('common.search')} 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: searchQuery ? '2.5rem' : '1rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setShowDropdown(false)
                }}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-gold)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  zIndex: 10,
                  transition: 'all 0.2s ease',
                }}
                className="hover-bg-glass"
                title={lang === 'fr' ? 'Effacer la recherche' : 'Clear search'}
              >
                <X size={16} />
              </button>
            )}

            {/* Smart Suggestions Dropdown */}
            {smartSearchEnabled && fuzzySuggestions.length > 0 && showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '100%',
                  background: 'rgba(20, 16, 14, 0.98)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(229, 193, 125, 0.3)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                  zIndex: 999,
                  maxHeight: '380px',
                  overflowY: 'auto',
                  padding: '0',
                }}
              >
                {/* Dropdown Header with Dismiss/Close Icon */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.6rem 1rem', 
                    borderBottom: '1px solid rgba(212, 180, 106, 0.15)',
                    background: 'rgba(20, 16, 14, 0.98)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {lang === 'fr' ? 'Suggestions de recherche' : 'Search Suggestions'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setShowDropdown(false)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-gold)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-bg-glass"
                    title={lang === 'fr' ? 'Masquer' : 'Hide'}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div style={{ padding: '0.25rem 0' }}>
                  {fuzzySuggestions.map(({ booking, matchPercent, isExactMatch }) => {
                    const primary = booking.primary_client || {
                      full_name: booking.client_name,
                      phone: booking.client_phone,
                    }
                    const secondary = booking.secondary_client
                    const vehicle = booking.vehicles

                    // Categorize Match
                    let categoryLabel = ''
                    let badgeBg = ''
                    let badgeColor = ''
                    let isWeak = false

                    if (isExactMatch) {
                      categoryLabel = lang === 'fr' ? 'Correspondance exacte' : 'Exact match'
                      badgeBg = 'rgba(74, 222, 128, 0.15)'
                      badgeColor = '#4ade80'
                    } else if (matchPercent >= 85) {
                      categoryLabel = lang === 'fr' ? 'Correspondance forte' : 'Strong match'
                      badgeBg = 'rgba(229, 193, 125, 0.15)'
                      badgeColor = '#E5C17D'
                    } else if (matchPercent >= 70) {
                      categoryLabel = lang === 'fr' ? 'Bonne correspondance' : 'Good match'
                      badgeBg = 'rgba(184, 168, 150, 0.15)'
                      badgeColor = '#b8a896'
                    } else {
                      categoryLabel = lang === 'fr' ? 'Correspondance possible' : 'Possible match'
                      badgeBg = 'rgba(122, 110, 99, 0.1)'
                      badgeColor = '#7a6e63'
                      isWeak = true
                    }

                    return (
                      <div
                        key={booking.id}
                        onClick={() => {
                          setSelectedAgreement(booking)
                          setShowDropdown(false)
                        }}
                        className="hover-bg-glass"
                        style={{
                          padding: '0.65rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(212, 180, 106, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          opacity: isWeak ? 0.75 : 1,
                          transition: 'all 0.2s ease',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="fw-600" style={{ color: '#fff', fontSize: '0.9rem' }}>
                            {primary.full_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: badgeBg,
                              color: badgeColor,
                              border: `1px solid ${isWeak ? 'rgba(255,255,255,0.08)' : badgeColor}40`,
                            }}
                          >
                            {categoryLabel} — {matchPercent}%
                          </span>
                        </div>
                        
                        {secondary && (
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            {lang === 'fr' ? 'Co-conducteur' : 'Co-driver'}: <span style={{ color: '#ccc' }}>{secondary.full_name}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ color: '#E5C17D', fontWeight: 600 }}>
                            📅 {booking.start_date ? new Date(booking.start_date).toLocaleDateString('en-GB') : '—'} ➔ {booking.end_date ? new Date(booking.end_date).toLocaleDateString('en-GB') : '—'}
                          </span>
                          <span>•</span>
                          <span>#{booking.id.substring(0, 6).toUpperCase()}</span>
                          <span>•</span>
                          <span>{primary.phone || 'No Phone'}</span>
                          {vehicle && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#fff' }}>{vehicle.brand} {vehicle.model} ({vehicle.license_plate})</span>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Smart Name Suggestions Toggle */}
          <button
            onClick={() => setSmartSearchEnabled(prev => !prev)}
            className={`btn-secondary ${smartSearchEnabled ? 'active-gold' : ''}`}
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: smartSearchEnabled ? '1px solid #E5C17D' : '1px solid rgba(255, 255, 255, 0.1)',
              background: smartSearchEnabled ? 'rgba(229, 193, 125, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              color: smartSearchEnabled ? '#E5C17D' : 'var(--text-muted)',
              borderRadius: '8px',
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

          {hasActiveFilters && (
            <button 
              onClick={handleResetFilters} 
              className="btn-secondary" 
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {t('common.resetFilters')}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          {/* Status Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('bookings.status')}:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '130px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem' }}
            >
              <option value="All">{t('status.all')}</option>
              <option value="confirmed">{t('status.confirmed')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </select>
          </div>

          {/* Vehicle Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('form.brand')}:</label>
            <select 
              value={vehicleFilter} 
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '160px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem' }}
            >
              <option value="All">{t('bookings.allVehicles')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
              ))}
            </select>
          </div>

          {/* Date Range Picker */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('bookings.dateFrom')}:</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input"
              style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem', width: '135px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('bookings.dateTo')}:</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input"
              style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.5rem', width: '135px' }}
            />
          </div>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel master-operations-table' style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>{t('bookings.contract')}</th>
                <th style={{ width: '320px' }}>{t('bookings.clientCoDrivers')}</th>
                <th style={{ width: '220px' }}>{t('bookings.legalDocs')}</th>
                <th style={{ width: '240px' }}>{t('bookings.vehicleTelemetry')}</th>
                <th style={{ width: '160px' }}>{t('bookings.rentalWindow')}</th>
                <th style={{ width: '180px' }}>{t('bookings.financials')}</th>
                <th style={{ width: '140px', textAlign: 'right' }}>{t('fleet.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings && paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking: any) => {
                  const { deltaKm, deltaFuel } = getHandoverTelemetry(booking)
                  const acomptePaid = Number(booking.acompte_paid || 0)
                  const paidInstallmentsSum = (booking.installments || [])
                    .filter((t: any) => t.status === 'paid')
                    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
                  const totalPaid = acomptePaid + paidInstallmentsSum
                  const reste = Number(booking.total_amount || 0) - totalPaid
                  const primary = booking.primary_client || { full_name: booking.client_name, phone: booking.client_phone, trust_score: null, cin: booking.client_cin_passport, license_number: booking.client_license_number }
                  const secondary = booking.secondary_client
                  const hasRisk = secondary?.trust_score !== null && secondary?.trust_score < 30

                  return (
                  <tr key={booking.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* COL 1: CONTRACT */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div className="fw-600" style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>#{booking.id.substring(0, 6).toUpperCase()}</div>
                      <Badge variant={booking.status === 'completed' ? 'success' : booking.status === 'confirmed' ? 'info' : 'warning'}>
                        {getStatusLabel(booking.status)}
                      </Badge>
                    </td>

                    {/* COL 2: CLIENT & CO-DRIVER COCKPIT */}
                    <td style={{ verticalAlign: 'top', padding: '1rem' }}>
                      {/* Top: Primary Driver */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(229,193,125,0.15)', border: '1px solid rgba(229,193,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E5C17D', fontWeight: 600, fontSize: '0.85rem' }}>
                           {getInitials(primary.full_name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="fw-500" style={{ color: '#fff', fontSize: '0.95rem' }}>{primary.full_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            {primary.phone || 'No Phone'}
                          </div>
                          {primary.trust_score !== null && primary.trust_score !== undefined && primary.trust_score < 30 ? (
                            <div style={{ 
                              background: 'rgba(239,68,68,0.15)', 
                              border: '1px solid rgba(239,68,68,0.4)', 
                              color: '#ef4444', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px', 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              animation: 'pulseAlert 2s infinite'
                            }}>
                              {t('dri.primaryRisk')}
                            </div>
                          ) : (
                            <span style={{
                              background: primary.trust_score === null || primary.trust_score === undefined ? 'rgba(255,255,255,0.05)' : primary.trust_score >= 80 ? 'rgba(16,185,129,0.15)' : primary.trust_score >= 60 ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                              color: primary.trust_score === null || primary.trust_score === undefined ? 'var(--text-muted)' : primary.trust_score >= 80 ? '#10b981' : primary.trust_score >= 60 ? '#4ade80' : '#fbbf24',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: '1px solid',
                              borderColor: primary.trust_score === null || primary.trust_score === undefined ? 'rgba(255,255,255,0.1)' : primary.trust_score >= 80 ? 'rgba(16,185,129,0.3)' : primary.trust_score >= 60 ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
                            }}>
                              {primary.trust_score === null || primary.trust_score === undefined ? t('dri.unrated') : primary.trust_score >= 80 ? `${t('dri.excellent')} (${primary.trust_score.toFixed(1)} DRI)` : primary.trust_score >= 60 ? `${t('dri.standard')} (${primary.trust_score.toFixed(1)} DRI)` : `${t('dri.watch')} (${primary.trust_score.toFixed(1)} DRI)`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Partition Line */}
                      <div style={{ borderBottom: '1px dashed rgba(229,193,125,0.15)', margin: '0.75rem 0' }} />

                      {/* Bottom: Secondary Driver */}
                      {secondary ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontWeight: 600, fontSize: '0.75rem' }}>
                            {getInitials(secondary.full_name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="fw-500" style={{ color: '#ccc', fontSize: '0.9rem' }}>{secondary.full_name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>({t('bookings.coDriver')})</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                              {secondary.phone || 'No Phone'}
                            </div>
                            {secondary.trust_score !== null && secondary.trust_score !== undefined && secondary.trust_score < 30 ? (
                              <div style={{ 
                                background: 'rgba(239,68,68,0.15)', 
                                border: '1px solid rgba(239,68,68,0.4)', 
                                color: '#ef4444', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: '4px', 
                                fontSize: '0.7rem', 
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                animation: 'pulseAlert 2s infinite'
                              }}>
                                {t('dri.codriverRisk')}
                              </div>
                            ) : (
                              <span style={{
                                background: secondary.trust_score === null || secondary.trust_score === undefined ? 'rgba(255,255,255,0.05)' : secondary.trust_score >= 80 ? 'rgba(16,185,129,0.15)' : secondary.trust_score >= 60 ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
                                color: secondary.trust_score === null || secondary.trust_score === undefined ? 'var(--text-muted)' : secondary.trust_score >= 80 ? '#10b981' : secondary.trust_score >= 60 ? '#4ade80' : '#fbbf24',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                border: '1px solid',
                                borderColor: secondary.trust_score === null || secondary.trust_score === undefined ? 'rgba(255,255,255,0.1)' : secondary.trust_score >= 80 ? 'rgba(16,185,129,0.3)' : secondary.trust_score >= 60 ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)',
                              }}>
                                {secondary.trust_score === null || secondary.trust_score === undefined ? t('dri.unrated') : secondary.trust_score >= 80 ? `${t('dri.excellent')} (${secondary.trust_score.toFixed(1)} DRI)` : secondary.trust_score >= 60 ? `${t('dri.standard')} (${secondary.trust_score.toFixed(1)} DRI)` : `${t('dri.watch')} (${secondary.trust_score.toFixed(1)} DRI)`}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          {activeCoDriverSearch === booking.id ? (
                            <div style={{ 
                              background: 'rgba(15,23,42,0.98)', 
                              backdropFilter: 'blur(12px)',
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid rgba(229,193,125,0.4)',
                              position: 'absolute',
                              top: '0',
                              left: '0',
                              width: '260px',
                              zIndex: 50,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                            }}>
                              <input 
                                type="text"
                                autoFocus
                                placeholder={t('common.search')}
                                value={coDriverSearchQuery}
                                onChange={(e) => setCoDriverSearchQuery(e.target.value)}
                                className="form-input text-xs"
                                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                {filteredClients.slice(0, 5).map(c => (
                                  <div 
                                    key={c.id} 
                                    onClick={() => submitCoDriver(booking.id, c.id)}
                                    style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}
                                    className="hover-bg-glass"
                                  >
                                    <span className="fw-500">{c.full_name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>CIN: {c.cin || 'N/A'} • {c.phone}</span>
                                  </div>
                                ))}
                                {filteredClients.length === 0 && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem', textAlign: 'center' }}>{t('common.noData')}</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                <button className="text-muted text-xs hover-bg-glass px-2 py-1 rounded" onClick={() => setActiveCoDriverSearch(null)}>{t('common.cancel')}</button>
                                <button className="text-gold text-xs fw-500 hover-bg-glass px-2 py-1 rounded" onClick={() => { handleOpenNewModal(); setActiveCoDriverSearch(null) }}>[ ➕ {t('clients.new')} ]</button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setActiveCoDriverSearch(booking.id); setCoDriverSearchQuery('') }}
                              style={{ 
                                padding: '0.5rem 0.75rem', 
                                fontSize: '0.8rem', 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px dashed rgba(229,193,125,0.3)', 
                                color: '#E5C17D',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                width: '100%',
                                justifyContent: 'center'
                              }}
                              className="hover-bg-glass"
                            >
                              <Plus size={14} /> {t('bookings.addCoDriver')}
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* COL 3: STATUTORY LEGAL DOCS */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                        <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>CIN</span>: {primary.cin || '-'}</div>
                        <div style={{ marginTop: '0.15rem' }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>Lic</span>: {primary.license_number || '-'}</div>
                      </div>
                      
                      {secondary && (
                        <>
                          <div style={{ borderBottom: '1px dashed rgba(229,193,125,0.12)', margin: '0.75rem 0' }} />
                          <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                            <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>CIN</span>: {secondary.cin || '-'}</div>
                            <div style={{ marginTop: '0.15rem' }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '35px' }}>Lic</span>: {secondary.license_number || '-'}</div>
                          </div>
                        </>
                      )}
                    </td>

                    {/* COL 4: VEHICLE TELEMETRY NODE */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ 
                        background: '#111', 
                        border: '2px solid #333', 
                        borderRadius: '4px', 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        padding: '0.15rem 0.4rem',
                        marginBottom: '0.4rem'
                      }}>
                        <span style={{ borderRight: '1px solid #444', paddingRight: '0.4rem', marginRight: '0.4rem', color: '#f87171' }}>TN</span>
                        <span>{booking.vehicles?.license_plate || 'NO PLATE'}</span>
                      </div>
                      <div className="fw-500 text-sm" style={{ color: '#ccc', marginBottom: '0.4rem' }}>
                        {booking.vehicles?.brand} {booking.vehicles?.model}
                      </div>
                      <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {deltaKm !== null && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{deltaKm} {t('fleet.kmDriven')}</span>}
                        {deltaFuel !== null && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{deltaFuel} {t('fleet.tank')}</span>}
                      </div>
                    </td>

                    {/* COL 5: RENTAL WINDOW */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.25rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} />
                        {new Date(booking.start_date).toLocaleDateString('en-GB')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                        {new Date(booking.end_date).toLocaleDateString('en-GB')}
                      </div>
                      <Badge variant="default">{getDaysDiff(booking.start_date, booking.end_date)} {t('bookings.days')}</Badge>

                      {/* Phase 17a — Optional off-site Handover badge. Renders nothing
                          when handover_location is null/empty so the column stays compact. */}
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
                            title={`${t('fleet.handover')} · ${loc}${hhmm ? ' @ ' + hhmm : ''}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                              marginTop: '0.5rem',
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
                    </td>

                    {/* COL 6: CASH RECONCILIATION */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{Number(booking.total_amount || 0).toFixed(2)} DT</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.15rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('bookings.acompte')}:</span>
                        <span style={{ color: '#4ade80' }}>{acomptePaid.toFixed(2)} DT</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.15rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('bookings.installmentsPaid')}:</span>
                        <span style={{ color: paidInstallmentsSum > 0 ? '#4ade80' : 'var(--text-muted)' }}>{paidInstallmentsSum.toFixed(2)} DT</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '0.2rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('bookings.totalPaid')}:</span>
                        <span style={{ color: '#4ade80', fontWeight: 600 }}>{totalPaid.toFixed(2)} DT</span>
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        paddingTop: '0.4rem',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        fontWeight: 600,
                        color: reste > 0 ? '#f87171' : '#4ade80'
                      }}>
                        <span>{t('bookings.remaining')}:</span>
                        <span>{reste.toFixed(2)} DT</span>
                      </div>
                    </td>

                    {/* COL 7: ACTIONS */}
                    <td style={{ verticalAlign: 'top', paddingTop: '1.25rem', textAlign: 'right' }}>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="icon-btn text-amber" title={t('bookings.invoice')} onClick={() => setSelectedInvoice(booking)}>
                          <Receipt size={16} />
                        </button>
                        <button className="icon-btn text-gold" title={t('bookings.agreement')} onClick={() => setSelectedAgreement(booking)}>
                          <FileText size={16} />
                        </button>
                        <button className="icon-btn text-info" title={t('common.edit')} onClick={() => handleOpenEditModal(booking)}>
                          <Edit size={16} />
                        </button>
                        {booking.status !== 'confirmed' && (
                          <button className="icon-btn text-success" title={t('common.confirm')} onClick={() => handleStatusChange(booking.id, 'confirmed')} disabled={loading}>
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {booking.status !== 'cancelled' && (
                          <button className="icon-btn text-danger" title={t('common.cancel')} onClick={() => handleStatusChange(booking.id, 'cancelled')} disabled={loading}>
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem 0' }}>
                      <div style={{ 
                        background: 'rgba(212, 180, 106, 0.03)', 
                        border: '1px solid rgba(212, 180, 106, 0.1)', 
                        padding: '2.5rem', 
                        borderRadius: '12px',
                        maxWidth: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem',
                        margin: '0 auto',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Calendar size={40} style={{ color: '#e5c17d', opacity: 0.8 }} />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#fff', letterSpacing: '0.3px' }}>{t('bookings.noBookings')}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center' }}>
                          {t('bookings.manageReservations')}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {(localTotalPages > 1 || serverTotalPages > 1) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.85rem 1.25rem', marginTop: '1rem', borderRadius: '12px',
            background: 'rgba(38, 30, 24, 0.4)', border: '1px solid var(--border-color)',
            flexWrap: 'wrap', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
          }} className="glass-panel">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('common.showing')} <span style={{ color: '#fff', fontWeight: 600 }}>
                {Math.min(serverTotalCount, (serverPage - 1) * SERVER_PAGE_SIZE + (currentPage - 1) * LOCAL_PAGE_SIZE + 1)}–{Math.min(serverTotalCount, (serverPage - 1) * SERVER_PAGE_SIZE + currentPage * LOCAL_PAGE_SIZE)}
              </span> {t('common.of')} <span style={{ color: '#fff', fontWeight: 600 }}>{serverTotalCount}</span> {t('common.bookings')}
              {isFetching && <Loader2 size={14} style={{ marginLeft: '0.5rem', display: 'inline', animation: 'spin 1s linear infinite', color: '#E5C17D', verticalAlign: 'middle' }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* Previous server batch */}
              {serverPage > 1 && currentPage === 1 && (
                <button
                  onClick={() => setServerPage(prev => Math.max(1, prev - 1))}
                  disabled={isFetching}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.7)', cursor: isFetching ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
                  }}
                  className="hover-bg-glass"
                >
                  « {t('common.previous')}
                </button>
              )}
              {/* Local prev within batch */}
              <button
                disabled={currentPage === 1 && serverPage === 1}
                style={{
                  padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  color: currentPage === 1 && serverPage === 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                  cursor: currentPage === 1 && serverPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
                }}
                className="hover-bg-glass"
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(prev => prev - 1)
                  } else if (serverPage > 1) {
                    setServerPage(prev => prev - 1)
                  }
                }}
              >
                {t('common.previous')}
              </button>
              {Array.from({ length: Math.min(9, localTotalPages) }, (_, idx) => {
                let p = idx + 1
                if (currentPage > 5 && localTotalPages > 9) {
                  p = currentPage - 5 + idx
                  if (p + (8 - idx) > localTotalPages) p = localTotalPages - 8 + idx
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
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                    className="hover-bg-glass"
                  >
                    {p}
                  </button>
                )
              })}
              {/* Local next within batch / next server batch */}
              <button
                onClick={() => {
                  if (currentPage < localTotalPages) {
                    setCurrentPage(prev => prev + 1)
                  } else if (serverPage < serverTotalPages) {
                    setServerPage(prev => prev + 1)
                  }
                }}
                disabled={(currentPage === localTotalPages && serverPage === serverTotalPages) || isFetching}
                style={{
                  padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  color: (currentPage === localTotalPages && serverPage === serverTotalPages) || isFetching ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                  cursor: (currentPage === localTotalPages && serverPage === serverTotalPages) || isFetching ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
                }}
                className="hover-bg-glass"
              >
                {t('common.next')}
              </button>
              {/* Load next server batch indicator */}
              {serverTotalPages > 1 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                  ({lang === 'fr' ? 'Page' : 'Batch'} {serverPage}/{serverTotalPages})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <BookingFormModal
          isOpen={isFormOpen}
          editingBooking={editingBooking}
          vehicles={vehicles}
          clients={clients}
          initialBookings={serverBookings}
          vehicleLegalDocs={vehicleLegalDocs}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {selectedInvoice && (
        <BookingInvoiceModal
          booking={selectedInvoice}
          businessSettings={businessSettings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {selectedAgreement && (
        <BookingAgreementModal
          booking={selectedAgreement}
          businessSettings={businessSettings}
          onClose={() => setSelectedAgreement(null)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseAlert {
          0% { opacity: 1; }
          50% { opacity: 0.5; box-shadow: 0 0 12px rgba(239, 68, 68, 0.4); }
          100% { opacity: 1; }
        }
        .hover-bg-glass:hover {
          background: rgba(229, 193, 125, 0.08) !important;
        }
      ` }} />
    </div>
  )
}
