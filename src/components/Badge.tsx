import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default'
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  // Try to use existing status-badge classes
  let variantClass = ''
  switch (variant) {
    case 'success': variantClass = 'confirmed'; break; // Maps to confirmed status color
    case 'warning': variantClass = 'pending'; break;
    case 'danger': variantClass = 'cancelled'; break;
    case 'info': variantClass = 'active'; break;
    default: variantClass = 'default'; break;
  }

  const combinedClass = `status-badge ${variantClass} ${className}`.trim()

  return (
    <span className={combinedClass}>
      {children}
    </span>
  )
}
