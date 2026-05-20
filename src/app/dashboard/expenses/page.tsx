import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, vehicles(brand, model)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model')
    .eq('owner_id', user.id)

  const settings = await getBusinessSettings()

  return <ExpensesClient initialExpenses={expenses || []} vehicles={vehicles || []} businessSettings={settings} />
}