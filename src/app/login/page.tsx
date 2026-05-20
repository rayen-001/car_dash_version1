'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Car, Lock, Mail } from 'lucide-react'
import styles from './login.module.css'
import '@/app/globals.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Middleware will handle redirection, but we can push to '/' to trigger it
    router.push('/')
    router.refresh()
  }

  return (
    <div className={styles['login-container']}>
      <div className={`${styles['login-glass']} animate-fade-in`}>
        <div className={styles['logo-container']}>
          <Car size={48} className={styles['logo-icon']} />
          <h1>AutoManage</h1>
          <p>Premium Fleet Control</p>
        </div>

        <form onSubmit={handleLogin} className={styles['login-form']}>
          {error && <div className={styles['error-message']}>{error}</div>}
          
          <div className={styles['input-group']}>
            <Mail className={styles['input-icon']} size={20} />
            <input
              type="email"
              placeholder="Email address"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles['input-group']}>
            <Lock className={styles['input-icon']} size={20} />
            <input
              type="password"
              placeholder="Password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={`btn btn-primary ${styles['login-btn']}`} disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
