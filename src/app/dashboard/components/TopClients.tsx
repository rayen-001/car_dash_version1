'use client'

import styles from '../dashboard.module.css'

interface TopClientsProps {
  allBookings: any[]
}

export default function TopClients({ allBookings = [] }: TopClientsProps) {
  // Aggregate revenue by client
  const clientRevenue: Record<string, { name: string, total: number, bookings: number }> = {}

  allBookings.forEach(b => {
    if (b.status === 'confirmed' || b.status === 'completed') {
      const clientId = b.client_id || b.client_name // fallback to name if ID is missing
      if (!clientRevenue[clientId]) {
        clientRevenue[clientId] = {
          name: b.client_name,
          total: 0,
          bookings: 0
        }
      }
      clientRevenue[clientId].total += Number(b.total_amount) || 0
      clientRevenue[clientId].bookings += 1
    }
  })

  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className={`${styles['top-clients-section']} glass-panel`}>
      <div className={styles['section-header']}>
        <h3>Top Clients Leaderboard</h3>
      </div>
      <div className={styles['client-list']}>
        {topClients.length > 0 ? (
          topClients.map((client, i) => (
            <div key={i} className={styles['client-item']}>
              <div className={styles['client-rank']}>
                {i === 0 ? '👑' : `#${i + 1}`}
              </div>
              <div className={styles['client-avatar']}>{getInitials(client.name)}</div>
              <div className={styles['client-info']}>
                <div className={styles['client-name']}>{client.name}</div>
                <div className={styles['client-bookings']}>{client.bookings} Booking(s)</div>
              </div>
              <div className={styles['client-total']}>
                DT {client.total.toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-muted">No client data available yet.</div>
        )}
      </div>
    </div>
  )
}
