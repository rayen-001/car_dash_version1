import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VehicleHistoryClient from './VehicleHistoryClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VehicleHistoryPage({ params }: PageProps) {
  const { id: vehicleId } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch specific vehicle
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('owner_id', user.id)
    .single()

  if (vehicleError || !vehicle) {
    redirect('/dashboard/fleet')
  }

  // Generate timezone-anchored current date string (Africa/Tunis) for server calculations
  const todayStr = (() => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Africa/Tunis',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return formatter.format(now)
  })()

  // Fetch active bookings for dynamic availability state switcher
  let activeBookings: any[] = []
  try {
    const { data } = await supabase
      .from('bookings')
      .select('vehicle_id')
      .eq('owner_id', user.id)
      .in('status', ['confirmed', 'completed'])
      .lte('start_date', todayStr)
      .gte('end_date', todayStr)
    if (data) activeBookings = data
  } catch (err) {
    console.error('active bookings query error:', err)
  }

  const activeRentedVehicleIds = new Set(activeBookings.map(b => b.vehicle_id))

  // Fetch all vehicles for matricule dropdown switcher
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, license_plate, availability, year')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const vehiclesWithDynamicAvailability = (vehicles || []).map(v => ({
    ...v,
    availability: !activeRentedVehicleIds.has(v.id)
  }))

  // Fetch legal documents (try/catch to avoid crash if migrations are pending)
  let legalDocs: any[] = []
  try {
    const { data } = await supabase
      .from('vehicle_legal_docs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('owner_id', user.id)
    if (data) legalDocs = data
  } catch (err) {
    console.error('vehicle_legal_docs query error (migrations might be missing):', err)
  }

  // Fetch bookings — include installments for the Financials column tranche list,
  // handovers for the Condition Δ column, and clients for the Client Legal Docs column.
  let bookings: any[] = []
  try {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        installments:booking_installments(*),
        clients:clients!client_id(id, full_name, phone, cin, license_number, date_naissance, cin_delivre_le, permis_numero, permis_delivre_le)
      `)
      .eq('vehicle_id', vehicleId)
      .eq('owner_id', user.id)
      .order('start_date', { ascending: false })
    if (data) bookings = data
  } catch (err) {
    console.error('bookings query error:', err)
  }

  // Fetch maintenance log details
  let maintenance: any[] = []
  try {
    const { data } = await supabase
      .from('maintenance')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('owner_id', user.id)
      .order('service_date', { ascending: false })
    if (data) maintenance = data
  } catch (err) {
    console.error('maintenance query error:', err)
  }

  // Fetch expenses
  let expenses: any[] = []
  try {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (data) expenses = data
  } catch (err) {
    console.error('expenses query error:', err)
  }

  // Handovers removed

  return (
    <VehicleHistoryClient
      currentVehicle={vehicle}
      vehiclesList={vehiclesWithDynamicAvailability}
      legalDocs={legalDocs}
      bookings={bookings}
      maintenance={maintenance}
      expenses={expenses}
    />
  )
}
