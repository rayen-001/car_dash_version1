'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Users, UserPlus, Search, Mail, Phone, CreditCard, 
  Calendar, History, Edit, Trash2, X, FileText, CheckCircle2, ShieldAlert, Loader2 
} from 'lucide-react'
import { addClient, updateClient, deleteClient } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Client, Booking } from '@/types'

interface ClientsClientProps {
  initialClients: Client[]
  bookings: Booking[]
}

export default function ClientsClient({ initialClients, bookings }: ClientsClientProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddModalOpen(true)
    }
  }, [searchParams])
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingHistoryClient, setViewingHistoryClient] = useState<Client | null>(null)
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

  // Filter clients by search query and risk rating
  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = 
      client.full_name.toLowerCase().includes(query) ||
      (client.email || '').toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      (client.license_number || '').toLowerCase().includes(query)

    const clientBookings = bookings.filter((b) => b.client_id === client.id)
    const unpaidBookings = clientBookings.filter(b => b.payment_status === 'unpaid' || b.payment_status === 'partial')
    const outstandingBalance = unpaidBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
    const cancelledRents = clientBookings.filter(b => b.status === 'cancelled').length

    let riskLevel = 'good'
    if (outstandingBalance > 0 && cancelledRents > 0) {
      riskLevel = 'high'
    } else if (outstandingBalance > 0 || cancelledRents >= 2) {
      riskLevel = 'medium'
    }

    const matchesRisk = riskFilter === 'All' || riskLevel === riskFilter.toLowerCase()

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
      if (viewingHistoryClient?.id === id) setViewingHistoryClient(null)
      showToast('Client removed from records.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete client. Please try again.', 'error')
    }
  }

  // Calculate rental history for a client
  const getClientStats = (clientId: string) => {
    const clientBookings = bookings.filter((b) => b.client_id === clientId)
    const totalSpent = clientBookings.reduce((sum, b) => sum + Number(b.total_amount), 0)
    const completedRents = clientBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').length
    
    return {
      bookingsList: clientBookings,
      totalSpent,
      completedRents
    }
  }

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">👤 Mini-CRM Clients</h1>
          <p className="subtitle">Track client rental records, contact channels, active agreements, and security deposits.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={18} />
          <span>Register Client</span>
        </button>
      </div>

      {/* Stats Summary cards */}
      <div className="grid-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>TOTAL CLIENTS</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>{clients.length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>ACTIVE RENTERS</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
            {bookings.filter((b) => b.status === 'confirmed').length} Clients
          </div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>TUNISIAN LOCAL CURRENCY</span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ae9260', marginTop: '0.5rem' }}>DT</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', padding: '0.5rem 1rem', width: '320px' }}>
            <Search size={16} style={{ color: '#ae9260', marginRight: '0.75rem' }} />
            <input 
              type="text" 
              placeholder="Search clients..." 
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
              style={{ minWidth: '150px', background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(229,193,125,0.2)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer' }}
            >
              <option value="All">All Standing</option>
              <option value="Good">Good Standing</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
          </div>
        </div>

        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(229,193,125,0.15)', textAlign: 'left' }}>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Client</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Contact info</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Driver License</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Rents</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600 }}>Total Spent</th>
                <th style={{ padding: '1rem 0.75rem', color: '#ae9260', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                    No clients found. Click "Register Client" to add your first customer.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const stats = getClientStats(client.id)
                  const clientBookings = bookings.filter((b) => b.client_id === client.id)
                  const unpaidBookings = clientBookings.filter(b => b.payment_status === 'unpaid' || b.payment_status === 'partial')
                  const outstandingBalance = unpaidBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                  const cancelledRents = clientBookings.filter(b => b.status === 'cancelled').length

                  let riskLevel = 'good'
                  let riskReason = ''
                  if (outstandingBalance > 0 && cancelledRents > 0) {
                    riskLevel = 'high'
                    riskReason = `Outstanding: ${outstandingBalance} DT & Cancelled rents.`
                  } else if (outstandingBalance > 0) {
                    riskLevel = 'medium'
                    riskReason = `Outstanding balance of ${outstandingBalance} DT.`
                  } else if (cancelledRents >= 2) {
                    riskLevel = 'medium'
                    riskReason = `${cancelledRents} cancelled bookings.`
                  }

                  return (
                    <tr key={client.id} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
                            border: '1px solid rgba(229,193,125,0.3)'
                          }}>
                            {getInitials(client.full_name)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: '#ffffff', display: 'block' }}>{client.full_name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                              <span style={{ fontSize: '0.78rem', color: '#888' }}>Registered: {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}</span>
                              {riskLevel === 'high' && (
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 600 }} title={riskReason}>
                                  ⚠️ High Risk
                                </span>
                              )}
                              {riskLevel === 'medium' && (
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 600 }} title={riskReason}>
                                  ⚠️ Medium Risk
                                </span>
                              )}
                              {riskLevel === 'good' && stats.completedRents > 0 && (
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600 }}>
                                  ✓ Good Standing
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>{client.phone}</div>
                        {client.email && <div style={{ fontSize: '0.78rem', color: '#888' }}>{client.email}</div>}
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <span style={{ fontFamily: 'monospace', color: '#e0e0e0', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                          {client.license_number || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: '#ffffff' }}>
                        {stats.completedRents}
                      </td>
                      <td style={{ padding: '1rem 0.75rem', fontWeight: 700, color: '#ae9260' }}>
                        {stats.totalSpent.toFixed(2)} DT
                      </td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', position: 'relative', zIndex: 10 }}>
                          <button 
                            type="button"
                            className="btn-action-icon" 
                            title="Rental History"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewingHistoryClient(client); }}
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- RENTAL HISTORY SIDE DRAWER / MODAL --- */}
      {viewingHistoryClient && (() => {
        const stats = getClientStats(viewingHistoryClient.id)
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(229,193,125,0.2)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="profile-avatar" style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ae9260, #735d38)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: '1px solid rgba(229,193,125,0.3)'
                  }}>
                    {getInitials(viewingHistoryClient.full_name)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      {viewingHistoryClient.full_name}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>Driver License: {viewingHistoryClient.license_number || 'N/A'}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingHistoryClient(null)}
                  style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Total Rented Sessions</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>{stats.completedRents}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Total Value Contributed</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ae9260', marginTop: '0.25rem' }}>{stats.totalSpent.toFixed(2)} DT</div>
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', color: '#ae9260', marginBottom: '1rem', fontWeight: 600 }}>Rental Agreement Records</h3>
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(229,193,125,0.1)', textAlign: 'left', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.75rem 0.5rem', color: '#888' }}>Vehicle</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: '#888' }}>Period</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: '#888' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: '#888' }}>Payment</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: '#888', textAlign: 'right' }}>Total Rent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bookingsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '0.9rem' }}>
                          No historical bookings linked to this client yet.
                        </td>
                      </tr>
                    ) : (
                      stats.bookingsList.map((booking) => (
                        <tr key={booking.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#ffffff', fontWeight: 500 }}>
                            {booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : 'Deleted Vehicle'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#e0e0e0' }}>
                            {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              textTransform: 'capitalize',
                              background: booking.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                              color: booking.status === 'completed' ? '#10b981' : '#f59e0b'
                            }}>
                              {booking.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              background: booking.payment_status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: booking.payment_status === 'paid' ? '#10b981' : '#ef4444'
                            }}>
                              {booking.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#ae9260' }}>
                            {Number(booking.total_amount).toFixed(2)} DT
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

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
