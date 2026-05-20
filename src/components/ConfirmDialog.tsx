'use client'

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  /** If true, renders in red (destructive action style) */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<{ confirm: ConfirmFn } | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' })
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  const resolve = (value: boolean) => {
    resolveRef.current?.(value)
    setOpen(false)
  }

  const accentColor = options.danger ? '#ef4444' : '#d4b46a'
  const accentRgba  = options.danger ? 'rgba(239,68,68,' : 'rgba(212,180,106,'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 6, 5, 0.78)',
            backdropFilter: 'blur(16px) saturate(120%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '1rem',
            animation: 'confirmFadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'linear-gradient(155deg, rgba(38,30,24,0.97) 0%, rgba(18,14,12,0.99) 100%)',
              border: `1px solid ${accentRgba}0.32)`,
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: `0 30px 80px rgba(0,0,0,0.85), 0 0 40px ${accentRgba}0.06)`,
              animation: 'confirmSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top edge glow */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${accentRgba}0.55), transparent)`,
                pointerEvents: 'none',
              }}
            />

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.75rem' }}>
              {/* Icon circle */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: `${accentRgba}0.14)`,
                  border: `1px solid ${accentRgba}0.3)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} style={{ color: accentColor }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, paddingTop: '2px' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: '#f4ede1',
                    fontFamily: 'Outfit, sans-serif',
                    margin: '0 0 0.4rem 0',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {options.title || 'Confirm Action'}
                </h3>
                <p
                  style={{
                    fontSize: '0.88rem',
                    color: '#b8a896',
                    lineHeight: 1.55,
                    margin: 0,
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  {options.message}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => resolve(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.3)',
                  padding: 0,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                aria-label="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => resolve(false)}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#b8a896',
                  cursor: 'pointer',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
                  e.currentTarget.style.color = '#f4ede1'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = '#b8a896'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => resolve(true)}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '10px',
                  background: options.danger
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #f0d188 0%, #d4b46a 50%, #8a6d35 100%)',
                  border: 'none',
                  color: options.danger ? '#ffffff' : '#120e0a',
                  cursor: 'pointer',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                  boxShadow: options.danger
                    ? '0 4px 16px rgba(239,68,68,0.35)'
                    : '0 4px 16px rgba(212,180,106,0.35)',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes confirmSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </ConfirmContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx.confirm
}
