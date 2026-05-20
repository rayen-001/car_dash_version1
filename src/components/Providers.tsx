'use client'

/**
 * Providers.tsx — Client-side context providers wrapper.
 * This must be a 'use client' component so we can use the
 * Toast and ConfirmDialog providers (which rely on React state/context).
 * The root layout.tsx remains a Server Component and simply wraps
 * {children} with this file.
 */

import { ToastProvider }   from '@/components/Toast'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ReactNode }       from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
