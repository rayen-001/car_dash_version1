'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users, UserPlus, Search, Mail, Phone, CreditCard,
  Calendar, History, Edit, Trash2, X, FileText, CheckCircle2, ShieldAlert, Loader2,
  ChevronRight, ChevronDown, ShieldAlert as ShieldIcon, Star, Shield, MapPin, Cake
} from 'lucide-react'
import { addClient, updateClient, deleteClient } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Client, Booking, Expense } from '@/types'
import { calculateTrustScore } from '@/lib/trustScore'

interface ClientsClientProps {
  initialClients: Client[]
  bookings: Booking[]
  expenses: Expense[]
}

/* ─── Trust Scoring Core Evaluator (Parity with GlobalCommandSearch.tsx) ─── */
const getClientRiskProfile = (
  clientId: string | undefined,
  clientName: string | undefined,
  allBookings: Booking[]
) => {
  if (!clientId && !clientName) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  // Filter bookings for this client (excluding cancelled)
  const clientBookings = allBookings.filter(b => {
    if (clientId && (b.client_id === clientId || b.secondary_client_id === clientId)) return true
    if (clientName && (b.client_name === clientName || b.secondary_client?.full_name === clientName)) return true
    return false
  }).filter(b => b.status !== 'cancelled')

  if (clientBookings.length === 0) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const { trustScore: score, hasCriminalOverride } = calculateTrustScore(clientBookings as any, todayStr)

  let riskLevel: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'very_high_risk' | 'criminal'
  
  if (hasCriminalOverride || (score !== null && score < 15.0)) {
    riskLevel = 'criminal'
  } else if (score !== null && score >= 92.0) {
    riskLevel = 'very_low_risk'
  } else if (score !== null && score >= 80.0) {
    riskLevel = 'low_risk'
  } else if (score !== null && score >= 60.0) {
    riskLevel = 'medium_risk'
  } else if (score !== null && score >= 45.0) {
    riskLevel = 'high_risk'
  } else {
    riskLevel = 'very_high_risk'
  }

  return { score, riskLevel }
}

