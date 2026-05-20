import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { syncAndRelateClients } from '@/app/actions'
import ClientsClient from './ClientsClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Perform dynamic sync & back-filling of clients from bookings
  try {
    await syncAndRelateClients()
  } catch (e) {
    console.error('Failed to sync clients:', e)
  }

  // Fetch clients belonging to this owner
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch all bookings for this owner so we can build client history dynamically
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicle:vehicles(*)')
    .eq('owner_id', user.id)
    .order('start_date', { ascending: false })

  return <ClientsClient initialClients={clients || []} bookings={bookings || []} />
}
