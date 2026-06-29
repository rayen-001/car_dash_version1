'use client'

import React, { useState, useEffect } from 'react'
import { MessageSquare, Loader2, Edit } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import ModalPortal from '@/components/ModalPortal'
import { updateClientNotesScore } from '@/app/actions'
import { getEffectiveClientScore } from '@/lib/clientScore'

// ─── Score Badge Component ─────────────────────────────────────────
interface ScoreBadgeProps {
  client?: {
    trust_score?: number | null
    manual_score_adjustment?: number | null
  } | null
  style?: React.CSSProperties
}

export function ClientEffectiveScoreBadge({ client, style }: ScoreBadgeProps) {
  const { t } = useLanguage()
  const score = client ? getEffectiveClientScore(client) : null

  const getStyle = () => {
    if (score === null) {
      return {
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--text-muted)',
        borderColor: 'rgba(255,255,255,0.1)'
      }
    }
    if (score >= 80) {
      return {
        background: 'rgba(16,185,129,0.15)',
        color: '#10b981',
        borderColor: 'rgba(16,185,129,0.3)'
      }
    }
    if (score >= 60) {
      return {
        background: 'rgba(74,222,128,0.15)',
        color: '#4ade80',
        borderColor: 'rgba(74,222,128,0.3)'
      }
    }
    return {
      background: 'rgba(251,191,36,0.15)',
      color: '#fbbf24',
      borderColor: 'rgba(251,191,36,0.3)'
    }
  }

  const badgeStyle = getStyle()

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 600,
        border: '1px solid',
        ...badgeStyle,
        ...style
      }}
    >
      {score === null
        ? t('dri.unrated') || 'Unrated'
        : score >= 80
        ? `${t('dri.excellent') || 'Preferred'} (${score.toFixed(1)} DRI)`
        : score >= 60
        ? `${t('dri.standard') || 'Standard'} (${score.toFixed(1)} DRI)`
        : `${t('dri.watch') || 'Watch'} (${score.toFixed(1)} DRI)`}
    </span>
  )
}

// ─── Note Badge/Text Component ─────────────────────────────────────
interface NoteBadgeProps {
  note?: string | null
  style?: React.CSSProperties
}

export function ClientInternalNoteBadge({ note, style }: NoteBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  if (!note || !note.trim()) return null

  const cleanNote = note.replace('[GREEN]', '').replace('[GRAY]', '').replace('[RED]', '').trim()

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setExpanded(!expanded)
      }}
      title={expanded ? "Click to collapse" : "Click to view full note"}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: 'rgba(229, 193, 125, 0.05)',
        color: '#E5C17D',
        border: '1px solid rgba(229, 193, 125, 0.25)',
        boxSizing: 'border-box',
        marginTop: '0.25rem',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: '220px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        ...style
      }}
    >
      <MessageSquare size={11} style={{ flexShrink: 0, color: 'rgba(229,193,125,0.7)' }} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap',
          wordBreak: expanded ? 'break-word' : 'normal',
        }}
      >
        {cleanNote}
      </span>
    </div>
  )
}

// ─── Reusable Note/Score Modal Component ───────────────────────────
interface ClientNoteScoreModalProps {
  isOpen: boolean
  onClose: () => void
  client: {
    id: string
    full_name: string
    trust_score: number | null
    internal_note: string | null
    manual_score_adjustment: number | null
  } | null
  onClientUpdated: (updated: {
    id: string
    trust_score: number | null
    internal_note: string | null
    manual_score_adjustment: number | null
  }) => void
}

