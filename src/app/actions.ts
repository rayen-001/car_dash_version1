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

  const { error } = await supabase.from('vehicles').insert({
    owner_id: user.id,
    brand,
    model,
    year,
    price_per_day,
    availability,
    images: imageUrls,
    license_plate: (formData.get('license_plate') as string) || null,
    color: (formData.get('color') as string) || null,
  })

  if (error) throw new Error(error.message)
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
  const fuel_level_pickup = formData.get('fuel_level_pickup') as string || 'Full'
  const fuel_level_return = formData.get('fuel_level_return') as string || 'Full'
  const starting_mileage = parseInt(formData.get('starting_mileage') as string) || 0
  const return_mileage = parseInt(formData.get('return_mileage') as string) || 0

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

  const { error } = await supabase.from('bookings').insert({
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
    fuel_level_return,
    starting_mileage,
    return_mileage,
    deposit_amount,
    deposit_type,
    deposit_status,
    client_phone,
    client_license_number,
    client_cin_passport,
    client_address,
    pickup_time,
    return_time
  })

  if (error) throw new Error(error.message)
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
  const fuel_level_pickup = formData.get('fuel_level_pickup') as string || 'Full'
  const fuel_level_return = formData.get('fuel_level_return') as string || 'Full'
  const starting_mileage = parseInt(formData.get('starting_mileage') as string) || 0
  const return_mileage = parseInt(formData.get('return_mileage') as string) || 0

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
      fuel_level_return,
      starting_mileage,
      return_mileage,
      deposit_amount,
      deposit_type,
      deposit_status,
      client_phone,
      client_license_number,
      client_cin_passport,
      client_address,
      pickup_time,
      return_time
    })
    .eq('id', id)
    .eq('owner_id', user.id)

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
      license_number: license_number || null
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/clients')
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

