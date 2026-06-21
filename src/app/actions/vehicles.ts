'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAuthedUser, parseCostFromNotes } from './_shared'
import { syncMaintenanceTodos } from './todos'

export async function addVehicle(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const brand = formData.get('brand') as string
  const model = formData.get('model') as string
  const year = parseInt(formData.get('year') as string)
  const price_per_day = parseFloat(formData.get('price_per_day') as string)
  const availability = formData.get('availability') === 'on' || formData.get('availability') === 'true'

  // Handle image uploads
  const imageFiles = formData.getAll('images') as File[]
  const imageUrls: string[] = []

  if (imageFiles && imageFiles.length > 0) {
    const adminClient = createAdminClient()
    for (const file of imageFiles) {
      if (file && file.size > 0 && file.name) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const { error: uploadError } = await adminClient.storage
          .from('vehicle-images')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError.message)
        } else {
          const { data: { publicUrl } } = adminClient.storage
            .from('vehicle-images')
            .getPublicUrl(filePath)
          imageUrls.push(publicUrl)
        }
      }
    }
  }

  const current_km = formData.get('current_km') ? parseInt(formData.get('current_km') as string) : null
  const last_vidange_km = formData.get('last_vidange_km') ? parseInt(formData.get('last_vidange_km') as string) : null
  const next_vidange_km = formData.get('next_vidange_km') ? parseInt(formData.get('next_vidange_km') as string) : null
  const last_pads_km = formData.get('last_pads_km') ? parseInt(formData.get('last_pads_km') as string) : null
  const next_pads_km = formData.get('next_pads_km') ? parseInt(formData.get('next_pads_km') as string) : null

  // Legacy fallback compatibility
  const oil_change_due_km = next_vidange_km
  const brake_pad_state = next_pads_km && current_km && current_km >= next_pads_km ? 'critical' : 'good'

  const insurance_start_date = (formData.get('insurance_start_date') as string) || null

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      owner_id: user.id,
      brand,
      model,
      year,
      price_per_day,
      availability,
      images: imageUrls,
      license_plate: (formData.get('license_plate') as string) || null,
      color: (formData.get('color') as string) || null,
      current_km,
      last_vidange_km,
      next_vidange_km,
      last_pads_km,
      next_pads_km,
      oil_change_due_km,
      brake_pad_state,
      insurance_start_date,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (data?.id) {
    const assurance_expiry = formData.get('assurance_expiry') as string
    const visite_technique_expiry = formData.get('visite_technique_expiry') as string
    const laissez_passer_expiry = formData.get('laissez_passer_expiry') as string

    const docsToInsert = []
    if (assurance_expiry) {
      docsToInsert.push({
        owner_id: user.id,
        vehicle_id: data.id,
        doc_type: 'assurance',
        expiry_date: assurance_expiry,
        notes: null
      })
    }
    if (visite_technique_expiry) {
      docsToInsert.push({
        owner_id: user.id,
        vehicle_id: data.id,
        doc_type: 'visite_technique',
        expiry_date: visite_technique_expiry,
        notes: null
      })
    }
    if (laissez_passer_expiry) {
      docsToInsert.push({
        owner_id: user.id,
        vehicle_id: data.id,
        doc_type: 'laissez_passer',
        expiry_date: laissez_passer_expiry,
        notes: null
      })
    }

    if (docsToInsert.length > 0) {
      const { error: docsError } = await supabase.from('vehicle_legal_docs').insert(docsToInsert)
      if (docsError) {
        console.error('Error inserting vehicle legal docs during creation:', docsError.message)
      }
    }
  }

  revalidatePath('/dashboard/fleet')
}

