'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, Mail, ShieldAlert, LogOut, Loader2, CheckCircle2, Lock } from 'lucide-react'
import styles from './settings.module.css'

export default function PlatformSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  // State variables
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch current user and profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        setEmail(user.email || '')

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error.message)
        } else if (profile) {
          setFullName(profile.full_name || '')
        }
      } catch (err) {
        console.error('Unexpected error loading profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [supabase, router])

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update full_name in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update email in Auth if it has changed
      if (user.email !== email) {
        const { error: authError } = await supabase.auth.updateUser({ email })
        if (authError) throw authError
        setMessage({ type: 'success', text: 'Profile updated successfully! A verification email has been sent to your new address.' })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setPassword('')
      setConfirmPassword('')
      setMessage({ type: 'success', text: 'Password updated successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to change password' })
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (profileLoading) {
    return (
      <div className={styles['loading-container']}>
        <Loader2 className={styles['spinner']} size={40} />
        <p>Loading Admin Profile...</p>
      </div>
    )
  }

  return (
    <div className={styles['dashboard-page']}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>👑 Super Admin Profile</h1>
        <p className={styles['subtitle']}>Manage your credentials and security settings.</p>
      </div>

      {message && (
        <div className={`${styles['status-banner']} ${styles[message.type]}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={styles['content-grid']}>
        {/* Profile Info Panel */}
        <div className={`${styles['glass-panel']} ${styles['form-panel']}`}>
          <div className={styles['panel-header-row']}>
            <h3 className={styles['section-subtitle']}>Account Details</h3>
            <span className={styles['badge-admin']}>Platform Admin</span>
          </div>

          <form onSubmit={handleUpdateProfile} className={styles['profile-form']}>
            <div className={styles['form-group']}>
              <label>
                <User size={14} className={styles['input-icon']} />
                <span>Full Name</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required 
                placeholder="Admin Full Name" 
                className={styles['form-input']} 
              />
            </div>

            <div className={styles['form-group']}>
              <label>
                <Mail size={14} className={styles['input-icon']} />
                <span>Email Address</span>
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                placeholder="admin@automanage.com" 
                className={styles['form-input']} 
              />
            </div>

            <button type="submit" className={styles['btn-gold']} disabled={loading}>
              {loading ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Security & Settings Panel */}
        <div className={`${styles['glass-panel']} ${styles['form-panel']}`}>
          <h3 className={styles['section-subtitle']}>Security Settings</h3>
          
          <form onSubmit={handleChangePassword} className={styles['profile-form']}>
            <div className={styles['form-group']}>
              <label>
                <Lock size={14} className={styles['input-icon']} />
                <span>New Password</span>
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="Min. 6 characters" 
                className={styles['form-input']} 
              />
            </div>

            <div className={styles['form-group']}>
              <label>
                <Lock size={14} className={styles['input-icon']} />
                <span>Confirm New Password</span>
              </label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                placeholder="Confirm password" 
                className={styles['form-input']} 
              />
            </div>

            <button type="submit" className={styles['btn-gold-outline']} disabled={loading}>
              {loading ? 'Updating Password...' : 'Change Password'}
            </button>
          </form>

          <div className={styles['logout-divider']}></div>

          <button onClick={handleLogout} className={styles['btn-logout-danger']}>
            <LogOut size={16} />
            <span>Sign Out of Platform</span>
          </button>
        </div>
      </div>
    </div>
  )
}