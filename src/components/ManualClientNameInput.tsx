'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, User, Sparkles } from 'lucide-react'
import { Client } from '@/types'

interface ManualClientNameInputProps {
  value: string
  onChange: (val: string) => void
  /** Called when user selects an existing CRM client from suggestions */
  onSelectExisting: (client: Client) => void
  clients: Client[]
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  required?: boolean
}

/** Normalize a string for fuzzy comparison */
function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Score how well a client matches a query (0 = no match) */
function matchScore(client: Client, query: string): number {
  const q = norm(query)
  if (q.length < 2) return 0

  const name = norm(client.full_name)
  const phone = norm(client.phone || '')
  const cin = norm(client.cin || '')
  const permis = norm(client.permis_numero || '')

  // Exact name start → highest score
  if (name.startsWith(q)) return 100
  // Full name contains query
  if (name.includes(q)) return 80
  // Phone/CIN/Permis exact match
  if (phone.includes(q) || cin.includes(q) || permis.includes(q)) return 70
  // Word-level name match (any word starts with query token)
  const queryWords = q.split(' ')
  const nameWords = name.split(' ')
  const wordMatch = queryWords.every(qw =>
    nameWords.some(nw => nw.startsWith(qw))
  )
  if (wordMatch) return 60

  return 0
}

export default function ManualClientNameInput({
  value,
  onChange,
  onSelectExisting,
  clients,
  placeholder = 'ex. Mohamed Ben Ali',
  className,
  style,
  required,
}: ManualClientNameInputProps) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Compute suggestions whenever value changes
  const suggestions = value.trim().length >= 2
    ? clients
        .map(c => ({ client: c, score: matchScore(c, value) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(x => x.client)
    : []

  // Open dropdown when we have suggestions
  useEffect(() => {
    setOpen(suggestions.length > 0)
    setActiveIdx(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback((client: Client) => {
    onSelectExisting(client)
    setOpen(false)
  }, [onSelectExisting])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', ...style }}
      className={className}
    >
      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="form-input"
        style={{ margin: 0, width: '100%' }}
      />

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            borderRadius: '12px',
            background: 'rgba(24, 20, 14, 0.97)',
            border: '1px solid rgba(174, 146, 96, 0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(174,146,96,0.1)',
            backdropFilter: 'blur(16px)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid rgba(174, 146, 96, 0.15)',
              fontSize: '0.7rem',
              color: '#ae9260',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={11} />
            Clients existants correspondants
          </div>

          {/* Suggestion rows */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {suggestions.map((client, idx) => (
              <div
                key={client.id}
                onMouseDown={() => handleSelect(client)}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  cursor: 'pointer',
                  background: idx === activeIdx
                    ? 'rgba(174, 146, 96, 0.12)'
                    : 'transparent',
                  borderBottom: idx < suggestions.length - 1
                    ? '1px solid rgba(255,255,255,0.04)'
                    : 'none',
                  transition: 'background 0.12s ease',
                }}
              >
                {/* Left: name + phone */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#e8d5b0',
                      letterSpacing: '0.02em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {client.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted, #7a6a50)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Search size={10} style={{ flexShrink: 0 }} />
                    {client.phone || 'N/A'}
                  </div>
                </div>

                {/* Right: license badge + user icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  {client.license_number && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: '#ae9260',
                        background: 'rgba(174,146,96,0.12)',
                        border: '1px solid rgba(174,146,96,0.25)',
                        borderRadius: '6px',
                        padding: '0.15rem 0.45rem',
                        letterSpacing: '0.03em',
                      }}
                    >
                      Lic: {client.license_number}
                    </span>
                  )}
                  <User
                    size={14}
                    style={{ color: idx === activeIdx ? '#ae9260' : 'rgba(174,146,96,0.4)' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '0.4rem 0.75rem',
              borderTop: '1px solid rgba(174, 146, 96, 0.1)',
              fontSize: '0.66rem',
              color: 'rgba(174,146,96,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>↑↓ naviguer</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>↵ sélectionner</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Esc ignorer</span>
          </div>
        </div>
      )}
    </div>
  )
}
