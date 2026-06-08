import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import FleetClient from './FleetClient'

export default async function FleetPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch ALL vehicles (active + withdrawn) belonging to this owner.
  // The FleetClient separates them via the withdrawn_at IS NULL / IS NOT NULL distinction.
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*, vehicle_legal_docs(*)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch bookings for owner to calculate per-vehicle revenue and metrics
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('owner_id', user.id)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', user.id)

  return <FleetClient initialVehicles={vehicles || []} bookings={bookings || []} expenses={expenses || []} />
}