export function ClientNoteScoreModal({
  isOpen,
  onClose,
  client,
  onClientUpdated
}: ClientNoteScoreModalProps) {
  const { t } = useLanguage()
  const { showToast } = useToast()

  const [note, setNote] = useState('')
  const [targetScore, setTargetScore] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (client) {
      setNote(client.internal_note || '')
      const score = getEffectiveClientScore(client)
      setTargetScore(score !== null ? String(Math.round(score)) : '')
      setErrorMessage(null)
    }
  }, [client])

  if (!isOpen || !client) return null

  const handleSave = async () => {
    setLoading(true)
    setErrorMessage(null)

    const trimmedNote = note.slice(0, 1000).trim() || null
    let validTarget: number | null = null

    if (targetScore.trim() !== '') {
      const parsed = Number(targetScore)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setErrorMessage(t('clientNotes.scoreValidation') || 'Target score must be between 0 and 100.')
        setLoading(false)
        return
      }
      validTarget = Math.round(parsed)
    }

    try {
      const baseScore = client.trust_score ?? 0
      const localAdjustment = validTarget !== null ? validTarget - baseScore : null

      // Optimistic UI state update
      onClientUpdated({
        id: client.id,
        trust_score: client.trust_score,
        internal_note: trimmedNote,
        manual_score_adjustment: localAdjustment
      })

      onClose()
      showToast(t('clientNotes.updatingNoteScore') || 'Updating notes & score...', 'info')

      const updated = await updateClientNotesScore(client.id, trimmedNote, validTarget)
      
      // Authoritative save verification
      onClientUpdated({
        id: client.id,
        trust_score: updated.trust_score,
        internal_note: updated.internal_note,
        manual_score_adjustment: updated.manual_score_adjustment
      })

      showToast(t('clientNotes.updated') || 'Notes & score updated successfully!', 'success')
    } catch (err: any) {
      // Rollback
      onClientUpdated({
        id: client.id,
        trust_score: client.trust_score,
        internal_note: client.internal_note,
        manual_score_adjustment: client.manual_score_adjustment
      })
      showToast(err.message || t('clientNotes.updateFailed') || 'Failed to update note/score.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalPortal>
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <div
          className="modal-content glass-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '460px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <MessageSquare size={18} color="#f59e0b" />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                {t('clientNotes.title') || 'Note / Score'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.85rem', color: '#ae9260', fontWeight: 600 }}>{client.full_name}</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                {t('clientNotes.systemScore') || 'System Score'}:{' '}
                {client.trust_score !== null && client.trust_score !== undefined ? client.trust_score.toFixed(1) : '-'}
              </span>
            </div>
          </div>

          {/* Internal Note */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 600 }}>
              {t('clientNotes.internalNote') || 'Internal Note'}{' '}
              <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                ({t('clientNotes.ownerOnly') || 'owner-only'})
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 1000))}
              placeholder={t('clientNotes.placeholder') || 'e.g. Late payer, prefers premium vehicles...'}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
              {note.length}/1000 {t('clientNotes.characters') || 'characters'}
            </div>
          </div>

          {/* Target Score */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ae9260', marginBottom: '0.4rem', fontWeight: 600 }}>
              {t('clientNotes.targetScore') || 'Target Score'}{' '}
              <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: '0.4rem' }}>
                ({t('clientNotes.targetScoreHint') || '0-100, empty = system score'})
              </span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
              placeholder={t('clientNotes.emptyUsesSystem') || 'Leave empty to use system score'}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setTargetScore('')}
              style={{ marginTop: '0.5rem', padding: '0.45rem 0.75rem', fontSize: '0.72rem' }}
            >
              {t('clientNotes.clearAdjustment') || 'Clear adjustment'}
            </button>
            {targetScore.trim() !== '' && client.trust_score !== null && client.trust_score !== undefined && (
              <div style={{ fontSize: '0.7rem', color: 'rgba(245,158,11,0.7)', marginTop: '0.3rem' }}>
                {t('clientNotes.adjustmentPreview') || 'Adjustment'}:{' '}
                {(Math.max(0, Math.min(100, Number(targetScore))) - client.trust_score).toFixed(1)} pts
                {' | '}
                {t('clientNotes.effectivePreview') || 'Displayed'}:{' '}
                {Math.max(0, Math.min(100, Number(targetScore))).toFixed(0)}
                {' | '}
                {t('clientNotes.movesWithSystem') || 'moves with system score'}
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                background: 'rgba(239,68,68,0.1)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)'
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '8px',
                color: '#000000',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading && <Loader2 size={14} className="spinner" />}
              {t('common.save') || 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
