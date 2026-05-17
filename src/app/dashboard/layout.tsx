'use client'

import { useState } from 'react'
import { CarFront, CalendarClock, CircleDollarSign, Wrench, BarChart3, User, LogOut, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: 'Analytics', href: '/dashboard', icon: BarChart3 },
    { name: 'My Fleet', href: '/dashboard/fleet', icon: CarFront },
    { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarClock },
    { name: 'Expenses', href: '/dashboard/expenses', icon: CircleDollarSign },
    { name: 'Maintenance', href: '/dashboard/maintenance', icon: Wrench },
    { name: 'Profile', href: '/dashboard/profile', icon: User },
  ]

  return (
    <div className="layout-container">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="brand">
            <span className="brand-accent">Owner</span>Dash
          </h2>
          <button 
            className="mobile-close-btn" 
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close Menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar glass-panel">
          <div className="topbar-left">
            <button 
              className="menu-toggle-btn" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Menu"
            >
              <Menu size={24} />
            </button>
            <div className="topbar-info">
              <span className="status-indicator"></span>
              <span>Live Data Sync</span>
            </div>
          </div>
          <div className="topbar-profile">
            <div className="avatar">O</div>
            <span>My Account</span>
          </div>
        </header>

        <div className="content-area animate-fade-in">
          {children}
        </div>
      </main>

      <style jsx>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
          position: relative;
        }

        .sidebar {
          width: 280px;
          height: calc(100vh - 2rem);
          margin: 1rem;
          position: sticky;
          top: 1rem;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-xl);
          background:
            linear-gradient(165deg, rgba(34, 28, 24, 0.85) 0%, rgba(13, 11, 10, 0.92) 100%);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          border: 1px solid var(--border-color);
          box-shadow:
            inset 0 1px 0 rgba(255, 240, 200, 0.06),
            var(--shadow-lg);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
          z-index: 100;
          overflow: hidden;
        }

        .sidebar::before {
          content: '';
          position: absolute;
          top: 0; left: 15%; right: 15%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent-gold), transparent);
          opacity: 0.5;
        }

        .sidebar::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(212, 180, 106, 0.08), transparent 60%);
          pointer-events: none;
        }

        .sidebar-header {
          padding: 2.25rem 2rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .mobile-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.5rem;
        }

        .brand {
          font-family: var(--font-heading);
          font-size: 1.6rem;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          font-style: italic;
        }

        .brand-accent {
          background: linear-gradient(135deg, var(--accent-gold-hover), var(--accent-gold-deep));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          font-style: normal;
          font-weight: 600;
        }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 1rem;
          position: relative;
          z-index: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.95rem 1.1rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.92rem;
          font-weight: 500;
          letter-spacing: 0.2px;
          border: 1px solid transparent;
          transition: var(--transition);
          position: relative;
        }

        .nav-item:hover {
          background: linear-gradient(135deg, rgba(212, 180, 106, 0.08), rgba(212, 180, 106, 0.02));
          color: var(--text-primary);
          border-color: rgba(212, 180, 106, 0.12);
          transform: translateX(2px);
        }

        .nav-item.active {
          background: linear-gradient(135deg, rgba(212, 180, 106, 0.18) 0%, rgba(212, 180, 106, 0.04) 100%);
          color: var(--accent-gold);
          border-color: rgba(212, 180, 106, 0.35);
          box-shadow:
            inset 0 1px 0 rgba(255, 240, 200, 0.1),
            0 4px 16px -4px rgba(212, 180, 106, 0.25);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 20%;
          bottom: 20%;
          width: 3px;
          background: linear-gradient(180deg, var(--accent-gold-hover), var(--accent-gold));
          border-radius: 0 var(--radius-full) var(--radius-full) 0;
          box-shadow: 0 0 12px var(--accent-gold-glow);
        }

        .sidebar-footer {
          padding: 1rem;
          border-top: 1px solid var(--border-color);
          position: relative;
          z-index: 1;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.95rem 1.1rem;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          font-family: var(--font-body);
          font-size: 0.92rem;
          font-weight: 500;
          border-radius: var(--radius-md);
        }

        .logout-btn:hover {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.02));
          border-color: rgba(239, 68, 68, 0.25);
          color: var(--danger);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1rem 1.5rem 1rem 0;
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 2rem;
          margin-bottom: 1.5rem;
          background: linear-gradient(155deg, rgba(34, 28, 24, 0.6), rgba(13, 11, 10, 0.7));
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-toggle-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: var(--radius-md);
          transition: var(--transition);
        }

        .menu-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .topbar-info {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          color: var(--text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          background: var(--success);
          border-radius: 50%;
          box-shadow: 0 0 14px var(--success), inset 0 0 4px rgba(255, 255, 255, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.9); }
        }

        .topbar-profile {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-gold-deep), var(--bg-tertiary));
          border: 1px solid var(--accent-gold);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-family: var(--font-heading);
          font-size: 1.1rem;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 6px 16px rgba(212, 180, 106, 0.3);
        }

        .content-area {
          flex: 1;
          padding-right: 0.5rem;
        }

        @media (max-width: 992px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            margin: 0;
            height: 100vh;
            border-radius: 0;
            transform: translateX(-100%);
            opacity: 0;
            z-index: 1000;
          }

          .sidebar.open {
            transform: translateX(0);
            opacity: 1;
          }

          .mobile-close-btn { display: block; }

          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(8, 6, 5, 0.7);
            backdrop-filter: blur(8px);
            z-index: 999;
          }

          .main-content {
            padding: 1rem;
          }

          .menu-toggle-btn { display: block; }
        }
      `}</style>
    </div>
  )
}
