'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAuthedUser } from './_shared'

export async function getBusinessSettings() {
  const { supabase, user } = await getAuthedUser()

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
  const { supabase, user } = await getAuthedUser()

  const business_name = formData.get('business_name') as string
  let logo_url = formData.get('logo_url') as string
  const logoFile = formData.get('logo_file') as File | null

  if (logoFile && logoFile.size > 0 && logoFile.name) {
    const adminClient = createAdminClient()
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

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

  // Tunisian legal & tax information
  const matricule_fiscal = formData.get('matricule_fiscal') as string
  const rne_number = formData.get('rne_number') as string
  const owner_full_name = formData.get('owner_full_name') as string
  const email = formData.get('email') as string
  const city = formData.get('city') as string
  const contract_language = (formData.get('contract_language') as string) || 'fr'
  const tva_number = formData.get('tva_number') as string
  const tva_rate = parseFloat(formData.get('tva_rate') as string) || 0.00

  const { data: existing } = await supabase
    .from('business_settings')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  let error
  if (existing) {
    const res = await supabase
      .from('business_settings')
      .update({
        business_name,
        logo_url,
        phone,
        address,
        currency,
        rental_terms,
        matricule_fiscal,
        rne_number,
        owner_full_name,
        email,
        city,
        contract_language,
        tva_number,
        tva_rate
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
        rental_terms,
        matricule_fiscal,
        rne_number,
        owner_full_name,
        email,
        city,
        contract_language,
        tva_number,
        tva_rate
      })
    error = res.error
  }

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/bookings')
}
