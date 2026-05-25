'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUser } from './_shared'

export async function getClients() {
  const { supabase, user } = await getAuthedUser()

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addClient(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const full_name = formData.get('full_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const license_number = formData.get('license_number') as string
  const cin = formData.get('cin') as string

  // Tunisian legal identity fields — same set updateClient already accepts.
  // Captured up-front so new clients can flow straight into a contract without
  // a second edit pass.
  const date_naissance = (formData.get('date_naissance') as string) || null
  const cin_delivre_le = (formData.get('cin_delivre_le') as string) || null
  const permis_numero = (formData.get('permis_numero') as string) || null
  const permis_delivre_le = (formData.get('permis_delivre_le') as string) || null

  const { error } = await supabase.from('clients').insert({
    owner_id: user.id,
    full_name,
    email: email || null,
    phone,
    license_number: license_number || null,
    cin: cin || null,
    date_naissance,
    cin_delivre_le,
    permis_numero,
    permis_delivre_le,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
}

export async function updateClient(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const id = formData.get('id') as string
  const full_name = formData.get('full_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const license_number = formData.get('license_number') as string
  const cin = formData.get('cin') as string

  const { error } = await supabase
    .from('clients')
    .update({
      full_name,
      email: email || null,
      phone,
      license_number: license_number || null,
      cin: cin || null,
      date_naissance: formData.get('date_naissance') || null,
      cin_delivre_le: formData.get('cin_delivre_le') || null,
      permis_numero: formData.get('permis_numero') || null,
      permis_delivre_le: formData.get('permis_delivre_le') || null,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
}

export async function updateClientLegalDetails(
  clientId: string,
  updates: {
    date_naissance?: string | null
    cin_delivre_le?: string | null
    permis_numero?: string | null
    permis_delivre_le?: string | null
  }
) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
}

export async function deleteClient(id: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
}

export async function syncAndRelateClients() {
  const { supabase, user } = await getAuthedUser()

  // 1. Fetch all bookings for this owner
  const { data: bookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, client_name, client_id')
    .eq('owner_id', user.id)

  if (bookingsErr) throw new Error(bookingsErr.message)
  if (!bookings || bookings.length === 0) return

  // 2. Fetch all current clients for this owner
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('*')
    .eq('owner_id', user.id)

  if (clientsErr) throw new Error(clientsErr.message)

  // --- AUTOMATIC DUPLICATE RESOLUTION & SELF-HEALING ---
  const nameToClientsMap = new Map<string, any[]>()
  if (clients) {
    clients.forEach(c => {
      const norm = c.full_name.trim().toLowerCase()
      if (!nameToClientsMap.has(norm)) {
        nameToClientsMap.set(norm, [])
      }
      nameToClientsMap.get(norm)!.push(c)
    })
  }

  const clientMap = new Map<string, string>() // Name -> Kept ID

  for (const [name, list] of nameToClientsMap.entries()) {
    if (list.length > 1) {
      // Keep the first registered instance, delete other duplicate copies
      const keptClient = list[0]
      const duplicateIds = list.slice(1).map(c => c.id)

      clientMap.set(name, keptClient.id)

      // Point any bookings that referenced the deleted duplicates back to the kept ID
      await supabase
        .from('bookings')
        .update({ client_id: keptClient.id })
        .in('client_id', duplicateIds)
        .eq('owner_id', user.id)

      // Delete the duplicate CRM client rows cleanly
      await supabase
        .from('clients')
        .delete()
        .in('id', duplicateIds)
        .eq('owner_id', user.id)
    } else if (list.length === 1) {
      clientMap.set(name, list[0].id)
    }
  }

  // 3. Scan bookings to see if any have no client_id
  for (const booking of bookings) {
    const normName = booking.client_name?.trim()
    if (!normName) continue
    const normNameLower = normName.toLowerCase()

    let linkedClientId = booking.client_id

    if (!linkedClientId) {
      if (clientMap.has(normNameLower)) {
        linkedClientId = clientMap.get(normNameLower)!
        await supabase
          .from('bookings')
          .update({ client_id: linkedClientId })
          .eq('id', booking.id)
          .eq('owner_id', user.id)
      } else {
        const { data: newClient, error: createErr } = await supabase
          .from('clients')
          .insert({
            owner_id: user.id,
            full_name: normName,
            phone: 'N/A',
            email: null,
            license_number: 'N/A'
          })
          .select('id')
          .single()

        if (!createErr && newClient) {
          linkedClientId = newClient.id
          clientMap.set(normNameLower, linkedClientId)

          await supabase
            .from('bookings')
            .update({ client_id: linkedClientId })
            .eq('id', booking.id)
            .eq('owner_id', user.id)
        }
      }
    }
  }
}
