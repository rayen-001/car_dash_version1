import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { fetchAllBookings } from '@/app/actions/_shared'
import FleetClient from './FleetClient'

export default async function FleetPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Tunis' })

  // Parallel fan-out: every read is independently scoped to the active tenant
  const [vehiclesRes, fleetStatsRes, activeRentalsRes, expensesRes, maintenanceRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*, vehicle_legal_docs(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .rpc('get_fleet_stats'),
    supabase
      .from('bookings')
      .select('vehicle_id, client_name, start_date, end_date, status')
      .eq('owner_id', user.id)
      .in('status', ['confirmed', 'completed'])
      .lte('start_date', todayISO)
      .gte('end_date', todayISO),
    supabase
      .from('expenses')
      .select('*')
      .eq('owner_id', user.id),
    supabase
      .from('maintenance')
      .select('*')
      .eq('owner_id', user.id)
  ])

  const vehicles = vehiclesRes.data || []
  const fleetStats = fleetStatsRes.data || []
  const activeRentals = activeRentalsRes.data || []
  const expenses = expensesRes.data || []
  const maintenance = maintenanceRes.data || []

  // Fetch all bookings with installments (handling Postgrest 1000 limit)
  const bookings = await fetchAllBookings(
    supabase,
    user.id,
    `
      *,
      installments:booking_installments(
        id, amount, due_date, status, paid_date
      )
    `
  )

  return (
    <FleetClient 
      initialVehicles={vehicles} 
      fleetStats={fleetStats} 
      activeRentals={activeRentals} 
      expenses={expenses} 
      bookings={bookings}
      maintenance={maintenance}
    />
  )
}

