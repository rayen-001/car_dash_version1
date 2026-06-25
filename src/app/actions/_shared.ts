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
  const seenIds = new Set<string>()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('bookings')
      .select(selectQuery)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (error) {
      console.error('[fetchAllBookings] error fetching page chunk:', error.message)
      break
    }
    if (data) {
      for (const row of data) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id)
          bookings.push(row)
        }
      }
    }
    if (!data || data.length < 1000) {
      break
    }
    from += 1000
  }
  return bookings
}

let clientsHasArchivedAt: boolean | null = null

async function checkClientsArchivedAt(supabase: any) {
  if (clientsHasArchivedAt !== null) return clientsHasArchivedAt
  try {
    const { error } = await supabase
      .from('clients')
      .select('archived_at')
      .limit(1)
    clientsHasArchivedAt = !error
  } catch {
    clientsHasArchivedAt = false
  }
  return clientsHasArchivedAt
}

/**
 * Fetches all clients belonging to the active tenant by handling Postgrest 1000 row limits.
 * We fetch sequentially in chunks of 1000 rows.
 * Stable ordering: full_name ASC, id ASC by default.
 * Every client fetch must be scoped by owner_id.
 */
export async function fetchAllClients(
  supabase: any,
  ownerId: string,
  selectQuery = 'id, full_name, phone, cin, license_number',
  orderOptions: { column: string; ascending: boolean }[] = [{ column: 'full_name', ascending: true }],
  activeOnly = false
) {
  const clients: any[] = []
  const seenIds = new Set<string>()
  let from = 0

  const hasArchivedAt = activeOnly ? await checkClientsArchivedAt(supabase) : false

  while (true) {
    let query = supabase
      .from('clients')
      .select(selectQuery)
      .eq('owner_id', ownerId)

    if (hasArchivedAt) {
      query = query.is('archived_at', null)
    }

    // Apply orders
    for (const opt of orderOptions) {
      query = query.order(opt.column, { ascending: opt.ascending })
    }
    // Always add a secondary unique order for stable pagination if it's not the primary sort column
    if (!orderOptions.some(opt => opt.column === 'id')) {
      query = query.order('id', { ascending: true })
    }

    const { data, error } = await query.range(from, from + 999)

    if (error) {
      console.error('[fetchAllClients] error fetching page chunk:', error.message)
      break
    }
    if (data) {
      for (const row of data) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id)
          clients.push(row)
        }
      }
    }
    if (!data || data.length < 1000) {
      break
    }
    from += 1000
  }
  return clients
}

/** Standardizes license plates (uppercase, remove spaces and dashes) */
export function normPlate(p: string | null | undefined): string {
  if (!p) return ''
  return p.toUpperCase().replace(/[\s\-]/g, '')
}

/** Standardizes CIN (remove spaces, pad 7-digit to 8-digit) */
export function normCIN(c: string | null | undefined): string {
  if (!c) return ''
  let cleaned = c.trim().replace(/\s/g, '')
  if (/^\d{7}$/.test(cleaned)) {
    cleaned = '0' + cleaned
  }
  return cleaned
}

/** Standardizes Driver License number (uppercase, remove spaces and leading '>') */
export function normPermis(p: string | null | undefined): string {
  if (!p) return ''
  let cleaned = p.trim().toUpperCase().replace(/\s/g, '')
  if (cleaned.startsWith('>')) {
    cleaned = cleaned.substring(1)
  }
  return cleaned
}

/** Standardizes Phone number (removes spaces, prefixes 8-digit numbers with +216) */
export function normPhone(p: string | null | undefined): string {
  if (!p) return ''
  const cleaned = p.trim().replace(/\s+/g, '')
  if (!cleaned) return ''
  if (/^\d{8}$/.test(cleaned)) {
    return '+216 ' + cleaned
  }
  return cleaned
}


