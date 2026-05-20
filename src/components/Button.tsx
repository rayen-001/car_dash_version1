import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  isLoading?: boolean
  className?: string
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon, 
  isLoading, 
  className = '', 
  disabled, 
  ...props 
}: ButtonProps) {
  
  // Map variant to existing global CSS classes
  let baseClass = 'btn-primary'
  if (variant === 'secondary') baseClass = 'btn-secondary'
  if (variant === 'danger') baseClass = 'btn-primary bg-danger' // Assuming bg-danger or similar exists, or we use inline style later
  if (variant === 'icon') baseClass = 'icon-btn'
  if (variant === 'ghost') baseClass = 'btn-ghost'

  const combinedClassName = `${baseClass} ${className}`.trim()

  return (
    <button 
      className={combinedClassName} 
      disabled={isLoading || disabled} 
      {...props}
      style={isLoading ? { display: 'flex', alignItems: 'center', gap: '0.5rem', ...props.style } : props.style}
    >
      {isLoading ? (
        <Loader2 size={variant === 'icon' ? 16 : 18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {icon}
          {children && <span>{children}</span>}
        </span>
      ) : (
        children
      )}
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </button>
  )
}
