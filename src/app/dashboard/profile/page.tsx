import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'
import styles from './profile.module.css'

export default async function BusinessProfilePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, company_name')
    .eq('id', user.id)
    .maybeSingle()

  const initialData = {
    email: user.email || '',
    address: user.user_metadata?.address || '',
    fullName: profile?.full_name || '',
    phone: profile?.phone || '',
    companyName: profile?.company_name || ''
  }

  return (
    <div className={styles['dashboard-page']}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>🚗 Owner Profile</h1>
        <p className={styles['subtitle']}>Manage your business profile details and dashboard access settings.</p>
      </div>

      <ProfileForm initialData={initialData} />
    </div>
  )
}
