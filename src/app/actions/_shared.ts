import { createClient } from '@/utils/supabase/server'

/**
 * Authenticated user accessor. Throws if no session. Used at the top of every
 * server action to enforce the multi-tenant isolation gate BEFORE any
 * `.eq('owner_id', user.id)`-scoped query runs.
 */
export async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}

/**
 * Same as getAuthedUser() but additionally verifies the caller's role is
 * 'admin' in the profiles table. Used by /admin/* server actions.
 */
export async function getAuthedAdmin() {
  const { supabase, user } = await getAuthedUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')
  return { supabase, user }
}

/** Local-time YYYY-MM-DD. Used everywhere a paid_date / due_date stamp is needed. */
export function getTodayYMD(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** Best-effort cost extraction from free-form notes; used by vehicle legal-doc renewals. */
export function parseCostFromNotes(notes: string | null | undefined, defaultCost: number): number {
  if (!notes) return defaultCost
  const matches = notes.match(/\b\d+(?:\.\d+)?\b/)
  if (matches) {
    const parsed = parseFloat(matches[0])
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return defaultCost
}

/**
 * Fetches all bookings belonging to the active tenant by handling Postgrest 1000 row limits.
 * We fetch sequentially in chunks of 1000 rows.
 */
export async function fetchAllBookings(supabase: any, ownerId: string, selectQuery = '*') {
  const bookings: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('bookings')
      .select(selectQuery)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .range(from, from + 999)

    if (error) {
      console.error('[fetchAllBookings] error fetching page chunk:', error.message)
      break
    }
    if (data) {
      bookings.push(...data)
    }
    if (!data || data.length < 1000) {
      break
    }
    from += 1000
  }
  return bookings
}

