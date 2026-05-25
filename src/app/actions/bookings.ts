'use server'

import { revalidatePath } from 'next/cache'
import { calculateTrustScore } from '@/lib/trustScore'
import { getAuthedUser, getTodayYMD } from './_shared'
import { syncVehicleMaxOdometer } from './vehicles'

// ─── Trust Score ─────────────────────────────────────────────────────────────

export async function recalculateClientTrustScore(clientId: string) {
  const { supabase, user } = await getAuthedUser()

  // Shared Liability (DRI): a client's score reflects bookings where they are
  // EITHER the primary renter OR a co-driver. Both accounts move together.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, status, start_date, end_date, actual_return_date, total_amount, acompte_paid, client_behavior_status, installments:booking_installments(id, amount, due_date, status, paid_date)')
    .or(`client_id.eq.${clientId},secondary_client_id.eq.${clientId}`)
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error fetching bookings for trust score:', error.message)
    return
  }

  if (!bookings || bookings.length === 0) {
    // No bookings → unproven client (NULL score)
    await supabase
      .from('clients')
      .update({ trust_score: null })
      .eq('id', clientId)
      .eq('owner_id', user.id)
    return
  }

  const { trustScore } = calculateTrustScore(bookings as any, getTodayYMD())

  await supabase
    .from('clients')
    .update({ trust_score: trustScore })
    .eq('id', clientId)
    .eq('owner_id', user.id)
}

// ─── Booking lifecycle ───────────────────────────────────────────────────────

