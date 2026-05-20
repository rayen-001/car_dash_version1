import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trendText?: string
  trendType?: 'positive' | 'negative' | 'neutral'
}

export function StatCard({ title, value, icon, trendText, trendType = 'neutral' }: StatCardProps) {
  return (
    <div className="stat-card glass-panel">
      <div className="stat-header">
        <span className="stat-label">{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {trendText && (
        <div className={`stat-trend ${trendType}`}>
          {trendText}
        </div>
      )}
    </div>
  )
}
