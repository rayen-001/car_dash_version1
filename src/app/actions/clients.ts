'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUser, normCIN, normPermis, normPhone, fetchAllClients } from './_shared'
import { recalculateClientTrustScore } from './bookings'

export async function getClients() {
  const { supabase, user } = await getAuthedUser()
  return fetchAllClients(supabase, user.id, '*', [{ column: 'created_at', ascending: false }])
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

  // 1. Fetch only UNLINKED bookings that have at least one identity field we
  //    can safely use for matching (CIN, permis, or phone).
  //    We intentionally do NOT match by full_name — same name ≠ same person.
  const { data: bookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, client_name, client_id, client_cin_passport, client_license_number, client_phone')
    .eq('owner_id', user.id)
    .is('client_id', null)

  if (bookingsErr) throw new Error(bookingsErr.message)
  if (!bookings || bookings.length === 0) return

  // 2. Values to reject — placeholders / dummy / invalid identity values.
  //    None of these count as a real identity for auto-matching.
  const IGNORE_SET = new Set(['', 'N/A', 'NA', 'UNKNOWN', 'NULL', '0', '00000000', '*', '-'])

  function isValidIdentity(raw: string | null | undefined): boolean {
    if (!raw) return false
    const upper = raw.trim().toUpperCase()
    return upper !== '' && !IGNORE_SET.has(upper)
  }

  const clientIdsToRecalculate = new Set<string>()

  // 3. Try to link each unlinked booking to an existing client using safe
  //    identity-only matching. Priority order: CIN → Permis → Phone (unique).
  for (const booking of bookings) {
    let linkedClientId: string | null = null

    // ── A. CIN match: booking.client_cin_passport → clients.cin ONLY ──────────
    //    Never compare CIN against permis_numero — they are different documents.
    const rawCIN = booking.client_cin_passport as string | null
    if (!linkedClientId && isValidIdentity(rawCIN)) {
      const cin = normCIN(rawCIN!)
      if (isValidIdentity(cin)) {
        const { data: matched } = await supabase
          .from('clients')
          .select('id')
          .eq('owner_id', user.id)  // strict owner scope
          .eq('cin', cin)
          .maybeSingle()
        if (matched) {
          linkedClientId = matched.id
        }
      }
    }

    // ── B. Permis match: booking.client_license_number → clients.permis_numero ONLY ──
    //    Never compare permis against cin — they are different documents.
    const rawPermis = booking.client_license_number as string | null
    if (!linkedClientId && isValidIdentity(rawPermis)) {
      const permis = normPermis(rawPermis!)
      if (isValidIdentity(permis)) {
        const { data: matched } = await supabase
          .from('clients')
          .select('id')
          .eq('owner_id', user.id)  // strict owner scope
          .eq('permis_numero', permis)
          .maybeSingle()
        if (matched) {
          linkedClientId = matched.id
        }
      }
    }

    // ── C. Phone match: only if EXACTLY ONE client shares this phone (unambiguous) ──
    //    If 0 or 2+ clients match → do NOT link (ambiguous or unknown).
    const rawPhone = booking.client_phone as string | null
    if (!linkedClientId && isValidIdentity(rawPhone)) {
      const phone = normPhone(rawPhone!)
      if (isValidIdentity(phone)) {
        const { data: phoneMatches, error: phoneErr } = await supabase
          .from('clients')
          .select('id')
          .eq('owner_id', user.id)  // strict owner scope
          .eq('phone', phone)
        if (!phoneErr && phoneMatches && phoneMatches.length === 1) {
          linkedClientId = phoneMatches[0].id
        }
        // 0 matches → unknown client, leave unlinked
        // 2+ matches → ambiguous, leave unlinked (do not guess)
      }
    }

    // ── D. Safe link: only update the booking if a real identity match was found ──
    if (linkedClientId) {
      await supabase
        .from('bookings')
        .update({ client_id: linkedClientId })
        .eq('id', booking.id)
        .eq('owner_id', user.id)

      clientIdsToRecalculate.add(linkedClientId)
    }
    // No match found → booking stays unlinked. NEVER auto-link by name alone.
  }

  // 4. Recalculate trust scores only for clients that were actually linked above.
  for (const cid of clientIdsToRecalculate) {
    try {
      await recalculateClientTrustScore(cid)
    } catch (err) {
      console.error(`Failed to recalculate score for ${cid}:`, err)
    }
  }
}
