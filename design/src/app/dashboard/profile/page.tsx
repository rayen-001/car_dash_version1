'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, Mail, ShieldAlert, CheckCircle2, Lock, Building, Phone, MapPin, Loader2 } from 'lucide-react'

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
      <div className="loading-container">
        <Loader2 className="spinner" size={40} />
        <p>Loading Business Profile...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 60vh;
            color: var(--accent-gold);
            gap: 1rem;
          }
          .spinner {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <h1 className='page-title'>🚗 Owner Profile</h1>
        <p className='subtitle'>Manage your business profile details and dashboard access settings.</p>
      </div>

      {message && (
        <div className={`status-banner ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className='content-grid'>
        {/* Profile Info Form */}
        <div className='glass-panel form-panel'>
          <div className="panel-header-row">
            <h3 className="section-subtitle">Business details</h3>
            <span className="badge-owner">Fleet Owner</span>
          </div>

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-group">
              <label>
                <Building size={14} className="input-icon" />
                <span>Company Name</span>
              </label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required 
                placeholder="Your Company Name" 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>
                <User size={14} className="input-icon" />
                <span>Owner Full Name</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required 
                placeholder="Full Name" 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>
                <Mail size={14} className="input-icon" />
                <span>Email Address</span>
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                placeholder="owner@example.com" 
                className="form-input" 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  <Phone size={14} className="input-icon" />
                  <span>Phone Number</span>
                </label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required 
                  placeholder="e.g. +123456789" 
                  className="form-input" 
                />
              </div>

              <div className="form-group">
                <label>
                  <MapPin size={14} className="input-icon" />
                  <span>Address <span className="optional">(optional)</span></span>
                </label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Country" 
                  className="form-input" 
                />
              </div>
            </div>

            <button type="submit" className="btn-gold" disabled={loading}>
              {loading ? 'Saving details...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Security Password Form */}
        <div className='glass-panel form-panel'>
          <h3 className="section-subtitle">Access Security</h3>
          <p className="form-help-text">Change your password below to update your login credentials.</p>

          <form onSubmit={handleChangePassword} className="profile-form">
            <div className="form-group">
              <label>
                <Lock size={14} className="input-icon" />
                <span>New Password</span>
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="Min. 6 characters" 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>
                <Lock size={14} className="input-icon" />
                <span>Confirm New Password</span>
              </label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                placeholder="Confirm new password" 
                className="form-input" 
              />
            </div>

            <button type="submit" className="btn-gold-outline" disabled={loading}>
              {loading ? 'Updating Password...' : 'Change Access Password'}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        .dashboard-page { 
          display: flex; 
          flex-direction: column; 
          gap: 2rem; 
          height: 100%; 
        }
        .header-section { 
          margin-bottom: 0.5rem; 
        }
        .page-title { 
          font-size: 2rem; 
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #fff 0%, var(--accent-gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle { 
          color: var(--text-muted); 
        }
        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
        }
        .form-panel {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          border: 1px solid rgba(212, 175, 55, 0.1) !important;
        }
        .panel-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .section-subtitle {
          font-size: 1.25rem;
          color: #fff;
          font-weight: 600;
        }
        .badge-owner {
          font-size: 0.75rem;
          padding: 0.25rem 0.6rem;
          background: rgba(212, 175, 55, 0.1);
          color: var(--accent-gold);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 9999px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
        .form-group label {
          color: var(--text-muted);
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .optional {
          font-size: 0.75rem;
          opacity: 0.6;
        }
        .input-icon {
          color: var(--accent-gold);
          opacity: 0.8;
        }
        .form-input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: #fff;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--accent-gold);
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.2);
        }
        .btn-gold {
          background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
          color: #000;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          padding: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.25);
        }
        .btn-gold:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(212, 175, 55, 0.4);
        }
        .btn-gold:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-gold-outline {
          background: transparent;
          border: 1px solid var(--accent-gold);
          color: var(--accent-gold);
          font-weight: 600;
          border-radius: 8px;
          padding: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-gold-outline:hover:not(:disabled) {
          background: rgba(212, 175, 55, 0.1);
          transform: translateY(-1px);
        }
        .btn-gold-outline:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .form-help-text {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .status-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-radius: 8px;
          font-size: 0.95rem;
          animation: slideDown 0.3s ease-out;
        }
        .status-banner.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #10b981;
        }
        .status-banner.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #ef4444;
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}