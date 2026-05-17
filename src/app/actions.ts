'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- VEHICLE ACTIONS ---

export async function addVehicle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const brand = formData.get('brand') as string
  const model = formData.get('model') as string
  const year = parseInt(formData.get('year') as string)
  const price_per_day = parseFloat(formData.get('price_per_day') as string)
  const availability = formData.get('availability') === 'on' || formData.get('availability') === 'true'

  const { error } = await supabase.from('vehicles').insert({
    owner_id: user.id,
    brand,
    model,
    year,
    price_per_day,
    availability
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/fleet')
}

export async function deleteVehicle(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('owner_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/fleet')
}

// --- BOOKING ACTIONS ---

export async function addBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const vehicle_id = formData.get('vehicle_id') as string
  const client_name = formData.get('client_name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const status = formData.get('status') as string || 'confirmed'

  const { error } = await supabase.from('bookings').insert({
    owner_id: user.id,
    vehicle_id,
    client_name,
    start_date,
    end_date,
    status,
    total_amount,
    payment_status: 'paid'
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/bookings')
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('bookings').update({ status }).eq('id', id).eq('owner_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/bookings')
}

// --- EXPENSE ACTIONS ---

export async function addExpense(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const amount = parseFloat(formData.get('amount') as string)
  const vehicle_id = formData.get('vehicle_id') as string

  const { error } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicle_id || null,
    category,
    description,
    amount
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

// --- MAINTENANCE ACTIONS ---

export async function addMaintenance(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const vehicle_id = formData.get('vehicle_id') as string
  const description = formData.get('description') as string
  const cost = parseFloat(formData.get('cost') as string)
  const service_date = formData.get('service_date') as string

  const { error } = await supabase.from('maintenance').insert({
    owner_id: user.id,
    vehicle_id,
    description,
    cost,
    service_date
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/maintenance')
}

// --- ADMIN ACTIONS ---

import { createAdminClient } from '@/utils/supabase/admin'

export async function addOwner(formData: FormData) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) throw new Error('Unauthorized')

  // Verify role is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', adminUser.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const full_name = formData.get('full_name') as string
  const company_name = formData.get('company_name') as string

  const adminClient = createAdminClient()

  // Create auth user
  const { data: newAuth, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: 'owner'
    }
  })

  if (authError) throw new Error(authError.message)
  if (!newAuth.user) throw new Error('Failed to create user')

  // Update profile details
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ company_name, full_name })
    .eq('id', newAuth.user.id)

  if (profileError) {
    // Cleanup if profile update fails
    await adminClient.auth.admin.deleteUser(newAuth.user.id)
    throw new Error(profileError.message)
  }

  revalidatePath('/admin/owners')
}

export async function deleteOwner(id: string) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) throw new Error('Unauthorized')

  // Verify role is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', adminUser.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const adminClient = createAdminClient()

  // Deleting Auth User cascades and deletes their profile and all owned vehicles/bookings
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/owners')
}

