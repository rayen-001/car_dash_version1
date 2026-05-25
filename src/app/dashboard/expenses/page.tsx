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
      .select(`
        id,
        client_name,
        client_id,
        vehicle_id,
        start_date,
        end_date,
        actual_return_date,
        total_amount,
        acompte_paid,
        status,
        created_at,
        client_phone,
        client_license_number,
        client_behavior_status,
        damage_notes,
        starting_km,
        return_km,
        fuel_level_pickup,
        fuel_level_return,
        lavage_pickup,
        lavage_return,
        departure_time,
        return_time,
        rental_days_text,
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
