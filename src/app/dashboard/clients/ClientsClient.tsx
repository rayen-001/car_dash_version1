'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Users, UserPlus, Search, Mail, Phone, CreditCard, 
  Calendar, History, Edit, Trash2, X, FileText, CheckCircle2, ShieldAlert, Loader2,
  ChevronRight, ChevronDown, ShieldAlert as ShieldIcon, Star, Shield
} from 'lucide-react'
import { addClient, updateClient, deleteClient } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Client, Booking } from '@/types'

interface ClientsClientProps {
  initialClients: Client[]
  bookings: Booking[]
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
    if (clientId && b.client_id === clientId) return true
    if (clientName && b.client_name === clientName) return true
    return false
  }).filter(b => b.status !== 'cancelled')

  if (clientBookings.length === 0) {
    return { score: null, riskLevel: 'new_client' as const }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const getDaysDiff = (d1Str: string, d2Str: string): number => {
    const d1 = new Date(d1Str.split('T')[0] + 'T00:00:00')
    const d2 = new Date(d2Str.split('T')[0] + 'T00:00:00')
    const diffTime = d2.getTime() - d1.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  }

  let returnHygiene = 100
  let totalContractValue = 0
  let totalOverdueUnpaid = 0
  let hasCriminalOverride = false
  let behaviorPenalty = 0

  const completedBookingsCount = clientBookings.filter(b => b.status === 'completed').length
  const loyaltyBonus = Math.min(20, completedBookingsCount * 2.5)

  clientBookings.forEach((b) => {
    const isCompleted = b.status === 'completed'
    const scheduledEnd = b.end_date
    const totalAmt = Number(b.total_amount) || 0
    const paidAmt = Number(b.acompte_paid) || 0
    const balance = totalAmt - paidAmt
    const installments = b.installments || []
    const hasInstallments = Array.isArray(installments) && installments.length > 0

    if (b.status === 'pending') {
      return
    }

    totalContractValue += totalAmt

    if (hasInstallments) {
      installments.forEach((inst: any) => {
        const amt = Number(inst.amount) || 0
        if (inst.status === 'unpaid') {
          if (getDaysDiff(inst.due_date, todayStr) > 0) {
            totalOverdueUnpaid += amt
          }
        }
      })
    } else {
      const isConfirmed = b.status === 'confirmed'
      const isOverdue = isConfirmed && (getDaysDiff(scheduledEnd, todayStr) > 0)
      if ((isCompleted || isOverdue) && balance > 0) {
        totalOverdueUnpaid += balance
      }
    }

    if (isCompleted) {
      const actualEnd = b.actual_return_date || scheduledEnd
      const lateDays = getDaysDiff(scheduledEnd, actualEnd)
      if (lateDays > 0) {
        returnHygiene -= Math.min(75, 4 * Math.pow(lateDays, 1.3))
      }
    } else if (b.status === 'confirmed') {
      const overdueDays = getDaysDiff(scheduledEnd, todayStr)
      if (overdueDays > 0) {
        let hasUnpaidDebt = false
        if (hasInstallments) {
          hasUnpaidDebt = installments.some(
            (inst: any) => inst.status === 'unpaid' && getDaysDiff(inst.due_date, todayStr) > 0
          )
        } else {
          hasUnpaidDebt = balance > 0
        }

        if (overdueDays >= 5 && hasUnpaidDebt) {
          hasCriminalOverride = true
        } else {
          returnHygiene -= overdueDays * 8
        }
      }
    }

    if (b.client_behavior_status) {
      const infractions = b.client_behavior_status.split(',').map((s: string) => s.trim()).filter(Boolean);
      
      infractions.forEach((infraction: string) => {
        let baseInfraction = 0
        let isPermanent = false

        if (infraction === 'dirty_return') {
          baseInfraction = 5
        } else if (infraction === 'speeding') {
          baseInfraction = 15
        } else if (infraction === 'minor_damage') {
          baseInfraction = 25
        } else if (infraction === 'major_damage') {
          baseInfraction = 100
          isPermanent = true
          hasCriminalOverride = true
        }

        if (baseInfraction > 0) {
          if (isPermanent) {
            behaviorPenalty += baseInfraction
          } else {
            const infractionDate = b.actual_return_date || b.end_date || todayStr
            const daysSince = Math.max(0, getDaysDiff(infractionDate, todayStr))
            const decayFactor = Math.max(0, 1 - daysSince / 90)
            behaviorPenalty += baseInfraction * decayFactor
          }
        }
      });
    }
  })

  returnHygiene = Math.max(0, Math.min(100, returnHygiene))

  const overdueDebtRatio = totalContractValue > 0 ? (totalOverdueUnpaid / totalContractValue) : 0
  const paymentHygiene = 100 - Math.min(100, overdueDebtRatio * 120)

  let score = (0.40 * returnHygiene) + (0.40 * paymentHygiene) - behaviorPenalty + loyaltyBonus

  if (hasCriminalOverride) {
    score = 0
  }

  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10))

  let riskLevel: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'very_high_risk' | 'criminal'
  
  if (hasCriminalOverride || score < 15.0) {
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

export default function ClientsClient({ initialClients, bookings }: ClientsClientProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set())

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

  // Toggle inline drawer
  const toggleRow = (clientId: string) => {
    setExpandedClientIds(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  // Calculate rental history and dynamic debt aggregator for a client
  const getClientStats = (clientId: string) => {
    const clientBookings = bookings.filter((b) => b.client_id === clientId)
    const totalSpent = clientBookings.reduce((sum, b) => sum + Number(b.total_amount), 0)
    const completedRents = clientBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').length
    
    // Aggregated Lifetime Debt: Unpaid balances across active (confirmed) and completed contracts
    const activeAndCompleted = clientBookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
    const totalOwed = activeAndCompleted.reduce((sum, b) => {
      const balance = Number(b.total_amount) - (Number(b.acompte_paid) || 0)
      return sum + Math.max(0, balance)
    }, 0)

    return {
      bookingsList: clientBookings,
      totalSpent,
      completedRents,
      totalOwed
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

  // Open add modal
  const handleOpenAdd = () => {
    setFullName('')
    setEmail('')
    setPhone('')
    setLicenseNumber('')
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
    if (score === null || riskLevel === 'new_client') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.7rem',
            fontWeight: 600,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            width: 'fit-content'
          }}>
            New Client
          </span>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>Unproven Trust Standing</span>
        </div>
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
          <span style={{ fontSize: '0.65rem', color: '#ff7777', fontWeight: 600 }}>
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
          <span style={{ fontSize: '0.65rem', color: '#fb7185' }}>
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
          <span style={{ fontSize: '0.65rem', color: '#fbbf24' }}>
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
          <span style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
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
          <span style={{ fontSize: '0.65rem', color: '#6ee7b7' }}>
            Access to All Fleets, Standard Pricing, Minimal Checklist.
          </span>
        </div>
      )
    }

    // very_low_risk
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
        <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
          Access to Luxury Fleets (SUVs), 0% Upfront Advance Approved.
        </span>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                    No clients found matching the selected query or standing categories.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const stats = getClientStats(client.id)
                  const { score, riskLevel } = getClientRiskProfile(client.id, client.full_name, bookings)
                  const isExpanded = expandedClientIds.has(client.id)

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
                            <div>
                              <span style={{ fontWeight: 600, color: '#ffffff', display: 'block' }}>{client.full_name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#888' }}>Reg: {client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : 'N/A'}</span>
                                {renderRiskBadge(score, riskLevel)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>{client.phone}</div>
                          {client.email && <div style={{ fontSize: '0.78rem', color: '#888' }}>{client.email}</div>}
                        </td>

                        <td style={{ padding: '1rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontFamily: 'monospace', color: '#e0e0e0', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                            {client.license_number || '—'}
                          </span>
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

                      {/* ── INTERACTIVE GLASSMORPHIC OBSIDIAN ROW DRAWER ── */}
                      {isExpanded && (
                        <tr key={`${client.id}-drawer`} style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                          <td colSpan={8} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(229,193,125,0.1)' }}>
                            <div className="glass-panel animate-fade-in" style={{
                              background: 'rgba(10, 8, 7, 0.95)',
                              border: '1px solid rgba(229, 193, 125, 0.22)',
                              borderRadius: '12px',
                              padding: '1.5rem',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            }} onClick={(e) => e.stopPropagation()}>
                              
                              {/* Drawer Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(229,193,125,0.1)', paddingBottom: '0.75rem' }}>
                                <h3 style={{ margin: 0, color: '#ae9260', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>📋 Rental Agreements & Payment Timelines:</span>
                                  <span style={{ color: '#fff' }}>{client.full_name}</span>
                                </h3>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                  Active/Completed: {stats.completedRents} sessions | Total Contributed: {stats.totalSpent.toFixed(2)} DT
                                </span>
                              </div>

                              {/* Booking Cards Block */}
                              {stats.bookingsList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.9rem' }}>
                                  No historical bookings linked to this client yet.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  {stats.bookingsList.map((booking) => {
                                    const remains = Math.max(0, Number(booking.total_amount) - (Number(booking.acompte_paid) || 0));
                                    const plateNumber = booking.vehicle?.license_plate || booking.vehicles?.license_plate || '—';
                                    const vehicleName = booking.vehicle 
                                      ? `${booking.vehicle.brand} ${booking.vehicle.model}` 
                                      : booking.vehicles 
                                        ? `${booking.vehicles.brand} ${booking.vehicles.model}` 
                                        : 'Deleted Vehicle';

                                    // Odometer Milestone safety checks
                                    const startingKm = booking.starting_km ?? booking.starting_mileage;
                                    const returnKm = booking.return_km ?? booking.return_mileage;

                                    // Installment calculations
                                    const insts = booking.installments || [];
                                    const maxAmt = insts.length > 0 ? Math.max(...insts.map(i => Number(i.amount))) : 0;

                                    return (
                                      <div key={booking.id} style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '10px',
                                        padding: '1.2rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem'
                                      }}>
                                        {/* Row 1: Vehicle Context Identity & Statuses */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {/* Stylized Tunisian License Plate Block Design */}
                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              background: '#111',
                                              border: '1.5px solid rgba(229, 193, 125, 0.4)',
                                              borderRadius: '6px',
                                              padding: '0.2rem 0.6rem',
                                              fontFamily: 'monospace',
                                              fontWeight: 'bold',
                                              color: '#fff',
                                              fontSize: '0.8rem',
                                              boxShadow: '0 0 8px rgba(229, 193, 125, 0.15)',
                                            }}>
                                              <span style={{ color: '#ae9260', marginRight: '0.4rem', borderRight: '1px solid rgba(229, 193, 125, 0.2)', paddingRight: '0.4rem', fontSize: '0.7rem' }}>TN</span>
                                              <span>{plateNumber}</span>
                                            </div>
                                            <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem' }}>
                                              {vehicleName}
                                            </span>
                                          </div>

                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              padding: '0.2rem 0.5rem',
                                              borderRadius: '4px',
                                              textTransform: 'capitalize',
                                              background: booking.status === 'completed' 
                                                ? 'rgba(16,185,129,0.12)' 
                                                : booking.status === 'confirmed'
                                                  ? 'rgba(59,130,246,0.12)'
                                                  : 'rgba(245,158,11,0.12)',
                                              color: booking.status === 'completed' 
                                                ? '#34d399' 
                                                : booking.status === 'confirmed'
                                                  ? '#60a5fa'
                                                  : '#fbbf24'
                                            }}>
                                              {booking.status}
                                            </span>

                                            <span style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              padding: '0.2rem 0.5rem',
                                              borderRadius: '4px',
                                              background: booking.payment_status === 'paid' 
                                                ? 'rgba(16,185,129,0.12)' 
                                                : 'rgba(239,68,68,0.12)',
                                              color: booking.payment_status === 'paid' ? '#34d399' : '#f87171'
                                            }}>
                                              {booking.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Row 2: Operational Delta and Financial Audit grid */}
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                          gap: '1rem',
                                          background: 'rgba(255,255,255,0.01)',
                                          border: '1px solid rgba(255,255,255,0.02)',
                                          borderRadius: '8px',
                                          padding: '0.85rem'
                                        }}>
                                          {/* Operational Deltas */}
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#ae9260', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                              🔧 Cleanliness & Mileage transitions
                                            </span>
                                            <div style={{ fontSize: '0.82rem', color: '#e0e0e0' }}>
                                              Lavage: <span style={{ color: '#fff', fontWeight: 500 }}>{booking.lavage_pickup || '—'}</span> → <span style={{ color: '#fff', fontWeight: 500 }}>{booking.lavage_return || '—'}</span>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: '#e0e0e0' }}>
                                              KM: <span style={{ color: '#fff', fontWeight: 500 }}>{startingKm !== undefined && startingKm !== null ? `${startingKm} km` : '-- km'}</span> → <span style={{ color: '#fff', fontWeight: 500 }}>{returnKm !== undefined && returnKm !== null ? `${returnKm} km` : '-- km'}</span>
                                            </div>
                                          </div>

                                          {/* Financial Ledger Audit */}
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#ae9260', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                              💰 Financial Audit
                                            </span>
                                            <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                                              Contract Total: <span style={{ color: '#fff', fontWeight: 600 }}>{Number(booking.total_amount).toFixed(2)} DT</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>
                                              Already Paid: <span style={{ color: '#34d399', fontWeight: 600 }}>{(Number(booking.acompte_paid) || 0).toFixed(2)} DT</span>
                                              {' '}| Outstanding Balance: <span style={{
                                                color: remains > 0 ? '#f87171' : '#34d399',
                                                fontWeight: 700,
                                                textShadow: remains > 0 ? '0 0 6px rgba(239, 68, 68, 0.3)' : 'none'
                                              }}>
                                                {remains.toFixed(2)} DT
                                              </span>
                                            </div>
                                          </div>

                                          {/* Temporal Context */}
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#ae9260', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                              📅 Agreement Period
                                            </span>
                                            <div style={{ fontSize: '0.82rem', color: '#e0e0e0' }}>
                                              Pickup: <span style={{ color: '#fff' }}>{new Date(booking.start_date).toLocaleDateString('en-GB')}</span>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: '#e0e0e0' }}>
                                              Return: <span style={{ color: '#fff' }}>{new Date(booking.end_date).toLocaleDateString('en-GB')}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Row 3: Scheduled Payment Installments Ledger */}
                                        {insts.length > 0 && (
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#ae9260', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                              💳 Scheduled Payment Installments Ledger
                                            </h4>
                                            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(229,193,125,0.1)' }}>
                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                                <thead>
                                                  <tr style={{ borderBottom: '1px solid rgba(229,193,125,0.15)', background: 'rgba(255,255,255,0.02)' }}>
                                                    <th style={{ padding: '0.5rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Tranche</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Due Date</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Principal Allocation</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', color: '#ae9260', fontWeight: 600, textAlign: 'right' }}>Status Tag</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {insts
                                                    .slice()
                                                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                                    .map((inst, index) => {
                                                      const original = maxAmt;
                                                      const remaining = Number(inst.amount);
                                                      const isPaid = inst.status === 'paid';
                                                      const isPartial = !isPaid && remaining < original;

                                                      return (
                                                        <tr key={inst.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                          <td style={{ padding: '0.5rem 0.75rem', color: '#fff', fontWeight: 500 }}>
                                                            Tranche #{index + 1}
                                                          </td>
                                                          <td style={{ padding: '0.5rem 0.75rem', color: '#e0e0e0' }}>
                                                            {new Date(inst.due_date).toLocaleDateString('en-GB')}
                                                          </td>
                                                          <td style={{ padding: '0.5rem 0.75rem', color: '#fff' }}>
                                                            {isPartial ? (
                                                              <span>
                                                                Original: <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.4)', marginRight: '0.25rem' }}>{original.toFixed(2)} DT</span>
                                                                | Remaining: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{remaining.toFixed(2)} DT</span>
                                                              </span>
                                                            ) : (
                                                              <span>Original: {remaining.toFixed(2)} DT</span>
                                                            )}
                                                          </td>
                                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                            {isPaid ? (
                                                              <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                background: 'rgba(16,185,129,0.12)',
                                                                color: '#34d399',
                                                                fontWeight: 600,
                                                                fontSize: '0.75rem'
                                                              }}>
                                                                🟢 Paid {inst.paid_date ? `(${new Date(inst.paid_date).toLocaleDateString('en-GB')})` : ''}
                                                              </span>
                                                            ) : isPartial ? (
                                                              <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                background: 'rgba(245,158,11,0.12)',
                                                                color: '#fbbf24',
                                                                fontWeight: 600,
                                                                fontSize: '0.75rem'
                                                              }}>
                                                                🟡 Partial ({remaining.toFixed(2)} DT left)
                                                              </span>
                                                            ) : (
                                                              <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                background: 'rgba(255,255,255,0.05)',
                                                                color: 'rgba(255,255,255,0.5)',
                                                                fontWeight: 600,
                                                                fontSize: '0.75rem'
                                                              }}>
                                                                ⚪ Unpaid
                                                              </span>
                                                            )}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
