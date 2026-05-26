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
      // Use `*` for the bookings row — enumerating columns is fragile (any
      // missing one nukes the entire SELECT and we end up with empty data,
      // see commit 493f23f for the departure_time precedent). The dashboard
      // SELECT uses `*` too and works; matching the pattern here.
      .select(`
        *,
        vehicles(brand, model, license_plate, price_per_day),
        installments:booking_installments(id, amount, due_date, status, paid_date),
        clients(id, full_name, phone, license_number, cin, address, trust_score, date_naissance, cin_delivre_le, permis_numero, permis_delivre_le)
      `)
      .eq('owner_id', user.id)
      .in('status', ['confirmed', 'completed'])
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
