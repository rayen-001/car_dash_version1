import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessSettings, syncAndRelateClients } from '@/app/actions'
import { fetchBookingsPageAction } from '@/app/actions/bookings'
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
  // IMPORTANT: PostgREST has a hard default limit of 1000 rows per request.
  // With 1000+ clients, a plain .select() silently truncates the list —
  // clients in the second half of the alphabet simply disappear from the
  // dropdown. We paginate in chunks of 1000 until we have everything.
  const allClients: any[] = []
  let clientFrom = 0
  while (true) {
    const { data: clientChunk, error: clientErr } = await supabase
      .from('clients')
      .select('id, full_name, phone, trust_score, cin, license_number, address, date_naissance, cin_delivre_le, permis_numero, permis_delivre_le')
      .eq('owner_id', user.id)
      .order('full_name')
      .range(clientFrom, clientFrom + 999)
    if (clientErr) {
      console.error('Error fetching clients chunk:', clientErr.message)
      break
    }
    if (clientChunk) allClients.push(...clientChunk)
    if (!clientChunk || clientChunk.length < 1000) break
    clientFrom += 1000
  }

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
