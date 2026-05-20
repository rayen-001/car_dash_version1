'use client'

export default function Loading() {
  return (
    <div className="dashboard-page animate-pulse" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ height: '32px', width: '200px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px' }} />
        <div style={{ height: '18px', width: '350px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '4px' }} />
      </div>

      {/* Stats Grid Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div 
            key={i} 
            className="glass-panel" 
            style={{ 
              height: '110px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid rgba(255, 255, 255, 0.05)', 
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ height: '14px', width: '100px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px' }} />
            <div style={{ height: '28px', width: '140px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px' }} />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: 1, 
          height: '400px', 
          background: 'rgba(255, 255, 255, 0.01)', 
          border: '1px solid rgba(255, 255, 255, 0.05)', 
          borderRadius: '12px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ height: '20px', width: '150px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', marginBottom: '1rem' }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            style={{ 
              display: 'flex', 
              gap: '1.5rem', 
              padding: '1rem 0', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.03)' 
            }}
          >
            <div style={{ height: '40px', width: '40px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <div style={{ height: '14px', width: '30%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px' }} />
              <div style={{ height: '10px', width: '15%', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '3px' }} />
            </div>
            <div style={{ height: '16px', width: '80px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', alignSelf: 'center' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
