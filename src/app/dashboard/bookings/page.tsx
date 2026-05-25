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

  // Fetch bookings with vehicle details, driver profiles, and handover telemetry
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles (brand, model, license_plate),
      installments:booking_installments(*),
      primary_client:clients!client_id(*),
      secondary_client:clients!secondary_client_id(*)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, price_per_day, current_km')
    .eq('owner_id', user.id)

  // Fetch clients belonging to this owner for dropdown selection.
  // Must include license_number + address — BookingFormModal hydrates these
  // into the contract snapshot fields when an existing client is picked, and
  // upsertBooking writes them back to the CRM record on save.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, phone, trust_score, cin, license_number, address')
    .eq('owner_id', user.id)
    .order('full_name')

  // Fetch vehicle legal documents for expiry collision warnings
  const { data: vehicleLegalDocs } = await supabase
    .from('vehicle_legal_docs')
    .select('*')
    .eq('owner_id', user.id)

  const settings = await getBusinessSettings()

  return (
    <BookingsClient 
      initialBookings={bookings || []} 
      vehicles={vehicles || []} 
      clients={clients || []}
      businessSettings={settings}
      vehicleLegalDocs={vehicleLegalDocs || []}
    />
  )
}
