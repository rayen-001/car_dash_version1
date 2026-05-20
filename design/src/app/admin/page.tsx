import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Verify Admin Access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch Total Owners
  const { data: owners } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'owner')

  const totalOwners = owners?.length || 0

  // Fetch Total Vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id')

  const activeVehicles = vehicles?.length || 0

  // Fetch All Bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('total_amount, status, start_date, end_date')

  let totalRevenue = 0
  let activeBookings = 0
  const today = new Date().toISOString().split('T')[0]

  if (bookings) {
    bookings.forEach(b => {
      if (b.status === 'confirmed') {
        totalRevenue += b.total_amount || 0
        if (b.start_date <= today && b.end_date >= today) {
          activeBookings++
        }
      }
    })
  }

  return (
    <AdminDashboardClient
      stats={{
        totalOwners,
        activeVehicles,
        totalRevenue,
        activeBookings
      }}
    />
  )
}
