'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, XCircle, X, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 11)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4500)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const colorMap = {
    success: {
      bg: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))',
      border: 'rgba(16,185,129,0.4)',
      icon: '#10b981',
    },
    error: {
      bg: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))',
      border: 'rgba(239,68,68,0.4)',
      icon: '#ef4444',
    },
    info: {
      bg: 'linear-gradient(135deg, rgba(212,180,106,0.18), rgba(212,180,106,0.06))',
      border: 'rgba(212,180,106,0.4)',
      icon: '#d4b46a',
    },
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          maxWidth: '380px',
          width: '90vw',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          const c = colorMap[toast.type]
          return (
            <div
              key={toast.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.9rem 1.1rem',
                borderRadius: '14px',
                background: c.bg,
                border: `1px solid ${c.border}`,
                backdropFilter: 'blur(24px) saturate(150%)',
                boxShadow:
                  '0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
                animation: 'toastSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'all',
              }}
            >
              {/* Icon */}
              <div style={{ flexShrink: 0, marginTop: '1px' }}>
                {toast.type === 'success' && <CheckCircle2 size={17} style={{ color: c.icon }} />}
                {toast.type === 'error'   && <XCircle      size={17} style={{ color: c.icon }} />}
                {toast.type === 'info'    && <Info         size={17} style={{ color: c.icon }} />}
              </div>

              {/* Message */}
              <span
                style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  color: '#f4ede1',
                  lineHeight: 1.45,
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                }}
              >
                {toast.message}
              </span>

              {/* Dismiss */}
              <button
                onClick={() => dismiss(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)',
                  padding: 0,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s',
                  marginTop: '1px',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(28px) scale(0.94); }
          to   { opacity: 1; transform: translateX(0)   scale(1);    }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
