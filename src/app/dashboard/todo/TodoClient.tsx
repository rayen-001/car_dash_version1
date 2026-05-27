'use client'

// ---------------------------------------------------------------------------
// Phase 18 — Client-side To-Do Hub.
// 4 time tabs (Today / Week / Month / Date) drive the AgendaWindow that
// agendaBuilder consumes. Items are split into 3 priority bands (Critical /
// High / Tasks) + a collapsed Completed accordion.
// ---------------------------------------------------------------------------

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ListChecks, Plane, Hotel, MapPin, Wrench, ShieldAlert, CheckSquare, Square,
  ChevronRight, Calendar, Trash2, Plus, Truck, X,
} from 'lucide-react'
import {
  buildAgenda,
  summarizeAgenda,
  getTodayYMD,
  addDays,
  startOfISOWeek, endOfISOWeek,
  firstDayOfMonth, lastDayOfMonth,
  type AgendaItem, type AgendaWindow, type AgendaIcon, type AgendaKind,
} from '@/lib/agendaBuilder'
import { completeTodo, deleteTodo, reopenTodo } from '@/app/actions/todos'
import AddTaskModal from './components/AddTaskModal'
import type { Booking, Vehicle, Todo, VehicleLegalDoc } from '@/types'

type Tab = 'today' | 'tomorrow' | 'week' | 'month' | 'date'

interface Props {
  bookings: Booking[]
  vehicles: Vehicle[]
  legalDocs: VehicleLegalDoc[]
  initialTodos: Todo[]
}

const ICON_MAP: Record<AgendaIcon, React.ComponentType<{ size?: number; color?: string }>> = {
  plane: Plane,
  hotel: Hotel,
  pin: MapPin,
  wrench: Wrench,
  shield: ShieldAlert,
  check: CheckSquare,
  truck: Truck,
}

