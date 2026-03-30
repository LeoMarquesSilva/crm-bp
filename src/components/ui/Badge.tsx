import { FunnelType } from '@/types'
import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'sales' | 'post' | 'default'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variantStyles = {
    sales: 'bg-sales/20 text-sales border-sales/30',
    post: 'bg-post/20 text-post border-post/30',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
