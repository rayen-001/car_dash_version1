'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
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
        
        // Convert File to Buffer for upload
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
  const oil_change_due_km = formData.get('oil_change_due_km') ? parseInt(formData.get('oil_change_due_km') as string) : null
  const brake_pad_state = (formData.get('brake_pad_state') as string) || null

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
      oil_change_due_km,
      brake_pad_state,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const brand = formData.get('brand') as string
  const model = formData.get('model') as string
  const year = parseInt(formData.get('year') as string)
  const price_per_day = parseFloat(formData.get('price_per_day') as string)
  const availability = formData.get('availability') === 'on' || formData.get('availability') === 'true'
  
  // Existing images kept
  const existingImagesJson = formData.get('existing_images') as string
  const keptImages: string[] = existingImagesJson ? JSON.parse(existingImagesJson) : []

  // Fetch current vehicle to delete removed images from storage
  const { data: currentCar } = await supabase
    .from('vehicles')
    .select('images')
    .eq('id', id)
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
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/fleet')
}

export async function deleteVehicle(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Fetch vehicle images to clean up storage
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


// --- BOOKING ACTIONS ---

export async function recalculateClientTrustScore(clientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Fetch all bookings for this client (excluding cancelled), joining installments
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, status, start_date, end_date, actual_return_date, total_amount, acompte_paid, client_behavior_status, installments:booking_installments(id, amount, due_date, status, paid_date)')
    .eq('client_id', clientId)
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error fetching bookings for trust score:', error.message)
    return
  }

  if (!bookings || bookings.length === 0) {
    // If no bookings exist, set trust_score to NULL (unproven client state)
    await supabase
      .from('clients')
      .update({ trust_score: null })
      .eq('id', clientId)
      .eq('owner_id', user.id)
    return
  }

  // Get local "today" string in YYYY-MM-DD format
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Helper to get day difference between two YYYY-MM-DD strings safely
  const getDaysDiff = (d1Str: string | null | undefined, d2Str: string | null | undefined): number => {
    if (!d1Str || !d2Str) return 0
    try {
      const parts1 = d1Str.split('T')[0].split('-')
      const parts2 = d2Str.split('T')[0].split('-')
      if (parts1.length < 3 || parts2.length < 3) return 0
      
      const d1 = new Date(Number(parts1[0]), Number(parts1[1]) - 1, Number(parts1[2]))
      const d2 = new Date(Number(parts2[0]), Number(parts2[1]) - 1, Number(parts2[2]))
      
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
      const diffTime = d2.getTime() - d1.getTime()
      return Math.round(diffTime / (1000 * 60 * 60 * 24))
    } catch {
      return 0
    }
  }

  let returnHygiene = 100
  let totalContractValue = 0
  let totalOverdueUnpaid = 0
  let hasCriminalOverride = false
  let behaviorPenalty = 0

  // Count completed bookings for loyalty bonus calculation
  const completedBookingsCount = bookings.filter(b => b.status === 'completed').length
  const loyaltyBonus = Math.min(20, completedBookingsCount * 2.5)

  bookings.forEach((b) => {
    const isCompleted = b.status === 'completed'
    const scheduledEnd = b.end_date
    const totalAmt = Number(b.total_amount) || 0
    const paidAmt = Number(b.acompte_paid) || 0
    const balance = totalAmt - paidAmt
    const installments = (b as any).installments || []
    const hasInstallments = Array.isArray(installments) && installments.length > 0

    // Exclude pending bookings completely
    if (b.status === 'pending') {
      return
    }

    // Accumulate total contract values
    totalContractValue += totalAmt

    // Calculate overdue unpaid amount for this booking
    if (hasInstallments) {
      installments.forEach((inst: any) => {
        const amt = Number(inst.amount) || 0
        if (inst.status === 'unpaid') {
          if (getDaysDiff(inst.due_date, todayStr) > 0) {
            // Overdue unpaid installment
            totalOverdueUnpaid += amt
          }
        }
      })
    } else {
      // Legacy bookings: overdue if confirmed and todayStr > scheduledEnd, or if completed
      const isConfirmed = b.status === 'confirmed'
      const isOverdue = isConfirmed && (getDaysDiff(scheduledEnd, todayStr) > 0)
      if ((isCompleted || isOverdue) && balance > 0) {
        totalOverdueUnpaid += balance
      }
    }

    // Evaluate return hygiene and overrides
    if (isCompleted) {
      const actualEnd = b.actual_return_date || scheduledEnd
      const lateDays = getDaysDiff(scheduledEnd, actualEnd)
      if (lateDays > 0) {
        returnHygiene -= Math.min(75, 4 * Math.pow(lateDays, 1.3))
      }
    } else if (b.status === 'confirmed') {
      // Ongoing Overdue booking (since todayStr > scheduledEnd)
      const overdueDays = getDaysDiff(scheduledEnd, todayStr)
      if (overdueDays > 0) {
        let hasUnpaidDebt = false
        if (hasInstallments) {
          hasUnpaidDebt = installments.some(
            (inst: any) => inst.status === 'unpaid' && getDaysDiff(inst.due_date, todayStr) > 0
          )
        } else {
          hasUnpaidDebt = balance > 0
        }

        if (overdueDays >= 5 && hasUnpaidDebt) {
          hasCriminalOverride = true
        } else {
          returnHygiene -= overdueDays * 8
        }
      }
    }

    // Apply Client Behavior Status penalties with linear time-decay (90-day window)
    if (b.client_behavior_status && typeof b.client_behavior_status === 'string') {
      const infractions = b.client_behavior_status.split(',').map((s: string) => s.trim()).filter(Boolean);
      
      infractions.forEach((infraction: string) => {
        let baseInfraction = 0
        let isPermanent = false

        if (infraction === 'dirty_return') {
          baseInfraction = 5
        } else if (infraction === 'speeding') {
          baseInfraction = 15
        } else if (infraction === 'minor_damage') {
          baseInfraction = 25
        } else if (infraction === 'major_damage') {
          baseInfraction = 100
          isPermanent = true
          hasCriminalOverride = true
        }

        if (baseInfraction > 0) {
          if (isPermanent) {
            behaviorPenalty += baseInfraction
          } else {
            const infractionDate = b.actual_return_date || b.end_date || todayStr
            const daysSince = Math.max(0, getDaysDiff(infractionDate, todayStr))
            const decayFactor = Math.max(0, 1 - daysSince / 90)
            behaviorPenalty += baseInfraction * decayFactor
          }
        }
      });
    }
  })

  // Clamp returnHygiene
  returnHygiene = Math.max(0, Math.min(100, returnHygiene))

  // Payment hygiene calculation
  const overdueDebtRatio = totalContractValue > 0 ? (totalOverdueUnpaid / totalContractValue) : 0
  const paymentHygiene = 100 - Math.min(100, overdueDebtRatio * 120)

  // Combine scores with new dynamic weights (40% return, 40% payment, plus loyalty)
  let trustScore = (0.40 * returnHygiene) + (0.40 * paymentHygiene) - behaviorPenalty + loyaltyBonus

  // Apply criminal override
  if (hasCriminalOverride) {
    trustScore = 0
  }

  // Round to 1 decimal place and clamp between 0 and 100
  trustScore = Math.max(0, Math.min(100, Math.round(trustScore * 10) / 10))

  await supabase
    .from('clients')
    .update({ trust_score: trustScore })
    .eq('id', clientId)
    .eq('owner_id', user.id)
}