export default function TodoClient({ bookings, vehicles, legalDocs, initialTodos }: Props) {
  const router = useRouter()
  const TODAY = getTodayYMD()

  const [tab, setTab] = useState<Tab>('today')
  const [pickedDate, setPickedDate] = useState<string>(TODAY)
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(new Set())
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedKind, setSelectedKind] = useState<AgendaKind | null>(null)

  const windowRange: AgendaWindow = useMemo(() => {
    if (tab === 'today') return { from: TODAY, to: TODAY }
    if (tab === 'tomorrow') {
      const TOMORROW = addDays(TODAY, 1)
      return { from: TOMORROW, to: TOMORROW }
    }
    if (tab === 'week')  return { from: startOfISOWeek(TODAY), to: endOfISOWeek(TODAY) }
    if (tab === 'month') return { from: firstDayOfMonth(TODAY), to: lastDayOfMonth(TODAY) }
    const start = pickedDate < TODAY ? pickedDate : TODAY
    const end = pickedDate < TODAY ? TODAY : pickedDate
    return { from: start, to: end }
  }, [tab, pickedDate, TODAY])

  const agenda = useMemo(
    () => buildAgenda({ bookings, vehicles, legalDocs, todos, window: windowRange, today: TODAY }),
    [bookings, vehicles, legalDocs, todos, windowRange, TODAY],
  )
  const totalVisible = useMemo(() => agenda.filter(a => !optimisticHidden.has(a.id)), [agenda, optimisticHidden])
  
  const summary = summarizeAgenda(totalVisible)

  const visible = useMemo(() => {
    if (!selectedKind) return totalVisible
    return totalVisible.filter(a => a.kind === selectedKind)
  }, [totalVisible, selectedKind])

  const critical = visible.filter(i => i.priority === 'critical')
  const high     = visible.filter(i => i.priority === 'high')
  const manual   = visible.filter(i => i.kind === 'manual' && i.priority === 'normal')
  const completedTodos = todos.filter(t => t.is_completed)

  // -- Click handlers -------------------------------------------------------
  function handleAction(item: AgendaItem) {
    if (!item.actionType) return
    if (item.actionType === 'complete' && item.actionPayload?.todoId) {
      const id = item.actionPayload.todoId
      const isCurrentlyCompleted = item.isCompleted ?? false

      // Optimistic state toggle
      setTodos(prev => prev.map(t => t.id === id ? {
        ...t,
        is_completed: !isCurrentlyCompleted,
        completed_at: !isCurrentlyCompleted ? new Date().toISOString() : null
      } : t))

      startTransition(async () => {
        const res = isCurrentlyCompleted ? await reopenTodo(id) : await completeTodo(id)
        if (!res.ok) {
          // Revert state on error
          setTodos(prev => prev.map(t => t.id === id ? {
            ...t,
            is_completed: isCurrentlyCompleted,
            completed_at: isCurrentlyCompleted ? t.completed_at : null
          } : t))
          alert(`Could not update task: ${res.error ?? 'unknown error'}`)
        }
      })
      return
    }
    if (item.actionType === 'open-handover' && item.actionPayload?.bookingId) {
      router.push(`/dashboard/bookings?openHandover=${item.actionPayload.bookingId}`)
      return
    }
    if (item.actionType === 'open-vehicle' && item.actionPayload?.vehicleId) {
      router.push(`/dashboard/vehicles/${item.actionPayload.vehicleId}/history`)
      return
    }
    if (item.actionType === 'open-doc' && item.actionPayload?.vehicleId) {
      router.push(`/dashboard/vehicles/${item.actionPayload.vehicleId}/history`)
      return
    }
  }

  function handleDelete(todoId: string, agendaId: string) {
    if (!confirm('Delete this task?')) return
    setOptimisticHidden(prev => new Set(prev).add(agendaId))
    startTransition(async () => {
      const res = await deleteTodo(todoId)
      if (!res.ok) {
        setOptimisticHidden(prev => {
          const next = new Set(prev); next.delete(agendaId); return next
        })
        alert(`Could not delete task: ${res.error ?? 'unknown error'}`)
      } else {
        setTodos(prev => prev.filter(t => t.id !== todoId))
      }
    })
  }

  // ------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>

      {/* Header ------------------------------------------------------------ */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.6rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            <ListChecks size={26} style={{ color: '#ae9260' }} />
            To-Do Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
            Field logistics, mechanical alerts, and manual reminders
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.55rem 1rem', borderRadius: '10px',
            background: 'linear-gradient(135deg, #ae9260, #735d38)',
            border: '1px solid rgba(229,193,125,0.4)',
            color: '#fff', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(174,146,96,0.3)',
          }}
        >
          <Plus size={16} /> Add Quick Task
        </button>
      </header>

      {/* Time tabs --------------------------------------------------------- */}
      <div className="glass-panel" style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
        padding: '0.6rem 0.8rem', borderRadius: '12px',
      }}>
        {(['today', 'tomorrow', 'week', 'month', 'date'] as Tab[]).map(t => {
          const active = tab === t
          const label =
            t === 'today' ? 'Today' :
            t === 'tomorrow' ? 'Tomorrow' :
            t === 'week' ? 'This Week' :
            t === 'month' ? 'This Month' :
            'Select Date'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                background: active ? 'rgba(229,193,125,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(229,193,125,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#ae9260' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
        {tab === 'date' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="date"
              value={pickedDate}
              onChange={e => setPickedDate(e.target.value)}
              style={{
                padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.85rem',
                background: 'rgba(0,0,0,0.35)', color: '#fff',
                border: '1px solid rgba(229,193,125,0.25)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                setTab('today')
                setPickedDate(TODAY)
              }}
              title="Reset to Today"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                color: '#f87171', cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
          <Calendar size={13} />
          <span>{windowRange.from === windowRange.to ? windowRange.from : `${windowRange.from} → ${windowRange.to}`}</span>
        </div>
      </div>

      {/* KPI strip --------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          icon={<Plane size={18} color="#fb923c" />}
          value={summary.handovers}
          label="Deliveries"
          tone="orange"
          active={selectedKind === 'handover'}
          onClick={() => setSelectedKind(prev => prev === 'handover' ? null : 'handover')}
        />
        <KpiCard
          icon={<Wrench size={18} color="#fbbf24" />}
          value={summary.maintenance}
          label="Maintenance due"
          tone="amber"
          active={selectedKind === 'maintenance'}
          onClick={() => setSelectedKind(prev => prev === 'maintenance' ? null : 'maintenance')}
        />
        <KpiCard
          icon={<ShieldAlert size={18} color="#f87171" />}
          value={summary.documents}
          label="Expiring docs"
          tone="red"
          active={selectedKind === 'document'}
          onClick={() => setSelectedKind(prev => prev === 'document' ? null : 'document')}
        />
        <KpiCard
          icon={<CheckSquare size={18} color="#ae9260" />}
          value={summary.manual}
          label="Tasks"
          tone="gold"
          active={selectedKind === 'manual'}
          onClick={() => setSelectedKind(prev => prev === 'manual' ? null : 'manual')}
        />
      </div>

      {/* Critical band ----------------------------------------------------- */}
      <Band title="⚠ CRITICAL" tone="red" items={critical} onAction={handleAction} onDelete={handleDelete} />

      {/* High priority band ------------------------------------------------ */}
      <Band title="HIGH PRIORITY" tone="amber" items={high} onAction={handleAction} onDelete={handleDelete} />

      {/* Manual tasks band ------------------------------------------------- */}
      <Band title="TASKS" tone="neutral" items={manual} onAction={handleAction} onDelete={handleDelete}
            emptyHint="No open tasks for this window. Use “+ Add Quick Task” to create one." />

      {/* Completed accordion ---------------------------------------------- */}
      {completedTodos.length > 0 && (
        <div className="glass-panel" style={{ padding: '0.8rem 1rem', borderRadius: '12px' }}>
          <button
            onClick={() => setShowCompleted(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
              fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer',
            }}
          >
            <span>COMPLETED ({completedTodos.length})</span>
            <ChevronRight size={14} style={{ transform: showCompleted ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {showCompleted && (
            <ul style={{ listStyle: 'none', margin: '0.7rem 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {completedTodos.map(t => (
                <li key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.45rem 0.7rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'line-through',
                }}>
                  <span>{t.title}</span>
                  <button
                    onClick={() => handleDelete(t.id, `manual__${t.id}`)}
                    aria-label="Delete"
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add modal --------------------------------------------------------- */}
      {isAddOpen && (
        <AddTaskModal
          onClose={() => setIsAddOpen(false)}
          onCreated={(newTodo) => {
            setTodos(prev => [newTodo, ...prev])
            setIsAddOpen(false)
          }}
        />
      )}

      {isPending && (
        <div style={{ position: 'fixed', bottom: '1rem', left: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
          Saving…
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function KpiCard({
  icon, value, label, tone, active, onClick
}: {
  icon: React.ReactNode
  value: number
  label: string
  tone: 'orange' | 'amber' | 'red' | 'gold'
  active?: boolean
  onClick?: () => void
}) {
  const tint =
    tone === 'red'    ? (active ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)')   :
    tone === 'amber'  ? (active ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)')  :
    tone === 'orange' ? (active ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.08)')  :
                        (active ? 'rgba(229,193,125,0.18)' : 'rgba(229,193,125,0.07)')
  const border =
    tone === 'red'    ? (active ? 'rgba(239,68,68,0.85)' : 'rgba(239,68,68,0.25)')   :
    tone === 'amber'  ? (active ? 'rgba(245,158,11,0.85)' : 'rgba(245,158,11,0.28)')  :
    tone === 'orange' ? (active ? 'rgba(249,115,22,0.85)' : 'rgba(249,115,22,0.3)')   :
                        (active ? 'rgba(229,193,125,0.85)' : 'rgba(229,193,125,0.3)')
  const shadow =
    tone === 'red'    ? 'rgba(239,68,68,0.35)' :
    tone === 'amber'  ? 'rgba(245,158,11,0.35)' :
    tone === 'orange' ? 'rgba(249,115,22,0.35)' :
                        'rgba(229,193,125,0.35)'

  return (
    <div
      className="glass-panel"
      onClick={onClick}
      style={{
        padding: '0.85rem 1rem', borderRadius: '12px',
        background: tint, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', gap: '0.7rem',
        cursor: 'pointer',
        boxShadow: active ? `0 0 16px ${shadow}` : 'none',
        transform: active ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {icon}
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.2rem' }}>{label}</div>
      </div>
    </div>
  )
}

function Band({
  title, tone, items, onAction, onDelete, emptyHint,
}: {
  title: string
  tone: 'red' | 'amber' | 'neutral'
  items: AgendaItem[]
  onAction: (i: AgendaItem) => void
  onDelete: (todoId: string, agendaId: string) => void
  emptyHint?: string
}) {
  const tint =
    tone === 'red'   ? 'rgba(239,68,68,0.04)'   :
    tone === 'amber' ? 'rgba(245,158,11,0.04)'  :
                       'rgba(255,255,255,0.02)'
  const border =
    tone === 'red'   ? 'rgba(239,68,68,0.22)'   :
    tone === 'amber' ? 'rgba(245,158,11,0.22)'  :
                       'rgba(255,255,255,0.06)'
  const labelColor =
    tone === 'red'   ? '#f87171' :
    tone === 'amber' ? '#fbbf24' :
                       'rgba(255,255,255,0.55)'

  if (items.length === 0 && !emptyHint) return null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: labelColor }}>
        {title}
      </div>
      <div className="glass-panel" style={{
        padding: '0.7rem 0.85rem', borderRadius: '12px',
        background: tint, border: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {items.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', padding: '0.4rem 0.2rem' }}>{emptyHint}</div>
        ) : items.map(item => <Row key={item.id} item={item} onAction={onAction} onDelete={onDelete} />)}
      </div>
    </section>
  )
}

function Row({
  item, onAction, onDelete,
}: {
  item: AgendaItem
  onAction: (i: AgendaItem) => void
  onDelete: (todoId: string, agendaId: string) => void
}) {
  const Icon = ICON_MAP[item.icon] ?? CheckSquare
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto auto',
      alignItems: 'center', gap: '0.7rem',
      padding: '0.55rem 0.7rem', borderRadius: '8px',
      background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.04)',
    }}>
      {item.kind === 'manual' ? (
        <button
          onClick={() => onAction(item)}
          aria-label={item.isCompleted ? "Mark as not done" : "Mark as done"}
          style={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: item.isCompleted ? 'rgba(229,193,125,0.15)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${item.isCompleted ? 'rgba(229,193,125,0.45)' : 'rgba(255,255,255,0.12)'}`,
            color: '#ae9260',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: 0,
          }}
          className="todo-checkbox-btn"
        >
          {item.isCompleted ? (
            <CheckSquare size={16} color="#ae9260" />
          ) : (
            <Square size={16} color="rgba(255,255,255,0.3)" />
          )}
        </button>
      ) : (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(229,193,125,0.08)',
          border: '1px solid rgba(229,193,125,0.18)',
        }}>
          <Icon size={16} color="#ae9260" />
        </div>
      )}
      <div style={{ minWidth: 0, opacity: item.isCompleted ? 0.45 : 1 }}>
        <div style={{
          fontSize: '0.85rem',
          color: '#fff',
          fontWeight: 600,
          textDecoration: item.isCompleted ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '0.15rem',
            textDecoration: item.isCompleted ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {item.subtitle}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {item.time && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#ae9260',
            background: 'rgba(229,193,125,0.08)',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            border: '1px solid rgba(229,193,125,0.22)',
          }}>{item.time}</span>
        )}
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.45)',
          background: 'rgba(255,255,255,0.04)',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
        }}>{item.date}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {item.kind === 'manual' && item.actionPayload?.todoId && (
          <button
            onClick={() => onDelete(item.actionPayload!.todoId!, item.id)}
            aria-label="Delete"
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '0.2rem' }}
          >
            <Trash2 size={14} />
          </button>
        )}
        {item.kind !== 'manual' && (
          <button
            onClick={() => onAction(item)}
            aria-label="Open"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '6px',
              background: 'rgba(229,193,125,0.1)',
              border: '1px solid rgba(229,193,125,0.25)',
              color: '#ae9260',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
