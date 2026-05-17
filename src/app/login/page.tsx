'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Car, Lock, Mail } from 'lucide-react'
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
    <div className="login-container">
      <div className="login-glass animate-fade-in">
        <div className="logo-container">
          <Car size={48} className="logo-icon" />
          <h1>AutoManage</h1>
          <p>Premium Fleet Control</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input
              type="email"
              placeholder="Email address"
              className="input-field with-icon"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              placeholder="Password"
              className="input-field with-icon"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .login-glass {
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-color);
          padding: 3rem;
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
        }

        .login-glass::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent-gold), #FFF8DC, var(--accent-gold));
        }

        .logo-container {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .logo-icon {
          color: var(--accent-gold);
          margin-bottom: 1rem;
          filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.4));
        }

        .logo-container h1 {
          font-size: 2rem;
          margin-bottom: 0.25rem;
          background: linear-gradient(to right, #fff, var(--accent-gold));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .logo-container p {
          color: var(--text-muted);
          font-size: 0.9rem;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .input-group {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          transition: var(--transition);
        }

        .input-group:focus-within .input-icon {
          color: var(--accent-gold);
        }

        .with-icon {
          padding-left: 3rem !important;
        }

        .login-btn {
          margin-top: 1rem;
          height: 3rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .error-message {
          background: rgba(229, 62, 62, 0.1);
          color: #FC8181;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid rgba(229, 62, 62, 0.2);
          font-size: 0.9rem;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
