import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps {
  variant?: 'warning' | 'info' | 'success' | 'error'
  title?: string
  children: React.ReactNode
  className?: string
}

const icons = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  error: XCircle,
}

const variantStyles = {
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const Icon = icons[variant]

  return (
    <div
      className={cn(
        'border rounded-lg p-4 flex gap-3',
        variantStyles[variant],
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}
