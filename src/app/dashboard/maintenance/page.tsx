import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings } from '@/app/actions'
import MaintenanceClient from './MaintenanceClient'

export default async function MaintenancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: records } = await supabase
    .from('maintenance')
    .select('*, vehicles(brand, model)')
    .eq('owner_id', user.id)
    .order('service_date', { ascending: false })

  // Fetch vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model')
    .eq('owner_id', user.id)
    .is('withdrawn_at', null)

  const settings = await getBusinessSettings()

  return <MaintenanceClient initialRecords={records || []} vehicles={vehicles || []} businessSettings={settings} />
}
