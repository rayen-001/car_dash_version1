import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: vehicles } = await supabase.from('vehicles').select('id, current_km, license_plate')
  for (const v of vehicles) {
    const { data: bookings } = await supabase.from('bookings').select('starting_km, return_km').eq('vehicle_id', v.id)
    const { data: handovers } = await supabase.from('vehicle_handovers').select('pickup_km, return_km').eq('vehicle_id', v.id)
    
    let maxKm = 0
    if (bookings) {
      for (const b of bookings) {
        if (b.starting_km && b.starting_km > maxKm) maxKm = b.starting_km
        if (b.return_km && b.return_km > maxKm) maxKm = b.return_km
      }
    }
    if (handovers) {
      for (const h of handovers) {
        if (h.pickup_km && h.pickup_km > maxKm) maxKm = h.pickup_km
        if (h.return_km && h.return_km > maxKm) maxKm = h.return_km
      }
    }
    
    if (maxKm > (v.current_km || 0)) {
      console.log(`-> Fixing ${v.license_plate} to ${maxKm}`)
      const res = await supabase.from('vehicles').update({ current_km: maxKm }).eq('id', v.id)
      if (res.error) console.error("Error for", v.license_plate, ":", res.error)
      else console.log("Success for", v.license_plate)
    }
  }
}
run().catch(console.error)
