'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUser } from './_shared'

export async function addExpense(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const amountInput = formData.get('amount') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const amount = parseFloat(amountInput || '0')

  if (!category) throw new Error('Category is required')
  if (!description) throw new Error('Description is required')
  if (!amount || amount <= 0) throw new Error('A positive amount is required')

  const { error } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicle_id || null,
    category,
    description,
    amount
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
  if (vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${vehicle_id}/history`)
  }
}

export async function updateExpense(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const rawId = formData.get('id') as string
  const id = rawId ? rawId.replace('expense-', '') : ''
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const amountInput = formData.get('amount') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const amount = parseFloat(amountInput || '0')

  // Fetch the old expense to handle vehicle change cache revalidation and check system-managed status
  const { data: oldExpense } = await supabase
    .from('expenses')
    .select('vehicle_id, maintenance_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (oldExpense && oldExpense.maintenance_id) {
    throw new Error('Ce coût est géré par le module Entretien. Veuillez le modifier depuis la page Entretien.')
  }

  const { error } = await supabase
    .from('expenses')
    .update({ category, description, amount, vehicle_id: vehicle_id || null })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  
  // Revalidate new vehicle history
  if (vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${vehicle_id}/history`)
  }
  // Revalidate old vehicle history if it changed
  if (oldExpense && oldExpense.vehicle_id && oldExpense.vehicle_id !== vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${oldExpense.vehicle_id}/history`)
  }
}

export async function deleteExpense(id: string) {
  const { supabase, user } = await getAuthedUser()

  const cleanId = id ? id.replace('expense-', '') : ''

  // Fetch the old expense to handle vehicle cache revalidation and check system-managed status
  const { data: oldExpense } = await supabase
    .from('expenses')
    .select('vehicle_id, maintenance_id')
    .eq('id', cleanId)
    .eq('owner_id', user.id)
    .single()

  if (oldExpense && oldExpense.maintenance_id) {
    throw new Error('Ce coût est géré par le module Entretien. Veuillez le modifier depuis la page Entretien.')
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', cleanId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  if (oldExpense && oldExpense.vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${oldExpense.vehicle_id}/history`)
  }
}

export async function addMaintenance(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const vehicle_id = formData.get('vehicle_id') as string
  const description = formData.get('description') as string
  const cost = parseFloat(formData.get('cost') as string)
  const service_date = formData.get('service_date') as string

  // Insert the maintenance record first and select its ID
  const { data: newM, error } = await supabase
    .from('maintenance')
    .insert({
      owner_id: user.id,
      vehicle_id,
      description,
      cost,
      service_date
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Auto-sync into the main 'expenses' table as a mirrored row
  const { error: expError } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicle_id || null,
    category: 'maintenance',
    description: description,
    amount: cost,
    maintenance_id: newM.id
  })
  if (expError) console.error('Error syncing maintenance to expenses:', expError.message)

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  if (vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${vehicle_id}/history`)
  }
}

export async function updateMaintenance(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const id = formData.get('id') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const description = formData.get('description') as string
  const cost = parseFloat(formData.get('cost') as string)
  const service_date = formData.get('service_date') as string

  // Fetch the old maintenance record to handle vehicle change cache revalidation
  const { data: oldM } = await supabase
    .from('maintenance')
    .select('vehicle_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  // Update maintenance record
  const { error } = await supabase
    .from('maintenance')
    .update({ vehicle_id, description, cost, service_date })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // Look up mirrored expense
  const { data: mirroredExpense } = await supabase
    .from('expenses')
    .select('id')
    .eq('maintenance_id', id)
    .eq('owner_id', user.id)
    .single()

  if (mirroredExpense) {
    // Update mirrored expense (amount, description, vehicle_id). Do NOT touch created_at!
    const { error: expError } = await supabase
      .from('expenses')
      .update({
        amount: cost,
        description: description,
        vehicle_id: vehicle_id || null
      })
      .eq('id', mirroredExpense.id)
      .eq('owner_id', user.id)
    if (expError) console.error('Error updating synced expense:', expError.message)
  } else {
    console.warn(`[Safeguard] Warning: Old unlinked maintenance record updated. No synced expense was updated. Maintenance ID: ${id}`)
  }

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  if (vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${vehicle_id}/history`)
  }
  if (oldM && oldM.vehicle_id && oldM.vehicle_id !== vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${oldM.vehicle_id}/history`)
  }
}

export async function deleteMaintenance(id: string) {
  const { supabase, user } = await getAuthedUser()

  // Fetch the old maintenance entry to get vehicle_id for revalidation
  const { data: oldM } = await supabase
    .from('maintenance')
    .select('vehicle_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  // Look up mirrored expense
  const { data: mirroredExpense } = await supabase
    .from('expenses')
    .select('id')
    .eq('maintenance_id', id)
    .eq('owner_id', user.id)
    .single()

  if (mirroredExpense) {
    // Explicitly delete mirrored expense record before deleting maintenance record
    const { error: expError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', mirroredExpense.id)
      .eq('owner_id', user.id)
    if (expError) console.error('Error deleting synced expense:', expError.message)
  } else {
    console.warn(`[Safeguard] Warning: Old unlinked maintenance record deleted. No synced expense was deleted. Maintenance ID: ${id}`)
  }

  // Delete the maintenance record itself
  const { error } = await supabase
    .from('maintenance')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  if (oldM && oldM.vehicle_id) {
    revalidatePath(`/dashboard/vehicles/${oldM.vehicle_id}/history`)
  }
}
