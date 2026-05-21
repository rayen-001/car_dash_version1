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

  // Fetch Legal Docs
  const { data: vehicleLegalDocs } = await supabase
    .from('vehicle_legal_docs')
    .select('*')
    .eq('owner_id', user.id)

  // Fetch Bookings with full omni-search fields
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles(id, brand, model, license_plate, price_per_day),
      clients(
        id,
        full_name, phone, license_number,
        trust_score,
        date_naissance, cin_delivre_le,
        permis_numero, permis_delivre_le
      ),
      installments:booking_installments(
        id, amount, due_date, status, paid_date
      )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  let revenue = 0
  let activeRentals = 0

  const todayObj = new Date()
  const year = todayObj.getFullYear()
  const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const dayStr = String(todayObj.getDate()).padStart(2, '0')
  const today = `${year}-${monthStr}-${dayStr}`

  const PAID_STATUSES = ['confirmed', 'completed']

  if (bookings) {
    bookings.forEach((booking) => {
      const status = (booking.status || '').toLowerCase()
      if (PAID_STATUSES.includes(status)) {
        // Aggregate total revenue from all paid bookings
        revenue += Number(booking.total_amount) || 0
        // Active = currently within the rental date window
        if (booking.start_date <= today && booking.end_date >= today) {
          activeRentals++
        }
      }
    })
  }

  // Fetch Expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, category, description, created_at')
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
    .select('id, cost, service_date, description, created_at')
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
      vehicleLegalDocs={vehicleLegalDocs || []}
      expenses={expenses || []}
      maintenance={maintenance || []}
    />
  )
}
