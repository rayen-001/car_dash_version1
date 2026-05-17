'use client'

export default function BusinessProfilePage() {
  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <h1 className='page-title'>Business Profile</h1>
        <p className='subtitle'>Manage your company details and account settings.</p>
      </div>

      <div className='content-grid'>
        <div className='glass-panel empty-state'>
          <div className='empty-icon'>🚧</div>
          <h3>Under Construction</h3>
          <p>This module is currently being built. Check back soon!</p>
        </div>
      </div>

      <style jsx>{`
        .dashboard-page { display: flex; flex-direction: column; gap: 2rem; height: 100%; }
        .header-section { margin-bottom: 1rem; }
        .page-title { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: var(--text-muted); }
        .empty-state { padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 400px; }
        .empty-icon { font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.8; }
        .empty-state h3 { font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text-primary); }
        .empty-state p { color: var(--text-muted); max-width: 400px; }
      `}</style>
    </div>
  )
}