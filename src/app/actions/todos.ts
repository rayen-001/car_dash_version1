'use server'

// ---------------------------------------------------------------------------
// Phase 18 — manual To-Do CRUD server actions.
// All queries carry .eq('owner_id', user.id) for tenant isolation — same
// non-negotiable pattern enforced everywhere else in this project.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache'
import { getAuthedUser } from './_shared'
import type { Todo } from '@/types'

const TODOS = 'todos'
const PATH = '/dashboard/todo'

type Priority = 'high' | 'normal' | 'low'

function normalizePriority(input: unknown): Priority {
  return input === 'high' || input === 'low' ? input : 'normal'
}

// --- READ ------------------------------------------------------------------

export async function getTodos(): Promise<Todo[]> {
  const { supabase, user } = await getAuthedUser()
  const { data, error } = await supabase
    .from(TODOS)
    .select('*')
    .eq('owner_id', user.id)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getTodos] failed', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return []
  }
  return (data ?? []) as Todo[]
}

// --- CREATE ----------------------------------------------------------------

export async function addTodo(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getAuthedUser()

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, error: 'Title is required.' }

  const notes = String(formData.get('notes') ?? '').trim() || null
  const due_date = String(formData.get('due_date') ?? '').trim() || null
  const priority = normalizePriority(formData.get('priority'))

  const { error } = await supabase.from(TODOS).insert({
    owner_id: user.id,
    title,
    notes,
    due_date,
    priority,
    is_completed: false,
  })

  if (error) {
    console.error('[addTodo] failed', error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath(PATH)
  return { ok: true }
}

// --- UPDATE ----------------------------------------------------------------

export async function updateTodo(
  id: string,
  patch: Partial<Pick<Todo, 'title' | 'notes' | 'due_date' | 'priority'>>,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getAuthedUser()

  const safePatch: Record<string, unknown> = {}
  if (typeof patch.title === 'string')     safePatch.title    = patch.title.trim()
  if ('notes' in patch)                    safePatch.notes    = patch.notes ?? null
  if ('due_date' in patch)                 safePatch.due_date = patch.due_date ?? null
  if (patch.priority)                      safePatch.priority = normalizePriority(patch.priority)

  if (Object.keys(safePatch).length === 0) return { ok: true }

  const { error } = await supabase
    .from(TODOS)
    .update(safePatch)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[updateTodo] failed', error.message)
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

// --- COMPLETE / REOPEN -----------------------------------------------------

export async function completeTodo(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getAuthedUser()
  const { error } = await supabase
    .from(TODOS)
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[completeTodo] failed', error.message)
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

export async function reopenTodo(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getAuthedUser()
  const { error } = await supabase
    .from(TODOS)
    .update({ is_completed: false, completed_at: null })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[reopenTodo] failed', error.message)
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

// --- DELETE ----------------------------------------------------------------

export async function deleteTodo(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getAuthedUser()
  const { error } = await supabase
    .from(TODOS)
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[deleteTodo] failed', error.message)
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Auto-Maintenance Sync — called on every dashboard/todo page load.
// For each vehicle within the 1000 km warning window:
//   • If no open todo exists → insert one (notes prefix: _auto:maint:vidange:<vehicleId>)
//   • If vehicle is back above the threshold → auto-complete the todo
// This gives operators a persistent, trackable record that naturally disappears
// (auto-completed) once maintenance is done and km limits are reset.
// ---------------------------------------------------------------------------

interface SimpleVehicle {
  id: string
  brand: string
  model: string
  license_plate?: string
  current_km?: number
  next_vidange_km?: number
  next_pads_km?: number
}

const MAINT_PREFIX = '_auto:maint:'

export async function syncMaintenanceTodos(
  vehicles: SimpleVehicle[]
): Promise<void> {
  if (!vehicles || vehicles.length === 0) return

  let supabase: Awaited<ReturnType<typeof import('./_shared')['getAuthedUser']>>['supabase']
  let userId: string
  try {
    const auth = await getAuthedUser()
    supabase = auth.supabase
    userId = auth.user.id
  } catch {
    return // Not authenticated; skip silently
  }

  // Fetch all existing auto-maintenance todos for this owner
  const { data: existing } = await supabase
    .from(TODOS)
    .select('id, notes, is_completed, created_at')
    .eq('owner_id', userId)
    .like('notes', `${MAINT_PREFIX}%`)
    .order('created_at', { ascending: false }) // newest first

  // Build a map keyed by notes. If there are duplicates (race-condition leftovers),
  // keep the newest row and delete all older ones immediately.
  const existingMap = new Map<string, { id: string; is_completed: boolean }>()
  const idsToDelete: string[] = []
  for (const row of existing ?? []) {
    if (!row.notes) continue
    if (existingMap.has(row.notes)) {
      // Already have a newer row for this key → queue this older one for deletion
      idsToDelete.push(row.id)
    } else {
      existingMap.set(row.notes, { id: row.id, is_completed: row.is_completed })
    }
  }
  // Purge duplicates before processing
  if (idsToDelete.length > 0) {
    await supabase.from(TODOS).delete().in('id', idsToDelete).eq('owner_id', userId)
  }

  const upsertQueue: Array<{
    notesKey: string
    title: string
    priority: 'high' | 'normal'
    needed: boolean
  }> = []

  for (const v of vehicles) {
    const current = Number(v.current_km) || 0
    const label = `${v.brand} ${v.model}${v.license_plate ? ` (${v.license_plate})` : ''}`

    // --- Vidange / Oil Change -----------------------------------------------
    const targetVid = Number(v.next_vidange_km) || 0
    if (targetVid > 0) {
      const delta = targetVid - current
      const key = `${MAINT_PREFIX}vidange:${v.id}`
      upsertQueue.push({
        notesKey: key,
        title: delta <= 0
          ? `🔴 Oil Change OVERDUE by ${Math.abs(delta).toLocaleString()} km — ${label}`
          : `⚠ Oil Change due in ${delta.toLocaleString()} km — ${label}`,
        priority: delta <= 200 ? 'high' : 'normal',
        needed: delta <= 1000,
      })
    }

    // --- Brake Pads ---------------------------------------------------------
    const targetPads = Number(v.next_pads_km) || 0
    if (targetPads > 0) {
      const delta = targetPads - current
      const key = `${MAINT_PREFIX}pads:${v.id}`
      upsertQueue.push({
        notesKey: key,
        title: delta <= 0
          ? `🔴 Brake Pads OVERDUE by ${Math.abs(delta).toLocaleString()} km — ${label}`
          : `⚠ Brake Pads due in ${delta.toLocaleString()} km — ${label}`,
        priority: delta <= 200 ? 'high' : 'normal',
        needed: delta <= 1000,
      })
    }
  }

  // Apply changes in parallel
  const ops: Promise<void>[] = []

  for (const item of upsertQueue) {
    const existing_row = existingMap.get(item.notesKey)

    if (item.needed) {
      if (!existing_row) {
        // Create new auto-todo
        ops.push(
          Promise.resolve(
            supabase.from(TODOS).insert({
              owner_id: userId,
              title: item.title,
              notes: item.notesKey,
              priority: item.priority,
              is_completed: false,
            })
          ).then(() => {})
        )
      } else if (existing_row.is_completed) {
        // Maintenance was flagged as done before but threshold crossed again —
        // Reopen it with updated title
        ops.push(
          Promise.resolve(
            supabase.from(TODOS).update({
              is_completed: false,
              completed_at: null,
              title: item.title,
            }).eq('id', existing_row.id).eq('owner_id', userId)
          ).then(() => {})
        )
      } else {
        // Already open — just refresh the title (km changes)
        ops.push(
          Promise.resolve(
            supabase.from(TODOS).update({ title: item.title })
              .eq('id', existing_row.id).eq('owner_id', userId)
          ).then(() => {})
        )
      }
    } else if (existing_row && !existing_row.is_completed) {
      // Vehicle is back above threshold → auto-complete (maintenance was done)
      ops.push(
        Promise.resolve(
          supabase.from(TODOS).update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          }).eq('id', existing_row.id).eq('owner_id', userId)
        ).then(() => {})
      )
    }
  }

  await Promise.all(ops)
  // NOTE: intentionally no revalidatePath here — this function is called
  // during Server Component renders (todo/page, dashboard/page) where calling
  // revalidatePath would throw a Next.js runtime error. Data is already fresh
  // since we're mid-render. Revalidation of downstream pages happens naturally
  // on the next navigation.
}