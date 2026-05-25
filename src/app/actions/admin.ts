'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAuthedAdmin } from './_shared'

export async function addOwner(formData: FormData) {
  await getAuthedAdmin()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const full_name = formData.get('full_name') as string
  const company_name = formData.get('company_name') as string

  const adminClient = createAdminClient()

  // Create auth user — role is stamped into user_metadata so the middleware
  // can read it from the JWT without a profiles round-trip.
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
  await getAuthedAdmin()

  const adminClient = createAdminClient()

  // Deleting the auth user cascades to their profile and owned rows.
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/owners')
}
