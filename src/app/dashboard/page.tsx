import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch Vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', user.id)

  const fleetSize = vehicles?.length || 0

  // Fetch Bookings with Vehicle details
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicles(brand, model)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  let revenue = 0
  let activeRentals = 0

  const todayObj = new Date()
  const year = todayObj.getFullYear()
  const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const dayStr = String(todayObj.getDate()).padStart(2, '0')
  const today = `${year}-${monthStr}-${dayStr}`

  if (bookings) {
    bookings.forEach((booking) => {
      if (booking.status === 'confirmed') {
        revenue += booking.total_amount || 0
        if (booking.start_date <= today && booking.end_date >= today) {
          activeRentals++
        }
      }
    })
  }

  // Fetch Expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('owner_id', user.id)

  let totalExpenses = 0
  if (expenses) {
    expenses.forEach((e) => {
      totalExpenses += Number(e.amount) || 0
    })
  }

  // Fetch Maintenance Costs
  const { data: maintenance } = await supabase
    .from('maintenance')
    .select('cost')
    .eq('owner_id', user.id)

  if (maintenance) {
    maintenance.forEach((m) => {
      totalExpenses += Number(m.cost) || 0
    })
  }

  const realRevenue = revenue - totalExpenses
  const utilizationRate = fleetSize > 0 ? (activeRentals / fleetSize) * 100 : 0
  const recentBookings = bookings ? bookings.slice(0, 5) : []

  return (
    <DashboardClient
      stats={{
        revenue,
        totalExpenses,
        realRevenue,
        fleetSize,
        activeRentals,
        utilizationRate,
      }}
      recentBookings={recentBookings}
      vehicles={vehicles || []}
      allBookings={bookings || []}
    />
  )
}
