import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import FleetClient from './FleetClient'

export default async function FleetPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch active vehicles first (withdrawn loaded on-demand in FleetClient)
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*, vehicle_legal_docs(*)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Call the secure get_fleet_stats() RPC (uses auth.uid() internally — no p_owner_id needed)
  const { data: fleetStats, error: statsError } = await supabase
    .rpc('get_fleet_stats')

  if (statsError) {
    console.error('[FleetPage] get_fleet_stats RPC error:', statsError.message)
  }

  // Light-weight active rentals: only today's confirmed bookings for rented status
  const todayISO = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Tunis' })
  const { data: activeRentals } = await supabase
    .from('bookings')
    .select('vehicle_id, client_name, start_date, end_date, status')
    .eq('owner_id', user.id)
    .in('status', ['confirmed', 'completed'])
    .lte('start_date', todayISO)
    .gte('end_date', todayISO)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', user.id)

  return (
    <FleetClient 
      initialVehicles={vehicles || []} 
      fleetStats={fleetStats || []} 
      activeRentals={activeRentals || []} 
      expenses={expenses || []} 
    />
  )
}

