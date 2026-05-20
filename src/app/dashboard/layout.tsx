'use client'

import { useState, useEffect, useRef } from 'react'
import { CarFront, CalendarClock, CircleDollarSign, Wrench, BarChart3, User, LogOut, Menu, X, Settings, Users, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import styles from './layout.module.css'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [userInitials, setUserInitials] = useState('?')
  const [displayName, setDisplayName] = useState('My Account')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false)
  
  const profileRef = useRef<HTMLDivElement>(null)

  // Fetch user identity and business name for the topbar
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Derive initials from name metadata or email
        const rawName: string = user.user_metadata?.full_name || user.email || ''
        const parts = rawName.split(/[\s@.]/).filter(Boolean)
        const initials = parts.map((p: string) => p[0]).join('').toUpperCase().substring(0, 2)
        setUserInitials(initials || '?')

        // Default display name fallback to full name or email username
        const nameFallback = user.user_metadata?.full_name || (user.email || '').split('@')[0] || 'My Account'
        setDisplayName(nameFallback)
        if (user.email) {
          setUserEmail(user.email)
        }

        // Try to load business name and logo from settings table
        const { data: settings } = await supabase
          .from('business_settings')
          .select('business_name, logo_url')
          .maybeSingle()

        if (settings?.business_name) {
          setDisplayName(settings.business_name)
        }
        if (settings?.logo_url) {
          setLogoUrl(settings.logo_url)
        } else {
          setLogoUrl(null)
        }
      } catch (err) {
        console.error('Error loading topbar info:', err)
      }
    }
    loadUserInfo()
    
    // Add real-time event listener
    window.addEventListener('business-settings-updated', loadUserInfo)
    
    return () => {
      window.removeEventListener('business-settings-updated', loadUserInfo)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navGroups = [
    {
      title: 'Operations',
      items: [
        { name: 'Analytics', href: '/dashboard', icon: BarChart3 },
        { name: 'My Fleet', href: '/dashboard/fleet', icon: CarFront },
        { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarClock },
        { name: 'Clients', href: '/dashboard/clients', icon: Users },
      ]
    },
    {
      title: 'Finance & Service',
      items: [
        { name: 'Expenses', href: '/dashboard/expenses', icon: CircleDollarSign },
        { name: 'Maintenance', href: '/dashboard/maintenance', icon: Wrench },
      ]
    },
    {
      title: 'Management',
      items: [
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
        { name: 'Profile', href: '/dashboard/profile', icon: User },
      ]
    }
  ]

  return (
    <div className={styles['layout-container']}>
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className={`${styles['sidebar-overlay']} no-print`} onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`${styles['sidebar']} glass-panel ${isSidebarOpen ? styles['open'] : ''} no-print`}>
        <div className={styles['sidebar-header']}>
          <h2 className={styles['brand']}>
            <span className={styles['brand-accent']}>Owner</span>Dash
          </h2>
          <button 
            className={styles['mobile-close-btn']} 
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close Menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={styles['sidebar-nav']}>
          {navGroups.map((group) => (
            <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div className={styles['nav-group-label']}>{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`${styles['nav-item']} ${isActive ? styles['active'] : ''}`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className={styles['sidebar-footer']}>
          <button onClick={handleLogout} className={styles['logout-btn']}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles['main-content']}>
        <header className={`${styles['topbar']} glass-panel no-print`}>
          <div className={styles['topbar-left']}>
            <button 
              className={styles['menu-toggle-btn']} 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Menu"
            >
              <Menu size={24} />
            </button>
            <div className={styles['topbar-info']}>
              <span className={styles['status-indicator']}></span>
              <span>Live Data Sync</span>
            </div>
          </div>
          <div 
            ref={profileRef}
            className={`${styles['topbar-profile']} ${isProfileDropdownOpen ? styles['active'] : ''}`}
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
          >
            {logoUrl ? (
              <div className={styles['avatar-container']}>
                <img 
                  src={logoUrl} 
                  alt={displayName} 
                  className={styles['avatar-img']} 
                  title={displayName}
                />
              </div>
            ) : (
              <div className={styles['avatar']} title={displayName}>{userInitials}</div>
            )}
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className={styles['profile-dropdown']} onClick={(e) => e.stopPropagation()}>
                <div className={styles['dropdown-header']}>
                  {logoUrl ? (
                    <div className={styles['dropdown-avatar-container']}>
                      <img src={logoUrl} alt={displayName} className={styles['dropdown-avatar-img']} />
                    </div>
                  ) : (
                    <div className={styles['dropdown-avatar']}>{userInitials}</div>
                  )}
                  <div className={styles['dropdown-user-info']}>
                    <h4>{displayName}</h4>
                    <span className={styles['dropdown-role']}>Business Owner</span>
                    <span className={styles['dropdown-email']} title={userEmail}>{userEmail}</span>
                  </div>
                </div>
                
                <div className={styles['dropdown-divider']}></div>

                <div className={styles['dropdown-menu']}>
                  <Link href="/dashboard/profile" className={styles['dropdown-item']}>
                    <User size={16} />
                    <span>My Profile</span>
                  </Link>
                  <Link href="/dashboard/settings" className={styles['dropdown-item']}>
                    <Settings size={16} />
                    <span>Business Settings</span>
                  </Link>
                </div>

                <div className={styles['dropdown-divider']}></div>

                <div className={styles['dropdown-footer']}>
                  <button onClick={handleLogout} className={styles['dropdown-logout-btn']}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className={`${styles['content-area']} animate-fade-in`}>
          {children}
        </div>

        {/* Floating Quick Actions Bar */}
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }} className="no-print">
          {isQuickActionsOpen && (
            <div className="glass-panel" style={{
              background: 'rgba(20, 20, 20, 0.95)',
              border: '1px solid rgba(229, 193, 125, 0.25)',
              borderRadius: '16px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              minWidth: '200px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              transformOrigin: 'bottom right',
              animation: 'scaleUp 0.2s ease-out'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#ae9260', fontWeight: 700, paddingBottom: '0.4rem', borderBottom: '1px solid rgba(229,193,125,0.15)', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>QUICK ACTIONS</div>
              
              <Link href="/dashboard/bookings?openAdd=true" onClick={() => setIsQuickActionsOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.88rem', transition: 'background 0.2s' }} className="quick-action-link">
                <CalendarClock size={16} style={{ color: '#ae9260' }} />
                <span>New Booking</span>
              </Link>
              
              <Link href="/dashboard/fleet?openAdd=true" onClick={() => setIsQuickActionsOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.88rem', transition: 'background 0.2s' }} className="quick-action-link">
                <CarFront size={16} style={{ color: '#ae9260' }} />
                <span>Add Vehicle</span>
              </Link>

              <Link href="/dashboard/clients?openAdd=true" onClick={() => setIsQuickActionsOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.88rem', transition: 'background 0.2s' }} className="quick-action-link">
                <Users size={16} style={{ color: '#ae9260' }} />
                <span>Register Client</span>
              </Link>

              <Link href="/dashboard/expenses?openAdd=true" onClick={() => setIsQuickActionsOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.88rem', transition: 'background 0.2s' }} className="quick-action-link">
                <CircleDollarSign size={16} style={{ color: '#ae9260' }} />
                <span>Log Expense</span>
              </Link>
            </div>
          )}
          
          <button 
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ae9260, #735d38)',
              border: '1px solid rgba(229,193,125,0.4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(174, 146, 96, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            className="quick-actions-trigger"
          >
            <Plus size={24} style={{ transform: isQuickActionsOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .quick-action-link:hover {
          background: rgba(229, 193, 125, 0.1) !important;
          color: #ae9260 !important;
        }
        .quick-actions-trigger:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(174, 146, 96, 0.45) !important;
        }
      ` }} />
    </div>
  )
}
