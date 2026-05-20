import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: number
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 40, text = 'Loading...', fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <Loader2 size={size} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-gold)' }} />
      {text && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{text}</span>}
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (fullScreen) {
    return (
      <div style={{ 
        position: 'fixed', inset: 0, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,8,7,0.8)', backdropFilter: 'blur(10px)',
        zIndex: 9999
      }}>
        {content}
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {content}
    </div>
  )
}
