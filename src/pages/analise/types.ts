import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Award,
  Table2,
  AlertCircle,
  Users,
  FileBarChart,
} from 'lucide-react'

/** IDs das abas do Dashboard de análise. */
export type DashboardTabId =
  | 'visao-geral'
  | 'performance'
  | 'leads'
  | 'perdas'
  | 'origem'
  | 'relatorios'

export const DASHBOARD_TAB_ITEMS: { id: DashboardTabId; label: string; icon: LucideIcon }[] = [
  { id: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'performance', label: 'Performance', icon: Award },
  { id: 'leads', label: 'Leads', icon: Table2 },
  { id: 'perdas', label: 'Análise de Perdas', icon: AlertCircle },
  { id: 'origem', label: 'Origem', icon: Users },
  { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
]
