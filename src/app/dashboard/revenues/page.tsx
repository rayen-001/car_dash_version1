import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import { fetchAllBookings } from '@/app/actions/_shared'
import RevenuesClient from './RevenuesClient'

export default async function RevenuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel fan-out: every read is independently scoped to the active tenant
  // via .eq('owner_id', user.id) so isolation is preserved per-query.
  const [expensesRes, maintenanceRes, vehiclesRes, legalDocsRes, settings] = await Promise.all([
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
      .from('vehicles')
      .select('id, brand, model, license_plate')
      .eq('owner_id', user.id)
      .is('withdrawn_at', null),
    supabase
      .from('vehicle_legal_docs')
      .select('vehicle_id, doc_type, expiry_date')
      .eq('owner_id', user.id)
      .eq('doc_type', 'assurance'),
    getBusinessSettings(),
  ])

  // Fetch all bookings (handling Postgrest 1000 limit)
  const bookings = await fetchAllBookings(
    supabase,
    user.id,
    `
      *,
      vehicles(*),
      installments:booking_installments(*),
      clients:clients!client_id(*),
      secondary_client:clients!secondary_client_id(*)
    `
  )

  // Filter out cancelled bookings from the fetched list to match the original database query filter (.neq('status', 'cancelled'))
  const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled')

  console.log('[revenues/page.tsx] bookings fetched:', activeBookings.length, 'rows')

  return (
    <RevenuesClient
      initialExpenses={expensesRes.data || []}
      initialMaintenance={maintenanceRes.data || []}
      initialBookings={activeBookings}
      vehicles={vehiclesRes.data || []}
      businessSettings={settings}
      legalDocs={legalDocsRes.data || []}
    />
  )
}
