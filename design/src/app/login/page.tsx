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
          padding: 1.5rem;
          position: relative;
        }

        .login-glass {
          background: linear-gradient(180deg, rgba(24, 20, 16, 0.92), rgba(14, 12, 10, 0.95));
          backdrop-filter: blur(28px) saturate(140%);
          -webkit-backdrop-filter: blur(28px) saturate(140%);
          border: 1px solid var(--border-color);
          padding: 2.75rem 2.25rem;
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 420px;
          box-shadow: var(--shadow-xl);
          position: relative;
          transition: var(--transition);
        }
        .login-glass:hover { border-color: var(--border-strong); }

        .logo-container {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-icon {
          color: var(--accent-gold-hover);
          margin-bottom: 1rem;
          width: 44px; height: 44px;
          padding: 10px;
          border-radius: var(--radius-md);
          background: var(--accent-gold-soft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .logo-container h1 {
          font-family: var(--font-heading);
          font-size: 1.75rem;
          font-weight: 500;
          letter-spacing: -0.025em;
          margin-bottom: 0.35rem;
          color: var(--text-primary);
        }

        .logo-container p {
          color: var(--text-muted);
          font-size: 0.78rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-family: var(--font-body);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .input-group { position: relative; }

        .input-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          transition: var(--transition-fast);
          z-index: 1;
          pointer-events: none;
        }

        .input-group:focus-within .input-icon { color: var(--accent-gold-hover); }

        .with-icon {
          padding-left: 2.5rem !important;
        }

        .login-btn {
          margin-top: 0.75rem;
          height: 2.75rem;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          border-radius: var(--radius-md);
          background: linear-gradient(180deg, var(--accent-gold-hover) 0%, var(--accent-gold) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: #14110d !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.35),
            0 4px 14px -4px rgba(212, 180, 106, 0.35) !important;
          transition: var(--transition-fast) !important;
          cursor: pointer;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.45),
            0 8px 22px -6px rgba(212, 180, 106, 0.55) !important;
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .error-message {
          background: var(--danger-soft);
          color: var(--danger);
          padding: 0.7rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid rgba(248, 113, 113, 0.25);
          font-size: 0.82rem;
          font-family: var(--font-body);
          text-align: center;
        }
      `}</style>
    </div>
  )
}
