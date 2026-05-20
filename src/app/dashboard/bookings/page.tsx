import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings, syncAndRelateClients } from '@/app/actions'
import BookingsClient from './BookingsClient'

export default async function BookingsPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Back-fill historical clients to new clients table
  try {
    await syncAndRelateClients()
  } catch (e) {
    console.error('Failed to sync bookings clients:', e)
  }

  // Fetch bookings with vehicle details
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles (brand, model, license_plate)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, price_per_day')
    .eq('owner_id', user.id)

  // Fetch clients belonging to this owner for dropdown selection
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, phone')
    .eq('owner_id', user.id)
    .order('full_name')

  const settings = await getBusinessSettings()

  return (
    <BookingsClient 
      initialBookings={bookings || []} 
      vehicles={vehicles || []} 
      clients={clients || []}
      businessSettings={settings} 
    />
  )
}