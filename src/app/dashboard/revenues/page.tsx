import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import RevenuesClient from './RevenuesClient'

export default async function RevenuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel fan-out: every read is independently scoped to the active tenant
  // via .eq('owner_id', user.id) so isolation is preserved per-query.
  //
  // The bookings SELECT is INTENTIONALLY permissive — use '*' on the booking
  // row + on every joined table. Two prior debugging cycles burned on missing
  // columns (departure_time, then Tunisian legal columns on the clients join)
  // silently nuking the whole query and producing allRows=0 in the client.
  // Keeping it permissive eliminates that failure mode for good.
  //
  // We also dropped the status .in(['confirmed', 'completed']) filter —
  // bookings in other states (e.g. 'pending', 'in_progress', or any custom
  // status the operator uses) may still have collected acompte / paid
  // tranches, and the operator expects to see ALL collected cash on the
  // Rental Inflows hub. The client-side flow filter still hides irrelevant
  // states if needed.
  const [expensesRes, maintenanceRes, bookingsRes, vehiclesRes, legalDocsRes, settings] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, vehicles(brand, model, license_plate)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance')
      .select('*, vehicles(brand, model, license_plate)')
      .eq('owner_id', user.id)
      .order('service_date', { ascending: false }),
    supabase
      .from('bookings')
      .select(`
        *,
        vehicles(*),
        installments:booking_installments(*),
        clients(*)
      `)
      .eq('owner_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicles')
      .select('id, brand, model, license_plate')
      .eq('owner_id', user.id),
    supabase
      .from('vehicle_legal_docs')
      .select('vehicle_id, doc_type, expiry_date')
      .eq('owner_id', user.id)
      .eq('doc_type', 'assurance'),
    getBusinessSettings(),
  ])

  // Server-side diagnostic — surfaces silent Supabase errors that previously
  // hid behind `bookingsRes.data || []`. Visible in the dev-server terminal.
  if (bookingsRes.error) {
    console.error('[revenues/page.tsx] bookings SELECT failed:', bookingsRes.error)
  }
  console.log('[revenues/page.tsx] bookings fetched:', bookingsRes.data?.length ?? 0, 'rows')

  return (
    <RevenuesClient
      initialExpenses={expensesRes.data || []}
      initialMaintenance={maintenanceRes.data || []}
      initialBookings={bookingsRes.data || []}
      vehicles={vehiclesRes.data || []}
      businessSettings={settings}
      legalDocs={legalDocsRes.data || []}
    />
  )
}
