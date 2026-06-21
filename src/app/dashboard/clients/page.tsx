import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { syncAndRelateClients } from '@/app/actions'
import { fetchAllBookings } from '@/app/actions/_shared'
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

  // Fetch clients belonging to this owner (handling Postgrest 1000 row limits)
  const clients = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) {
      console.error('Error fetching clients page chunk:', error)
      break
    }
    if (data) clients.push(...data)
    if (!data || data.length < 1000) break
    from += 1000
  }

  // Fetch all bookings for this owner with nested vehicles and installments to build high-fidelity intelligence ledger
  const bookings = await fetchAllBookings(
    supabase,
    user.id,
    '*, vehicle:vehicles(*), installments:booking_installments(*)'
  )

  // Fetch all expenses to calculate Net LTV (Damage Deductions)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', user.id)

  return <ClientsClient initialClients={clients || []} bookings={bookings || []} expenses={expenses || []} />
}