export default function ClientsClient({ initialClients, bookings, expenses }: ClientsClientProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [clients, setClients] = useState<Client[]>(initialClients)
  
  useEffect(() => {
    setClients(initialClients)
  }, [initialClients])

  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddModalOpen(true)
    }
  }, [searchParams])

  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [cin, setCin] = useState('')
  // Tunisian legal identity fields — surfaced under the "Legal Identity" sub-section
  // in both Add and Edit modals. Stored as YYYY-MM-DD strings (HTML date inputs).
  const [dateNaissance, setDateNaissance] = useState('')
  const [lieuNaissance, setLieuNaissance] = useState('')
  const [cinDelivreLe, setCinDelivreLe] = useState('')
  const [permisNumero, setPermisNumero] = useState('')
  const [permisDelivreLe, setPermisDelivreLe] = useState('')

  // Initials generator for circular premium avatars
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const normalizePhone = (raw?: string): string => {
    if (!raw) return ''
    return raw
      .replace(/^\+216/, '')   // strip country code
      .replace(/\D/g, '')      // strip non-digits
      .trim()
  }

  // Render YYYY-MM-DD (or full ISO) as DD/MM/YYYY without timezone drift.
  // Used by the inline Legal Identity strip on each client row.
  const fmtDate = (s?: string | null): string => {
    if (!s) return ''
    const parts = s.split('T')[0].split('-')
    if (parts.length !== 3) return s
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  // Toggle right-side drawer
  const toggleRow = (clientId: string) => {
    setSelectedClientId(prev => prev === clientId ? null : clientId)
  }

  // Calculate rental history and dynamic debt aggregator for a client
  const getClientStats = (clientId: string) => {
    // 1. Calculate Inflows (Include both primary and secondary roles)
    const primaryBookings = bookings.filter((b) => b.client_id === clientId || b.secondary_client_id === clientId)
    const totalSpent = primaryBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
    
    // 2. Calculate Outflows (Shared Damages from Expenses)
    const clientExpenses = expenses.filter((e) => e.client_id === clientId)
    const damageOutflows = clientExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    // Net LTV Expression
    const netLTV = totalSpent - damageOutflows

    const completedRents = primaryBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').length
    
    // Aggregated Lifetime Debt: Unpaid balances across active (confirmed) and completed contracts
    const activeAndCompleted = primaryBookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
    const totalOwed = activeAndCompleted.reduce((sum, b) => {
      const balance = Number(b.total_amount) - (Number(b.acompte_paid) || 0)
      return sum + Math.max(0, balance)
    }, 0)

    return {
      bookingsList: primaryBookings,
      totalSpent,
      damageOutflows,
      netLTV,
      completedRents,
      totalOwed,
      clientExpenses
    }
  }

  // Filter clients by search query and risk rating
  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase().trim()
    const clientBookings = bookings.filter((b) => b.client_id === client.id)

    // Compute live risk profile
    const { score, riskLevel } = getClientRiskProfile(client.id, client.full_name, bookings)
    const stats = getClientStats(client.id)

    const isDebtQuery = query === 'debt'
    
    // Cleansed phone matching
    const normalizedStoredPhone = normalizePhone(client.phone)
    const normalizedQuery       = normalizePhone(searchQuery)
    const matchPhone = normalizedQuery.length >= 4
      ? normalizedStoredPhone.includes(normalizedQuery)
      : client.phone.toLowerCase().includes(query)

    const matchesSearch = 
      (isDebtQuery && stats.totalOwed > 0) ||
      client.full_name.toLowerCase().includes(query) ||
      (client.email || '').toLowerCase().includes(query) ||
      matchPhone ||
      (client.license_number || '').toLowerCase().includes(query) ||
      (client.permis_numero || '').toLowerCase().includes(query) ||
      clientBookings.some(b => 
        (b.vehicle?.brand || '').toLowerCase().includes(query) ||
        (b.vehicle?.model || '').toLowerCase().includes(query) ||
        (b.vehicles?.brand || '').toLowerCase().includes(query) ||
        (b.vehicles?.model || '').toLowerCase().includes(query) ||
        (b.vehicle?.license_plate || '').toLowerCase().includes(query) ||
        (b.vehicles?.license_plate || '').toLowerCase().includes(query)
      )

    // Matches Risk filter
    let matchesRisk = true
    if (riskFilter !== 'All') {
      if (riskFilter === 'Elite / VIP Renter') matchesRisk = riskLevel === 'very_low_risk'
      else if (riskFilter === 'Preferred') matchesRisk = riskLevel === 'low_risk'
      else if (riskFilter === 'Standard') matchesRisk = riskLevel === 'medium_risk'
      else if (riskFilter === 'Cautionary') matchesRisk = riskLevel === 'high_risk'
      else if (riskFilter === 'Restricted / High Risk') matchesRisk = riskLevel === 'very_high_risk'
      else if (riskFilter === 'Blacklisted / Suspended') matchesRisk = riskLevel === 'criminal'
    }

    return matchesSearch && matchesRisk
  })

  // Date columns come back from Supabase as YYYY-MM-DD already, but defensively
  // trim any trailing time component so HTML date inputs accept the value.
  const ymd = (s?: string | null): string => (s ? s.split('T')[0] : '')

  // Open add modal
  const handleOpenAdd = () => {
    setFullName('')
    setEmail('')
    setPhone('')
    setLicenseNumber('')
    setCin('')
    setDateNaissance('')
    setLieuNaissance('')
    setCinDelivreLe('')
    setPermisNumero('')
    setPermisDelivreLe('')
    setMessage(null)
    setIsAddModalOpen(true)
  }

  // Open edit modal
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client)
    setFullName(client.full_name)
    setEmail(client.email || '')
    setPhone(client.phone)
    setLicenseNumber(client.license_number || '')
    setCin(client.cin || '')
    setDateNaissance(ymd(client.date_naissance))
    setLieuNaissance(client.lieu_naissance || '')
    setCinDelivreLe(ymd(client.cin_delivre_le))
    setPermisNumero(client.permis_numero || '')
    setPermisDelivreLe(ymd(client.permis_delivre_le))
    setMessage(null)
  }

  // Handle Add Client Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('full_name', fullName)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('license_number', licenseNumber)
      formData.append('cin', cin)
      formData.append('date_naissance', dateNaissance)
      formData.append('lieu_naissance', lieuNaissance)
      formData.append('cin_delivre_le', cinDelivreLe)
      formData.append('permis_numero', permisNumero)
      formData.append('permis_delivre_le', permisDelivreLe)

      await addClient(formData)
      
      setMessage({ type: 'success', text: 'Client profile registered successfully!' })
      showToast('Client registered successfully!', 'success')
      setTimeout(() => {
        setIsAddModalOpen(false)
        router.refresh()
      }, 600)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to register client.' })
    } finally {
      setLoading(false)
    }
  }

  // Handle Edit Client Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return
    setLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('id', editingClient.id)
      formData.append('full_name', fullName)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('license_number', licenseNumber)
      formData.append('cin', cin)
      formData.append('date_naissance', dateNaissance)
      formData.append('lieu_naissance', lieuNaissance)
      formData.append('cin_delivre_le', cinDelivreLe)
      formData.append('permis_numero', permisNumero)
      formData.append('permis_delivre_le', permisDelivreLe)

      await updateClient(formData)
      
      setMessage({ type: 'success', text: 'Client profile updated successfully!' })
      showToast('Client profile updated!', 'success')
      setTimeout(() => {
        setEditingClient(null)
        router.refresh()
      }, 600)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update client.' })
    } finally {
      setLoading(false)
    }
  }

  // Handle Delete Client
  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Client',
      message: 'Are you sure you want to delete this client? This will permanently remove their profile and rental history link.',
      confirmLabel: 'Yes, Delete',
      danger: true,
    })
    if (!confirmed) return
    
    try {
      await deleteClient(id)
      setClients(clients.filter(c => c.id !== id))
      showToast('Client removed from records.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete client. Please try again.', 'error')
    }
  }

  const renderRiskBadge = (score: number | null, riskLevel: string) => {
    const isNew = score === null || riskLevel === 'new_client'
    const displayScore = isNew ? 0 : score
    const safeScore = Math.max(0, Math.min(100, displayScore))
    
    // SVG Metrics
    const radius = 18
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (safeScore / 100) * circumference

    let strokeColor = '#f59e0b' // Amber default
    let glowColor = 'rgba(245, 158, 11, 0.4)'
    let statusText = 'Standard'
    
    if (isNew) {
      strokeColor = '#4b5563' // Gray
      glowColor = 'rgba(75, 85, 99, 0.2)'
      statusText = 'New Client'
    } else if (riskLevel === 'criminal' || safeScore < 40) {
      strokeColor = '#ef4444' // Intense Crimson
      glowColor = 'rgba(239, 68, 68, 0.6)'
      statusText = 'Blacklisted'
    } else if (safeScore >= 75) {
      strokeColor = '#10b981' // Emerald Green
      glowColor = 'rgba(16, 185, 129, 0.4)'
      statusText = riskLevel === 'very_low_risk' ? 'VIP' : 'Preferred'
    } else {
      statusText = riskLevel === 'high_risk' || riskLevel === 'very_high_risk' ? 'High Risk' : 'Standard'
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx="22" cy="22" r={radius}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="4" fill="transparent"
            />
            {/* Progress Ring */}
            <circle
              cx="22" cy="22" r={radius}
              stroke={strokeColor}
              strokeWidth="4" fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={isNew ? circumference : offset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 1s ease-out',
                filter: `drop-shadow(0 0 4px ${glowColor})`
              }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
            {isNew ? 'N/A' : safeScore.toFixed(0)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: strokeColor }}>
            {statusText}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
            DRI Score
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page animate-fade-in">
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
      `}</style>

      <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">👤 Mini-CRM Clients Directory</h1>
          <p className="subtitle">Track client rental records, trust scoring metrics, scheduled installments cascades, and total debt exposure.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={18} />
          <span>Register Client</span>
        </button>
      </div>

      {/* Stats Summary cards */}
      <div className="grid-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>TOTAL REGISTERED CLIENTS</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>{clients.length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>ACTIVE RENTERS</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
            {bookings.filter((b) => b.status === 'confirmed').length} Clients
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>TOTAL Llifetime DEBT LIABILITY</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f87171', marginTop: '0.5rem', textShadow: '0 0 8px rgba(239, 68, 68, 0.3)' }}>
            {clients.reduce((acc, c) => acc + getClientStats(c.id).totalOwed, 0).toFixed(2)} DT
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', padding: '0.5rem 1rem', width: '360px' }}>
            <Search size={16} style={{ color: '#ae9260', marginRight: '0.75rem' }} />
            <input 
              type="text" 
              placeholder="Search by name, license, CIN, phone, plate..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', outline: 'none', width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: '#ae9260', fontSize: '0.85rem', fontWeight: 600 }}>Risk Rating:</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '220px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer' }}
            >
              <option value="All">All Standing Categories</option>
              <option value="Elite / VIP Renter">Elite / VIP Renter (DRI ≥ 92)</option>
              <option value="Preferred">Preferred (DRI 80-92)</option>
              <option value="Standard">Standard (DRI 60-80)</option>
              <option value="Cautionary">Cautionary (DRI 45-60)</option>
              <option value="Restricted / High Risk">Restricted / High Risk (DRI 15-45)</option>
              <option value="Blacklisted / Suspended">Blacklisted / Suspended (DRI &lt; 15)</option>
            </select>
          </div>
        </div>

        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(229,193,125,0.15)', textAlign: 'left' }}>
                <th style={{ width: '40px', padding: '1rem 0.5rem' }}></th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Client & Standing</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Contact Info</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>CIN</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Driver License</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Rents</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Total Spent</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Total Owed (Reste Total)</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                    No clients found matching the selected query or standing categories.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const stats = getClientStats(client.id)
                  const { score, riskLevel } = getClientRiskProfile(client.id, client.full_name, bookings)
                  const isExpanded = selectedClientId === client.id

                  return (
                    <Fragment key={client.id}>
                      <tr 
                        key={client.id} 
                        className={`table-row ${isExpanded ? 'active-row' : ''}`} 
                        onClick={() => toggleRow(client.id)}
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.03)', 
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(229, 193, 125, 0.02)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        {/* Expander Arrow Toggle */}
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: '#ae9260', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => { e.stopPropagation(); toggleRow(client.id); }}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            {/* Monogram initials circle (Strict compliance: NO photograph imports) */}
                            <div className="profile-avatar" style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #ae9260, #735d38)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              border: '1px solid rgba(229,193,125,0.3)',
                              flexShrink: 0
                            }}>
                              {getInitials(client.full_name)}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              {/* Tier 1: name */}
                              <span style={{ fontWeight: 600, color: '#ffffff', display: 'block', fontSize: '0.95rem', letterSpacing: '-0.005em' }}>
                                {client.full_name}
                              </span>

                              {/* Tier 2: anchor row — Reg date + DRI score (always present) */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                                  Reg {client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : '—'}
                                </span>
                                {renderRiskBadge(score, riskLevel)}
                              </div>

                              {/* Tier 3: optional chips — only render when populated, so empty
                                  rows stay clean and populated rows look intentional. */}
                              {(client.date_naissance || client.address) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                  {client.date_naissance && (
                                    <span
                                      title="Date of Birth"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        fontSize: '0.7rem',
                                        color: 'rgba(229,193,125,0.95)',
                                        background: 'rgba(229,193,125,0.06)',
                                        border: '1px solid rgba(229,193,125,0.18)',
                                        padding: '0.18rem 0.5rem',
                                        borderRadius: '999px',
                                        fontWeight: 600,
                                        letterSpacing: '0.01em',
                                        lineHeight: 1,
                                      }}
                                    >
                                      <Cake size={11} strokeWidth={2.2} />
                                      <span>{fmtDate(client.date_naissance)}</span>
                                    </span>
                                  )}
                                  {client.address && (
                                    <span
                                      title={client.address}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        fontSize: '0.7rem',
                                        color: 'rgba(229,193,125,0.95)',
                                        background: 'rgba(229,193,125,0.06)',
                                        border: '1px solid rgba(229,193,125,0.18)',
                                        padding: '0.18rem 0.5rem',
                                        borderRadius: '999px',
                                        fontWeight: 500,
                                        letterSpacing: '0.01em',
                                        lineHeight: 1,
                                        maxWidth: '220px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <MapPin size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.address}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>{client.phone}</div>
                          {client.email && <div style={{ fontSize: '0.78rem', color: '#888' }}>{client.email}</div>}
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'monospace', color: client.cin ? '#e0e0e0' : 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '0.22rem 0.5rem', borderRadius: '6px', fontSize: '0.82rem', letterSpacing: '0.02em' }}>
                              {client.cin || '—'}
                            </span>
                            {client.cin_delivre_le && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.66rem', color: 'rgba(229,193,125,0.7)', letterSpacing: '0.02em' }}>
                                <Calendar size={10} strokeWidth={2.2} />
                                <span>Iss {fmtDate(client.cin_delivre_le)}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'monospace', color: (client.permis_numero || client.license_number) ? '#e0e0e0' : 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '0.22rem 0.5rem', borderRadius: '6px', fontSize: '0.82rem', letterSpacing: '0.02em' }}>
                              {client.permis_numero || client.license_number || '—'}
                            </span>
                            {client.permis_delivre_le && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.66rem', color: 'rgba(229,193,125,0.7)', letterSpacing: '0.02em' }}>
                                <Calendar size={10} strokeWidth={2.2} />
                                <span>Issued {fmtDate(client.permis_delivre_le)}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: '#ffffff' }}>
                          {stats.completedRents}
                        </td>

                        <td style={{ padding: '1rem 0.75rem', fontWeight: 700, color: '#ae9260' }}>
                          {stats.totalSpent.toFixed(2)} DT
                        </td>

                        {/* Total Owed column with Warning Glow block */}
                        <td style={{ padding: '1rem 0.75rem' }}>
                          {stats.totalOwed > 0 ? (
                            <div style={{
                              color: '#f87171',
                              textShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              fontWeight: 700,
                              display: 'inline-block',
                              fontSize: '0.9rem'
                            }}>
                              {stats.totalOwed.toFixed(2)} DT
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>0.00 DT</span>
                          )}
                        </td>

                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', position: 'relative', zIndex: 10 }}>
                            <button 
                              type="button"
                              className="btn-action-icon" 
                              title="Rental History Drawer"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleRow(client.id); }}
                              style={{ background: 'rgba(229,193,125,0.1)', color: '#ae9260', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <History size={15} />
                            </button>
                            <button 
                              type="button"
                              className="btn-action-icon" 
                              title="Edit Profile"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenEdit(client); }}
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Edit size={15} />
                            </button>
                            <button 
                              type="button"
                              className="btn-action-icon" 
                              title="Remove Client"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(client.id); }}
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="expanded-accordion-row">
                          <td colSpan={9} style={{ padding: 0, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,193,125,0.15)' }}>
                            <div style={{ padding: '2rem', borderTop: '1px solid rgba(229,193,125,0.1)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
                                {/* Left Side: Ledger & Identity */}
                                <div style={{ flex: '1 1 400px' }}>
                                  <h3 style={{ margin: '0 0 1.5rem 0', color: '#ae9260', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <History size={20} />
                                    <span>Client Profile & Ledger</span>
                                  </h3>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ae9260', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Lifetime Revenue</span>
                                      <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.totalSpent.toFixed(2)} DT</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ae9260', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Net LTV (Rev - Dmg)</span>
                                      <div style={{ 
                                        color: stats.netLTV < 0 ? '#ef4444' : '#10b981', 
                                        fontSize: '1.25rem', 
                                        fontWeight: 700, 
                                        marginTop: '0.25rem',
                                        textShadow: stats.netLTV < 0 ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none'
                                      }}>
                                        {stats.netLTV.toFixed(2)} DT
                                      </div>
                                    </div>
                                    <div style={{ background: 'rgba(239,68,68,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Outstanding Debt</span>
                                      <div style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.totalOwed.toFixed(2)} DT</div>
                                    </div>
                                    <div style={{ background: 'rgba(245,158,11,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Damage Logs</span>
                                      <div style={{ color: '#f59e0b', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.damageOutflows.toFixed(2)} DT</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Timeline */}
                                <div style={{ flex: '1 1 500px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <h4 style={{ margin: '0 0 1.5rem 0', color: '#ae9260', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Rental Timeline
                                  </h4>
                                  {stats.bookingsList.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                      No historical bookings linked to this client yet.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                                      <div style={{ position: 'absolute', left: '15px', top: '0', bottom: '0', width: '2px', background: 'rgba(229,193,125,0.1)' }}></div>
                                      
                                      {stats.bookingsList.slice().reverse().map((booking) => {
                                        const remains = Math.max(0, Number(booking.total_amount) - (Number(booking.acompte_paid) || 0));
                                        const plateNumber = booking.vehicle?.license_plate || booking.vehicles?.license_plate || '—';
                                        const vehicleName = booking.vehicle 
                                          ? `${booking.vehicle.brand} ${booking.vehicle.model}` 
                                          : booking.vehicles 
                                            ? `${booking.vehicles.brand} ${booking.vehicles.model}` 
                                            : 'Deleted Vehicle';
                                        
                                        const incidentExpenses = stats.clientExpenses.filter(e => e.vehicle_id === booking.vehicle_id && new Date(e.created_at || '') >= new Date(booking.start_date) && new Date(e.created_at || '') <= new Date(booking.actual_return_date || booking.end_date || new Date().toISOString()))

                                        return (
                                          <div key={booking.id} style={{ position: 'relative', paddingLeft: '2.5rem' }}>
                                            <div style={{ position: 'absolute', left: '11px', top: '16px', width: '10px', height: '10px', borderRadius: '50%', background: booking.status === 'completed' ? '#10b981' : booking.status === 'confirmed' ? '#3b82f6' : '#f59e0b', boxShadow: '0 0 0 4px rgba(10,8,7,1)' }}></div>
                                            
                                            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '1rem' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                  <div style={{ color: '#ae9260', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {new Date(booking.start_date).toLocaleDateString('en-GB')} - {new Date(booking.end_date).toLocaleDateString('en-GB')}
                                                  </div>
                                                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{vehicleName}</div>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', background: '#111', border: '1px solid rgba(229, 193, 125, 0.4)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: '0.7rem' }}>
                                                    <span style={{ color: '#ae9260', marginRight: '0.3rem', borderRight: '1px solid rgba(229, 193, 125, 0.2)', paddingRight: '0.3rem' }}>TN</span>
                                                    <span>{plateNumber}</span>
                                                  </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{Number(booking.total_amount).toFixed(2)} DT</div>
                                                  <div style={{ fontSize: '0.75rem', color: remains > 0 ? '#ef4444' : '#10b981', fontWeight: 600, marginTop: '0.25rem' }}>
                                                    {remains > 0 ? `Unpaid: ${remains.toFixed(2)} DT` : 'Fully Paid'}
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {(booking.client_behavior_status || incidentExpenses.length > 0) && (
                                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                  {booking.client_behavior_status && (
                                                    <div style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                                      <ShieldAlert size={12} />
                                                      Flags: {booking.client_behavior_status.replace(/_/g, ' ')}
                                                    </div>
                                                  )}
                                                  {incidentExpenses.map(e => (
                                                    <div key={e.id} style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      <span>Damage Logged:</span>
                                                      <span style={{ fontWeight: 600 }}>{Number(e.amount).toFixed(2)} DT</span>
                                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>({e.description})</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD CLIENT MODAL --- */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', width: '95%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(229,193,125,0.2)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Register New Client</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {message && (
              <div className={`status-banner ${message.type}`} style={{ marginBottom: '1rem' }}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Full Name *</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Aladin Mabrouk"
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Phone Number *</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="e.g. +216 98 123 456"
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.2rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Email Address</label>
                  <input 
                     type="email" 
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="e.g. aladin@domain.tn"
                     className="form-input"
                     style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>CIN</label>
                  <input 
                    type="text" 
                    value={cin}
                    onChange={(e) => setCin(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="form-input"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Driver's License Number</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. 05/123456"
                    className="form-input"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* ── Tunisian Legal Identity ── */}
              <div style={{ paddingTop: '1rem', borderTop: '1px dashed rgba(229,193,125,0.18)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ae9260', boxShadow: '0 0 8px rgba(229,193,125,0.55)' }} />
                  <span style={{ fontSize: '0.7rem', color: '#ae9260', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Tunisian Legal Identity
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginLeft: '0.25rem' }}>
                    — surfaces on the Operations Command Center
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Date of Birth (DOB)</label>
                    <input
                      type="date"
                      value={dateNaissance}
                      onChange={(e) => setDateNaissance(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Lieu de Naissance (Place of Birth)</label>
                    <input
                      type="text"
                      value={lieuNaissance}
                      onChange={(e) => setLieuNaissance(e.target.value)}
                      placeholder="e.g. Tunis"
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>CIN Issue Date (Iss)</label>
                    <input
                      type="date"
                      value={cinDelivreLe}
                      onChange={(e) => setCinDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Permit Number (Permis)</label>
                    <input
                      type="text"
                      value={permisNumero}
                      onChange={(e) => setPermisNumero(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Permit Issue Date</label>
                    <input
                      type="date"
                      value={permisDelivreLe}
                      onChange={(e) => setPermisDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {loading ? <Loader2 size={16} className="spinner" /> : null}
                  <span>Save Client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CLIENT MODAL --- */}
      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', width: '95%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(229,193,125,0.2)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Edit Client Details</h2>
              <button onClick={() => setEditingClient(null)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {message && (
              <div className={`status-banner ${message.type}`} style={{ marginBottom: '1rem' }}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Full Name *</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Phone Number *</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.2rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. email@domain.tn"
                    className="form-input"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>CIN</label>
                  <input 
                    type="text" 
                    value={cin}
                    onChange={(e) => setCin(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Driver's License Number</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* ── Tunisian Legal Identity ── */}
              <div style={{ paddingTop: '1rem', borderTop: '1px dashed rgba(229,193,125,0.18)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ae9260', boxShadow: '0 0 8px rgba(229,193,125,0.55)' }} />
                  <span style={{ fontSize: '0.7rem', color: '#ae9260', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Tunisian Legal Identity
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginLeft: '0.25rem' }}>
                    — surfaces on the Operations Command Center
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Date of Birth (DOB)</label>
                    <input
                      type="date"
                      value={dateNaissance}
                      onChange={(e) => setDateNaissance(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Lieu de Naissance (Place of Birth)</label>
                    <input
                      type="text"
                      value={lieuNaissance}
                      onChange={(e) => setLieuNaissance(e.target.value)}
                      placeholder="e.g. Tunis"
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>CIN Issue Date (Iss)</label>
                    <input
                      type="date"
                      value={cinDelivreLe}
                      onChange={(e) => setCinDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Permit Number (Permis)</label>
                    <input
                      type="text"
                      value={permisNumero}
                      onChange={(e) => setPermisNumero(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 500 }}>Permit Issue Date</label>
                    <input
                      type="date"
                      value={permisDelivreLe}
                      onChange={(e) => setPermisDelivreLe(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingClient(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {loading ? <Loader2 size={16} className="spinner" /> : null}
                  <span>Update Client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
