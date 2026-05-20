'use client'

import { useState } from 'react'
import { LayoutDashboard, Users, Activity, Settings, LogOut, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import styles from './layout.module.css'

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
    <div className={styles['layout-container']}>
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className={styles['sidebar-overlay']} onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`${styles['sidebar']} glass-panel ${isSidebarOpen ? styles['open'] : ''}`}>
        <div className={styles['sidebar-header']}>
          <h2 className={styles['brand']}>
            <span className={styles['brand-accent']}>Super</span>Admin
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
          {navItems.map((item) => {
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
        <header className={`${styles['topbar']} glass-panel`}>
          <div className={styles['topbar-left']}>
            <button 
              className={styles['menu-toggle-btn']} 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Menu"
            >
              <Menu size={24} />
            </button>
            <div className={styles['topbar-search']}>
              <input type="text" placeholder="Global Search..." className={styles['input-field']} />
            </div>
          </div>
          <div className={styles['topbar-profile']}>
            <div className={styles['avatar']}>A</div>
            <span>Admin</span>
          </div>
        </header>

        <div className={`${styles['content-area']} animate-fade-in`}>
          {children}
        </div>
      </main>
    </div>
  )
}
