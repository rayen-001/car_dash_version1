'use client'

import { useState } from 'react'
import { LayoutDashboard, Users, Activity, Settings, LogOut, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Owners', href: '/admin/owners', icon: Users },
    { name: 'Activity', href: '/admin/activity', icon: Activity },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
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
            <span className="brand-accent">Super</span>Admin
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
            <div className="topbar-search">
              <input type="text" placeholder="Global Search..." className="input-field" />
            </div>
          </div>
          <div className="topbar-profile">
            <div className="avatar">A</div>
            <span>Admin</span>
          </div>
        </header>

        <div className="content-area animate-fade-in">
          {children}
        </div>
      </main>

      <style jsx>{`
        .layout-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
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
          position: relative;
          overflow: hidden;
        }

        /* Ambient top reflection */
        .sidebar::before {
          content: '';
          position: absolute;
          top: 0; left: 15%; right: 15%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent-gold), transparent);
          opacity: 0.5;
          pointer-events: none;
        }

        /* Golden neon glow bottom bar matching reference photo exactly */
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
        }

        .nav-item:hover {
          background: rgba(229, 193, 125, 0.06);
          color: var(--accent-gold-hover);
          transform: translateX(4px);
        }

        .nav-item.active {
          background: linear-gradient(90deg, rgba(229, 193, 125, 0.16) 0%, rgba(229, 193, 125, 0.02) 100%);
          color: var(--accent-gold-hover);
          border-left: 3px solid var(--accent-gold);
          box-shadow:
            0 4px 20px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .sidebar-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid rgba(229, 193, 125, 0.15);
          position: relative;
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
          border: none;
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
          overflow: hidden;
          padding: 1rem 1rem 1rem 0;
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

        /* Oval gold glowing Search Bar matching photo reference */
        .topbar-search .input-field {
          width: 320px;
          border-radius: 9999px;
          background: rgba(7, 5, 4, 0.85) !important;
          border: 1px solid rgba(229, 193, 125, 0.5) !important;
          box-shadow:
            0 0 15px rgba(229, 193, 125, 0.25),
            inset 0 0 8px rgba(229, 193, 125, 0.1) !important;
          color: var(--text-primary) !important;
          padding: 0.65rem 1.5rem !important;
          font-family: var(--font-body) !important;
          transition: var(--transition) !important;
        }

        .topbar-search .input-field:focus {
          width: 360px;
          border-color: var(--accent-gold-hover) !important;
          box-shadow:
            0 0 25px rgba(229, 193, 125, 0.45),
            inset 0 0 12px rgba(229, 193, 125, 0.2) !important;
        }

        .topbar-search .input-field::placeholder {
          color: rgba(229, 193, 125, 0.4);
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

        /* Glowing profile avatar ring matching photo reference */
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
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        /* Mobile CSS Media Queries */
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
            box-shadow: var(--shadow-xl);
          }

          .sidebar.open {
            transform: translateX(0);
            opacity: 1;
          }

          .mobile-close-btn {
            display: block;
          }

          .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            z-index: 999;
          }

          .main-content {
            padding: 1rem;
          }

          .menu-toggle-btn {
            display: block;
          }

          .topbar-search .input-field {
            width: 150px;
          }
          
          .topbar-search .input-field:focus {
            width: 180px;
          }
        }
      `}</style>
    </div>
  )
}
