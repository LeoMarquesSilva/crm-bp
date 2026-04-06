import { useMemo, useState } from 'react'
import { Landmark, TrendingUp, CalendarDays, Receipt, BarChart3, ChevronDown, ChevronUp, AlertTriangle, Search, Eye, EyeOff, RefreshCw, Loader2, CheckCircle2, Scale, Briefcase, FileText, PlusCircle, type LucideIcon } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import type {
  FinanceiroAreaCard,
  FinanceiroAreaLeadRow,
  FinanceiroLeadMeta,
  FinanceiroAreaMonthlyRow,
  FinanceiroMonthlyItem,
  FinanceiroSummary,
  FinanceiroValidationRow,
  FinanceiroValidationSummary,
  FinanceiroSyncReport,
} from './types'

type FinanceiroSectionProps = {
  summary: FinanceiroSummary
  monthlyData: FinanceiroMonthlyItem[]
  areaCards: FinanceiroAreaCard[]
  areaComparisonData: FinanceiroAreaCard[]
  areaMonthlyRows: FinanceiroAreaMonthlyRow[]
  areaLeadRows: FinanceiroAreaLeadRow[]
  validationSummary: FinanceiroValidationSummary
  validationRows: FinanceiroValidationRow[]
  financeLeadMeta: Map<string, FinanceiroLeadMeta>
  financeYears: number[]
  financeMonths: number[]
  selectedFinanceYear: number | ''
  selectedFinanceMonth: number | ''
  onFinanceYearChange: (year: number | '') => void
  onFinanceMonthChange: (month: number | '') => void
  syncLoading: boolean
  syncMode: 'check' | 'apply' | null
  syncError: string | null
  syncCheckedAt: string | null
  syncReport: FinanceiroSyncReport | null
  onCheckSync: () => Promise<void> | void
  onApplySync: () => Promise<void> | void
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const intFormatter = new Intl.NumberFormat('pt-BR')
const pctFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'
const MESES_LABEL: Record<number, string> = {
  1: 'Jan',
  2: 'Fev',
  3: 'Mar',
  4: 'Abr',
  5: 'Mai',
  6: 'Jun',
  7: 'Jul',
  8: 'Ago',
  9: 'Set',
  10: 'Out',
  11: 'Nov',
  12: 'Dez',
}
const MESES_LABEL_COMPLETO: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Marco',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
}

