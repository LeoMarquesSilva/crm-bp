import { cn } from '@/lib/utils'
import type { DashboardTabId } from './types'
import { DASHBOARD_TAB_ITEMS } from './types'

type DashboardTabBarProps = {
  activeTab: DashboardTabId
  onTabChange: (tab: DashboardTabId) => void
}

export function DashboardTabBar({ activeTab, onTabChange }: DashboardTabBarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-white/80 p-1.5 shadow-sm">
      {DASHBOARD_TAB_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === id ? 'bg-primary text-white shadow' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  )
}
