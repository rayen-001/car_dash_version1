import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import BookingsClient from './BookingsClient'

export default async function BookingsPage() {
  const supabase = await createClient()
  
  // Verify owner access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch bookings with vehicle details
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles (brand, model)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, price_per_day')
    .eq('owner_id', user.id)

  return <BookingsClient initialBookings={bookings || []} vehicles={vehicles || []} />
}