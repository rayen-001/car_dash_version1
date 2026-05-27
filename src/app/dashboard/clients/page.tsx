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

  // Fetch all bookings for this owner with nested vehicles and installments to build high-fidelity intelligence ledger
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicle:vehicles(*), installments:booking_installments(*)')
    .eq('owner_id', user.id)
    .order('start_date', { ascending: false })

  // Fetch all expenses to calculate Net LTV (Damage Deductions)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', user.id)

  return <ClientsClient initialClients={clients || []} bookings={bookings || []} expenses={expenses || []} />
}
