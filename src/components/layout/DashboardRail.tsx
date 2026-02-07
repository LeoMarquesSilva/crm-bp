import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  FileCheck,
  Clock,
  BarChart3,
  Search,
  Calendar,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardTabId } from '@/pages/analise/types'
import { DASHBOARD_TAB_ITEMS } from '@/pages/analise/types'

const CRM_PATHS = [
  { path: '/validacao', label: 'Validação', icon: FileCheck },
  { path: '/sla', label: 'SLA', icon: Clock },
  { path: '/analise-planilha', label: 'Dashboard', icon: BarChart3 },
] as const

type DashboardRailProps = {
  activeTab: DashboardTabId
  onTabChange: (tab: DashboardTabId) => void
}

export function DashboardRail({ activeTab, onTabChange }: DashboardRailProps) {
  const { pathname } = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const isDashboard = pathname === '/analise-planilha'

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0f172a] text-white/90 transition-[width] duration-200 ease-out',
        isExpanded ? 'w-56' : 'w-14 lg:w-16'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      aria-label="Menu Dashboard"
    >
      <div className="flex flex-col py-4 min-w-0">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 h-10 lg:h-11 px-3 mb-2 rounded-lg transition-colors',
            pathname === '/' ? 'bg-primary text-white' : 'hover:bg-white/10 text-white/90'
          )}
          title="Início"
        >
          <Home className="h-5 w-5 shrink-0" />
          {isExpanded && <span className="text-sm font-medium truncate">Início</span>}
        </Link>

        <div className="h-px w-8 bg-white/10 my-3 self-center" />

        {CRM_PATHS.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex items-center gap-3 h-10 lg:h-11 px-3 rounded-lg transition-colors mb-1',
              pathname === path ? 'bg-primary text-white' : 'hover:bg-white/10 text-white/80'
            )}
            title={label}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {isExpanded && <span className="text-sm font-medium truncate">{label}</span>}
          </Link>
        ))}

        {isDashboard && (
          <>
            <div className="h-px w-8 bg-white/10 my-3 self-center" />
            <div className="px-2 mb-1">
              {isExpanded && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Abas
                </span>
              )}
            </div>
            {DASHBOARD_TAB_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex items-center gap-3 h-10 lg:h-11 px-3 rounded-lg transition-colors mb-1 w-full text-left',
                  activeTab === id
                    ? 'bg-primary/90 text-white'
                    : 'hover:bg-white/10 text-white/80'
                )}
                title={label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="text-sm font-medium truncate">{label}</span>}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col py-2 border-t border-white/10">
        <button
          type="button"
          className="flex items-center gap-3 h-10 w-full px-3 rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
          title="Busca"
        >
          <Search className="h-5 w-5 shrink-0" />
          {isExpanded && <span className="text-sm truncate">Busca</span>}
        </button>
        <button
          type="button"
          className="flex items-center gap-3 h-10 w-full px-3 rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
          title="Calendário"
        >
          <Calendar className="h-5 w-5 shrink-0" />
          {isExpanded && <span className="text-sm truncate">Calendário</span>}
        </button>
        <button
          type="button"
          className="flex items-center gap-3 h-10 w-full px-3 rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
          title="Configurações"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {isExpanded && <span className="text-sm truncate">Configurações</span>}
        </button>
        <div className="h-px w-8 bg-white/10 my-2 self-center" />
        <button
          type="button"
          className="flex items-center gap-3 h-10 w-full px-3 rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
          title="Sair"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isExpanded && <span className="text-sm truncate">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
