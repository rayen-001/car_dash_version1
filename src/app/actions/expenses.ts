'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUser } from './_shared'

/**
 * Anonymous-expense rule (Option A): client_id is MANDATORY for transactional
 * categories (the metric is meaningless without a counterparty), and OPTIONAL
 * for asset-overhead categories (the metric is vehicle/fleet-scoped).
 */
const CLIENT_REQUIRED_CATEGORIES: ReadonlySet<string> = new Set([
  'damage_repair',
  'installment_tranche',
  'late_return_penalty',
  'fuel',
  'cleaning',
])

function assertClientBindingForCategory(category: string, clientId: string | null) {
  if (CLIENT_REQUIRED_CATEGORIES.has(category) && !clientId) {
    throw new Error(
      `Category "${category}" requires a client to be selected (no anonymous transactional metrics permitted).`
    )
  }
}

export async function addExpense(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  let category = formData.get('category') as string
  const infractionType = formData.get('infraction_type') as string
  const targetLiability = formData.get('target_liability_amount') as string
  const description = formData.get('description') as string
  const amountInput = formData.get('amount') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const amount = parseFloat(amountInput || targetLiability || '0')

  if (infractionType) {
    category = infractionType
  }

  const clientIdRaw = formData.get('client_id') as string
  const client_id = clientIdRaw && clientIdRaw !== 'null' ? clientIdRaw : null

  assertClientBindingForCategory(category, client_id)

  const payload: any = {
    owner_id: user.id,
    vehicle_id: vehicle_id || null,
    client_id,
    category,
    description,
    amount
  }

  const { error } = await supabase.from('expenses').insert(payload)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

export async function updateExpense(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const rawId = formData.get('id') as string
  const id = rawId ? rawId.replace('expense-', '') : ''
  let category = formData.get('category') as string
  const infractionType = formData.get('infraction_type') as string
  const targetLiability = formData.get('target_liability_amount') as string
  const description = formData.get('description') as string
  const amountInput = formData.get('amount') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const amount = parseFloat(amountInput || targetLiability || '0')

  if (infractionType) {
    category = infractionType
  }

  const clientIdRaw = formData.get('client_id') as string
  const client_id = clientIdRaw && clientIdRaw !== 'null' ? clientIdRaw : null

  assertClientBindingForCategory(category, client_id)

  const payload: any = { category, description, amount, vehicle_id: vehicle_id || null }
  if (client_id) payload.client_id = client_id

  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

export async function deleteExpense(id: string) {
  const { supabase, user } = await getAuthedUser()

  const cleanId = id ? id.replace('expense-', '') : ''
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', cleanId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

export async function addMaintenance(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

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

  // Auto-sync into the main 'expenses' table as an asset-overhead row
  // (category 'maintenance' is allowed to have null client_id per Option A).
  const { error: expError } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicle_id || null,
    category: 'maintenance',
    description: `Maintenance: ${description}`,
    amount: cost
  })
  if (expError) console.error('Error syncing maintenance to expenses:', expError.message)

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/expenses')
  revalidatePath(`/dashboard/vehicles/${vehicle_id}/history`)
}

export async function updateMaintenance(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const id = formData.get('id') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const description = formData.get('description') as string
  const cost = parseFloat(formData.get('cost') as string)
  const service_date = formData.get('service_date') as string

  const { error } = await supabase
    .from('maintenance')
    .update({ vehicle_id, description, cost, service_date })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/maintenance')
}

export async function deleteMaintenance(id: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('maintenance')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/maintenance')
}
