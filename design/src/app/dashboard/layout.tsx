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
          position: relative;
        }

        .sidebar {
          width: 248px;
          height: calc(100vh - 1.5rem);
          margin: 0.75rem;
          position: sticky;
          top: 0.75rem;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-xl);
          background: linear-gradient(180deg, rgba(20, 17, 14, 0.92), rgba(14, 12, 10, 0.95));
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-md);
          transition: transform 0.35s var(--ease), opacity 0.25s ease;
          z-index: 100;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 1.5rem 1.25rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mobile-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: var(--radius-sm);
        }
        .mobile-close-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }

        .brand {
          font-family: var(--font-heading);
          font-size: 1.25rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
        .brand::before {
          content: '';
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: linear-gradient(135deg, var(--accent-gold-hover), var(--accent-gold-deep));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px -4px var(--accent-gold-glow);
        }
        .brand-accent { color: var(--accent-gold); font-style: normal; font-weight: 600; }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.5rem 0.6rem;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.6rem 0.75rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          transition: var(--transition-fast);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          position: relative;
        }
        .nav-item :global(svg) {
          width: 18px; height: 18px;
          color: var(--text-muted);
          transition: var(--transition-fast);
          flex-shrink: 0;
        }
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
        }
        .nav-item:hover :global(svg) { color: var(--accent-gold-hover); }

        .nav-item.active {
          background: var(--accent-gold-soft);
          color: var(--accent-gold-hover);
          font-weight: 600;
        }
        .nav-item.active :global(svg) { color: var(--accent-gold-hover); }
        .nav-item.active::before {
          content: '';
          position: absolute;
          left: -0.6rem;
          top: 22%;
          bottom: 22%;
          width: 2px;
          background: var(--accent-gold);
          border-radius: 0 2px 2px 0;
        }

        .sidebar-footer {
          padding: 0.75rem 0.6rem;
          border-top: 1px solid var(--border-color);
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.6rem 0.75rem;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-fast);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: var(--radius-md);
        }
        .logout-btn :global(svg) { width: 18px; height: 18px; color: var(--text-muted); }
        .logout-btn:hover {
          background: var(--danger-soft);
          color: var(--danger);
        }
        .logout-btn:hover :global(svg) { color: var(--danger); }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0.75rem 1rem 1rem 0;
          min-width: 0;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.25rem;
          margin-bottom: 1.25rem;
          background: var(--bg-glass);
          backdrop-filter: blur(20px) saturate(140%);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xs);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .menu-toggle-btn {
          display: none;
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.45rem;
          border-radius: var(--radius-sm);
          transition: var(--transition-fast);
        }
        .menu-toggle-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--text-primary); }

        .topbar-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 500;
        }

        .status-indicator {
          width: 7px;
          height: 7px;
          background: var(--success);
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
          animation: pulseStatusIndicator 2.4s ease-in-out infinite;
        }

        @keyframes pulseStatusIndicator {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }

        .topbar-profile {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.3rem 0.75rem 0.3rem 0.3rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.02);
          transition: var(--transition-fast);
          cursor: pointer;
        }
        .topbar-profile:hover { border-color: var(--border-strong); background: rgba(255,255,255,0.04); }

        .topbar-profile span {
          font-family: var(--font-body);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-gold-hover), var(--accent-gold-deep));
          color: #14110d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-family: var(--font-body);
          font-size: 0.85rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transition: var(--transition-fast);
          flex-shrink: 0;
        }

        .content-area {
          flex: 1;
          padding-right: 0.25rem;
        }

        @media (max-width: 992px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            margin: 0;
            width: 280px;
            height: 100vh;
            border-radius: 0;
            transform: translateX(-100%);
            opacity: 0;
            background: rgba(14, 12, 10, 0.98);
            z-index: 1000;
          }
          .sidebar.open { transform: translateX(0); opacity: 1; }
          .mobile-close-btn { display: flex; }
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(6, 5, 4, 0.7);
            backdrop-filter: blur(8px);
            z-index: 999;
          }
          .main-content { padding: 0.75rem; }
          .menu-toggle-btn { display: inline-flex; }
        }

        @media (max-width: 480px) {
          .topbar-profile span { display: none; }
        }
      `}</style>
    </div>
  )
}
