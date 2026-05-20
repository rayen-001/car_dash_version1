'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, Mail, ShieldAlert, CheckCircle2, Lock, Building, Phone, MapPin, Loader2 } from 'lucide-react'
import styles from './profile.module.css'

export default function BusinessProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  // State variables
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch current user and profile details
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        setEmail(user.email || '')
        
        // Fetch optional address from user metadata if it exists
        if (user.user_metadata?.address) {
          setAddress(user.user_metadata.address)
        }

        // Fetch other fields from profiles table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone, company_name')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error.message)
        } else if (profile) {
          setFullName(profile.full_name || '')
          setPhone(profile.phone || '')
          setCompanyName(profile.company_name || '')
        }
      } catch (err) {
        console.error('Unexpected error loading profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [supabase, router])

  // Update profile handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // 1. Update fields in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          company_name: companyName
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Update address in auth user metadata and email if updated
      const authUpdates: any = {
        data: { ...user.user_metadata, address: address }
      }

      if (user.email !== email) {
        authUpdates.email = email
      }

      const { error: authError } = await supabase.auth.updateUser(authUpdates)
      if (authError) throw authError

      if (user.email !== email) {
        setMessage({ type: 'success', text: 'Business profile updated successfully! Please check your new email address to verify the changes.' })
      } else {
        setMessage({ type: 'success', text: 'Business profile updated successfully!' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  // Change password handler
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

  if (profileLoading) {
    return (
      <div className={styles['loading-container']}>
        <Loader2 className={styles['spinner']} size={40} />
        <p>Loading Business Profile...</p>
      </div>
    )
  }

  return (
    <div className={styles['dashboard-page']}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>🚗 Owner Profile</h1>
        <p className={styles['subtitle']}>Manage your business profile details and dashboard access settings.</p>
      </div>

      {message && (
        <div className={`${styles['status-banner']} ${styles[message.type]}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={styles['content-grid']}>
        {/* Profile Info Form */}
        <div className={`${styles['glass-panel']} ${styles['form-panel']}`}>
          <div className={styles['panel-header-row']}>
            <h3 className={styles['section-subtitle']}>Business details</h3>
            <span className={styles['badge-owner']}>Fleet Owner</span>
          </div>

          <form onSubmit={handleUpdateProfile} className={styles['profile-form']}>
            <div className={styles['form-group']}>
              <label>
                <Building size={14} className={styles['input-icon']} />
                <span>Company Name</span>
              </label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required 
                placeholder="Your Company Name" 
                className={styles['form-input']} 
              />
            </div>

            <div className={styles['form-group']}>
              <label>
                <User size={14} className={styles['input-icon']} />
                <span>Owner Full Name</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required 
                placeholder="Full Name" 
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
                placeholder="owner@example.com" 
                className={styles['form-input']} 
              />
            </div>

            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label>
                  <Phone size={14} className={styles['input-icon']} />
                  <span>Phone Number</span>
                </label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required 
                  placeholder="e.g. +123456789" 
                  className={styles['form-input']} 
                />
              </div>

              <div className={styles['form-group']}>
                <label>
                  <MapPin size={14} className={styles['input-icon']} />
                  <span>Address <span className={styles['optional']}>(optional)</span></span>
                </label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Country" 
                  className={styles['form-input']} 
                />
              </div>
            </div>

            <button type="submit" className={styles['btn-gold']} disabled={loading}>
              {loading ? 'Saving details...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Security Password Form */}
        <div className={`${styles['glass-panel']} ${styles['form-panel']}`}>
          <h3 className={styles['section-subtitle']}>Access Security</h3>
          <p className={styles['form-help-text']}>Change your password below to update your login credentials.</p>

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
                placeholder="Confirm new password" 
                className={styles['form-input']} 
              />
            </div>

            <button type="submit" className={styles['btn-gold-outline']} disabled={loading}>
              {loading ? 'Updating Password...' : 'Change Access Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}