export async function addBooking(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const vehicle_id = formData.get('vehicle_id') as string
  const client_id_raw = formData.get('client_id') as string || null
  const client_name = formData.get('client_name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const status = formData.get('status') as string || 'confirmed'
  const secondary_client_id_raw = formData.get('secondary_client_id') as string || null

  // Decoupled operational parameters
  const fuel_level_pickup = formData.get('fuel_level_pickup') as string || 'Full'
  const starting_km = parseInt(formData.get('starting_km') as string) || 0
  const lavage_pickup = formData.get('lavage_pickup') as string || 'clean_wash'
  const acompte_paid = parseFloat(formData.get('acompte_paid') as string) || 0
  const rental_days_text = formData.get('rental_days_text') as string || ''

  // Security Deposit tracking fields
  const deposit_amount = parseFloat(formData.get('deposit_amount') as string) || 0
  const deposit_type = (formData.get('deposit_type') as string) || 'Cash'
  const deposit_status = (formData.get('deposit_status') as string) || 'Held'

  // Legal snapshot fields & times
  let client_phone = formData.get('client_phone') as string || ''
  let client_license_number = formData.get('client_license_number') as string || ''
  const client_cin_passport = formData.get('client_cin_passport') as string || ''
  const client_address = formData.get('client_address') as string || ''
  const pickup_time = formData.get('pickup_time') as string || '10:00'
  const return_time = formData.get('return_time') as string || '10:00'

  // Safely parse client_id to prevent type parsing issues with "manual" or empty values
  let client_id = client_id_raw
  if (client_id === 'manual' || client_id === 'null' || !client_id) {
    client_id = null
  }
  let secondary_client_id = secondary_client_id_raw
  if (secondary_client_id === 'manual' || secondary_client_id === 'null' || !secondary_client_id) {
    secondary_client_id = null
  }
  const secondary_client_name = formData.get('secondary_client_name') as string
  const secondary_client_phone = formData.get('secondary_client_phone') as string || ''
  const secondary_client_license_number = formData.get('secondary_client_license_number') as string || ''
  const secondary_client_cin_passport = formData.get('secondary_client_cin_passport') as string || ''
  const secondary_client_address = formData.get('secondary_client_address') as string || ''

  // Ensure manual secondary client names are related/created in the CRM immediately
  if (!secondary_client_id && secondary_client_name) {
    const normName = secondary_client_name.trim()
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('full_name', normName)
      .maybeSingle()

    if (existingClient) {
      secondary_client_id = existingClient.id
    } else {
      const { data: newClient, error: createErr } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          full_name: normName,
          phone: secondary_client_phone || 'N/A',
          email: null,
          license_number: secondary_client_license_number || 'N/A',
          cin: secondary_client_cin_passport || null
        })
        .select('id')
        .single()

      if (!createErr && newClient) {
        secondary_client_id = newClient.id
      }
    }
  }

  // Ensure manual primary client names are related/created in the CRM immediately
  if (!client_id && client_name) {
    const normName = client_name.trim()
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('full_name', normName)
      .maybeSingle()

    if (existingClient) {
      client_id = existingClient.id
    } else {
      const { data: newClient, error: createErr } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          full_name: normName,
          phone: client_phone || 'N/A',
          email: null,
          license_number: client_license_number || 'N/A'
        })
        .select('id')
        .single()

      if (!createErr && newClient) {
        client_id = newClient.id
      }
    }
  }

  // Two-Way CRM Sync: backfill latest snapshot data into existing client profiles
  if (client_id) {
    const updatePayload: any = {}
    if (client_phone) updatePayload.phone = client_phone
    if (client_license_number) updatePayload.license_number = client_license_number
    if (client_cin_passport) updatePayload.cin = client_cin_passport
    if (client_address) updatePayload.address = client_address

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('clients').update(updatePayload).eq('id', client_id).eq('owner_id', user.id)
    }
  }

  if (secondary_client_id) {
    const updateSecondaryPayload: any = {}
    if (secondary_client_phone) updateSecondaryPayload.phone = secondary_client_phone
    if (secondary_client_license_number) updateSecondaryPayload.license_number = secondary_client_license_number
    if (secondary_client_cin_passport) updateSecondaryPayload.cin = secondary_client_cin_passport
    if (secondary_client_address) updateSecondaryPayload.address = secondary_client_address

    if (Object.keys(updateSecondaryPayload).length > 0) {
      await supabase.from('clients').update(updateSecondaryPayload).eq('id', secondary_client_id).eq('owner_id', user.id)
    }
  }

  // If snapshot values are empty, fall back to the CRM defaults
  if (client_id && (!client_phone || !client_license_number)) {
    const { data: clientObj } = await supabase
      .from('clients')
      .select('phone, license_number')
      .eq('id', client_id)
      .eq('owner_id', user.id)
      .single()

    if (clientObj) {
      if (!client_phone) client_phone = clientObj.phone || ''
      if (!client_license_number) client_license_number = clientObj.license_number || ''
    }
  }

  // Validate dates do not collide with an existing rental
  const { data: conflicts, error: conflictError } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', vehicle_id)
    .neq('status', 'cancelled')
    .lte('start_date', end_date)
    .gte('end_date', start_date)

  if (conflictError) throw new Error(conflictError.message)
  if (conflicts && conflicts.length > 0) {
    throw new Error('This vehicle is already rented during these dates.')
  }

  const installmentsJson = formData.get('installments') as string
  const installmentsInput: { amount: number; due_date: string; status: 'paid' | 'unpaid' }[] = installmentsJson
    ? JSON.parse(installmentsJson)
    : []

  const { data: newBooking, error } = await supabase.from('bookings').insert({
    owner_id: user.id,
    vehicle_id,
    client_id,
    secondary_client_id,
    client_name,
    start_date,
    end_date,
    status,
    total_amount,
    payment_status: status === 'confirmed' ? 'paid' : 'unpaid',
    acompte_paid,
    rental_days_text,
    deposit_amount,
    deposit_type,
    deposit_status,
    client_phone,
    client_license_number,
    client_cin_passport,
    client_address,
    pickup_time,
    return_time
  }).select('id').single()

  if (error) throw new Error(error.message)

  // Insert decoupled handover record using the 8-point fuel scale
  if (newBooking?.id) {
    const fuelMap: Record<string, number> = { 'Full': 8, '3/4': 6, '1/2': 4, '1/4': 2, 'Empty': 0 }
    const fuelNum = fuelMap[fuel_level_pickup] ?? 8

    await supabase.from('vehicle_handovers').insert({
      booking_id: newBooking.id,
      vehicle_id,
      pickup_km: starting_km,
      return_km: null,
      pickup_fuel: fuelNum,
      return_fuel: null,
      pickup_cleanliness: lavage_pickup === 'clean_wash' ? 'Clean' : 'Dirty',
      return_cleanliness: null
    })
  }

  if (installmentsInput.length > 0 && newBooking) {
    const todayStr = getTodayYMD()
    const installmentsToInsert = installmentsInput.map((inst) => ({
      booking_id: newBooking.id,
      amount: inst.amount,
      due_date: inst.due_date,
      status: inst.status || 'unpaid',
      paid_date: inst.status === 'paid' ? todayStr : null
    }))

    const { error: instError } = await supabase
      .from('booking_installments')
      .insert(installmentsToInsert)

    if (instError) {
      console.error('Error inserting installments:', instError.message)
    }
  }

  if (client_id) {
    await recalculateClientTrustScore(client_id)
  }
  if (secondary_client_id) {
    await recalculateClientTrustScore(secondary_client_id)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

export async function updateBooking(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const id = formData.get('id') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const client_id_raw = formData.get('client_id') as string || null
  const client_name = formData.get('client_name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const status = formData.get('status') as string || 'confirmed'
  const secondary_client_id_raw = formData.get('secondary_client_id') as string || null

  // Decoupled operational parameters
  const fuel_level_pickup = formData.get('fuel_level_pickup') as string || 'Full'
  const starting_km = parseInt(formData.get('starting_km') as string) || 0
  const lavage_pickup = formData.get('lavage_pickup') as string || 'clean_wash'
  const acompte_paid = parseFloat(formData.get('acompte_paid') as string) || 0
  const rental_days_text = formData.get('rental_days_text') as string || ''

  // Security Deposit tracking fields
  const deposit_amount = parseFloat(formData.get('deposit_amount') as string) || 0
  const deposit_type = (formData.get('deposit_type') as string) || 'Cash'
  const deposit_status = (formData.get('deposit_status') as string) || 'Held'

  // Legal snapshot fields & times
  let client_phone = formData.get('client_phone') as string || ''
  let client_license_number = formData.get('client_license_number') as string || ''
  const client_cin_passport = formData.get('client_cin_passport') as string || ''
  const client_address = formData.get('client_address') as string || ''
  const pickup_time = formData.get('pickup_time') as string || '10:00'
  const return_time = formData.get('return_time') as string || '10:00'

  let client_id = client_id_raw
  if (client_id === 'manual' || client_id === 'null' || !client_id) {
    client_id = null
  }
  let secondary_client_id = secondary_client_id_raw
  if (secondary_client_id === 'manual' || secondary_client_id === 'null' || !secondary_client_id) {
    secondary_client_id = null
  }
  const secondary_client_name = formData.get('secondary_client_name') as string
  const secondary_client_phone = formData.get('secondary_client_phone') as string || ''
  const secondary_client_license_number = formData.get('secondary_client_license_number') as string || ''
  const secondary_client_cin_passport = formData.get('secondary_client_cin_passport') as string || ''
  const secondary_client_address = formData.get('secondary_client_address') as string || ''

  if (!secondary_client_id && secondary_client_name) {
    const normName = secondary_client_name.trim()
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('full_name', normName)
      .maybeSingle()

    if (existingClient) {
      secondary_client_id = existingClient.id
    } else {
      const { data: newClient, error: createErr } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          full_name: normName,
          phone: secondary_client_phone || 'N/A',
          email: null,
          license_number: secondary_client_license_number || 'N/A',
          cin: secondary_client_cin_passport || null
        })
        .select('id')
        .single()

      if (!createErr && newClient) {
        secondary_client_id = newClient.id
      }
    }
  }

  if (!client_id && client_name) {
    const normName = client_name.trim()
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('full_name', normName)
      .maybeSingle()

    if (existingClient) {
      client_id = existingClient.id
    } else {
      const { data: newClient, error: createErr } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          full_name: normName,
          phone: client_phone || 'N/A',
          email: null,
          license_number: client_license_number || 'N/A'
        })
        .select('id')
        .single()

      if (!createErr && newClient) {
        client_id = newClient.id
      }
    }
  }

  // Two-Way CRM Sync
  if (client_id) {
    const updatePayload: any = {}
    if (client_phone) updatePayload.phone = client_phone
    if (client_license_number) updatePayload.license_number = client_license_number
    if (client_cin_passport) updatePayload.cin = client_cin_passport
    if (client_address) updatePayload.address = client_address

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('clients').update(updatePayload).eq('id', client_id).eq('owner_id', user.id)
    }
  }

  if (secondary_client_id) {
    const updateSecondaryPayload: any = {}
    if (secondary_client_phone) updateSecondaryPayload.phone = secondary_client_phone
    if (secondary_client_license_number) updateSecondaryPayload.license_number = secondary_client_license_number
    if (secondary_client_cin_passport) updateSecondaryPayload.cin = secondary_client_cin_passport
    if (secondary_client_address) updateSecondaryPayload.address = secondary_client_address

    if (Object.keys(updateSecondaryPayload).length > 0) {
      await supabase.from('clients').update(updateSecondaryPayload).eq('id', secondary_client_id).eq('owner_id', user.id)
    }
  }

  // Fall back to CRM defaults when snapshot fields are empty
  if (client_id && (!client_phone || !client_license_number)) {
    const { data: clientObj } = await supabase
      .from('clients')
      .select('phone, license_number')
      .eq('id', client_id)
      .eq('owner_id', user.id)
      .single()

    if (clientObj) {
      if (!client_phone) client_phone = clientObj.phone || ''
      if (!client_license_number) client_license_number = clientObj.license_number || ''
    }
  }

  // Validate dates do not collide with another booking
  const { data: conflicts, error: conflictError } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', vehicle_id)
    .neq('id', id)
    .neq('status', 'cancelled')
    .lte('start_date', end_date)
    .gte('end_date', start_date)

  if (conflictError) throw new Error(conflictError.message)
  if (conflicts && conflicts.length > 0) {
    throw new Error('This vehicle is already rented during these dates.')
  }

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('actual_return_date')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  const todayStr = getTodayYMD()
  const actual_return_date = status === 'completed' ? (existingBooking?.actual_return_date || todayStr) : null

  const { error } = await supabase
    .from('bookings')
    .update({
      vehicle_id,
      client_id,
      secondary_client_id,
      client_name,
      start_date,
      end_date,
      status,
      total_amount,
      acompte_paid,
      rental_days_text,
      deposit_amount,
      deposit_type,
      deposit_status,
      client_phone,
      client_license_number,
      client_cin_passport,
      client_address,
      pickup_time,
      return_time,
      actual_return_date
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // Update or insert handover decoupled data using the 8-point fuel scale
  const fuelMap: Record<string, number> = { 'Full': 8, '3/4': 6, '1/2': 4, '1/4': 2, 'Empty': 0 }
  const fuelNum = fuelMap[fuel_level_pickup] ?? 8

  const { data: existingHandover } = await supabase
    .from('vehicle_handovers')
    .select('booking_id')
    .eq('booking_id', id)
    .maybeSingle()

  if (existingHandover) {
    await supabase.from('vehicle_handovers').update({
      vehicle_id,
      pickup_km: starting_km,
      pickup_fuel: fuelNum,
      pickup_cleanliness: lavage_pickup === 'clean_wash' ? 'Clean' : 'Dirty'
    }).eq('booking_id', id)
  } else {
    await supabase.from('vehicle_handovers').insert({
      booking_id: id,
      vehicle_id,
      pickup_km: starting_km,
      return_km: null,
      pickup_fuel: fuelNum,
      return_fuel: null,
      pickup_cleanliness: lavage_pickup === 'clean_wash' ? 'Clean' : 'Dirty',
      return_cleanliness: null
    })
  }

  // Sync installments: delete old, insert new
  const installmentsJson = formData.get('installments') as string
  const installmentsInput: { amount: number; due_date: string; status: 'paid' | 'unpaid' }[] = installmentsJson
    ? JSON.parse(installmentsJson)
    : []

  await supabase
    .from('booking_installments')
    .delete()
    .eq('booking_id', id)

  if (installmentsInput.length > 0) {
    const installmentsToInsert = installmentsInput.map((inst) => ({
      booking_id: id,
      amount: inst.amount,
      due_date: inst.due_date,
      status: inst.status || 'unpaid',
      paid_date: inst.status === 'paid' ? todayStr : null
    }))

    const { error: instError } = await supabase
      .from('booking_installments')
      .insert(installmentsToInsert)

    if (instError) {
      console.error('Error inserting installments in updateBooking:', instError.message)
    }
  }

  if (client_id) {
    await recalculateClientTrustScore(client_id)
  }
  if (secondary_client_id) {
    await recalculateClientTrustScore(secondary_client_id)
  }

  revalidatePath('/dashboard/bookings')
}

export async function addCoDriverToBooking(bookingId: string, clientId: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('bookings')
    .update({ secondary_client_id: clientId })
    .eq('id', bookingId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/revenues')
}

export async function updateBookingStatus(id: string, status: string) {
  const { supabase, user } = await getAuthedUser()

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, secondary_client_id, actual_return_date')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  const todayStr = getTodayYMD()
  const updatePayload: any = { status }
  if (status === 'completed') {
    updatePayload.actual_return_date = booking?.actual_return_date || todayStr
  } else {
    updatePayload.actual_return_date = null
  }

  const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id).eq('owner_id', user.id)
  if (error) throw new Error(error.message)

  if (booking && booking.client_id) {
    await recalculateClientTrustScore(booking.client_id)
  }
  if (booking && booking.secondary_client_id) {
    await recalculateClientTrustScore(booking.secondary_client_id)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

// ─── Historical update / installment cascade ────────────────────────────────

export async function updateBookingHistoricalDetails(
  bookingId: string,
  vehicleId: string,
  updates: {
    amount_paid?: number
    acompte_paid?: number
    accident_reported?: boolean
    owner_remarks?: string | null
    rental_days_text?: string | null
    starting_km?: number | null
    return_km?: number | null
    lavage_pickup?: string | null
    lavage_return?: string | null
    client_behavior_status?: string | null
    fuel_level_pickup?: string | null
    fuel_level_return?: string | null
    damage_notes?: string | null
    status?: string
    return_mileage?: number | null
    starting_mileage?: number | null
    end_date?: string
    amount_collected_now?: number
    incident_penalties?: number
    total_amount?: number
  }
) {
  const { supabase, user } = await getAuthedUser()

  const dbUpdates = { ...updates }

  // Clean up transient UI inputs from db payload
  delete dbUpdates.amount_collected_now
  delete dbUpdates.incident_penalties

  if (dbUpdates.return_km !== undefined) {
    dbUpdates.return_mileage = dbUpdates.return_km
  }
  if (dbUpdates.starting_km !== undefined) {
    dbUpdates.starting_mileage = dbUpdates.starting_km
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, secondary_client_id, status, actual_return_date, total_amount, acompte_paid')
    .eq('id', bookingId)
    .eq('owner_id', user.id)
    .single()

  const incident_penalties = Number(updates.incident_penalties) || 0
  if (incident_penalties > 0 && booking) {
    // Penalty insert ALWAYS binds client_id (secondary takes precedence as the driver-at-fault).
    const targetClientId = booking.secondary_client_id || booking.client_id
    await supabase.from('expenses').insert({
      owner_id: user.id,
      vehicle_id: vehicleId,
      client_id: targetClientId,
      category: 'Damage/Penalty',
      description: `Incident/Damage Penalty for Booking ${bookingId}`,
      amount: incident_penalties
    })
  }

  if (updates.status !== undefined) {
    const todayStr = getTodayYMD()
    if (updates.status === 'completed') {
      ;(dbUpdates as any).actual_return_date = booking?.actual_return_date || todayStr
    } else {
      ;(dbUpdates as any).actual_return_date = null
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update(dbUpdates)
    .eq('id', bookingId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // Odometer Operations Auto-Sync (centralized)
  await syncVehicleMaxOdometer(vehicleId)

  // Sequential Installment Clearing Algorithm
  const amountCollected = Number(updates.amount_collected_now) || 0
  if (amountCollected > 0) {
    const { data: installments, error: instFetchError } = await supabase
      .from('booking_installments')
      .select('id, amount, status, due_date')
      .eq('booking_id', bookingId)
      .order('due_date', { ascending: true })

    if (instFetchError) {
      console.error('Error fetching installments for allocation:', instFetchError.message)
    } else if (installments && installments.length > 0) {
      let remainingCash = amountCollected
      const todayStr = getTodayYMD()

      for (const inst of installments) {
        if (remainingCash <= 0) break

        if (inst.status === 'paid') {
          continue
        }

        const instAmt = Number(inst.amount) || 0
        if (remainingCash >= instAmt) {
          const { error: updErr } = await supabase
            .from('booking_installments')
            .update({
              status: 'paid',
              paid_date: todayStr
            })
            .eq('id', inst.id)

          if (updErr) {
            console.error(`Error satisfying installment ${inst.id}:`, updErr.message)
          } else {
            remainingCash -= instAmt
          }
        } else {
          // Partial satisfaction: split tranche so the paid portion is recorded distinctly
          const newAmt = instAmt - remainingCash
          const { error: updErr } = await supabase
            .from('booking_installments')
            .update({
              amount: newAmt
            })
            .eq('id', inst.id)

          if (updErr) {
            console.error(`Error partially satisfying installment ${inst.id}:`, updErr.message)
          } else {
            const { error: insErr } = await supabase
              .from('booking_installments')
              .insert({
                booking_id: bookingId,
                amount: remainingCash,
                due_date: inst.due_date,
                status: 'paid',
                paid_date: todayStr
              })
            if (insErr) {
              console.error(`Error inserting split paid installment for ${inst.id}:`, insErr.message)
            }
            remainingCash = 0
          }
        }
      }
    } else {
      // Fallback: no scheduled tranches — create a synthetic paid installment
      const remainingAmount = (Number(booking?.total_amount) || 0) - (Number(booking?.acompte_paid) || 0)
      if (remainingAmount > 0) {
        const payAmt = Math.min(amountCollected, remainingAmount)
        const todayStr = getTodayYMD()
        const { error: insErr } = await supabase
          .from('booking_installments')
          .insert({
            booking_id: bookingId,
            amount: payAmt,
            due_date: todayStr,
            status: 'paid',
            paid_date: todayStr
          })
        if (insErr) {
          console.error('Error inserting synthetic installment in updateBookingHistoricalDetails:', insErr.message)
        }
      }
    }
  }

  if (booking && booking.client_id) {
    await recalculateClientTrustScore(booking.client_id)
  }

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard/revenues')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/expenses')
}

// ─── Installment & ledger settlement ────────────────────────────────────────

export async function clearOutstandingLedgerItem(bookingId: string, lineItemId: string) {
  const { supabase, user } = await getAuthedUser()

  const paid_date = getTodayYMD()

  if (String(lineItemId).startsWith('unpaid-liability-')) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('total_amount, acompte_paid, client_id, secondary_client_id')
      .eq('id', bookingId)
      .eq('owner_id', user.id)
      .single()

    if (booking) {
      const { data: paidInst } = await supabase
        .from('booking_installments')
        .select('amount')
        .eq('booking_id', bookingId)
        .eq('status', 'paid')

      const paidInstallmentsSum = (paidInst || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      const remainingAmount = (Number(booking.total_amount) || 0) - (Number(booking.acompte_paid) || 0) - paidInstallmentsSum

      if (remainingAmount > 0) {
        const { error } = await supabase
          .from('booking_installments')
          .insert({
            booking_id: bookingId,
            amount: remainingAmount,
            due_date: paid_date,
            status: 'paid',
            paid_date
          })
        if (error) throw new Error(error.message)

        if (booking.client_id) {
          await recalculateClientTrustScore(booking.client_id)
        }
        if (booking.secondary_client_id) {
          await recalculateClientTrustScore(booking.secondary_client_id)
        }
      }
    }
    revalidatePath('/dashboard/expenses')
    revalidatePath('/dashboard')
    return
  }

  const { error } = await supabase
    .from('booking_installments')
    .update({ status: 'paid', paid_date })
    .eq('id', lineItemId)
    .eq('booking_id', bookingId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
}

export async function toggleTrancheStatus(bookingId: string, trancheId: string, currentStatus: 'paid' | 'unpaid') {
  const { supabase, user } = await getAuthedUser()

  if (String(trancheId).startsWith('unpaid-liability-')) {
    // Synthetic tranche: satisfy the remaining contract liability
    const { data: booking } = await supabase
      .from('bookings')
      .select('total_amount, acompte_paid, client_id')
      .eq('id', bookingId)
      .eq('owner_id', user.id)
      .single()

    if (booking) {
      const { data: paidInst } = await supabase
        .from('booking_installments')
        .select('amount')
        .eq('booking_id', bookingId)
        .eq('status', 'paid')

      const paidInstallmentsSum = (paidInst || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      const remainingAmount = (Number(booking.total_amount) || 0) - (Number(booking.acompte_paid) || 0) - paidInstallmentsSum

      if (remainingAmount > 0) {
        const paid_date = getTodayYMD()
        const { error } = await supabase
          .from('booking_installments')
          .insert({
            booking_id: bookingId,
            amount: remainingAmount,
            due_date: paid_date,
            status: 'paid',
            paid_date
          })
        if (error) throw new Error(error.message)

        if (booking.client_id) {
          await recalculateClientTrustScore(booking.client_id)
        }
      }
    }
    revalidatePath('/dashboard/expenses')
    revalidatePath('/dashboard')
    return
  }

  const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
  const paid_date = newStatus === 'paid' ? getTodayYMD() : null

  const { error } = await supabase
    .from('booking_installments')
    .update({ status: newStatus, paid_date })
    .eq('id', trancheId)
    .eq('booking_id', bookingId)

  if (error) throw new Error(error.message)

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id')
    .eq('id', bookingId)
    .eq('owner_id', user.id)
    .single()

  if (booking?.client_id) {
    await recalculateClientTrustScore(booking.client_id)
  }

  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
}

export async function settleBookingTrancheCascade(bookingId: string, amount: number) {
  const { supabase, user } = await getAuthedUser()

  if (amount <= 0) throw new Error('Amount must be positive')

  const todayStr = getTodayYMD()

  const { data: installments, error: instFetchError } = await supabase
    .from('booking_installments')
    .select('id, amount, status, due_date')
    .eq('booking_id', bookingId)
    .order('due_date', { ascending: true })

  if (instFetchError) throw new Error(instFetchError.message)

  if (!installments || installments.length === 0) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('total_amount, acompte_paid, client_id')
      .eq('id', bookingId)
      .eq('owner_id', user.id)
      .single()

    if (booking) {
      const remainingAmount = (Number(booking.total_amount) || 0) - (Number(booking.acompte_paid) || 0)
      if (remainingAmount > 0) {
        const payAmt = Math.min(amount, remainingAmount)
        const { error: insErr } = await supabase
          .from('booking_installments')
          .insert({
            booking_id: bookingId,
            amount: payAmt,
            due_date: todayStr,
            status: 'paid',
            paid_date: todayStr
          })
        if (insErr) throw new Error(insErr.message)

        if (booking.client_id) {
          await recalculateClientTrustScore(booking.client_id)
        }
        revalidatePath('/dashboard/expenses')
        revalidatePath('/dashboard')
        return
      }
    }
    throw new Error('No scheduled installments found and no outstanding contract balance remains.')
  }

  let remainingCash = amount

  for (const inst of installments) {
    if (remainingCash <= 0) break

    if (inst.status === 'paid') {
      continue
    }

    const instAmt = Number(inst.amount) || 0
    if (remainingCash >= instAmt) {
      const { error: updErr } = await supabase
        .from('booking_installments')
        .update({
          status: 'paid',
          paid_date: todayStr
        })
        .eq('id', inst.id)

      if (updErr) throw new Error(updErr.message)
      remainingCash -= instAmt
    } else {
      const newAmt = instAmt - remainingCash
      const { error: updErr } = await supabase
        .from('booking_installments')
        .update({
          amount: newAmt
        })
        .eq('id', inst.id)

      if (updErr) throw new Error(updErr.message)

      const { error: insErr } = await supabase
        .from('booking_installments')
        .insert({
          booking_id: bookingId,
          amount: remainingCash,
          due_date: inst.due_date,
          status: 'paid',
          paid_date: todayStr
        })
      if (insErr) throw new Error(insErr.message)

      remainingCash = 0
    }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id')
    .eq('id', bookingId)
    .eq('owner_id', user.id)
    .single()

  if (booking?.client_id) {
    await recalculateClientTrustScore(booking.client_id)
  }

  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
}

// ─── Vehicle handover ────────────────────────────────────────────────────────

export async function updateBookingHandover(
  bookingId: string,
  vehicleId: string,
  updates: {
    pickup_km?: number | null
    return_km?: number | null
    pickup_fuel?: number | null
    return_fuel?: number | null
    pickup_cleanliness?: 'Clean' | 'Dirty' | null
    return_cleanliness?: 'Clean' | 'Dirty' | null
  }
) {
  const { supabase } = await getAuthedUser()

  const payload = {
    booking_id: bookingId,
    vehicle_id: vehicleId,
    ...updates,
    created_at: new Date().toISOString()
  }

  const { error: upsertErr } = await supabase
    .from('vehicle_handovers')
    .upsert(payload, { onConflict: 'booking_id' })

  if (upsertErr) {
    throw new Error(upsertErr.message)
  }

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')

  // Run central odometer sync AFTER saving handover (owner-scoped & ownership-verified inside)
  await syncVehicleMaxOdometer(vehicleId)
}
