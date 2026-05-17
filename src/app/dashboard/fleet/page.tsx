import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import FleetClient from './FleetClient'

export default async function FleetPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch vehicles belonging to this owner
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return <FleetClient initialVehicles={vehicles || []} />
}