const AREA_COLOR_MAP: Record<string, { fill: string; bg: string; border: string; text: string }> = {
  insolvencia: { fill: '#16a34a', bg: '#ecfdf3', border: '#86efac', text: '#166534' },
  civel: { fill: '#2563eb', bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  trabalhista: { fill: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  tributario: { fill: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
  contratos: { fill: '#14b8a6', bg: '#f0fdfa', border: '#5eead4', text: '#0f766e' },
  add: { fill: '#6b7280', bg: '#f9fafb', border: '#d1d5db', text: '#374151' },
}

function getAreaColor(areaKey: string | null | undefined) {
  return AREA_COLOR_MAP[String(areaKey ?? '').toLowerCase()] ?? { fill: '#6b7280', bg: '#f9fafb', border: '#d1d5db', text: '#374151' }
}

const AREA_ICON_MAP: Record<string, LucideIcon> = {
  insolvencia: AlertTriangle,
  civel: Scale,
  trabalhista: Briefcase,
  tributario: Landmark,
  contratos: FileText,
  add: PlusCircle,
}

function getAreaIcon(areaKey: string | null | undefined): LucideIcon {
  return AREA_ICON_MAP[String(areaKey ?? '').toLowerCase()] ?? BarChart3
}

function AreaBadge({
  areaKey,
  label,
}: {
  areaKey: string | null | undefined
  label: string
}) {
  const color = getAreaColor(areaKey)
  const Icon = getAreaIcon(areaKey)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function formatBrl(value: number): string {
  return brlFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatPct(value: number): string {
  return `${pctFormatter.format(Number.isFinite(value) ? value : 0)}%`
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value ?? '').trim())
}

function getAreaVisualAlerts(
  row: FinanceiroAreaLeadRow,
  leadMeta: FinanceiroLeadMeta | null,
  mode: 'mensal' | 'anual'
): string[] {
  const alerts: string[] = []
  if (row.consistencyMessage) alerts.push(row.consistencyMessage)

  if (row.rateioPercentRaw && row.percentualRateio == null) {
    alerts.push(`Rateio (${row.area}): percentual em formato inválido (preenchido: "${row.rateioPercentRaw}")`)
  }
  if (mode === 'mensal' && row.valorMensalArea === 0) {
    if (!hasText(leadMeta?.valorPrimeiroFaturamentoRaw)) {
      alerts.push(`Rateio (${row.area}): valor mensal zerado porque falta "Valor 1º faturamento"`)
    } else if (row.percentualRateio == null) {
      alerts.push(`Rateio (${row.area}): valor mensal zerado porque o percentual não é válido`)
    } else if (row.percentualRateio === 0) {
      alerts.push(`Rateio (${row.area}): valor mensal zerado porque o percentual está 0%`)
    }
  }
  if (mode === 'anual' && row.valorAnualArea === 0 && !hasText(leadMeta?.valorContratoAnualRaw) && !hasText(row.rateioValorRaw)) {
    alerts.push(`Rateio (${row.area}): valor anual zerado por falta de contrato anual/valor de rateio`)
  }

  return Array.from(new Set(alerts))
}

export function FinanceiroSection({
  summary,
  monthlyData: _monthlyData,
  areaCards,
  areaComparisonData: _areaComparisonData,
  areaMonthlyRows: _areaMonthlyRows,
  areaLeadRows,
  validationSummary,
  validationRows,
  financeLeadMeta,
  financeYears,
  financeMonths,
  selectedFinanceYear,
  selectedFinanceMonth,
  onFinanceYearChange,
  onFinanceMonthChange,
  syncLoading,
  syncMode,
  syncError,
  syncCheckedAt,
  syncReport,
  onCheckSync,
  onApplySync,
}: FinanceiroSectionProps) {
  const [rateioPieMode, setRateioPieMode] = useState<'mensal' | 'anual'>('mensal')
  const [selectedLeadModalKey, setSelectedLeadModalKey] = useState<string | null>(null)
  const [areaLeadAuditFilter, setAreaLeadAuditFilter] = useState<string>('todos')
  const [areaLeadAuditSearch, setAreaLeadAuditSearch] = useState('')
  const [showAuditoriaSection, setShowAuditoriaSection] = useState(false)
  const [periodViewMode, setPeriodViewMode] = useState<'mes' | 'ano'>('mes')
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('')
  const [selectedPeriodLeadKey, setSelectedPeriodLeadKey] = useState('')
  const [validationStatusFilter, setValidationStatusFilter] = useState<'todos' | 'com_erro' | 'ok'>('com_erro')
  const [validationAreaFilter, setValidationAreaFilter] = useState<string>('todos')
  const [validationTypeFilter, setValidationTypeFilter] = useState<'todos' | 'obrigatorio' | 'formato' | 'faixa' | 'consistencia'>('todos')
  const [validationOwnerFilter, setValidationOwnerFilter] = useState<string>('todos')
  const [validationSearch, setValidationSearch] = useState('')
  const [expandedValidationRow, setExpandedValidationRow] = useState<number | null>(null)
  const [showValidationSection, setShowValidationSection] = useState(false)
  const rateioPieData = useMemo(() => {
    const base = areaCards
      .map((area) => ({
        area: area.area,
        areaKey: area.areaKey,
        valorMensal: area.valorMensal,
        valorAnual: area.valorAnual,
        value: rateioPieMode === 'mensal' ? area.valorMensal : area.valorAnual,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
    const total = base.reduce((acc, item) => acc + item.value, 0)
    return base.map((item) => ({
      ...item,
      rateioPercent: total > 0 ? (item.value / total) * 100 : 0,
    }))
  }, [areaCards, rateioPieMode])
  const rateioPieOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent: number }) => {
          const tipo = rateioPieMode === 'mensal' ? 'Valor mensal por área' : 'Valor anual por área'
          return `
            <div style="min-width: 180px;">
              <div style="font-weight:600; margin-bottom: 4px;">${params.name}</div>
              <div>${tipo}: <b>${formatBrl(Number(params.value))}</b></div>
              <div>Participação: <b>${(params.percent ?? 0).toFixed(1)}%</b></div>
            </div>
          `
        },
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 8,
        top: 'middle',
        icon: 'circle',
        textStyle: {
          fontSize: 12,
          color: '#334155',
        },
      },
      series: [
        {
          name: rateioPieMode === 'mensal' ? 'Valor mensal por área' : 'Valor anual por área',
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['36%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: '#475569',
            fontSize: 11,
          },
          labelLine: {
            smooth: 0.2,
            length: 8,
            length2: 10,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: rateioPieData.map((item) => ({
            name: item.area,
            value: item.value,
            itemStyle: { color: getAreaColor(item.areaKey).fill },
          })),
        },
      ],
    }
  }, [rateioPieData, rateioPieMode])

  const validationAreas = useMemo(() => {
    const set = new Set<string>()
    validationRows.forEach((row) => {
      row.issues.forEach((issue) => {
        if (issue.areaLabel) set.add(issue.areaLabel)
      })
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [validationRows])

  const rowMatchesFilters = (
    row: FinanceiroValidationRow,
    opts?: { ignoreOwner?: boolean }
  ) => {
    if (validationStatusFilter !== 'todos' && row.status !== validationStatusFilter) return false
    const filteredIssues = row.issues.filter((issue) => {
      if (validationAreaFilter !== 'todos' && issue.areaLabel !== validationAreaFilter) return false
      if (validationTypeFilter !== 'todos' && issue.type !== validationTypeFilter) return false
      return true
    })
    if (validationStatusFilter === 'com_erro' && filteredIssues.length === 0) return false
    if (validationStatusFilter === 'ok' && row.issues.length > 0) return false
    if (!opts?.ignoreOwner && validationOwnerFilter !== 'todos' && row.responsavelKey !== validationOwnerFilter) return false
    const term = validationSearch.trim().toLowerCase()
    if (!term) return true
    const haystack = [
      row.leadRef,
      row.stageName,
      row.funil,
      row.dealId ?? '',
      row.responsavelNome,
      ...filteredIssues.map((i) => `${i.fieldLabel} ${i.message} ${i.currentValue}`),
    ].join(' ').toLowerCase()
    return haystack.includes(term)
  }

  const filteredValidationRows = useMemo(() => {
    return validationRows.filter((row) => rowMatchesFilters(row))
  }, [validationRows, validationStatusFilter, validationAreaFilter, validationTypeFilter, validationOwnerFilter, validationSearch])

  const ownerCards = useMemo(() => {
    const map = new Map<string, { key: string; nome: string; avatar: string | null; leadsComErro: number }>()
    validationRows.forEach((row) => {
      if (!rowMatchesFilters(row, { ignoreOwner: true })) return
      if (row.issues.length === 0) return
      const cur = map.get(row.responsavelKey) ?? {
        key: row.responsavelKey,
        nome: row.responsavelNome,
        avatar: row.responsavelAvatar,
        leadsComErro: 0,
      }
      cur.leadsComErro += 1
      if (!cur.avatar && row.responsavelAvatar) cur.avatar = row.responsavelAvatar
      map.set(row.responsavelKey, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.leadsComErro - a.leadsComErro)
  }, [validationRows, validationStatusFilter, validationAreaFilter, validationTypeFilter, validationSearch])

  const areaLeadAuditRows = useMemo(() => {
    const term = areaLeadAuditSearch.trim().toLowerCase()
    return areaLeadRows.filter((row) => {
      if (areaLeadAuditFilter !== 'todos' && row.areaKey !== areaLeadAuditFilter) return false
      if (!term) return true
      return [
        row.leadRef,
        row.dealId ?? '',
        row.area,
        row.monthLabel ?? '',
        row.rateioPercentRaw,
        row.rateioValorRaw,
      ].join(' ').toLowerCase().includes(term)
    })
  }, [areaLeadRows, areaLeadAuditFilter, areaLeadAuditSearch])

  const periodOptions = useMemo(() => {
    const map = new Map<string, string>()
    areaLeadRows.forEach((row) => {
      if (!row.monthKey) return
      if (periodViewMode === 'mes') {
        map.set(row.monthKey, row.monthLabel ?? row.monthKey)
        return
      }
      const year = row.monthKey.slice(0, 4)
      if (year) map.set(year, year)
    })
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key))
  }, [areaLeadRows, periodViewMode])

  const effectivePeriodKey = useMemo(() => {
    if (!periodOptions.length) return ''
    return periodOptions.some((opt) => opt.key === selectedPeriodKey)
      ? selectedPeriodKey
      : periodOptions[0].key
  }, [periodOptions, selectedPeriodKey])

  const periodLeadRows = useMemo(() => {
    if (!effectivePeriodKey) return [] as FinanceiroAreaLeadRow[]
    return areaLeadRows.filter((row) => {
      if (!row.monthKey) return false
      if (periodViewMode === 'mes') return row.monthKey === effectivePeriodKey
      return row.monthKey.startsWith(`${effectivePeriodKey}-`) || row.monthKey === effectivePeriodKey
    })
  }, [areaLeadRows, periodViewMode, effectivePeriodKey])

  const periodLeadOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>()
    periodLeadRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      const label = row.dealId ? `${row.leadRef} · ${row.dealId}` : row.leadRef
      const cur = map.get(key) ?? { key, label, count: 0 }
      cur.count += 1
      map.set(key, cur)
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [periodLeadRows])

  const effectivePeriodLeadKey = useMemo(() => {
    if (!periodLeadOptions.length) return ''
    return periodLeadOptions.some((opt) => opt.key === selectedPeriodLeadKey)
      ? selectedPeriodLeadKey
      : periodLeadOptions[0].key
  }, [periodLeadOptions, selectedPeriodLeadKey])

  const selectedLeadPeriodRows = useMemo(() => {
    if (!effectivePeriodLeadKey) return [] as FinanceiroAreaLeadRow[]
    return periodLeadRows
      .filter((row) => `${row.dealId ?? 'sem-deal'}|${row.leadRef}` === effectivePeriodLeadKey)
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'))
  }, [periodLeadRows, effectivePeriodLeadKey])

  const selectedLeadPeriodSummary = useMemo(() => {
    let valorAnual = 0
    let valorMensal = 0
    let percentual = 0
    let percentualCount = 0
    selectedLeadPeriodRows.forEach((row) => {
      valorAnual += row.valorAnualArea
      valorMensal += row.valorMensalArea
      if (row.percentualRateio != null) {
        percentual += row.percentualRateio
        percentualCount += 1
      }
    })
    return {
      totalAreas: selectedLeadPeriodRows.length,
      valorAnual,
      valorMensal,
      percentualMedio: percentualCount > 0 ? percentual / percentualCount : 0,
    }
  }, [selectedLeadPeriodRows])

  const leadsDoPeriodoSelecionado = useMemo(() => {
    const map = new Map<string, {
      key: string
      leadRef: string
      dealId: string | null
      stageName: string
      issueCount: number
      valorMensal: number
      valorAnual: number
      areas: number
    }>()
    areaLeadRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      const cur = map.get(key) ?? {
        key,
        leadRef: row.leadRef,
        dealId: row.dealId,
        stageName: '',
        issueCount: 0,
        valorMensal: 0,
        valorAnual: 0,
        areas: 0,
      }
      cur.valorMensal += row.valorMensalArea
      cur.valorAnual += row.valorAnualArea
      cur.areas += 1
      map.set(key, cur)
    })
    validationRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      const cur = map.get(key)
      if (!cur) return
      cur.stageName = row.stageName
      cur.issueCount = row.issues.length
    })
    return Array.from(map.values()).sort((a, b) => b.valorMensal - a.valorMensal || a.leadRef.localeCompare(b.leadRef, 'pt-BR'))
  }, [areaLeadRows, validationRows])

  const visaoSociosRows = useMemo(() => {
    const map = new Map<string, {
      key: string
      leadRef: string
      dealId: string | null
      stageName: string
      responsavelNome: string
      responsavelAvatar: string | null
      issueCount: number
      valorMensal: number
      valorAnual: number
      areas: Array<{ areaKey: string; area: string; pct: number | null; pctRaw: string; valorMensal: number; valorAnual: number }>
    }>()

    areaLeadRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      const cur = map.get(key) ?? {
        key,
        leadRef: row.leadRef,
        dealId: row.dealId,
        stageName: '',
        responsavelNome: 'Não informado',
        responsavelAvatar: null,
        issueCount: 0,
        valorMensal: 0,
        valorAnual: 0,
        areas: [],
      }
      cur.valorMensal += row.valorMensalArea
      cur.valorAnual += row.valorAnualArea
      cur.areas.push({
        areaKey: row.areaKey,
        area: row.area,
        pct: row.percentualRateio,
        pctRaw: row.rateioPercentRaw,
        valorMensal: row.valorMensalArea,
        valorAnual: row.valorAnualArea,
      })
      map.set(key, cur)
    })

    validationRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      const cur = map.get(key)
      if (!cur) return
      cur.stageName = row.stageName
      cur.responsavelNome = row.responsavelNome || 'Não informado'
      if (!cur.responsavelAvatar && row.responsavelAvatar) cur.responsavelAvatar = row.responsavelAvatar
      cur.issueCount = row.issues.length
    })

    return Array.from(map.values())
      .map((row) => {
        const totalPct = row.areas.reduce((acc, area) => acc + (area.pct ?? 0), 0)
        const coberturaRateio = totalPct > 0 ? totalPct : null
        const topAreas = [...row.areas]
          .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.valorMensal - a.valorMensal)
          .slice(0, 4)
        const risco =
          row.issueCount >= 3 ? 'alto' :
          row.issueCount > 0 ? 'atencao' :
          'ok'
        return {
          ...row,
          coberturaRateio,
          topAreas,
          risco,
        }
      })
      .sort((a, b) => b.valorMensal - a.valorMensal || a.leadRef.localeCompare(b.leadRef, 'pt-BR'))
  }, [areaLeadRows, validationRows])

  const selectedLeadModalRows = useMemo(() => {
    if (!selectedLeadModalKey) return [] as FinanceiroAreaLeadRow[]
    return areaLeadRows
      .filter((row) => `${row.dealId ?? 'sem-deal'}|${row.leadRef}` === selectedLeadModalKey)
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'))
  }, [areaLeadRows, selectedLeadModalKey])

  const selectedLeadModalHeader = useMemo(() => {
    if (!selectedLeadModalKey) return null
    return leadsDoPeriodoSelecionado.find((item) => item.key === selectedLeadModalKey) ?? null
  }, [leadsDoPeriodoSelecionado, selectedLeadModalKey])

  const selectedLeadMeta = useMemo(() => {
    if (!selectedLeadModalHeader?.dealId) return null
    return financeLeadMeta.get(selectedLeadModalHeader.dealId) ?? null
  }, [selectedLeadModalHeader, financeLeadMeta])

  const validationIssuesByLeadKey = useMemo(() => {
    const map = new Map<string, FinanceiroValidationRow['issues']>()
    validationRows.forEach((row) => {
      const key = `${row.dealId ?? 'sem-deal'}|${row.leadRef}`
      map.set(key, row.issues)
    })
    return map
  }, [validationRows])

  const selectedLeadValidationIssues = useMemo(() => {
    if (!selectedLeadModalKey) return [] as FinanceiroValidationRow['issues']
    return validationIssuesByLeadKey.get(selectedLeadModalKey) ?? []
  }, [selectedLeadModalKey, validationIssuesByLeadKey])

  const selectedLeadTopAlerts = useMemo(() => {
    const alerts: string[] = selectedLeadValidationIssues.map((issue) => {
      if (issue.type === 'formato') {
        const preenchido = hasText(issue.currentValue) ? issue.currentValue : 'vazio'
        return `${issue.message} (preenchido: "${preenchido}")`
      }
      return issue.message
    })
    if (rateioPieMode === 'mensal' && !hasText(selectedLeadMeta?.valorPrimeiroFaturamentoRaw)) {
      alerts.push('Mensal zerado: falta preencher "Valor 1º faturamento" na planilha.')
    }
    if (rateioPieMode === 'anual' && !hasText(selectedLeadMeta?.valorContratoAnualRaw)) {
      alerts.push('Anual pode zerar: falta preencher "Valor contrato anual".')
    }
    return Array.from(new Set(alerts)).slice(0, 8)
  }, [selectedLeadValidationIssues, rateioPieMode, selectedLeadMeta])

  return (
    <div className="space-y-6">
      <DashboardSection
        icon={<CalendarDays className="h-5 w-5" />}
        title="Filtro de período financeiro"
        description="Selecione ano e mês para aplicar os filtros da aba Financeiro."
        fullWidth
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ano</span>
            <button
              type="button"
              onClick={() => onFinanceYearChange('')}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                selectedFinanceYear === '' ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos os anos
            </button>
            {financeYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => onFinanceYearChange(year)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  selectedFinanceYear === year ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          {selectedFinanceYear !== '' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mês</span>
              <button
                type="button"
                onClick={() => onFinanceMonthChange('')}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  selectedFinanceMonth === '' ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              {financeMonths.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => onFinanceMonthChange(month)}
                  className={`rounded-xl border px-5 py-3 text-base font-semibold min-w-[140px] ${
                    selectedFinanceMonth === month ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {MESES_LABEL_COMPLETO[month] ?? MESES_LABEL[month] ?? month}
                </button>
              ))}
            </div>
          )}
        </div>
      </DashboardSection>

      <DashboardSection
        icon={<Landmark className="h-5 w-5" />}
        title="Financeiro Empresarial"
        description="Contratos fechados do pós-venda nas etapas de inclusão em faturamento e boas-vindas ao cliente."
        fullWidth
      >
        {summary.totalLeadsElegiveis === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Nenhum contrato fechado elegível com os filtros atuais. Esta aba considera apenas pós-venda com etapas de faturamento/boas-vindas.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos fechados</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{intFormatter.format(summary.totalLeadsElegiveis)}</p>
              <p className="mt-1 text-xs text-gray-500">
                <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                {intFormatter.format(summary.leadsComPrimeiroFaturamento)} com mês de faturamento
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Previsão de honorários mês</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {selectedFinanceMonth === '' ? '—' : formatBrl(summary.totalValorPrimeiroFaturamento)}
              </p>
              <p className="mt-1 text-xs text-blue-800">
                <Receipt className="h-3.5 w-3.5 inline mr-1" />
                {selectedFinanceMonth === ''
                  ? 'Selecione um mês para visualizar este indicador'
                  : `${intFormatter.format(summary.leadsComValorPrimeiroFaturamento)} contratos com faturamento informado`}
              </p>
            </div>
            {rateioPieMode === 'anual' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Previsão anual dos contratos fechados</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{formatBrl(summary.totalValorContratoAnual)}</p>
                <p className="mt-1 text-xs text-emerald-800">
                  <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
                  {intFormatter.format(summary.leadsComContratoAnual)} contratos com valor anual informado
                </p>
              </div>
            )}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        icon={<BarChart3 className="h-5 w-5" />}
        title="Rateio por área"
        description="Visualização por área com base no percentual de rateio aplicado aos valores financeiros."
        fullWidth
      >
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visualização do rateio</span>
            <button
              type="button"
              onClick={() => setRateioPieMode('mensal')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                rateioPieMode === 'mensal'
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setRateioPieMode('anual')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                rateioPieMode === 'anual'
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Anual
            </button>
          </div>

        </div>

        {rateioPieData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Sem dados de rateio para o período selecionado.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="h-[360px]">
                  <ReactECharts
                    option={rateioPieOption}
                    style={{ width: '100%', height: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 shadow-sm overflow-hidden">
                  <div className="max-h-[260px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Área</th>
                          <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                            {rateioPieMode === 'mensal' ? 'Valor mensal' : 'Valor anual'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rateioPieData.map((item, index) => {
                          const color = getAreaColor(item.areaKey)
                          const barWidth = Math.max(6, Math.min(100, item.rateioPercent))
                          return (
                            <tr key={`pie-${item.areaKey}`} className="align-top hover:bg-white/70">
                              <td className="px-3 py-2.5 text-gray-700">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 min-w-[28px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <AreaBadge areaKey={item.areaKey} label={item.area} />
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${barWidth}%`, backgroundColor: color.fill }}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatBrl(rateioPieMode === 'mensal' ? item.valorMensal : item.valorAnual)}
                                </p>
                                <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                                  {formatPct(item.rateioPercent)} do total
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="h-[520px] rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 shadow-sm overflow-hidden">
                {selectedFinanceMonth === '' ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Selecione um mês para exibir a visão executiva ao lado do gráfico.</p>
                ) : visaoSociosRows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Sem contratos fechados para montar a visão executiva no mês selecionado.</p>
                ) : (
                  <div className="h-full overflow-y-auto overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Contrato fechado</th>
                          <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Responsável</th>
                          <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visaoSociosRows.map((row, idx) => {
                          const shownAreaKeys = new Set(row.topAreas.map((area) => area.areaKey))
                          const hiddenAreas = row.areas.filter((area) => !shownAreaKeys.has(area.areaKey))
                          const hiddenAreasUnique = hiddenAreas.filter(
                            (area, hiddenIdx, arr) => arr.findIndex((candidate) => candidate.areaKey === area.areaKey) === hiddenIdx
                          )
                          return (
                          <tr key={`socios-inline-${row.key}`} className="align-top hover:bg-white/70">
                            <td className="px-3 py-2.5">
                              <div className="flex items-start gap-2">
                                <span className="inline-flex h-5 min-w-[28px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-800">{row.leadRef}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {row.topAreas.map((area, areaIdx) => (
                                      <AreaBadge
                                        key={`${row.key}-inline-area-${areaIdx}`}
                                        areaKey={area.areaKey}
                                        label={`${area.area}: ${area.pct == null ? (area.pctRaw || '—') : formatPct(area.pct)}`}
                                      />
                                    ))}
                                    {hiddenAreasUnique.length > 0 && (
                                      <div className="group inline-flex flex-col items-start">
                                        <span className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-500 cursor-help">
                                          +{hiddenAreasUnique.length} área(s)
                                        </span>
                                        <div className="mt-1.5 hidden w-80 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-100 shadow-xl group-hover:block">
                                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                            Áreas adicionais
                                          </p>
                                          <div className="space-y-1">
                                            {hiddenAreasUnique.map((area, hiddenIdx) => {
                                              const pct = area.pct == null ? (area.pctRaw || '—') : formatPct(area.pct)
                                              const value = rateioPieMode === 'mensal' ? formatBrl(area.valorMensal) : formatBrl(area.valorAnual)
                                              return (
                                                <div key={`${row.key}-hidden-area-${hiddenIdx}`} className="rounded-md bg-slate-800/70 px-2 py-1">
                                                  <p className="font-medium text-slate-100">{area.area}</p>
                                                  <p className="text-[11px] text-slate-300">{pct} · {value}</p>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {rateioPieMode === 'mensal' ? formatBrl(row.valorMensal) : formatBrl(row.valorAnual)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              <div className="flex items-center gap-2">
                                {row.responsavelAvatar ? (
                                  <img src={row.responsavelAvatar} alt="" className="h-7 w-7 rounded-full object-cover border border-gray-200" />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700">
                                    {(row.responsavelNome || '?').charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate">{row.responsavelNome}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedLeadModalKey(row.key)}
                                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Ver detalhes
                              </button>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardSection>

      {selectedFinanceMonth !== '' && (
        <DashboardSection
          icon={<Search className="h-5 w-5" />}
          title="Contratos fechados do mês selecionado"
          description="Clique em um contrato fechado para abrir o modal com detalhes de rateio por área."
          fullWidth
        >
          {leadsDoPeriodoSelecionado.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Nenhum contrato fechado encontrado para o mês selecionado.</p>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 shadow-sm overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Contrato fechado</th>
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Deal</th>
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">Etapa</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">Áreas</th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                        {rateioPieMode === 'mensal' ? 'Total mensal' : 'Total anual'}
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leadsDoPeriodoSelecionado.map((lead, idx) => (
                      <tr key={lead.key} className="hover:bg-white/70">
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          <div className="flex items-start gap-2">
                            <span className="inline-flex h-5 min-w-[28px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <p>{lead.leadRef}</p>
                              {lead.issueCount > 0 && (
                                <p className="mt-0.5 text-xs font-medium text-red-700">
                                  {intFormatter.format(lead.issueCount)} alerta(s) de preenchimento
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{lead.dealId ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{lead.stageName || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{intFormatter.format(lead.areas)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatBrl(rateioPieMode === 'mensal' ? lead.valorMensal : lead.valorAnual)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLeadModalKey(lead.key)}
                            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DashboardSection>
      )}

      <DashboardSection
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Validação de preenchimento financeiro"
        description="Validador essencial dos campos obrigatórios e consistência básica dos campos de rateio."
        fullWidth
      >
        <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Abrir validação detalhada</p>
            <p className="text-xs text-gray-500">Use esta seção para auditar campos inválidos e inconsistências.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowValidationSection((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showValidationSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showValidationSection ? 'Fechar validação' : 'Abrir validação'}
          </button>
        </div>

        {showValidationSection && (validationSummary.totalLeadsValidadas === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Sem leads elegíveis para validar.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Contratos fechados validados</p>
                <p className="text-xl font-bold text-gray-900">{intFormatter.format(validationSummary.totalLeadsValidadas)}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-600 uppercase tracking-wide">Contratos fechados com erro</p>
                <p className="text-xl font-bold text-red-800">{intFormatter.format(validationSummary.leadsComErro)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 uppercase tracking-wide">Total de inconsistências</p>
                <p className="text-xl font-bold text-amber-900">{intFormatter.format(validationSummary.totalErros)}</p>
              </div>
            </div>

            {validationSummary.leadsComErro === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="font-semibold">Sem erros encontrados.</p>
                <p className="text-sm mt-1">
                  {intFormatter.format(validationSummary.totalLeadsValidadas)} contrato(s) fechado(s) validados com preenchimento essencial correto.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-800 mb-2">Resumo por tipo de erro</p>
                <div className="flex flex-wrap gap-2">
                  {validationSummary.errosPorTipo.map((err) => (
                    <span key={err.type} className="rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs text-red-700">
                      {err.type}: {intFormatter.format(err.count)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
                  <select
                    value={validationStatusFilter}
                    onChange={(e) => setValidationStatusFilter(e.target.value as 'todos' | 'com_erro' | 'ok')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="com_erro">Com erro</option>
                    <option value="ok">Sem erro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Área</label>
                  <select
                    value={validationAreaFilter}
                    onChange={(e) => setValidationAreaFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                  >
                    <option value="todos">Todas</option>
                    {validationAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de erro</label>
                  <select
                    value={validationTypeFilter}
                    onChange={(e) => setValidationTypeFilter(e.target.value as 'todos' | 'obrigatorio' | 'formato' | 'faixa' | 'consistencia')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="obrigatorio">Obrigatório</option>
                    <option value="formato">Formato inválido</option>
                    <option value="faixa">Fora de faixa</option>
                    <option value="consistencia">Consistência</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Busca</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={validationSearch}
                      onChange={(e) => setValidationSearch(e.target.value)}
                      placeholder="Lead, etapa, funil ou campo..."
                      className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-2.5 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {intFormatter.format(filteredValidationRows.length)} contrato(s) fechado(s) no resultado atual.
              </p>
            </div>

            {ownerCards.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Erros por gestor responsável</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  {ownerCards.map((owner) => {
                    const isActive = validationOwnerFilter === owner.key
                    return (
                      <button
                        key={owner.key}
                        type="button"
                        onClick={() => setValidationOwnerFilter(isActive ? 'todos' : owner.key)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        title={isActive ? 'Clique para remover o filtro deste gestor' : 'Clique para filtrar por este gestor'}
                      >
                        <div className="flex items-center gap-2">
                          {owner.avatar ? (
                            <img src={owner.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                              {(owner.nome || '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{owner.nome}</p>
                            <p className="text-xs text-gray-500">{intFormatter.format(owner.leadsComErro)} contrato(s) fechado(s) com erro</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredValidationRows.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Nenhum resultado para os filtros aplicados.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredValidationRows.map((item) => {
                  const filteredIssues = item.issues.filter((issue) => {
                    if (validationAreaFilter !== 'todos' && issue.areaLabel !== validationAreaFilter) return false
                    if (validationTypeFilter !== 'todos' && issue.type !== validationTypeFilter) return false
                    return true
                  })
                  const isExpanded = expandedValidationRow === item.rowIndex
                  const issueCount = item.status === 'com_erro' ? filteredIssues.length : 0
                  return (
                    <div key={`${item.rowIndex}-${item.leadRef}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-3 py-3 items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{item.leadRef}</p>
                          <p className="text-xs text-gray-500">Linha {item.rowIndex}{item.dealId ? ` · Deal ${item.dealId}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Etapa</p>
                          <p className="text-sm text-gray-700 truncate">{item.stageName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Funil</p>
                          <p className="text-sm text-gray-700 truncate">{item.funil}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Inconsistências</p>
                          <p className={`text-sm font-semibold ${issueCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {intFormatter.format(issueCount)}
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedValidationRow(isExpanded ? null : item.rowIndex)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {isExpanded ? 'Ocultar' : 'Detalhes'}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/60">
                          {issueCount === 0 ? (
                            <p className="text-sm text-emerald-700">Nenhum erro para os filtros atuais.</p>
                          ) : (
                            <div className="space-y-2">
                              {filteredIssues.map((issue, idx) => (
                                <div key={`${item.rowIndex}-${issue.fieldKey}-${idx}`} className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                                  <p className="text-sm font-semibold text-red-800">{issue.message}</p>
                                  <p className="text-xs text-red-700 mt-0.5">
                                    Campo: <span className="font-medium">{issue.fieldLabel}</span>
                                    {issue.areaLabel ? ` · Área: ${issue.areaLabel}` : ''}
                                  </p>
                                  {issue.currentValue && (
                                    <p className="text-xs text-red-700 mt-0.5">Valor atual: {issue.currentValue}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </DashboardSection>

      <DashboardSection
        icon={<Search className="h-5 w-5" />}
        title="Auditoria financeira"
        description="Investigação detalhada por período, lead e área. Use apenas quando precisar validar preenchimento."
        fullWidth
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Abrir auditoria detalhada</p>
              <p className="text-xs text-gray-500">Esta seção fica por último para priorizar leitura executiva no topo.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditoriaSection((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {showAuditoriaSection ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAuditoriaSection ? 'Fechar auditoria' : 'Abrir auditoria'}
            </button>
          </div>

          {showAuditoriaSection && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">Explorador por período e lead</p>
                  <span className="text-xs text-gray-500">Selecione mês/ano, depois o contrato fechado para ver rateio por área.</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPeriodViewMode('mes')}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        periodViewMode === 'mes'
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Por mês
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodViewMode('ano')}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        periodViewMode === 'ano'
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Por ano
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {periodViewMode === 'mes' ? 'Mês' : 'Ano'}
                    </label>
                    <select
                      value={effectivePeriodKey}
                      onChange={(e) => setSelectedPeriodKey(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                    >
                      {periodOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contrato fechado no período</label>
                    <select
                      value={effectivePeriodLeadKey}
                      onChange={(e) => setSelectedPeriodLeadKey(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                    >
                      {periodLeadOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedLeadPeriodRows.length === 0 ? (
                  <p className="mt-3 text-xs text-gray-500">Sem dados de rateio para o período/lead selecionado.</p>
                ) : (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                        <p className="text-[11px] text-gray-500 uppercase">Áreas no período</p>
                        <p className="text-base font-bold text-gray-900">{intFormatter.format(selectedLeadPeriodSummary.totalAreas)}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="text-[11px] text-emerald-700 uppercase">Valor anual total</p>
                        <p className="text-base font-bold text-emerald-900">{formatBrl(selectedLeadPeriodSummary.valorAnual)}</p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                        <p className="text-[11px] text-blue-700 uppercase">Valor mensal total</p>
                        <p className="text-base font-bold text-blue-900">{formatBrl(selectedLeadPeriodSummary.valorMensal)}</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                        <p className="text-[11px] text-amber-700 uppercase">% médio</p>
                        <p className="text-base font-bold text-amber-900">{formatPct(selectedLeadPeriodSummary.percentualMedio)}</p>
                      </div>
                    </div>

                    <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Área</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Mês</th>
                            <th className="px-2.5 py-2 text-right font-semibold text-gray-600">% rateio</th>
                            <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor anual</th>
                            <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor mensal</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Valor preenchido</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-gray-600">% preenchido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {selectedLeadPeriodRows.map((row) => (
                            <tr key={`period-${row.rowIndex}-${row.areaKey}`}>
                              <td className="px-2.5 py-2 text-gray-700">
                                <AreaBadge areaKey={row.areaKey} label={row.area} />
                              </td>
                              <td className="px-2.5 py-2 text-gray-700">{row.monthLabel ?? '—'}</td>
                              <td className="px-2.5 py-2 text-right tabular-nums">
                                {row.percentualRateio == null ? '—' : formatPct(row.percentualRateio)}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorAnualArea)}</td>
                              <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorMensalArea)}</td>
                              <td className="px-2.5 py-2 text-gray-700">{row.rateioValorRaw || '—'}</td>
                              <td className="px-2.5 py-2 text-gray-700">{row.rateioPercentRaw || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Auditoria por lead (área de rateio)</p>
                    <p className="text-xs text-gray-500">Clique em “Ver leads da área” ou use os filtros abaixo.</p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      value={areaLeadAuditFilter}
                      onChange={(e) => setAreaLeadAuditFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="todos">Todas as áreas</option>
                      {areaCards.map((area) => (
                        <option key={area.areaKey} value={area.areaKey}>{area.area}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        value={areaLeadAuditSearch}
                        onChange={(e) => setAreaLeadAuditSearch(e.target.value)}
                        placeholder="Buscar lead/deal..."
                        className="rounded-lg border border-gray-300 bg-white pl-7 pr-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {intFormatter.format(areaLeadAuditRows.length)} registro(s) de participação de área.
                </p>
                <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Área</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Lead</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Deal</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Mês</th>
                        <th className="px-2.5 py-2 text-right font-semibold text-gray-600">% rateio</th>
                        <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor anual área</th>
                        <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor mensal área</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Valor preenchido</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">% preenchido</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Alerta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {areaLeadAuditRows.map((row) => (
                        <tr key={`${row.areaKey}-${row.rowIndex}-${row.leadRef}`}>
                          <td className="px-2.5 py-2 text-gray-700">
                            <AreaBadge areaKey={row.areaKey} label={row.area} />
                          </td>
                          <td className="px-2.5 py-2 font-medium text-gray-800">{row.leadRef}</td>
                          <td className="px-2.5 py-2 text-gray-600">{row.dealId ?? '—'}</td>
                          <td className="px-2.5 py-2 text-gray-600">{row.monthLabel ?? '—'}</td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{row.percentualRateio == null ? '—' : formatPct(row.percentualRateio)}</td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorAnualArea)}</td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorMensalArea)}</td>
                          <td className="px-2.5 py-2 text-gray-700">{row.rateioValorRaw || '—'}</td>
                          <td className="px-2.5 py-2 text-gray-700">{row.rateioPercentRaw || '—'}</td>
                          <td className="px-2.5 py-2 text-gray-700">
                            {row.consistencyMessage ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">{row.consistencyMessage}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardSection>

      <DashboardSection
        icon={<RefreshCw className="h-5 w-5" />}
        title="Sincronização RD x Planilha"
        description="Verifique divergências e, após validação, aplique as atualizações na planilha."
        fullWidth
      >
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-indigo-900">Sincronização RD x Planilha</p>
            <button
              type="button"
              onClick={onCheckSync}
              disabled={syncLoading}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"
            >
              {syncLoading && syncMode === 'check' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Verificar no RD
            </button>
            <button
              type="button"
              onClick={onApplySync}
              disabled={syncLoading || !syncReport?.dryRun || (syncReport?.stats?.updatesCount ?? 0) === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {syncLoading && syncMode === 'apply' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Aplicar atualizações (OK)
            </button>
          </div>
          <p className="mt-1 text-xs text-indigo-900/80">
            Primeiro clique em verificar. Depois revise as divergências e clique em aplicar para gravar na planilha.
          </p>
          {syncCheckedAt && (
            <p className="mt-1 text-[11px] text-indigo-900/70">
              Última verificação: {new Date(syncCheckedAt).toLocaleString('pt-BR')}
            </p>
          )}
          {syncError && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {syncError}
            </p>
          )}
          {syncReport && (
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-indigo-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500 uppercase">Contratos comparados</p>
                  <p className="text-sm font-semibold text-gray-900">{intFormatter.format(syncReport.stats.rowsMatchedRd)}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500 uppercase">Contratos com diferença</p>
                  <p className="text-sm font-semibold text-gray-900">{intFormatter.format(syncReport.stats.rowsChanged)}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500 uppercase">Células para atualizar</p>
                  <p className="text-sm font-semibold text-gray-900">{intFormatter.format(syncReport.stats.updatesCount)}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500 uppercase">Deals sem match RD</p>
                  <p className="text-sm font-semibold text-gray-900">{intFormatter.format(syncReport.stats.rowsNoRdMatch)}</p>
                </div>
              </div>
              {syncReport.sampleDivergences.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-indigo-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Linha</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Deal</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Campo</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Planilha</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">RD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {syncReport.sampleDivergences.slice(0, 40).map((item, idx) => (
                        <tr key={`${item.rowIndex}-${item.dealId}-${item.field}-${idx}`}>
                          <td className="px-2 py-1.5 text-gray-700">{item.rowIndex}</td>
                          <td className="px-2 py-1.5 text-gray-700">{item.dealId}</td>
                          <td className="px-2 py-1.5 text-gray-700">{item.field}</td>
                          <td className="px-2 py-1.5 text-gray-700">{item.oldValue || '—'}</td>
                          <td className="px-2 py-1.5 text-gray-900 font-medium">{item.newValue || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                  Nenhuma divergência encontrada entre RD e planilha para os campos financeiros.
                </p>
              )}
            </div>
          )}
        </div>
      </DashboardSection>

      {selectedLeadModalHeader && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:items-center sm:p-4">
          <div className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedLeadModalHeader.leadRef}</p>
                <p className="text-xs text-gray-500">
                  Deal: {selectedLeadModalHeader.dealId ?? '—'} · Etapa: {selectedLeadModalHeader.stageName || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadModalKey(null)}
                className="ml-auto rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase">Áreas</p>
                  <p className="text-base font-bold text-gray-900">{intFormatter.format(selectedLeadModalHeader.areas)}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                  <p className="text-[11px] text-blue-700 uppercase">Total mensal</p>
                  <p className="text-base font-bold text-blue-900">{formatBrl(selectedLeadModalHeader.valorMensal)}</p>
                </div>
                {rateioPieMode === 'anual' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <p className="text-[11px] text-emerald-700 uppercase">Total anual</p>
                    <p className="text-base font-bold text-emerald-900">{formatBrl(selectedLeadModalHeader.valorAnual)}</p>
                  </div>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase">Link contrato</p>
                  {selectedLeadMeta?.linkContrato ? (
                    <a href={selectedLeadMeta.linkContrato} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline break-all">
                      {selectedLeadMeta.linkContrato}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">Não preenchido</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase">Link proposta</p>
                  {selectedLeadMeta?.linkProposta ? (
                    <a href={selectedLeadMeta.linkProposta} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline break-all">
                      {selectedLeadMeta.linkProposta}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">Não preenchido</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-2.5 sm:col-span-2">
                  <p className="text-[11px] text-gray-500 uppercase">Objeto do Contrato [CC]</p>
                  <p className="text-xs text-gray-800 whitespace-pre-wrap">
                    {selectedLeadMeta?.objetoContratoCc || 'Não preenchido'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase">Negociação no RD</p>
                  {selectedLeadModalHeader.dealId ? (
                    <a
                      href={`${RD_CRM_DEAL_URL}${selectedLeadModalHeader.dealId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 underline break-all"
                    >
                      {`${RD_CRM_DEAL_URL}${selectedLeadModalHeader.dealId}`}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">Deal não informado</p>
                  )}
                </div>
              </div>
              {selectedLeadMeta?.observacoesFinanceiro && (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase">Observações financeiras</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedLeadMeta.observacoesFinanceiro}</p>
                </div>
              )}
              {selectedLeadTopAlerts.length > 0 && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                  <p className="text-[11px] font-semibold uppercase text-red-700">Alertas visuais (por que está zerando/não mostrando)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedLeadTopAlerts.map((alert, idx) => (
                      <span key={`top-alert-${idx}`} className="rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] text-red-800">
                        {alert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Área</th>
                      <th className="px-2.5 py-2 text-right font-semibold text-gray-600">% rateio</th>
                      <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor mensal</th>
                      {rateioPieMode === 'anual' && (
                        <th className="px-2.5 py-2 text-right font-semibold text-gray-600">Valor anual</th>
                      )}
                      <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Valor preenchido</th>
                      <th className="px-2.5 py-2 text-left font-semibold text-gray-600">% preenchido</th>
                      <th className="px-2.5 py-2 text-left font-semibold text-gray-600">Alerta visual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {selectedLeadModalRows.map((row) => {
                      const areaAlerts = getAreaVisualAlerts(row, selectedLeadMeta, rateioPieMode)
                      return (
                      <tr key={`modal-${row.rowIndex}-${row.areaKey}`}>
                        <td className="px-2.5 py-2 text-gray-700">
                          <AreaBadge areaKey={row.areaKey} label={row.area} />
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums">
                          {row.percentualRateio == null ? '—' : formatPct(row.percentualRateio)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorMensalArea)}</td>
                        {rateioPieMode === 'anual' && (
                          <td className="px-2.5 py-2 text-right tabular-nums">{formatBrl(row.valorAnualArea)}</td>
                        )}
                        <td className="px-2.5 py-2 text-gray-700">{row.rateioValorRaw || '—'}</td>
                        <td className="px-2.5 py-2 text-gray-700">{row.rateioPercentRaw || '—'}</td>
                        <td className="px-2.5 py-2 text-gray-700">
                          {areaAlerts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {areaAlerts.map((alert, idx) => (
                                <span key={`area-alert-${row.areaKey}-${idx}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                                  {alert}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-800">Preenchimento atual na planilha</p>
                <p className="mt-1 text-xs text-gray-500">
                  Este detalhe mostra apenas os dados já preenchidos na planilha para o lead selecionado.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                    <p className="text-[11px] text-gray-500 uppercase">Primeiro faturamento (planilha)</p>
                    <p className="text-xs text-gray-800">{selectedLeadMeta?.primeiroFaturamentoRaw || 'Não preenchido'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                    <p className="text-[11px] text-gray-500 uppercase">Valor 1º faturamento (planilha)</p>
                    <p className="text-xs text-gray-800">{selectedLeadMeta?.valorPrimeiroFaturamentoRaw || 'Não preenchido'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                    <p className="text-[11px] text-gray-500 uppercase">Valor contrato anual (planilha)</p>
                    <p className="text-xs text-gray-800">{selectedLeadMeta?.valorContratoAnualRaw || 'Não preenchido'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
