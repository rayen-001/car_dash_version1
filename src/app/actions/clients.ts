'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUser, normCIN, normPermis, normPhone } from './_shared'
import { recalculateClientTrustScore } from './bookings'

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

  const date_naissance = (formData.get('date_naissance') as string) || null
  const lieu_naissance = (formData.get('lieu_naissance') as string || '').trim() || null
  const cin_delivre_le = (formData.get('cin_delivre_le') as string) || null
  const permis_numero = (formData.get('permis_numero') as string) || null
  const permis_delivre_le = (formData.get('permis_delivre_le') as string) || null

  const nCin = normCIN(cin)
  const nPermis = normPermis(permis_numero || license_number)
  const nPhone = normPhone(phone)

  const ignoreList = ['N/A', 'NA', 'UNKNOWN', '0', '*', '-']

  // Check CIN duplicate
  const isCinValid = nCin && !ignoreList.includes(nCin.toUpperCase())
  if (isCinValid) {
    const { data: duplicate } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('cin', nCin)
      .maybeSingle()
    if (duplicate) {
      throw new Error("Un client avec ce numéro de CIN existe déjà dans votre CRM.")
    }
  }

  // Check Permis duplicate
  const isPermisValid = nPermis && !ignoreList.includes(nPermis.toUpperCase())
  if (isPermisValid) {
    const { data: duplicate } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('permis_numero', nPermis)
      .maybeSingle()
    if (duplicate) {
      throw new Error("Un client avec ce numéro de permis existe déjà dans votre CRM.")
    }
  }

  const { error } = await supabase.from('clients').insert({
    owner_id: user.id,
    full_name: full_name?.trim(),
    email: email || null,
    phone: nPhone || 'N/A',
    license_number: nPermis || 'N/A',
    cin: nCin || null,
    date_naissance,
    lieu_naissance,
    cin_delivre_le,
    permis_numero: nPermis || null,
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

  const lieu_naissance = (formData.get('lieu_naissance') as string || '').trim() || null

  const nCin = normCIN(cin)
  const nPermis = normPermis(formData.get('permis_numero') as string || license_number)
  const nPhone = normPhone(phone)

  const ignoreList = ['N/A', 'NA', 'UNKNOWN', '0', '*', '-']

  // Check CIN duplicate
  const isCinValid = nCin && !ignoreList.includes(nCin.toUpperCase())
  if (isCinValid) {
    const { data: duplicate } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('cin', nCin)
      .neq('id', id)
      .maybeSingle()
    if (duplicate) {
      throw new Error("Un client avec ce numéro de CIN existe déjà dans votre CRM.")
    }
  }

  // Check Permis duplicate
  const isPermisValid = nPermis && !ignoreList.includes(nPermis.toUpperCase())
  if (isPermisValid) {
    const { data: duplicate } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('permis_numero', nPermis)
      .neq('id', id)
      .maybeSingle()
    if (duplicate) {
      throw new Error("Un client avec ce numéro de permis existe déjà dans votre CRM.")
    }
  }

  const { error } = await supabase
    .from('clients')
    .update({
      full_name: full_name?.trim(),
      email: email || null,
      phone: nPhone || 'N/A',
      license_number: nPermis || 'N/A',
      cin: nCin || null,
      date_naissance: formData.get('date_naissance') || null,
      lieu_naissance,
      cin_delivre_le: formData.get('cin_delivre_le') || null,
      permis_numero: nPermis || null,
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

  const finalUpdates: typeof updates = { ...updates }

  if (updates.permis_numero) {
    const nPermis = normPermis(updates.permis_numero)
    finalUpdates.permis_numero = nPermis

    const ignoreList = ['N/A', 'NA', 'UNKNOWN', '0', '*', '-']
    const isPermisValid = nPermis && !ignoreList.includes(nPermis.toUpperCase())
    if (isPermisValid) {
      const { data: duplicate } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_id', user.id)
        .eq('permis_numero', nPermis)
        .neq('id', clientId)
        .maybeSingle()
      if (duplicate) {
        throw new Error("Un client avec ce numéro de permis existe déjà dans votre CRM.")
      }
    }
  }

  const { error } = await supabase
    .from('clients')
    .update(finalUpdates)
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

  const clientIdsToRecalculate = new Set<string>()

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
      clientIdsToRecalculate.add(keptClient.id)

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
        clientIdsToRecalculate.add(linkedClientId)
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
          clientIdsToRecalculate.add(linkedClientId)

          await supabase
            .from('bookings')
            .update({ client_id: linkedClientId })
            .eq('id', booking.id)
            .eq('owner_id', user.id)
        }
      }
    }
  }

  // 4. Recalculate trust scores for any affected clients
  for (const cid of clientIdsToRecalculate) {
    try {
      await recalculateClientTrustScore(cid)
    } catch (err) {
      console.error(`Failed to recalculate score for ${cid}:`, err)
    }
  }
}
