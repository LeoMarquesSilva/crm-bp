import { cn } from '@/lib/utils'

interface ProgressBarProps {
  total: number
  active: number
  variant?: 'sales' | 'post'
}

export function ProgressBar({ total, active, variant = 'sales' }: ProgressBarProps) {
  const percentage = ((active + 1) / total) * 100
  const accentColor = variant === 'sales' ? 'sales' : 'post'

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Progresso
        </span>
        <span className="text-xs font-bold text-primary bg-gray-50 px-2.5 py-1 rounded-full">
          {active + 1} / {total}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden',
            variant === 'sales' 
              ? 'bg-gradient-to-r from-sales/90 to-sales' 
              : 'bg-gradient-to-r from-post/90 to-post'
          )}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      <div className="flex justify-between items-center mt-2.5 gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex-1 h-1.5 rounded-full transition-all duration-300',
              index <= active
                ? variant === 'sales'
                  ? 'bg-sales shadow-sm'
                  : 'bg-post shadow-sm'
                : 'bg-gray-200'
            )}
          />
        ))}
      </div>
    </div>
  )
}
