import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OwnersClient from './OwnersClient'

export default async function ManageOwnersPage() {
  const supabase = await createClient()
  
  // Verify admin access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Fetch owners
  const { data: owners } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'owner')
    .order('created_at', { ascending: false })

  return <OwnersClient initialOwners={owners || []} />
}
