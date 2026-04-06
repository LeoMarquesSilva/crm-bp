import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Award,
  Table2,
  AlertCircle,
  Users,
  FileBarChart,
  Landmark,
} from 'lucide-react'

/** IDs das abas do Dashboard de análise. */
export type DashboardTabId =
  | 'visao-geral'
  | 'performance'
  | 'leads'
  | 'perdas'
  | 'origem'
  | 'relatorios'
  | 'financeiro'

export const DASHBOARD_TAB_ITEMS: { id: DashboardTabId; label: string; icon: LucideIcon }[] = [
  { id: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'performance', label: 'Performance', icon: Award },
  { id: 'leads', label: 'Leads', icon: Table2 },
  { id: 'perdas', label: 'Análise de Perdas', icon: AlertCircle },
  { id: 'origem', label: 'Origem', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: Landmark },
  { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
]

export type FinanceiroValidationIssueType = 'obrigatorio' | 'formato' | 'faixa' | 'consistencia'

export type FinanceiroSummary = {
  totalLeadsElegiveis: number
  leadsComPrimeiroFaturamento: number
  leadsSemPrimeiroFaturamento: number
  leadsComContratoAnual: number
  leadsComValorPrimeiroFaturamento: number
  totalValorContratoAnual: number
  totalValorPrimeiroFaturamento: number
  ticketMedioAnual: number
  mediaPrimeiroFaturamento: number
}

export type FinanceiroMonthlyItem = {
  monthKey: string
  monthLabel: string
  leadsComFaturamento: number
  leadsEntrada: number
  valorContratoAnual: number
  valorPrimeiroFaturamento: number
  ticketMedioAnual: number
}

export type FinanceiroAreaCard = {
  area: string
  areaKey: string
  participacoes: number
  leadsUnicas: number
  valorAnual: number
  valorMensal: number
  percentualMedio: number
}

export type FinanceiroAreaMonthlyRow = {
  monthKey: string
  monthLabel: string
  area: string
  participacoes: number
  leadsUnicas: number
  valorAnual: number
  valorMensal: number
  percentualSoma: number
  percentualCount: number
  percentualMedio: number
}

export type FinanceiroAreaLeadRow = {
  area: string
  areaKey: string
  leadRef: string
  rowIndex: number
  dealId: string | null
  monthKey: string | null
  monthLabel: string | null
  percentualRateio: number | null
  valorAnualArea: number
  valorMensalArea: number
  rateioValorRaw: string
  rateioPercentRaw: string
  consistencyMessage: string | null
}

export type FinanceiroValidationSummary = {
  totalLeadsValidadas: number
  leadsComErro: number
  totalErros: number
  errosPorTipo: { type: string; count: number }[]
}

export type FinanceiroValidationIssue = {
  fieldKey: string
  fieldLabel: string
  areaLabel: string | null
  type: FinanceiroValidationIssueType
  message: string
  currentValue: string
}

export type FinanceiroValidationRow = {
  leadRef: string
  rowIndex: number
  dealId: string | null
  stageName: string
  funil: string
  responsavelKey: string
  responsavelNome: string
  responsavelAvatar: string | null
  issues: FinanceiroValidationIssue[]
  status: 'ok' | 'com_erro'
}

export type FinanceiroSyncStats = {
  totalFetchedRdDeals: number
  rdPages: number
  rowsRead: number
  rowsWithDealId: number
  rowsMatchedRd: number
  rowsNoRdMatch: number
  rowsChanged: number
  rowsUnchanged: number
  updatesCount: number
  missingColumns: string[]
}

export type FinanceiroSyncDivergence = {
  rowIndex: number
  dealId: string
  field: string
  oldValue: string
  newValue: string
}

export type FinanceiroSyncReport = {
  ok: boolean
  dryRun: boolean
  message: string
  stats: FinanceiroSyncStats
  sampleDivergences: FinanceiroSyncDivergence[]
}

export type FinanceiroLeadMeta = {
  leadRef: string
  dealId: string | null
  linkContrato: string | null
  linkProposta: string | null
  objetoContratoCc: string | null
  observacoesFinanceiro: string | null
  primeiroFaturamentoRaw: string | null
  valorPrimeiroFaturamentoRaw: string | null
  valorContratoAnualRaw: string | null
}

export type FinanceiroDealFieldDiff = {
  field: string
  localValue: string
  rdValue: string
}
