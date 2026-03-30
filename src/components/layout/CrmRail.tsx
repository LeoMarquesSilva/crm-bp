import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Search,
  FileCheck,
  Clock,
  BarChart3,
  PieChart,
  Calendar,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CRM_PATHS = [
  { path: '/validacao', label: 'Validação', icon: FileCheck },
  { path: '/sla', label: 'SLA', icon: Clock },
  { path: '/analise-planilha', label: 'Dashboard', icon: BarChart3 },
] as const

export function CrmRail() {
  const { pathname } = useLocation()

  return (
    <aside
      className="w-14 lg:w-16 flex-shrink-0 flex flex-col items-center py-4 border-r border-gray-200 bg-[#0f172a] text-white/80"
      aria-label="Ferramentas CRM"
    >
      <Link
        to="/"
        className={cn(
          'flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg transition-colors mb-2',
          pathname === '/' ? 'bg-primary text-white' : 'hover:bg-white/10 text-white/90'
        )}
        title="Início"
      >
        <Home className="h-5 w-5" />
      </Link>

      <div className="h-px w-8 bg-white/10 my-3" />

      {CRM_PATHS.map(({ path, label, icon: Icon }) => (
        <Link
          key={path}
          to={path}
          className={cn(
            'flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg transition-colors mb-1',
            pathname === path ? 'bg-primary text-white' : 'hover:bg-white/10 text-white/80'
          )}
          title={label}
        >
          <Icon className="h-5 w-5" />
        </Link>
      ))}

      <div className="flex-1" />

      <button
        type="button"
        className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
        title="Busca"
      >
        <Search className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
        title="Calendário"
      >
        <Calendar className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors mb-1"
        title="Configurações"
      >
        <Settings className="h-5 w-5" />
      </button>
      <div className="h-px w-8 bg-white/10 my-2" />
      <button
        type="button"
        className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
        title="Sair"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  )
}
