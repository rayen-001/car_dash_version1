import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings, syncAndRelateClients } from '@/app/actions'
import { fetchBookingsPageAction } from '@/app/actions/bookings'
import { fetchAllClients } from '@/app/actions/_shared'
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

  // Fetch bookings (first 50 rows) using the secure server action
  const initialData = await fetchBookingsPageAction({
    page: 1,
    pageSize: 50
  })

  // Fetch vehicles for the dropdown — include maintenance km fields so the
  // booking form can show oil-change / brake-pads warnings.
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, license_plate, price_per_day, current_km, next_vidange_km, last_vidange_km, next_pads_km, withdrawn_at, color')
    .eq('owner_id', user.id)
    .is('withdrawn_at', null)

  // Fetch ALL clients belonging to this owner for dropdown selection.
  const allClients = await fetchAllClients(
    supabase,
    user.id,
    'id, full_name, phone, trust_score, cin, license_number, address, date_naissance, cin_delivre_le, permis_numero, permis_delivre_le',
    [{ column: 'full_name', ascending: true }],
    true // activeOnly = true
  )

  // Fetch vehicle legal documents for expiry collision warnings
  const { data: vehicleLegalDocs } = await supabase
    .from('vehicle_legal_docs')
    .select('*')
    .eq('owner_id', user.id)

  const settings = await getBusinessSettings()

  return (
    <BookingsClient 
      initialBookings={initialData.bookings} 
      initialTotalCount={initialData.totalCount}
      initialTotalPages={initialData.totalPages}
      vehicles={vehicles || []} 
      clients={allClients}
      businessSettings={settings}
      vehicleLegalDocs={vehicleLegalDocs || []}
    />
  )
}
