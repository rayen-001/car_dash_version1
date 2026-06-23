'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'

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

// ---------------------------------------------------------------------------
// Fuzzy matching helpers (module-level, not inside the component)
// ---------------------------------------------------------------------------

/** Levenshtein edit distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = Array.from({ length: n + 1 }, (_, j) => j)
  const curr = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[n]
}

/** Max allowed edit distance for a word of given length */
function maxDist(len: number): number {
  if (len <= 2) return 0   // short: exact only
  if (len <= 4) return 1   // medium: 1 typo allowed
  return 2                  // long: 2 typos allowed
}

/**
 * Returns a match score for `text` against `query`.
 * 0 = no match. Higher = better match.
 */
function fuzzyScore(text: string, query: string): number {
  if (!query || !text) return query ? 0 : 1
  const t = text.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  if (!q) return 1

  // Exact substring → best score
  if (t.includes(q)) return 100

  // Word-level fuzzy: each query word must fuzzy-match at least one target word
  const qWords = q.split(/\s+/).filter(Boolean)
  const tWords = t.split(/\s+/).filter(Boolean)

  let totalScore = 0
  for (const qw of qWords) {
    let bestWordScore = 0
    for (const tw of tWords) {
      if (tw.startsWith(qw)) { bestWordScore = Math.max(bestWordScore, 90); break }
      if (qw.startsWith(tw)) { bestWordScore = Math.max(bestWordScore, 70); break }
      const dist = levenshtein(qw, tw)
      if (dist <= maxDist(qw.length)) {
        bestWordScore = Math.max(bestWordScore, 60 - dist * 10)
      }
    }
    if (bestWordScore === 0) return 0  // query word found no match → fail
    totalScore += bestWordScore
  }
  return totalScore / qWords.length
}

function optionMatches(o: ComboboxOption, query: string): boolean {
  if (!query) return true
  const fields = [o.label, o.sublabel ?? '', o.badge ?? '', o.searchKey ?? '']
  return fields.some(f => fuzzyScore(f, query) > 0)
}

function optionScore(o: ComboboxOption, query: string): number {
  if (!query) return 0
  const fields = [o.label, o.sublabel ?? '', o.badge ?? '', o.searchKey ?? '']
  return Math.max(...fields.map(f => fuzzyScore(f, query)))
}

// ---------------------------------------------------------------------------

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

  const filtered = query === ''
    ? options
    : options
        .filter(o => optionMatches(o, query))
        .sort((a, b) => optionScore(b, query) - optionScore(a, query))

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
