import { Step, FunnelType } from '@/types'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface StepCardProps {
  step: Step
  isActive: boolean
  onClick: () => void
  funnel: FunnelType
}

export function StepCard({ step, isActive, onClick, funnel }: StepCardProps) {
  const funnelColors = {
    sales: {
      active: 'bg-sales/10 border-sales text-sales',
      inactive: 'bg-white border-gray-200 text-gray-700 hover:border-sales/50',
    },
    post: {
      active: 'bg-post/10 border-post text-post',
      inactive: 'bg-white border-gray-200 text-gray-700 hover:border-post/50',
    },
  }

  const colors = funnelColors[funnel]

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border-2 p-4 transition-all duration-280',
        isActive ? colors.active : colors.inactive,
        'shadow-sm hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm',
            isActive
              ? funnel === 'sales'
                ? 'bg-sales text-white'
                : 'bg-post text-white'
              : 'bg-gray-100 text-gray-600'
          )}
        >
          {step.number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight mb-1">
            {step.name}
          </h3>
          <p className="text-xs text-gray-600 line-clamp-2">
            {step.subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
