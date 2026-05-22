import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch expenses (outflows)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, vehicles(brand, model, license_plate)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch maintenance records (outflows)
  const { data: maintenance } = await supabase
    .from('maintenance')
    .select('*, vehicles(brand, model, license_plate)')
    .eq('owner_id', user.id)
    .order('service_date', { ascending: false })

  // Fetch completed & confirmed bookings (inflows: acompte_paid + installment tranches)
  const { data: bookings } = await supabase
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
      vehicles(brand, model, license_plate),
      installments:booking_installments(id, amount, due_date, status, paid_date)
    `)
    .eq('owner_id', user.id)
    .in('status', ['confirmed', 'completed'])
    .order('created_at', { ascending: false })

  // Fetch vehicles for the expense dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, license_plate')
    .eq('owner_id', user.id)

  const settings = await getBusinessSettings()

  return (
    <ExpensesClient
      initialExpenses={expenses || []}
      initialMaintenance={maintenance || []}
      initialBookings={bookings || []}
      vehicles={vehicles || []}
      businessSettings={settings}
    />
  )
}