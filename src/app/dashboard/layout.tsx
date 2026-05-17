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
          background: #070504;
          background-image: 
            radial-gradient(circle at 15% 15%, rgba(229, 193, 125, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 85% 85%, rgba(229, 193, 125, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.2) 0%, transparent 100%);
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
          border-radius: 20px;
          background: rgba(10, 8, 7, 0.92);
          backdrop-filter: blur(30px) saturate(150%);
          -webkit-backdrop-filter: blur(30px) saturate(150%);
          border: 1px solid rgba(229, 193, 125, 0.2);
          box-shadow:
            0 20px 50px rgba(0, 0, 0, 0.8),
            inset 0 0 25px rgba(0, 0, 0, 0.95),
            0 0 30px rgba(229, 193, 125, 0.03);
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
          pointer-events: none;
        }

        /* Gold glowing neon bottom bar */
        .sidebar::after {
          content: '';
          position: absolute;
          bottom: 0; left: 15%; right: 15%;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--accent-gold-hover), transparent);
          box-shadow: 0 0 15px var(--accent-gold-hover), 0 0 5px var(--accent-gold);
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
          font-size: 1.7rem;
          font-weight: 500;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-hover) 50%, var(--accent-gold-deep) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 20px rgba(229, 193, 125, 0.15);
        }

        .brand-accent {
          color: inherit;
          font-style: normal;
        }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding: 1rem;
          position: relative;
          z-index: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          padding: 0.9rem 1.25rem;
          border-radius: var(--radius-md);
          color: rgba(229, 193, 125, 0.7);
          transition: var(--transition);
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          border: 1px solid transparent;
          position: relative;
        }

        .nav-item:hover {
          background: rgba(229, 193, 125, 0.06);
          color: var(--accent-gold-hover);
          border-color: rgba(229, 193, 125, 0.12);
          transform: translateX(4px);
        }

        .nav-item.active {
          background: linear-gradient(90deg, rgba(229, 193, 125, 0.16) 0%, rgba(229, 193, 125, 0.02) 100%);
          color: var(--accent-gold-hover);
          border-color: rgba(229, 193, 125, 0.35);
          box-shadow:
            0 4px 20px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
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
          box-shadow: 0 0 12px var(--accent-gold);
        }

        .sidebar-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid rgba(229, 193, 125, 0.15);
          position: relative;
          z-index: 1;
        }

        .sidebar-footer::before {
          content: '';
          position: absolute;
          top: -1px; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent-gold-hover), transparent);
          box-shadow: 0 0 10px var(--accent-gold-hover);
          opacity: 0.7;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 1.2rem;
          padding: 0.9rem 1.25rem;
          background: transparent;
          border: 1px solid transparent;
          color: rgba(229, 193, 125, 0.7);
          cursor: pointer;
          transition: var(--transition);
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: var(--radius-md);
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
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
          padding: 1.25rem 2.25rem;
          margin-bottom: 1.5rem;
          background: rgba(10, 8, 7, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(229, 193, 125, 0.15);
          border-radius: var(--radius-lg);
          box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.6),
            inset 0 0 15px rgba(0, 0, 0, 0.8);
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
          color: rgba(229, 193, 125, 0.7);
          font-size: 0.88rem;
          font-weight: 500;
          font-family: var(--font-body);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 14px #10b981, inset 0 0 4px rgba(255, 255, 255, 0.5);
          animation: pulseStatusIndicator 2s ease-in-out infinite;
        }

        @keyframes pulseStatusIndicator {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }

        .topbar-profile {
          display: flex;
          align-items: center;
          gap: 1.1rem;
        }

        .topbar-profile span {
          font-family: var(--font-heading);
          color: var(--accent-gold-hover);
          font-size: 1.05rem;
          letter-spacing: 0.3px;
        }

        .avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-gold-deep), var(--bg-tertiary));
          border: 2px solid var(--accent-gold);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-family: var(--font-heading);
          font-size: 1.15rem;
          box-shadow:
            0 0 15px rgba(229, 193, 125, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          transition: var(--transition);
        }

        .avatar:hover {
          transform: scale(1.06) rotate(5deg);
          box-shadow: 0 0 25px rgba(229, 193, 125, 0.7);
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
            background: rgba(10, 8, 7, 0.98);
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
            background: rgba(8, 6, 5, 0.75);
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
