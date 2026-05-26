import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel fan-out: every read is independently scoped to the active tenant
  // via .eq('owner_id', user.id) so isolation is preserved per-query.
  const [expensesRes, maintenanceRes, bookingsRes, vehiclesRes, legalDocsRes, clientsRes, settings] = await Promise.all([
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
      // Same fixes applied as revenues/page.tsx — see commit 493f23f for
      // the column-enumeration bug and 69d487c for the FK ambiguity bug.
      .select(`
        *,
        vehicles(*),
        installments:booking_installments(*),
        clients:clients!client_id(*),
        secondary_client:clients!secondary_client_id(*)
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
    supabase
      .from('clients')
      .select('id, full_name, cin, phone')
      .eq('owner_id', user.id)
      .order('full_name', { ascending: true }),
    getBusinessSettings(),
  ])

  return (
    <ExpensesClient
      initialExpenses={expensesRes.data || []}
      initialMaintenance={maintenanceRes.data || []}
      initialBookings={bookingsRes.data || []}
      vehicles={vehiclesRes.data || []}
      clients={clientsRes.data || []}
      businessSettings={settings}
      legalDocs={legalDocsRes.data || []}
    />
  )
}