export async function updateVehicle(formData: FormData) {
  const { supabase, user } = await getAuthedUser()

  const id = formData.get('id') as string
  const brand = formData.get('brand') as string
  const model = formData.get('model') as string
  const year = parseInt(formData.get('year') as string)
  const price_per_day = parseFloat(formData.get('price_per_day') as string)
  const availability = formData.get('availability') === 'on' || formData.get('availability') === 'true'

  // Existing images kept
  const existingImagesJson = formData.get('existing_images') as string
  const keptImages: string[] = existingImagesJson ? JSON.parse(existingImagesJson) : []

  // Fetch current vehicle (owner-scoped) to delete removed images from storage
  const { data: currentCar } = await supabase
    .from('vehicles')
    .select('images')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  const adminClient = createAdminClient()

  if (currentCar && currentCar.images) {
    const removedImages = currentCar.images.filter((img: string) => !keptImages.includes(img))
    for (const imgUrl of removedImages) {
      const pathParts = imgUrl.split('/vehicle-images/')
      if (pathParts.length > 1) {
        const storagePath = pathParts[1]
        await adminClient.storage.from('vehicle-images').remove([storagePath])
      }
    }
  }

  // Handle new image uploads
  const newImageFiles = formData.getAll('new_images') as File[]
  const newImageUrls: string[] = []

  if (newImageFiles && newImageFiles.length > 0) {
    for (const file of newImageFiles) {
      if (file && file.size > 0 && file.name) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const { error: uploadError } = await adminClient.storage
          .from('vehicle-images')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError.message)
        } else {
          const { data: { publicUrl } } = adminClient.storage
            .from('vehicle-images')
            .getPublicUrl(filePath)
          newImageUrls.push(publicUrl)
        }
      }
    }
  }

  const finalImageUrls = [...keptImages, ...newImageUrls]

  const insurance_start_date = (formData.get('insurance_start_date') as string) || null

  const { error } = await supabase
    .from('vehicles')
    .update({
      brand,
      model,
      year,
      price_per_day,
      availability,
      images: finalImageUrls,
      license_plate: (formData.get('license_plate') as string) || null,
      color: (formData.get('color') as string) || null,
      insurance_start_date,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // If the edit form provided an updated assurance (insurance) expiry date, sync it into vehicle_legal_docs
  const assurance_expiry_edit = (formData.get('assurance_expiry_edit') as string) || null
  if (assurance_expiry_edit) {
    await supabase.from('vehicle_legal_docs').upsert({
      owner_id: user.id,
      vehicle_id: id,
      doc_type: 'assurance',
      expiry_date: assurance_expiry_edit,
      notes: null,
    }, { onConflict: 'vehicle_id,doc_type' })
  }

  revalidatePath('/dashboard/fleet')
}

/**
 * Soft-withdraw a vehicle: sets withdrawn_at to the provided date.
 * The vehicle is hidden from the active fleet but ALL historical data
 * (bookings, clients, expenses, maintenance, etc.) is preserved.
 */
export async function withdrawVehicle(vehicleId: string, withdrawnAt: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('vehicles')
    .update({ withdrawn_at: withdrawnAt })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // Revalidate ALL active operational pages so the withdrawn vehicle
  // disappears immediately everywhere — not just on the fleet page.
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard/todo')
  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/revenues')
  revalidatePath('/dashboard/maintenance')
  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
}

/**
 * Restore a withdrawn vehicle: clears withdrawn_at.
 * The vehicle re-appears in the active fleet.
 */
export async function restoreVehicle(vehicleId: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('vehicles')
    .update({ withdrawn_at: null })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  // Fetch all vehicles for the user (including the newly restored one)
  const { data: allVehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, license_plate, current_km, next_vidange_km, next_pads_km, withdrawn_at')
    .eq('owner_id', user.id)

  if (allVehicles) {
    // Trigger the maintenance-alert synchronization process immediately
    await syncMaintenanceTodos(allVehicles)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/todo')
  revalidatePath('/dashboard/fleet')
  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
}

export async function deleteVehicle(id: string) {
  const { supabase, user } = await getAuthedUser()

  const { data: car } = await supabase
    .from('vehicles')
    .select('images')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (car && car.images && car.images.length > 0) {
    const adminClient = createAdminClient()
    for (const imgUrl of car.images) {
      const pathParts = imgUrl.split('/vehicle-images/')
      if (pathParts.length > 1) {
        const storagePath = pathParts[1]
        await adminClient.storage.from('vehicle-images').remove([storagePath])
      }
    }
  }

  const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('owner_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/fleet')
}

export async function updateVehicleMechanicalState(
  vehicleId: string,
  currentKm: number | null,
  lastVidangeKm: number | null,
  lastPadsKm: number | null,
  nextPadsKm?: number | null
) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('vehicles')
    .update({
      current_km: currentKm,
      last_vidange_km: lastVidangeKm,
      last_pads_km: lastPadsKm,
      next_pads_km: nextPadsKm,
    })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
}

export async function executeMechanicalService(
  vehicleId: string,
  type: 'vidange' | 'pads',
  currentKm: number,
  cost: number,
  interval: number
) {
  const { supabase, user } = await getAuthedUser()

  // 1. Fetch license plate (owner-scoped) for description
  const { data: vehicle, error: vehErr } = await supabase
    .from('vehicles')
    .select('license_plate')
    .eq('id', vehicleId)
    .eq('owner_id', user.id)
    .single()

  if (vehErr) throw new Error(vehErr.message)
  const plate = vehicle?.license_plate || 'Unknown Plate'

  // 2. Overwrite tracking loop with static target
  const updatePayload = type === 'vidange'
    ? { last_vidange_km: currentKm, next_vidange_km: currentKm + interval }
    : { last_pads_km: currentKm, next_pads_km: currentKm + interval }

  const { error: updateErr } = await supabase
    .from('vehicles')
    .update(updatePayload)
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (updateErr) throw new Error(updateErr.message)

  // 3. Append finalized deficit row into 'expenses' table (asset-overhead, no client binding)
  const serviceName = type === 'vidange' ? 'Vidange' : 'Pads'
  const description = `Mechanical Service (${serviceName}) for ${plate}`

  const { error: expErr } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicleId,
    category: 'maintenance',
    description,
    amount: cost
  })

  if (expErr) throw new Error(expErr.message)

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/revenues')
  revalidatePath('/dashboard')
}

