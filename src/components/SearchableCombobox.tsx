'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'
import Fuse from 'fuse.js'

export interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
  /** Hidden string used for filtering only (e.g. CIN, permis). Never displayed. */
  searchKey?: string
}

interface SearchableComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string, option?: ComboboxOption) => void
  placeholder?: string
  searchPlaceholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  emptyMessage?: string
  /** Extra option pinned at top (e.g. "Walk-in client") */
  pinnedOption?: ComboboxOption
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found',
  pinnedOption,
  disabled = false,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected =
    value === pinnedOption?.value
      ? pinnedOption
      : options.find(o => o.value === value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 60)
    }
  }, [open])

  // Initialize Fuse instance for fuzzy fallback
  const fuse = useMemo(() => {
    return new Fuse(options, {
      keys: ['label', 'sublabel', 'badge', 'searchKey'],
      threshold: 0.35,
      distance: 200,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    })
  }, [options])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return options

    // ── Pass 1: fast case-insensitive multi-word scan ───────────────────────
    // Splits the query into separate words and requires that each word matches.
    // This allows typing non-adjacent words (e.g. "Mohamed Ali" matches "Mohamed Ben Ali").
    const qLower = q.toLowerCase()
    const words = qLower.split(/\s+/).filter(w => w.length >= 1)

    const wordMatches = options.filter(o => {
      const searchable = [o.label, o.sublabel, o.badge, o.searchKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return words.every(w => searchable.includes(w))
    })

    if (wordMatches.length > 0) {
      // Sort: entries whose label *starts with* the query come first
      return wordMatches.sort((a, b) => {
        const aStarts = (a.label || '').toLowerCase().startsWith(qLower) ? 0 : 1
        const bStarts = (b.label || '').toLowerCase().startsWith(qLower) ? 0 : 1
        return aStarts - bStarts
      })
    }

    // ── Pass 2: Fuse fuzzy search (catches typos / partial matches) ─────────
    return fuse.search(q).map(r => r.item)
  }, [query, options, fuse])

  const handleSelect = useCallback((opt: ComboboxOption) => {
    onChange(opt.value, opt)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="scb-root" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`scb-trigger ${open ? 'scb-trigger--open' : ''} ${disabled ? 'scb-trigger--disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="scb-trigger__content">
          {selected ? (
            <span className="scb-trigger__selected">
              <span className="scb-trigger__label">{selected.label}</span>
              {selected.sublabel && (
                <span className="scb-trigger__sublabel">{selected.sublabel}</span>
              )}
            </span>
          ) : (
            <span className="scb-trigger__placeholder">{placeholder}</span>
          )}
        </span>
        <span className="scb-trigger__icons">
          {selected && !disabled && (
            <span className="scb-clear" onClick={handleClear} title="Clear">
              <X size={13} />
            </span>
          )}
          <ChevronDown size={15} className={`scb-chevron ${open ? 'scb-chevron--open' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="scb-dropdown" role="listbox">
          {/* Search input */}
          <div className="scb-search-wrap">
            <Search size={13} className="scb-search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="scb-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
            />
            {query && (
              <button type="button" className="scb-search-clear" onClick={() => setQuery('')}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Pinned option */}
          {pinnedOption && (
            <div
              className={`scb-option scb-option--pinned ${value === pinnedOption.value ? 'scb-option--active' : ''}`}
              onClick={() => handleSelect(pinnedOption)}
              role="option"
              aria-selected={value === pinnedOption.value}
            >
              <span className="scb-option__label">{pinnedOption.label}</span>
              {value === pinnedOption.value && <Check size={13} className="scb-option__check" />}
            </div>
          )}

          {/* Divider if pinned */}
          {pinnedOption && filtered.length > 0 && <div className="scb-divider" />}

          {/* Options list */}
          <div className="scb-list">
            {filtered.length === 0 ? (
              <div className="scb-empty">{emptyMessage}</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  className={`scb-option ${value === opt.value ? 'scb-option--active' : ''}`}
                  onClick={() => handleSelect(opt)}
                  role="option"
                  aria-selected={value === opt.value}
                >
                  <span className="scb-option__info">
                    <span className="scb-option__label">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="scb-option__sublabel">{opt.sublabel}</span>
                    )}
                  </span>
                  <span className="scb-option__right">
                    {opt.badge && <span className="scb-option__badge">{opt.badge}</span>}
                    {value === opt.value && <Check size={13} className="scb-option__check" />}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