export async function addBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const vehicle_id = formData.get('vehicle_id') as string
  const client_id_raw = formData.get('client_id') as string || null
  const client_name = formData.get('client_name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const status = formData.get('status') as string || 'confirmed'
  
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

  // Ensure manual client names are related/created in the CRM immediately
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

  // If we have a client_id and the snapshot values are empty, fetch and fallback to the CRM defaults
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

  // Validate dates overlap cleanly
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
    client_name,
    start_date,
    end_date,
    status,
    total_amount,
    payment_status: status === 'confirmed' ? 'paid' : 'unpaid',
    fuel_level_pickup,
    fuel_level_return: null,
    starting_mileage: starting_km,
    starting_km,
    return_mileage: null,
    return_km: null,
    lavage_pickup,
    lavage_return: null,
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

  if (installmentsInput.length > 0 && newBooking) {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
}

export async function updateBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const vehicle_id = formData.get('vehicle_id') as string
  const client_id_raw = formData.get('client_id') as string || null
  const client_name = formData.get('client_name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const status = formData.get('status') as string || 'confirmed'

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

  // If we have a client_id and the snapshot values are empty, fetch and fallback to the CRM defaults
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

  // Validate dates overlap cleanly, ignoring this current booking
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
    .single()

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const actual_return_date = status === 'completed' ? (existingBooking?.actual_return_date || todayStr) : null

  const { error } = await supabase
    .from('bookings')
    .update({
      vehicle_id,
      client_id,
      client_name,
      start_date,
      end_date,
      status,
      total_amount,
      fuel_level_pickup,
      starting_mileage: starting_km,
      starting_km,
      lavage_pickup,
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

  // Handle installments sync: delete old ones and insert new ones
  const installmentsJson = formData.get('installments') as string
  const installmentsInput: { amount: number; due_date: string; status: 'paid' | 'unpaid' }[] = installmentsJson
    ? JSON.parse(installmentsJson)
    : []

  // Delete all existing installments for this booking
  await supabase
    .from('booking_installments')
    .delete()
    .eq('booking_id', id)

  // Insert the new list of installments
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

  revalidatePath('/dashboard/bookings')
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, actual_return_date')
    .eq('id', id)
    .single()

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard')
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

export async function updateExpense(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const amount = parseFloat(formData.get('amount') as string)
  const vehicle_id = formData.get('vehicle_id') as string

  const { error } = await supabase
    .from('expenses')
    .update({ category, description, amount, vehicle_id: vehicle_id || null })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/expenses')
}

export async function updateMaintenance(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('maintenance')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/maintenance')
}

// --- ADMIN ACTIONS ---

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

export async function getBusinessSettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching settings:', error.message)
  }

  return data || {
    business_name: '',
    logo_url: '',
    phone: '',
    address: '',
    currency: 'DT',
    rental_terms: ''
  }
}

export async function saveBusinessSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const business_name = formData.get('business_name') as string
  let logo_url = formData.get('logo_url') as string
  const logoFile = formData.get('logo_file') as File | null

  if (logoFile && logoFile.size > 0 && logoFile.name) {
    const adminClient = createAdminClient()
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`
    
    // Convert File to Buffer for upload
    const bytes = await logoFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const { error: uploadError } = await adminClient.storage
      .from('vehicle-images')
      .upload(filePath, buffer, {
        contentType: logoFile.type,
        upsert: true
      })
      
    if (uploadError) {
      console.error('Logo upload error:', uploadError.message)
      throw new Error('Logo upload failed: ' + uploadError.message)
    } else {
      const { data: { publicUrl } } = adminClient.storage
        .from('vehicle-images')
        .getPublicUrl(filePath)
      logo_url = publicUrl
    }
  }

  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const currency = 'DT' // Force standard local market currency (Tunisian Dinar)
  const rental_terms = formData.get('rental_terms') as string

  const { data: existing } = await supabase
    .from('business_settings')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  let error;
  if (existing) {
    const res = await supabase
      .from('business_settings')
      .update({
        business_name,
        logo_url,
        phone,
        address,
        currency,
        rental_terms
      })
      .eq('owner_id', user.id)
    error = res.error
  } else {
    const res = await supabase
      .from('business_settings')
      .insert({
        owner_id: user.id,
        business_name,
        logo_url,
        phone,
        address,
        currency,
        rental_terms
      })
    error = res.error
  }

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/bookings')
}

// --- CLIENT ACTIONS ---

export async function getClients() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addClient(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const full_name = formData.get('full_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const license_number = formData.get('license_number') as string

  const { error } = await supabase.from('clients').insert({
    owner_id: user.id,
    full_name,
    email: email || null,
    phone,
    license_number: license_number || null
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
}

export async function updateClient(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const full_name = formData.get('full_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const license_number = formData.get('license_number') as string

  const { error } = await supabase
    .from('clients')
    .update({
      full_name,
      email: email || null,
      phone,
      license_number: license_number || null,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
}

export async function deleteClient(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
}

export async function syncAndRelateClients() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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

    // If booking doesn't have a linked client_id, check if client already exists
    if (!linkedClientId) {
      if (clientMap.has(normNameLower)) {
        linkedClientId = clientMap.get(normNameLower)!
        // Update booking's client_id in DB
        await supabase
          .from('bookings')
          .update({ client_id: linkedClientId })
          .eq('id', booking.id)
          .eq('owner_id', user.id)
      } else {
        // Create the client in the database dynamically!
        const { data: newClient, error: createErr } = await supabase
          .from('clients')
          .insert({
            owner_id: user.id,
            full_name: normName,
            phone: 'N/A', // default placeholder
            email: null,
            license_number: 'N/A'
          })
          .select('id')
          .single()

        if (!createErr && newClient) {
          linkedClientId = newClient.id
          clientMap.set(normNameLower, linkedClientId)
          
          // Update booking's client_id in DB
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

// --- VEHICLE 360° HISTORY HUB ACTIONS ---

export async function updateVehicleMechanicalState(
  vehicleId: string,
  currentKm: number | null,
  oilChangeDueKm: number | null,
  brakePadState: 'good' | 'worn' | 'critical' | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('vehicles')
    .update({
      current_km: currentKm,
      oil_change_due_km: oilChangeDueKm,
      brake_pad_state: brakePadState,
    })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
}

export async function upsertVehicleLegalDoc(
  vehicleId: string,
  docType: 'assurance' | 'visite_technique' | 'laissez_passer',
  expiryDate: string,
  notes: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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
  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
}

export async function renewVehicleDocument(
  vehicleId: string,
  docType: 'assurance' | 'visite_technique' | 'laissez_passer',
  calculatedExpiryDate: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard/fleet')
  revalidatePath('/dashboard')
}

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
    
    // New dynamic billing inputs
    amount_collected_now?: number
    incident_penalties?: number
    total_amount?: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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

  // Fetch client_id and status to update trust score & actual_return_date
  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, status, actual_return_date, total_amount, acompte_paid')
    .eq('id', bookingId)
    .single()

  if (updates.status !== undefined) {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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

  // Sequential Installment Clearing Algorithm
  const amountCollected = Number(updates.amount_collected_now) || 0
  if (amountCollected > 0) {
    const { data: installments, error: instFetchError } = await supabase
      .from('booking_installments')
      .select('id, amount, status')
      .eq('booking_id', bookingId)
      .order('due_date', { ascending: true })

    if (instFetchError) {
      console.error('Error fetching installments for allocation:', instFetchError.message)
    } else if (installments && installments.length > 0) {
      let remainingCash = amountCollected
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      for (const inst of installments) {
        if (remainingCash <= 0) break

        if (inst.status === 'paid') {
          continue
        }

        const instAmt = Number(inst.amount) || 0
        if (remainingCash >= instAmt) {
          // Fully satisfy this tranche
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
          // Partially satisfy this tranche: deduct amount, leave unpaid
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
            remainingCash = 0
          }
        }
      }
    }
  }

  if (booking && booking.client_id) {
    await recalculateClientTrustScore(booking.client_id)
  }

  revalidatePath(`/dashboard/vehicles/${vehicleId}/history`)
  revalidatePath('/dashboard')
}

