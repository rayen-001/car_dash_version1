import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import { fetchAllBookings, fetchAllClients } from '@/app/actions/_shared'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel fan-out: every read is independently scoped to the active tenant
  // via .eq('owner_id', user.id) so isolation is preserved per-query.
  const [expensesRes, maintenanceRes, vehiclesRes, legalDocsRes, clientsRes, settings] = await Promise.all([
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
    fetchAllClients(
      supabase,
      user.id,
      'id, full_name, cin, phone',
      [{ column: 'full_name', ascending: true }],
      true // activeOnly = true (only active clients in the expenses selector)
    ),
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

  return (
    <ExpensesClient
      initialExpenses={expensesRes.data || []}
      initialMaintenance={maintenanceRes.data || []}
      initialBookings={activeBookings}
      vehicles={vehiclesRes.data || []}
      clients={clientsRes}
      businessSettings={settings}
      legalDocs={legalDocsRes.data || []}
    />
  )
}
