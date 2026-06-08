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

  // Fetch vehicles for the dropdown — include maintenance km fields so the
  // booking form can show oil-change / brake-pads warnings.
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, license_plate, price_per_day, current_km, next_vidange_km, last_vidange_km, next_pads_km, withdrawn_at, color')
    .eq('owner_id', user.id)

  // Fetch clients belonging to this owner for dropdown selection.
  // BookingFormModal hydrates ALL of these into the contract snapshot fields
  // (and the Tunisian Legal Identity block) when an existing client is picked.
  // upsertBooking writes everything back to the CRM record on save — full
  // round-trip. If a column is missing here the hydration silently falls
  // through to '' and the user sees empty inputs even when CRM has data.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, phone, trust_score, cin, license_number, address, date_naissance, cin_delivre_le, permis_numero, permis_delivre_le')
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
