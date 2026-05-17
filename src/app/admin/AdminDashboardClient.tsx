'use client'

import { Users, Car, Coins, Calendar } from 'lucide-react'

interface AdminDashboardClientProps {
  stats: {
    totalOwners: number
    activeVehicles: number
    totalRevenue: number
    activeBookings: number
  }
}

export default function AdminDashboardClient({ stats }: AdminDashboardClientProps) {
  return (
    <div className="admin-dashboard">
      <div className="header-section">
        <h1 className="page-title">Global Overview</h1>
        <p className="subtitle">Platform performance across all tenants</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Total Owners</span>
            <span className="stat-icon"><Users size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className="stat-value">{stats.totalOwners}</div>
          <div className="stat-trend positive">Registered partners</div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Active Vehicles</span>
            <span className="stat-icon"><Car size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className="stat-value">{stats.activeVehicles}</div>
          <div className="stat-trend positive">Total platform fleet</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-icon"><Coins size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className="stat-value">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="stat-trend positive">Processed rentals</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Active Bookings</span>
            <span className="stat-icon"><Calendar size={20} style={{ color: 'var(--accent-gold)' }} /></span>
          </div>
          <div className="stat-value">{stats.activeBookings}</div>
          <div className="stat-trend positive">Ongoing reservations</div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card glass-panel">
          <h3>Revenue Growth</h3>
          <div className="mock-chart">
            <div className="chart-bars">
              {[40, 60, 45, 80, 65, 90, 100].map((height, i) => (
                <div key={i} className="bar-wrapper">
                  <div className="bar" style={{ height: `${height}%` }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="chart-card glass-panel map-card">
          <h3>Global Reach</h3>
          <div className="mock-map">
            <div className="map-dots"></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .header-section {
          margin-bottom: 1rem;
        }

        .page-title {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--text-muted);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          padding: 1.5rem;
        }

        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          color: var(--text-secondary);
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          font-family: var(--font-heading);
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #fff, var(--accent-gold));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stat-trend {
          font-size: 0.9rem;
        }

        .positive { color: var(--success); }

        .charts-section {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        .chart-card {
          padding: 1.5rem;
          min-height: 300px;
        }

        .chart-card h3 {
          margin-bottom: 1.5rem;
          color: var(--text-secondary);
        }

        .mock-chart {
          height: 200px;
          display: flex;
          align-items: flex-end;
          padding-top: 2rem;
          border-bottom: 1px solid var(--border-color);
        }

        .chart-bars {
          display: flex;
          justify-content: space-between;
          width: 100%;
          height: 100%;
          align-items: flex-end;
        }

        .bar-wrapper {
          flex: 1;
          margin: 0 0.5rem;
          height: 100%;
          display: flex;
          align-items: flex-end;
        }

        .bar {
          width: 100%;
          background: linear-gradient(to top, var(--accent-gold-dim), var(--accent-gold));
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          transition: var(--transition);
        }

        .bar:hover {
          background: var(--accent-gold-hover);
          box-shadow: var(--shadow-glow);
        }

        .mock-map {
          height: 200px;
          background: radial-gradient(circle at center, var(--accent-gold-dim) 0%, transparent 70%);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .map-dots {
          width: 100%;
          height: 100%;
          background-image: radial-gradient(var(--text-muted) 1px, transparent 1px);
          background-size: 10px 10px;
          opacity: 0.3;
        }
      `}</style>
    </div>
  )
}