export async function upsertVehicleLegalDoc(
  vehicleId: string,
  docType: 'assurance' | 'visite_technique' | 'laissez_passer',
  expiryDate: string,
  notes: string | null
) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('vehicle_legal_docs')
    .upsert({
      owner_id: user.id,
      vehicle_id: vehicleId,
      doc_type: docType,
      expiry_date: expiryDate,
      notes,
    }, {
      onConflict: 'vehicle_id,doc_type'
    })

  if (error) throw new Error(error.message)

  // Auto-sync into expenses (asset-overhead, no client binding)
  const docTypeLabel = docType === 'assurance' ? 'Assurance' : docType === 'visite_technique' ? 'Visite Technique' : 'Laissez-Passer'
  const defaultCost = docType === 'assurance' ? 250.0 : docType === 'visite_technique' ? 50.0 : 40.0
  const parsedCost = parseCostFromNotes(notes, defaultCost)
  const category = docType === 'assurance' ? 'insurance' : 'other'

  const { error: expError } = await supabase.from('expenses').insert({
    owner_id: user.id,
    vehicle_id: vehicleId,
    category,
    description: `${docTypeLabel} Renewal${notes ? `: ${notes}` : ''}`,
    amount: parsedCost
  })
  if (expError) console.error('Error inserting compliance expense:', expError.message)

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
}

export async function renewVehicleDocument(
  vehicleId: string,
  docType: 'assurance' | 'visite_technique' | 'laissez_passer',
  calculatedExpiryDate: string,
  cost?: number
) {
  const { supabase, user } = await getAuthedUser()

  // Fetch license plate (owner-scoped) for the standard description
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('license_plate')
    .eq('id', vehicleId)
    .eq('owner_id', user.id)
    .single()
  const plate = vehicle?.license_plate || 'Unknown Plate'

  const { error } = await supabase
    .from('vehicle_legal_docs')
    .upsert({
      owner_id: user.id,
      vehicle_id: vehicleId,
      doc_type: docType,
      expiry_date: calculatedExpiryDate,
      notes: `Quick auto-renewed on ${new Date().toLocaleDateString()}`
    }, {
      onConflict: 'vehicle_id,doc_type'
    })

  if (error) throw new Error(error.message)

  // Auto-sync into expenses (asset-overhead, no client binding)
  const docTypeLabel = docType === 'assurance' ? 'Assurance' : docType === 'visite_technique' ? 'Visite Technique' : 'Laissez-Passer'

  let finalCost = cost
  if (finalCost === undefined || isNaN(finalCost)) {
    finalCost = docType === 'assurance' ? 250.0 : docType === 'visite_technique' ? 50.0 : 40.0
  }

  const category = docType === 'assurance' ? 'insurance' : 'other'
  const description = `${docTypeLabel} Renewal for ${plate}`

  const todayStr = new Date().toISOString().split('T')[0]

  // Idempotency window: collapse multiple renewals of the same vehicle/category
  // within the same calendar day into a single ledger row.
  const { data: existingExpenses, error: fetchErr } = await supabase
    .from('expenses')
    .select('id, created_at')
    .eq('owner_id', user.id)
    .eq('vehicle_id', vehicleId)
    .eq('category', category)
    .gte('created_at', `${todayStr}T00:00:00Z`)
    .lte('created_at', `${todayStr}T23:59:59Z`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchErr) {
    console.error('Error fetching existing compliance expense:', fetchErr.message)
  }

  if (existingExpenses && existingExpenses.length > 0) {
    const existingId = existingExpenses[0].id
    const { error: expError } = await supabase
      .from('expenses')
      .update({
        amount: finalCost,
        description
      })
      .eq('id', existingId)
      .eq('owner_id', user.id)

    if (expError) console.error('Error updating compliance renewal expense:', expError.message)
  } else {
    const { error: expError } = await supabase.from('expenses').insert({
      owner_id: user.id,
      vehicle_id: vehicleId,
      category,
      description,
      amount: finalCost
    })
    if (expError) console.error('Error inserting compliance renewal expense:', expError.message)
  }

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/expenses')
}

