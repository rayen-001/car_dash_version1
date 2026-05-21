'use client'

import { useMemo } from 'react'
import styles from '../dashboard.module.css'
import { Trophy } from 'lucide-react'

interface TopClientsProps {
  allBookings: any[]
}

export default function TopClients({ allBookings = [] }: TopClientsProps) {
  const topClients = useMemo(() => {
    const clientTotals = new Map<string, { name: string, total: number, count: number }>()

    allBookings.forEach(booking => {
      if (booking.status === 'cancelled') return
      
      const clientId = booking.client_id || booking.client_name // Fallback to name if ID is missing
      const clientName = booking.clients?.full_name || booking.client_name || 'Unknown Client'
      const amount = Number(booking.total_amount) || 0

      if (!clientTotals.has(clientId)) {
        clientTotals.set(clientId, { name: clientName, total: 0, count: 0 })
      }

      const current = clientTotals.get(clientId)!
      current.total += amount
      current.count += 1
    })

    return Array.from(clientTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [allBookings])

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown Client') return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  return (
    <div className={`${styles['top-clients-widget']} glass-panel`} style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '14px', background: 'rgba(14, 11, 9, 0.75)', border: '1px solid rgba(229, 193, 125, 0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(229, 193, 125, 0.1)', paddingBottom: '1rem' }}>
        <Trophy size={20} color="var(--accent-gold)" />
        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 500 }}>Top 5 Clients</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {topClients.length > 0 ? (
          topClients.map((client, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(229, 193, 125, 0.04)', borderRadius: '10px', border: '1px solid rgba(229, 193, 125, 0.05)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', 
                  background: index === 0 ? 'linear-gradient(135deg, var(--accent-gold) 0%, #a67c00 100%)' : 'rgba(229, 193, 125, 0.15)',
                  color: index === 0 ? '#1a1410' : 'var(--accent-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem',
                  boxShadow: index === 0 ? '0 4px 12px rgba(197, 160, 89, 0.3)' : 'none'
                }}>
                  {getInitials(client.name)}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>{client.name}</span>
                  <span style={{ color: 'rgba(229, 193, 125, 0.5)', fontSize: '0.75rem' }}>{client.count} {client.count === 1 ? 'Booking' : 'Bookings'}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                  {client.total.toFixed(2)} DT
                </div>
              </div>
              
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(229, 193, 125, 0.4)', padding: '2rem 0', fontSize: '0.9rem' }}>
            No client data available yet.
          </div>
        )}
      </div>
    </div>
  )
}
