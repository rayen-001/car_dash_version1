'use client'

import { useState } from 'react'
import { Car, ArrowUpRight, ArrowDownLeft, AlertTriangle, Calendar, CheckCircle } from 'lucide-react'
import styles from '../dashboard.module.css'

interface TodayOperationsProps {
  allBookings: any[]
}

export default function TodayOperations({ allBookings = [] }: TodayOperationsProps) {
  const todayObj = new Date()
  const year = todayObj.getFullYear()
  const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const dayStr = String(todayObj.getDate()).padStart(2, '0')
  const today = `${year}-${monthStr}-${dayStr}`

  // Departures: Starts today, status confirmed
  const departures = allBookings.filter(
    (b) => b.start_date === today && b.status === 'confirmed'
  )

  // Returns: Ends today, status confirmed
  const returns = allBookings.filter(
    (b) => b.end_date === today && b.status === 'confirmed'
  )

  // Overdue: End date is in the past, status is confirmed (not completed or cancelled)
  const overdue = allBookings.filter(
    (b) => b.end_date < today && b.status === 'confirmed'
  )

  const getDaysOverdue = (endDateStr: string) => {
    const end = new Date(endDateStr)
    const now = new Date(today)
    const diffTime = Math.abs(now.getTime() - end.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className={`glass-panel ${styles['operations-widget']}`} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--accent-gold)' }}>🔔 Today's Operations</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Real-time overview of active departures, arrivals, and overdue handovers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
          <Calendar size={13} style={{ color: 'var(--accent-gold)', alignSelf: 'center' }} />
          <span>{todayObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Column 1: Departures Today */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowUpRight size={16} />
              Departures Today
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>{departures.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '180px' }}>
            {departures.length > 0 ? (
              departures.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', alignItems: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getInitials(b.client_name)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{b.client_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.vehicles?.brand} {b.vehicles?.model}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Until:</span>
                    <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500 }}>{b.end_date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1.5rem 0' }}>
                No departures scheduled today.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Returns Today */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowDownLeft size={16} />
              Returns Today
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>{returns.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '180px' }}>
            {returns.length > 0 ? (
              returns.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', alignItems: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getInitials(b.client_name)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{b.client_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.vehicles?.brand} {b.vehicles?.model}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From:</span>
                    <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500 }}>{b.start_date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1.5rem 0' }}>
                No returns scheduled today.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Overdue Returns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertTriangle size={15} />
              Overdue Returns
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>{overdue.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '180px' }}>
            {overdue.length > 0 ? (
              overdue.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', alignItems: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getInitials(b.client_name)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{b.client_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.vehicles?.brand} {b.vehicles?.model}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                      +{getDaysOverdue(b.end_date)}d Late
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Due: {b.end_date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={20} style={{ color: '#4ade80', marginBottom: '0.15rem' }} />
                <span>All vehicles returned on time!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
