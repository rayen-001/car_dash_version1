// ---------------------------------------------------------------------------
// Phase 18 — /dashboard/todo  (server entry point)
// Parallel-fetch bookings + vehicles + legal docs + todos, then hand off to
// the client component for filtering / sectioning / interactivity.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TodoClient from './TodoClient'
import { getTodos, syncMaintenanceTodos } from '@/app/actions/todos'
import type { Booking, Vehicle, Todo, VehicleLegalDoc } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TodoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Tolerant fan-out: if the `todos` table does not yet exist (migration not
  // run), getTodos() logs + returns []. The auto-generated streams still work.
  const [bookingsRes, vehiclesRes, legalDocsRes, todos] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, owner_id, client_id, client_name,
        vehicle_id, start_date, end_date, status,
        handover_location, handover_datetime,
        vehicles:vehicles!vehicle_id (
          brand, model, license_plate, year, price_per_day
        )
      `)
      .eq('owner_id', user.id)
      .neq('status', 'cancelled')
      .order('handover_datetime', { ascending: true }),
    supabase
      .from('vehicles')
      .select('*')
      .eq('owner_id', user.id),
    supabase
      .from('vehicle_legal_docs')
      .select('*')
      .eq('owner_id', user.id),
    getTodos(),
  ])

  if (bookingsRes.error)  console.error('[todo/page] bookings:', bookingsRes.error.message)
  if (vehiclesRes.error)  console.error('[todo/page] vehicles:', vehiclesRes.error.message)
  if (legalDocsRes.error) console.error('[todo/page] legal_docs:', legalDocsRes.error.message)

  const bookings   = (bookingsRes.data  ?? []) as unknown as Booking[]
  const vehicles   = (vehiclesRes.data  ?? []) as Vehicle[]
  const legalDocs  = (legalDocsRes.data ?? []) as VehicleLegalDoc[]

  // Auto-sync maintenance To-Dos: creates/updates/auto-completes based on km
  await syncMaintenanceTodos(vehicles)

  const todoList   = todos as Todo[]

  return (
    <TodoClient
      bookings={bookings}
      vehicles={vehicles}
      legalDocs={legalDocs}
      initialTodos={todoList}
    />
  )
}
