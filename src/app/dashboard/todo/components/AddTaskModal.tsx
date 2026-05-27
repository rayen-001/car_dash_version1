'use client'

// ---------------------------------------------------------------------------
// Phase 18 — Glassmorphic "Add Quick Task" modal.
// Title required; notes / due_date / priority optional.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react'
import { X, ListPlus } from 'lucide-react'
import { addTodo } from '@/app/actions/todos'
import type { Todo } from '@/types'

interface Props {
  onClose: () => void
  onCreated: (todo: Todo) => void
}

export default function AddTaskModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const t = title.trim()
    if (!t) { setError('Title is required.'); return }

    const fd = new FormData()
    fd.set('title', t)
    if (notes.trim())  fd.set('notes', notes.trim())
    if (dueDate.trim()) fd.set('due_date', dueDate.trim())
    fd.set('priority', priority)

    startTransition(async () => {
      const res = await addTodo(fd)
      if (!res.ok) {
        setError(res.error ?? 'Unknown error')
        return
      }
      // Optimistic record (server source-of-truth re-syncs on next page load).
      onCreated({
        id: `local__${Date.now()}`,
        title: t,
        notes: notes.trim() || null,
        due_date: dueDate.trim() || null,
        priority,
        is_completed: false,
      })
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-panel"
        style={{
          width: '100%', maxWidth: '420px',
          background: 'rgba(20,20,20,0.96)',
          border: '1px solid rgba(229,193,125,0.28)',
          borderRadius: '16px', padding: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.85rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.05rem', color: '#fff' }}>
            <ListPlus size={18} style={{ color: '#ae9260' }} /> New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <Field label="Title">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Call client about deposit return"
            autoFocus
            style={inputStyle}
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any extra context…"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as 'high' | 'normal' | 'low')}
              style={inputStyle}
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>

        {error && (
          <div style={{
            fontSize: '0.78rem', color: '#f87171',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
            padding: '0.5rem 0.7rem', borderRadius: '6px',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.2rem' }}>
          <button
            type="button" onClick={onClose}
            style={{
              padding: '0.5rem 0.9rem', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >Cancel</button>
          <button
            type="submit" disabled={isPending}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px',
              background: 'linear-gradient(135deg, #ae9260, #735d38)',
              color: '#fff', border: '1px solid rgba(229,193,125,0.45)',
              cursor: isPending ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem',
              opacity: isPending ? 0.7 : 1,
            }}
          >{isPending ? 'Saving…' : 'Add Task'}</button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  borderRadius: '8px',
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(229,193,125,0.22)',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
      <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  )
}