/**
 * Ensures the vehicle's current_km is strictly the absolute maximum of ALL
 * recorded kilometers across bookings and vehicle_handovers. Owner-scoped.
 */
export async function syncVehicleMaxOdometer(vehicleId: string) {
  const { supabase, user } = await getAuthedUser()

  // Verify vehicle ownership before any read or write. Also collapses the
  // previously separate "fetch current_km" round-trip into this guard.
  const { data: ownedVehicle } = await supabase
    .from('vehicles')
    .select('id, current_km')
    .eq('id', vehicleId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!ownedVehicle) throw new Error('Vehicle not found or not owned by user')

  // Fetch all legacy kilometers from bookings (owner-scoped)
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('starting_km, return_km')
    .eq('vehicle_id', vehicleId)
    .eq('owner_id', user.id)

  // Fetch all decoupled kilometers from handovers (scoped via the verified vehicle)
  const { data: handoversData } = await supabase
    .from('vehicle_handovers')
    .select('pickup_km, return_km')
    .eq('vehicle_id', vehicleId)

  let absoluteMax = 0

  if (bookingsData) {
    for (const b of bookingsData) {
      if (b.starting_km && b.starting_km > absoluteMax) absoluteMax = b.starting_km
      if (b.return_km && b.return_km > absoluteMax) absoluteMax = b.return_km
    }
  }

  if (handoversData) {
    for (const h of handoversData) {
      if (h.pickup_km && h.pickup_km > absoluteMax) absoluteMax = h.pickup_km
      if (h.return_km && h.return_km > absoluteMax) absoluteMax = h.return_km
    }
  }

  if (absoluteMax > (ownedVehicle.current_km || 0)) {
    const { error } = await supabase
      .from('vehicles')
      .update({ current_km: absoluteMax })
      .eq('id', vehicleId)
      .eq('owner_id', user.id)

    if (error) {
      console.error('Error in syncVehicleMaxOdometer:', error.message)
    }
  }
}

export async function updateManualMechanicalTarget(vehicleId: string, type: 'vidange' | 'pads', targetKm: number) {
  const { supabase, user } = await getAuthedUser()

  const updateField = type === 'vidange' ? 'next_vidange_km' : 'next_pads_km'
  const { error } = await supabase
    .from('vehicles')
    .update({ [updateField]: targetKm })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/fleet')
}

/**
 * Archive a withdrawn vehicle: sets archived_at to today's date (formatted as 'YYYY-MM-DD').
 */
export async function archiveVehicle(vehicleId: string) {
  const { supabase, user } = await getAuthedUser()
  
  // Format today's date in Africa/Tunis time zone
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const today = formatter.format(now)

  const { error } = await supabase
    .from('vehicles')
    .update({ archived_at: today })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/fleet')
}

/**
 * Unarchive an archived vehicle: clears archived_at (moves back to Retired).
 */
export async function unarchiveVehicle(vehicleId: string) {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('vehicles')
    .update({ archived_at: null })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/fleet')
}

export async function renewBulkInsurance(
  vehicleIds: string[],
  expiryDate: string,
  totalExpenseAmount: number | null
) {
  const { supabase, user } = await getAuthedUser()
  if (vehicleIds.length === 0) return

  // 1. Bulk upsert insurance legal documents
  const docsToUpsert = vehicleIds.map(vid => ({
    owner_id: user.id,
    vehicle_id: vid,
    doc_type: 'assurance',
    expiry_date: expiryDate,
    notes: `Bulk renewed on ${new Date().toLocaleDateString()}`
  }))

  const { error: upsertError } = await supabase
    .from('vehicle_legal_docs')
    .upsert(docsToUpsert, { onConflict: 'vehicle_id,doc_type' })

  if (upsertError) throw new Error(upsertError.message)

  // 2. Log single aggregate expense if amount is provided
  if (totalExpenseAmount !== null && totalExpenseAmount > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('license_plate')
      .in('id', vehicleIds)
      .eq('owner_id', user.id)

    const platesStr = vehicles?.map(v => v.license_plate).filter(Boolean).join(', ') || ''
    const description = `Bulk Insurance Renewal for ${vehicleIds.length} vehicles (${platesStr})`

    const { error: expError } = await supabase
      .from('expenses')
      .insert({
        owner_id: user.id,
        amount: totalExpenseAmount,
        category: 'insurance',
        description,
      })

    if (expError) console.error('Error logging bulk insurance expense:', expError.message)
  }

  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard')
}

