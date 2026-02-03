/**
 * Página de análise e gráficos a partir dos dados da planilha (Google Sheets).
 * Filtro por ano/mês, motivos de perda em lista, solicitantes com foto, cards clicáveis com detalhe do lead.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  PieChart as PieChartIcon,
  X,
  ExternalLink,
  List,
  Target,
  Percent,
  Award,
  Copy,
  FileText,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  LayoutDashboard,
  AlertCircle,
  Users,
  Send,
  BarChart2,
  Activity,
  Table2,
  UserPlus,
  Zap,
  Globe,
  Mail,
  Briefcase,
  UserCheck,
  Calculator,
  Building2,
  UserCog,
  MoreHorizontal,
} from 'lucide-react'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { AiAssistant } from '@/components/ai/AiAssistant'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { getTeamMember, getSolicitanteKey, getAreaByEmail } from '@/data/teamAvatars'

/** Detalhe de lead sem área: nome do solicitante e nome do lead (para exibir no relatório). */
type SemAreaDetalhe = { solicitanteNome: string; leadNome: string }
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'crm-bp-google-oauth'
const PLANILHA_ID = import.meta.env.VITE_PLANILHA_ID || '14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI'
const PLANILHA_ABA = import.meta.env.VITE_PLANILHA_ABA || ''
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'

/** Labels em português para colunas da planilha (exibir no modal de detalhe) */
const PLANILHA_LABELS: Record<string, string> = {
  stage_name: 'Etapa',
  stage_id: 'ID da etapa',
  nome: 'Nome',
  deal_id: 'Deal ID',
  estado: 'Estado',
  solicitante: 'Solicitante',
  lead: 'Lead',
  razao_social: 'Razão social',
  cnpj: 'CNPJ',
  demais_razoes_sociais: 'Demais razões sociais',
  razao_social_completa: 'Razão social completa',
  areas_analise: 'Áreas de análise',
  prazo_entrega_data: 'Prazo entrega (data)',
  prazo_entrega_hora: 'Prazo entrega (hora)',
  local_reuniao: 'Local reunião',
  data_reuniao: 'Data reunião',
  horario_reuniao: 'Horário reunião',
  email_solicitante: 'E-mail solicitante',
  havera_due_diligence: 'Haverá due diligence',
  areas_comparecimento: 'Áreas comparecimento',
  indicacao: 'Indicação',
  tipo_instrumento: 'Tipo instrumento',
  tipo_lead: 'Tipo de lead',
  nome_indicacao: 'Nome indicação',
  limitacao_processos: 'Limitação processos',
  limitacao_horas: 'Limitação horas',
  exito: 'Êxito',
  valores: 'Valores',
  tipo_pagamento: 'Tipo pagamento',
  link_arquivo_due: 'Link arquivo due',
  prazo_entrega_contrato: 'Prazo entrega contrato',
  data_assinatura_contrato: 'Data assinatura contrato',
  link_contrato: 'Link contrato',
  areas_cp: 'Áreas CP',
  gestor_contrato: 'Gestor contrato',
  captador: 'Captador',
  tributacao: 'Tributação',
  informacoes_adicionais: 'Informações adicionais',
  data_primeiro_vencimento: 'Data primeiro vencimento',
  prazo_entrega_cp: 'Prazo entrega CP',
  qualificacao_completa: 'Qualificação completa',
  realizou_due_diligence: 'Realizou due diligence',
  nome_ponto_focal: 'Nome ponto focal',
  email_ponto_focal: 'E-mail ponto focal',
  telefone_ponto_focal: 'Telefone ponto focal',
  link_proposta: 'Link proposta',
  status_cadastro: 'Status cadastro',
  razao_social_principal_cadastro: 'Razão social principal (cadastro)',
  cnpj_cpf_cadastro: 'CNPJ/CPF cadastro',
  endereco_cadastro: 'Endereço cadastro',
  escopo_contratual_cadastro: 'Escopo contratual cadastro',
  qualificacao_socios_cadastro: 'Qualificação sócios cadastro',
  consulta_auto_cadastro: 'Consulta auto cadastro',
  info_adicionais_cadastro: 'Info adicionais cadastro',
  id_sharepoint: 'ID SharePoint',
  razao_social_financeiro: 'Razão social (financeiro)',
  cpf_cnpj_financeiro: 'CPF/CNPJ financeiro',
  vigencia_contrato_financeiro: 'Vigência contrato financeiro',
  primeiro_faturamento_financeiro: 'Primeiro faturamento financeiro',
  responsavel_cliente_financeiro: 'Responsável cliente financeiro',
  posicao_responsavel_financeiro: 'Posição responsável financeiro',
  email_responsavel_financeiro: 'E-mail responsável financeiro',
  telefone_responsavel_financeiro: 'Telefone responsável financeiro',
  repasse_acordado_financeiro: 'Repasse acordado financeiro',
  mensal_fixo_financeiro: 'Mensal fixo financeiro',
  mensal_escalonado_financeiro: 'Mensal escalonado financeiro',
  mensal_variavel_financeiro: 'Mensal variável financeiro',
  mensal_condicionado_financeiro: 'Mensal condicionado financeiro',
  spot_financeiro: 'Spot financeiro',
  spot_manutencao_financeiro: 'Spot manutenção financeiro',
  spot_parcelado_financeiro: 'Spot parcelado financeiro',
  spot_parcelado_manutencao_financeiro: 'Spot parcelado manutenção financeiro',
  spot_condicionado_financeiro: 'Spot condicionado financeiro',
  exito_financeiro: 'Êxito financeiro',
  rateio_valor_insolvencia_financeiro: 'Rateio valor insolvência',
  rateio_porcentagem_insolvencia_financeiro: 'Rateio % insolvência',
  rateio_valor_civel_financeiro: 'Rateio valor cível',
  rateio_porcentagem_civel_financeiro: 'Rateio % cível',
  rateio_valor_trabalhista_financeiro: 'Rateio valor trabalhista',
  rateio_porcentagem_trabalhista_financeiro: 'Rateio % trabalhista',
  rateio_valor_tributario_financeiro: 'Rateio valor tributário',
  rateio_porcentagem_tributario_financeiro: 'Rateio % tributário',
  rateio_valor_contratos_financeiro: 'Rateio valor contratos',
  rateio_porcentagem_contratos_financeiro: 'Rateio % contratos',
  rateio_valor_add_financeiro: 'Rateio valor ADD',
  rateio_porcentagem_add_financeiro: 'Rateio % ADD',
  indice_reajuste_financeiro: 'Índice reajuste financeiro',
  periodicidade_reajuste_financeiro: 'Periodicidade reajuste financeiro',
  observacoes_financeiro: 'Observações financeiro',
  mensal_preco_fechado_financeiro: 'Mensal preço fechado financeiro',
  id_sharepoint_financeiro: 'ID SharePoint financeiro',
  status_financeiro: 'Status financeiro',
  motivo_perda: 'Motivo perda',
  motivo_perda_anotacao: 'Anotação do motivo de perda',
  date_create: 'Data criação',
  date_update: 'Data atualização',
  nome_lead: 'Nome lead',
  updated_at: 'Data atualização',
  created_at: 'Data criação',
  funil: 'Funil',
  cadastrado_por: 'Cadastro realizado por',
  due_diligence: 'Due diligence',
  prazo_reuniao_due: 'Prazo reunião due',
  horario_due: 'Horário due',
  tipo_de_lead: 'Tipo de lead',
  link_da_proposta: 'Link proposta',
  link_do_contrato: 'Link contrato',
  valor_mensal_fixo_cc: 'Mensal fixo [CC]',
  valor_mensal_preco_fechado_cc: 'Mensal preço fechado [CC]',
  valor_exito_cc: 'Êxito [CC]',
  gestor_contrato_cp: 'Gestor contrato [CP]',
  razao_social_cp: 'Razão social [CP]',
  cnpj_cp: 'CNPJ [CP]',
  prazo_contrato_cc: 'Prazo contrato [CC]',
  objeto_contrato_cc: 'Objeto contrato [CC]',
}

type RowStatus = 'win' | 'lost' | 'ongoing'

type PlanilhaRow = {
  rowIndex: number
  valid: boolean
  status?: RowStatus | null
  status_raw?: string | null
  email_solicitante?: string | null
  email_notificar?: string | null
  motivo_perda?: string | null
  motivo_perda_anotacao?: string | null
  stage_name?: string | null
  funil?: string | null
  id_registro?: string | null
  deal_id?: string | null
  updated_at_iso?: string | null
  created_at_iso?: string | null
  razao_social?: string | null
  nome_lead?: string | null
  valor_mensal_fixo_cc?: string | null
  valor_exito_cc?: string | null
  valor_mensal_preco_fechado_cc?: string | null
  /** Áreas de análise (planilha); pode ser string "Cível, Tributário" */
  areas?: string | null
  tipo_lead?: string | null
  nome_indicacao?: string | null
  indicacao?: string | null
  /** Dados completos da planilha (colunas brutas) para o modal de detalhe */
  planilha?: Record<string, string | null | undefined>
}

type ApiResponse = {
  results: PlanilhaRow[]
  total: number
  comErros: number
}

const TOKEN_GRACE_MS = 60 * 1000

function loadStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { access_token, expires_at } = JSON.parse(raw)
    if (!access_token || !expires_at) return null
    if (expires_at <= Date.now() - TOKEN_GRACE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return access_token
  } catch {
    return null
  }
}

function saveToken(access_token: string, expires_in: number) {
  try {
    const sec = typeof expires_in === 'number' && expires_in > 0 ? expires_in : 3600
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      access_token,
      expires_at: Date.now() + sec * 1000,
    }))
  } catch {
    /* ignore */
  }
}

/** Ano/mês em UTC a partir do ISO (evita diferença por fuso ao filtrar) */
function getYearMonthUTC(iso: string | null | undefined): { year: number; month: number } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

/** Filtro e listas por ano/mês usam sempre a DATA DE CRIAÇÃO (Date_Create), não a de atualização. */
function getAnosDisponiveis(rows: PlanilhaRow[]): number[] {
  const anos = new Set<number>()
  rows.forEach((r) => {
    const ym = getYearMonthUTC(r.created_at_iso)
    if (ym) anos.add(ym.year)
  })
  return Array.from(anos).sort((a, b) => b - a)
}

function getMesesDisponiveis(rows: PlanilhaRow[], ano: number): number[] {
  const meses = new Set<number>()
  rows.forEach((r) => {
    const ym = getYearMonthUTC(r.created_at_iso)
    if (ym && ym.year === ano) meses.add(ym.month)
  })
  return Array.from(meses).sort((a, b) => a - b)
}

function filterByAnoMes(rows: PlanilhaRow[], ano: number | '', mes: number | ''): PlanilhaRow[] {
  if (!ano) return rows
  return rows.filter((r) => {
    const ym = getYearMonthUTC(r.created_at_iso)
    if (!ym) return false
    if (ym.year !== ano) return false
    if (mes) return ym.month === mes
    return true
  })
}

function filterByFunil(rows: PlanilhaRow[], funil: string): PlanilhaRow[] {
  if (!funil) return rows
  return rows.filter((r) => (r.funil ?? '').trim() === funil)
}

function filterBySolicitante(rows: PlanilhaRow[], emailKey: string, getKey: (email: string) => string): PlanilhaRow[] {
  if (!emailKey) return rows
  return rows.filter((r) => {
    const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
    const key = e ? getKey(e) : '(sem e-mail)'
    return key === emailKey
  })
}

/** Filtro por área = tag do solicitante (Sócio, Cível, Trabalhista, etc.). */
function filterByArea(rows: PlanilhaRow[], area: string, getArea: (email: string) => string | null): PlanilhaRow[] {
  if (!area) return rows
  return rows.filter((r) => {
    const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
    const tag = e ? getArea(e) : null
    return tag === area
  })
}

/** Filtro por etapas: selectedEtapas vazio = todas; senão só stage_name em selectedEtapas. */
function filterByEtapas(rows: PlanilhaRow[], selectedEtapas: string[]): PlanilhaRow[] {
  if (!selectedEtapas.length) return rows
  const set = new Set(selectedEtapas)
  return rows.filter((r) => set.has((r.stage_name ?? '').trim()))
}

const COLORS_PIE = ['#14324f', '#d5b170', '#2d936c', '#6b7280', '#dc2626', '#7c3aed', '#0d9488']
const TOP_N = 5
const LISTA_LEADS_INICIAL = 15

/** Manual: significado de cada tipo de lead (salesFunnel) + ícone para o dashboard */
const TIPO_LEAD_MANUAL: Record<string, { icon: JSX.Element; description: string }> = {
  Indicação: {
    icon: <UserPlus className="h-5 w-5" />,
    description: 'Lead indicado por alguém (Fundo, Consultor, Cliente, etc.). Campos Indicação e Nome da Indicação obrigatórios.',
  },
  'Lead Ativa': {
    icon: <Zap className="h-5 w-5" />,
    description: 'Prospecção ativa: lead captado pela equipe em busca ativa de oportunidades.',
  },
  'Lead Digital': {
    icon: <Globe className="h-5 w-5" />,
    description: 'Captado digitalmente: site, redes sociais, campanhas online ou canais digitais.',
  },
  'Lead Passiva': {
    icon: <Mail className="h-5 w-5" />,
    description: 'Chegou espontaneamente: lead que entrou em contato por iniciativa própria.',
  },
  'Não informado': {
    icon: <List className="h-5 w-5" />,
    description: 'Tipo de lead não preenchido na planilha.',
  },
}

/** Ícones por categoria de indicação (quando tipo = Indicação). */
const INDICACAO_ICONS: Record<string, JSX.Element> = {
  Fundo: <Building2 className="h-4 w-4" />,
  Consultor: <Briefcase className="h-4 w-4" />,
  Cliente: <UserCheck className="h-4 w-4" />,
  Contador: <Calculator className="h-4 w-4" />,
  Sindicatos: <Users className="h-4 w-4" />,
  'Conselhos profissionais': <Award className="h-4 w-4" />,
  Colaborador: <UserCog className="h-4 w-4" />,
  'Outros parceiros': <MoreHorizontal className="h-4 w-4" />,
}

/** Recap: Dashboard em seções (DashboardSection). Ordem: Filtros | Pipeline & Métricas (KPIs) | [Motivos de perda | Resumo por status + Relatórios] (2 cols) | Ranking performance | Etapas funil | Lista de leads | Leads perdidas por solicitante | Leads vendidas (condicional) | Modal detalhe. Ícones: Filter, LayoutDashboard, AlertCircle, BarChart2, Send, Award, Table2, Activity, Users. */
const MESES_LABEL: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
  7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
}

/** Etapas que a API ignora (não entram na análise). Deve estar em sync com api/validar-sheets.js DISREGARD_STAGE_NAMES */
const STAGES_IGNORADOS = [
  'Contato Inicial',
  'Contato feito',
  'Contato Trimestral',
  'Descartados',
  'Mensagem Enviada',
  'Suspenso',
  'Lead Quente',
  'Contato Mensal',
  'Lead Capturado',
  'Reunião Realizada',
  'Contatos',
  'Novos Contatos',
  'Execução do Serviço',
]

/** Etapas do Funil de vendas (ordem oficial). */
const ETAPAS_FUNIL_VENDAS = [
  'Levantamento dos dados',
  'Compilação',
  'Revisão',
  'Due Dilligence Finalizada',
  'Reunião',
  'Confecção de Proposta',
  'Proposta enviada',
  'Confecção do Contrato',
  'Contrato Elaborado',
  'Contrato Enviado',
  'Contrato Assinado',
]

function sortEtapasByFunil(etapas: string[]): string[] {
  const naOrdem = ETAPAS_FUNIL_VENDAS.filter((e) => etapas.includes(e))
  const outras = etapas.filter((e) => !ETAPAS_FUNIL_VENDAS.includes(e)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return [...naOrdem, ...outras]
}

/** Dados de um solicitante para o card do pódio (ranking de performance). */
type PodiumCardData = {
  emailKey: string
  nome: string
  avatar: string | null
  area: string | null
  total: number
  won: number
  lost: number
  ongoing: number
  conversionRate: number
  winRate: number
  rank: number
}

/** Card do pódio: avatar, nome, tag de área, posição. No hover revela ganhas/perdidas/em andamento, taxas e barra. */
function PodiumCard({
  p,
  position,
  height,
  medalClass,
  onClick,
  isSelected,
}: {
  p: PodiumCardData
  position: 1 | 2 | 3
  height: string
  medalClass: string
  onClick: () => void
  isSelected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center rounded-2xl border-2 px-5 py-4 min-w-[160px] max-w-[200px] transition-all duration-300 hover:scale-[1.03] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50',
        height,
        isSelected ? 'border-post bg-post/10 ring-2 ring-post/30 shadow-lg' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 shadow-md'
      )}
    >
      <span className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-full text-base font-bold shadow', medalClass)}>
        {position}
      </span>
      {p.avatar ? (
        <img src={p.avatar} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-lg mb-3" />
      ) : (
        <div className="h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-xl ring-2 ring-white shadow-lg mb-3">
          {(p.nome || '?').charAt(0)}
        </div>
      )}
      <p className="font-semibold text-gray-900 text-center text-base leading-tight truncate w-full" title={p.nome}>
        {p.nome}
      </p>
      {p.area && (
        <span className="mt-1.5 inline-block rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
          {p.area}
        </span>
      )}
      {/* Detalhes no hover */}
      <div className="mt-3 w-full pt-3 border-t border-gray-200/80 opacity-0 max-h-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-36 transition-all duration-300 text-left">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
          <span className="text-post font-semibold">{p.won} ganhas</span>
          <span className="text-red-600">{p.lost} perdidas</span>
          <span className="text-gray-500">{p.ongoing} and.</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            <Percent className="h-3 w-3" />
            {p.conversionRate}%
          </span>
          {p.won + p.lost > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-post/15 px-2 py-0.5 text-xs font-semibold text-post">
              <Target className="h-3 w-3" />
              {p.winRate}%
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden flex">
          <div className="bg-post transition-all" style={{ width: `${p.total > 0 ? (p.won / p.total) * 100 : 0}%` }} title="Ganhas" />
          <div className="bg-red-400 transition-all" style={{ width: `${p.total > 0 ? (p.lost / p.total) * 100 : 0}%` }} title="Perdidas" />
          <div className="bg-gray-400 transition-all" style={{ width: `${p.total > 0 ? (p.ongoing / p.total) * 100 : 0}%` }} title="Em andamento" />
        </div>
      </div>
    </button>
  )
}

export function AnalisePlanilha() {
  const [accessToken, setAccessToken] = useState<string | null>(() => loadStoredToken())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [filterAno, setFilterAno] = useState<number | ''>('')
  const [filterMes, setFilterMes] = useState<number | ''>('')
  const [filterFunil, setFilterFunil] = useState<string>('')
  const [filterSolicitante, setFilterSolicitante] = useState<string>('')
  const [filterArea, setFilterArea] = useState<string>('')
  /** Etapas a considerar: vazio = todas; senão só estas. */
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([])
  const [showWonLeadsPanel, setShowWonLeadsPanel] = useState(false)
  const [selectedSolicitanteKey, setSelectedSolicitanteKey] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<PlanilhaRow | null>(null)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      const sec = typeof tokenResponse.expires_in === 'number' && tokenResponse.expires_in > 0 ? tokenResponse.expires_in : 3600
      setAccessToken(tokenResponse.access_token)
      saveToken(tokenResponse.access_token, sec)
      setError(null)
    },
    onError: () => setError('Não foi possível conectar com o Google. Tente novamente.'),
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
  })

  const loadPlanilha = useCallback(async () => {
    if (!accessToken || !PLANILHA_ID.trim()) {
      setError(accessToken ? 'Configure VITE_PLANILHA_ID em .env ou .env.local.' : 'Conecte-se com o Google primeiro.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/validar-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          spreadsheetId: PLANILHA_ID.trim(),
          sheetName: (PLANILHA_ABA || '').trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || json.error || 'Erro ao carregar planilha.')
        return
      }
      setData(json)
      const rows = json.results ?? []
      const temFunilVendas = rows.some((r: PlanilhaRow) => (r.funil ?? '').trim() === 'Funil de vendas')
      setFilterFunil(temFunilVendas ? 'Funil de vendas' : '')
      setFilterSolicitante('')
      setFilterArea('')
      setSelectedEtapas([])
      setFilterAno('')
      setFilterMes('')
      setShowWonLeadsPanel(false)
      setSelectedSolicitanteKey(null)
      setSelectedLead(null)
    } catch (e) {
      setError('Não foi possível falar com o servidor. Use "npm run dev" ou verifique a API.')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (accessToken && PLANILHA_ID.trim()) loadPlanilha()
  }, [accessToken, loadPlanilha])

  const rawResults = data?.results ?? []
  const getSolicitanteLabel = useCallback((email: string) => {
    const member = getTeamMember(email)
    return (member?.name ?? email) || '(sem e-mail)'
  }, [])
  const getSolicitanteAvatar = useCallback((email: string) => getTeamMember(email)?.avatar ?? null, [])
  const funisDisponiveis = useMemo(() => {
    const set = new Set<string>()
    rawResults.forEach((r) => {
      const f = (r.funil ?? '').trim()
      if (f) set.add(f)
    })
    return Array.from(set).sort()
  }, [rawResults])
  const solicitantesDisponiveis = useMemo(() => {
    const set = new Map<string, string>()
    rawResults.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      if (!set.has(key)) set.set(key, getSolicitanteLabel(key === '(sem e-mail)' ? '' : key))
    })
    return Array.from(set.entries()).map(([key, nome]) => ({ key, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rawResults])
  /** Áreas = tags dos solicitantes (Sócio, Cível, Trabalhista, Reestruturação, etc.). */
  const areasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    rawResults.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const tag = e ? getAreaByEmail(e) : null
      if (tag) set.add(tag)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rawResults])
  const anosDisponiveis = useMemo(() => getAnosDisponiveis(rawResults), [rawResults])
  const mesesDisponiveis = useMemo(() => {
    const base = filterByFunil(rawResults, filterFunil)
    const bySol = filterSolicitante ? filterBySolicitante(base, filterSolicitante, getSolicitanteKey) : base
    const byArea = filterArea ? filterByArea(bySol, filterArea, getAreaByEmail) : bySol
    return filterAno ? getMesesDisponiveis(byArea, filterAno) : []
  }, [rawResults, filterFunil, filterSolicitante, filterArea, filterAno])
  /** Etapas (stage_name) que existem nos dados (após API). Ordem: primeiro as do funil oficial, depois as demais. */
  const etapasDisponiveisParaFiltro = useMemo(() => {
    const set = new Set<string>()
    rawResults.forEach((r) => {
      const s = (r.stage_name ?? '').trim()
      if (s) set.add(s)
    })
    const naOrdem = ETAPAS_FUNIL_VENDAS.filter((e) => set.has(e))
    const outras = Array.from(set).filter((e) => !ETAPAS_FUNIL_VENDAS.includes(e)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [...naOrdem, ...outras]
  }, [rawResults])

  const results = useMemo(() => {
    let rows = filterByFunil(rawResults, filterFunil)
    if (filterSolicitante) rows = filterBySolicitante(rows, filterSolicitante, getSolicitanteKey)
    if (filterArea) rows = filterByArea(rows, filterArea, getAreaByEmail)
    rows = filterByAnoMes(rows, filterAno, filterMes)
    return filterByEtapas(rows, selectedEtapas)
  }, [rawResults, filterFunil, filterSolicitante, filterArea, filterAno, filterMes, selectedEtapas])

  const resumo = useMemo(() => {
    const won = results.filter((r) => r.status === 'win').length
    const lost = results.filter((r) => r.status === 'lost').length
    const ongoing = results.filter((r) => r.status === 'ongoing' || (r.status !== 'win' && r.status !== 'lost')).length
    const total = results.length
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0
    const lossRate = total > 0 ? Math.round((lost / total) * 100) : 0
    return { total, won, lost, ongoing, conversionRate, winRate, lossRate }
  }, [results])

  const motivoPerdaData = useMemo(() => {
    const lostRows = results.filter((r) => r.status === 'lost')
    const map = new Map<string, number>()
    lostRows.forEach((r) => {
      const motivo = (r.motivo_perda ?? '').trim() || 'Não informado'
      map.set(motivo, (map.get(motivo) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [results])

  /** Motivos de perda agrupados por área (tag do solicitante). Para cada área: total de perdidas e lista de motivos com quantidade. */
  type MotivoPerdaPorAreaItem = { area: string; totalLost: number; motivos: { name: string; value: number }[] }
  const motivoPerdaPorAreaData = useMemo((): MotivoPerdaPorAreaItem[] => {
    const lostRows = results.filter((r) => r.status === 'lost')
    const byArea = new Map<string, Map<string, number>>()
    lostRows.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const area = e ? getAreaByEmail(e) : null
      const areaKey = area ?? '(sem área)'
      let areaMap = byArea.get(areaKey)
      if (!areaMap) {
        areaMap = new Map<string, number>()
        byArea.set(areaKey, areaMap)
      }
      const motivo = (r.motivo_perda ?? '').trim() || 'Não informado'
      areaMap.set(motivo, (areaMap.get(motivo) ?? 0) + 1)
    })
    return Array.from(byArea.entries())
      .map(([area, motivoMap]) => {
        const motivos = Array.from(motivoMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
        const totalLost = motivos.reduce((s, m) => s + m.value, 0)
        return { area, totalLost, motivos }
      })
      .sort((a, b) => b.totalLost - a.totalLost)
  }, [results])

  type SolicitanteItem = { emailKey: string; nome: string; total: number; avatar: string | null }
  const vendidasPorSolicitante = useMemo(() => {
    const wonRows = results.filter((r) => r.status === 'win')
    const map = new Map<string, number>()
    wonRows.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([emailKey, total]) => ({
        emailKey,
        nome: getSolicitanteLabel(emailKey === '(sem e-mail)' ? '' : emailKey),
        total,
        avatar: getSolicitanteAvatar(emailKey === '(sem e-mail)' ? '' : emailKey),
      }))
      .sort((a, b) => b.total - a.total) as SolicitanteItem[]
  }, [results])

  /** Performance por solicitante: total, ganhas, perdidas, conversão, win rate, área (tag) */
  type PerformanceSolicitante = {
    emailKey: string
    nome: string
    avatar: string | null
    area: string | null
    total: number
    won: number
    lost: number
    ongoing: number
    conversionRate: number
    winRate: number
    rank: number
  }
  const performancePorSolicitante = useMemo(() => {
    const byKey = new Map<string, { won: number; lost: number; ongoing: number }>()
    results.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      const cur = byKey.get(key) ?? { won: 0, lost: 0, ongoing: 0 }
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      byKey.set(key, cur)
    })
    const arr = Array.from(byKey.entries())
      .map(([emailKey, counts]) => {
        const total = counts.won + counts.lost + counts.ongoing
        const conversionRate = total > 0 ? Math.round((counts.won / total) * 100) : 0
        const winRate = counts.won + counts.lost > 0 ? Math.round((counts.won / (counts.won + counts.lost)) * 100) : 0
        const area = emailKey !== '(sem e-mail)' ? getAreaByEmail(emailKey) : null
        return {
          emailKey,
          nome: getSolicitanteLabel(emailKey === '(sem e-mail)' ? '' : emailKey),
          avatar: getSolicitanteAvatar(emailKey === '(sem e-mail)' ? '' : emailKey),
          area,
          total,
          won: counts.won,
          lost: counts.lost,
          ongoing: counts.ongoing,
          conversionRate,
          winRate,
          rank: 0,
        }
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.won - a.won)
    arr.forEach((p, i) => {
      p.rank = i + 1
    })
    return arr as PerformanceSolicitante[]
  }, [results])

  const perdidasPorSolicitante = useMemo(() => {
    const lostRows = results.filter((r) => r.status === 'lost')
    const map = new Map<string, number>()
    lostRows.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([emailKey, total]) => ({
        emailKey,
        nome: getSolicitanteLabel(emailKey === '(sem e-mail)' ? '' : emailKey),
        total,
        avatar: getSolicitanteAvatar(emailKey === '(sem e-mail)' ? '' : emailKey),
      }))
      .sort((a, b) => b.total - a.total) as SolicitanteItem[]
  }, [results])

  /** Lê campo da linha (top-level ou planilha bruta) para tipo_lead, nome_indicacao, indicacao. Suporta colunas alternativas (ex.: tipo_de_lead). */
  const getLeadField = useCallback((r: PlanilhaRow, key: 'tipo_lead' | 'nome_indicacao' | 'indicacao') => {
    const planilha = r.planilha as Record<string, string | null | undefined> | undefined
    const raw =
      r[key] ??
      (planilha && (planilha[key] ?? (key === 'tipo_lead' ? planilha['tipo_de_lead'] : undefined))) ??
      ''
    const s = String(raw).trim()
    return s || null
  }, [])

  /** Dados para tipo de lead com vendidas / em andamento / perdidas por tipo */
  const tipoLeadComStatus = useMemo(() => {
    const map = new Map<string, { won: number; lost: number; ongoing: number }>()
    results.forEach((r) => {
      const v = getLeadField(r, 'tipo_lead') ?? 'Não informado'
      const cur = map.get(v) ?? { won: 0, lost: 0, ongoing: 0 }
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      map.set(v, cur)
    })
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        value: counts.won + counts.lost + counts.ongoing,
        won: counts.won,
        lost: counts.lost,
        ongoing: counts.ongoing,
      }))
      .sort((a, b) => b.value - a.value)
  }, [results, getLeadField])

  /** Dados para gráfico: indicação (contagem por valor: Sim, Não, etc.) */
  const indicacaoChartData = useMemo(() => {
    const map = new Map<string, number>()
    results.forEach((r) => {
      const v = getLeadField(r, 'indicacao') ?? 'Não informado'
      map.set(v, (map.get(v) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [results, getLeadField])

  /** Indicação (categoria) com vendidas / em andamento / perdidas — para relatório */
  const indicacaoComStatus = useMemo(() => {
    const map = new Map<string, { won: number; lost: number; ongoing: number }>()
    results.forEach((r) => {
      const v = getLeadField(r, 'indicacao') ?? 'Não informado'
      const cur = map.get(v) ?? { won: 0, lost: 0, ongoing: 0 }
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      map.set(v, cur)
    })
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        value: counts.won + counts.lost + counts.ongoing,
        won: counts.won,
        lost: counts.lost,
        ongoing: counts.ongoing,
      }))
      .sort((a, b) => b.value - a.value)
  }, [results, getLeadField])

  /** Dados para gráfico: nome indicação (top indicadores por quantidade de leads) */
  const nomeIndicacaoChartData = useMemo(() => {
    const map = new Map<string, number>()
    results.forEach((r) => {
      const v = getLeadField(r, 'nome_indicacao')
      if (!v) return
      map.set(v, (map.get(v) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [results, getLeadField])

  /** Filtro da lista "Nome indicação" por categoria de Indicação (clique em um card de Indicação). */
  const [filterIndicacaoParaNome, setFilterIndicacaoParaNome] = useState<string | null>(null)

  /** Nome da indicação clicado: abre mini lista dos leads que essa pessoa indicou. */
  const [selectedNomeIndicacao, setSelectedNomeIndicacao] = useState<string | null>(null)

  /** Leads indicados pela pessoa selecionada em "Nome indicação" (para mini lista). */
  const leadsIndicadosPorNome = useMemo(() => {
    if (!selectedNomeIndicacao) return []
    return results.filter((r) => getLeadField(r, 'nome_indicacao') === selectedNomeIndicacao)
  }, [results, getLeadField, selectedNomeIndicacao])

  /** Tipo de lead clicado: mostra lista de todos os leads daquela segmentação. */
  const [selectedTipoLead, setSelectedTipoLead] = useState<string | null>(null)

  /** Leads da segmentação (tipo de lead) selecionada. */
  const leadsPorTipoLead = useMemo(() => {
    if (!selectedTipoLead) return []
    return results.filter((r) => (getLeadField(r, 'tipo_lead') ?? 'Não informado') === selectedTipoLead)
  }, [results, getLeadField, selectedTipoLead])

  /** Top indicadores (nome indicação) com vendidas/em andamento/perdidas, filtrados por categoria de Indicação quando clicado. */
  const nomeIndicacaoComStatus = useMemo(() => {
    const base = filterIndicacaoParaNome
      ? results.filter((r) => (getLeadField(r, 'indicacao') ?? 'Não informado') === filterIndicacaoParaNome)
      : results
    const map = new Map<string, { won: number; lost: number; ongoing: number }>()
    base.forEach((r) => {
      const v = getLeadField(r, 'nome_indicacao')
      if (!v) return
      const cur = map.get(v) ?? { won: 0, lost: 0, ongoing: 0 }
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      map.set(v, cur)
    })
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        value: counts.won + counts.lost + counts.ongoing,
        won: counts.won,
        lost: counts.lost,
        ongoing: counts.ongoing,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [results, getLeadField, filterIndicacaoParaNome])

  /** Top indicadores (nome indicação) com status e tipo_lead/indicação mais frequente — para relatório */
  const nomeIndicacaoComStatusRelatorio = useMemo(() => {
    const map = new Map<string, { won: number; lost: number; ongoing: number; tipoLeadCount: Map<string, number>; indicacaoCount: Map<string, number> }>()
    results.forEach((r) => {
      const v = getLeadField(r, 'nome_indicacao')
      if (!v) return
      const cur = map.get(v) ?? {
        won: 0,
        lost: 0,
        ongoing: 0,
        tipoLeadCount: new Map(),
        indicacaoCount: new Map(),
      }
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      const tipo = getLeadField(r, 'tipo_lead') ?? 'Não informado'
      cur.tipoLeadCount.set(tipo, (cur.tipoLeadCount.get(tipo) ?? 0) + 1)
      const ind = getLeadField(r, 'indicacao') ?? 'Não informado'
      cur.indicacaoCount.set(ind, (cur.indicacaoCount.get(ind) ?? 0) + 1)
      map.set(v, cur)
    })
    const mode = (m: Map<string, number>) => {
      let max = 0
      let key = 'Não informado'
      m.forEach((count, k) => {
        if (count > max) {
          max = count
          key = k
        }
      })
      return key
    }
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        value: counts.won + counts.lost + counts.ongoing,
        won: counts.won,
        lost: counts.lost,
        ongoing: counts.ongoing,
        tipoLead: mode(counts.tipoLeadCount),
        indicacao: mode(counts.indicacaoCount),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
  }, [results, getLeadField])

  const wonLeads = useMemo(() => results.filter((r) => r.status === 'win'), [results])
  const wonLeadsFiltradasPorSolicitante = useMemo(() => {
    if (!selectedSolicitanteKey) return wonLeads
    return wonLeads.filter((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      return key === selectedSolicitanteKey
    })
  }, [wonLeads, selectedSolicitanteKey])

  const resumoPieData = useMemo(
    () => [
      { name: 'Ganhas', value: resumo.won, color: '#2d936c' },
      { name: 'Perdidas', value: resumo.lost, color: '#dc2626' },
      { name: 'Em andamento', value: resumo.ongoing, color: '#d5b170' },
    ].filter((d) => d.value > 0),
    [resumo]
  )

  /** Etapas (stage_name) que aparecem nos dados atuais (após filtros). Ordem: funil oficial, depois demais. */
  const etapasConsideradasNosDados = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const s = (r.stage_name ?? '').trim()
      if (s) set.add(s)
    })
    const naOrdem = ETAPAS_FUNIL_VENDAS.filter((e) => set.has(e))
    const outras = Array.from(set).filter((e) => !ETAPAS_FUNIL_VENDAS.includes(e)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [...naOrdem, ...outras]
  }, [results])

  type ReportTypeOption = 'resumo' | 'area' | 'solicitante' | 'motivos' | 'motivos-area' | 'tipo-lead' | 'indicacao' | 'nome-indicacao' | 'perdidas-anotacao'
  const [reportType, setReportType] = useState<ReportTypeOption>('resumo')
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [showWppModal, setShowWppModal] = useState(false)
  const [wppNumber, setWppNumber] = useState('')
  const [wppMessage, setWppMessage] = useState('')
  const [wppError, setWppError] = useState<string | null>(null)
  const [wppSending, setWppSending] = useState(false)
  const [expandMotivosGeral, setExpandMotivosGeral] = useState(false)
  const [expandedMotivosArea, setExpandedMotivosArea] = useState<string | null>(null)
  const [expandRankingSolicitantes, setExpandRankingSolicitantes] = useState(false)
  const [expandPerdidasSolicitante, setExpandPerdidasSolicitante] = useState(false)
  const [expandListaLeads, setExpandListaLeads] = useState(false)
  /** Filtro da lista de leads por motivo de perda (clique em um motivo). */
  const [filterListaPorMotivo, setFilterListaPorMotivo] = useState<string | null>(null)

  /** Lista de leads para exibir na tabela: filtrada por solicitante (se clicou no ranking) e/or motivo de perda (se clicou em um motivo). */
  const listaLeadsFiltrada = useMemo(() => {
    let list = results
    if (selectedSolicitanteKey) {
      list = list.filter((r) => {
        const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
        const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
        return key === selectedSolicitanteKey
      })
    }
    if (filterListaPorMotivo) {
      list = list.filter((r) => ((r.motivo_perda ?? '').trim() || 'Não informado') === filterListaPorMotivo)
    }
    return list
  }, [results, selectedSolicitanteKey, filterListaPorMotivo])

  /** Leads por área (tag do solicitante) para relatório. Para "(sem área)" inclui detalhes: solicitante + nome do lead. */
  const leadsPorAreaParaRelatorio = useMemo(() => {
    const byArea = new Map<
      string,
      { total: number; won: number; lost: number; ongoing: number; semAreaDetalhes?: SemAreaDetalhe[] }
    >()
    results.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const area = e ? getAreaByEmail(e) : null
      const key = area ?? '(sem área)'
      const cur = byArea.get(key) ?? { total: 0, won: 0, lost: 0, ongoing: 0 }
      cur.total += 1
      if (r.status === 'win') cur.won += 1
      else if (r.status === 'lost') cur.lost += 1
      else cur.ongoing += 1
      if (key === '(sem área)') {
        const solicitanteNome = e ? (getTeamMember(e)?.name ?? e) : '—'
        const leadNome =
          (r.nome_lead ?? r.razao_social ?? r.id_registro ?? r.planilha?.nome ?? r.planilha?.nome_lead ?? '—')?.toString().trim() || '—'
        if (!cur.semAreaDetalhes) cur.semAreaDetalhes = []
        cur.semAreaDetalhes.push({ solicitanteNome, leadNome })
      }
      byArea.set(key, cur)
    })
    return Array.from(byArea.entries())
      .map(([area, counts]) => ({ area, ...counts }))
      .sort((a, b) => b.total - a.total)
  }, [results])

  /** Texto do relatório conforme tipo. Formato otimizado para WhatsApp (emojis, seções, legível no celular). */
  const reportText = useMemo(() => {
    const periodo =
      filterAno && filterMes
        ? `${MESES_LABEL[filterMes] ?? filterMes}/${filterAno}`
        : filterAno
          ? `${filterAno}`
          : 'todo o período'
    const titulo = `📊 *Relatório de leads*\n${periodo}${filterFunil ? ` · ${filterFunil}` : ''}\n`

    if (reportType === 'resumo') {
      return (
        titulo +
        `\n📈 *Resumo*\n` +
        `Total: *${resumo.total}* leads\n` +
        `✅ Ganhas: ${resumo.won}\n` +
        `❌ Perdidas: ${resumo.lost}\n` +
        `⏳ Em andamento: ${resumo.ongoing}\n` +
        `\n📌 Taxa de conversão: *${resumo.conversionRate}%*\n` +
        `📌 Win rate: *${resumo.winRate}%*`
      )
    }
    if (reportType === 'area') {
      const linhas = leadsPorAreaParaRelatorio
        .map((x) => {
          const linhaBase = `• ${x.area}: ${x.total} (✅${x.won} ❌${x.lost} ⏳${x.ongoing})`
          if (x.area === '(sem área)' && x.semAreaDetalhes?.length) {
            const detalhes = x.semAreaDetalhes
              .map((d) => `  · ${d.leadNome} — Solicitante: ${d.solicitanteNome}`)
              .join('\n')
            return `${linhaBase}\n${detalhes}`
          }
          return linhaBase
        })
        .join('\n')
      return titulo + `\n📂 *Leads por área*\n\n` + (linhas || 'Nenhum dado por área.') + `\n\n_Total: ${resumo.total} leads_`
    }
    if (reportType === 'solicitante') {
      const linhas = performancePorSolicitante
        .map(
          (p) =>
            `• ${p.nome}: ${p.total} leads (✅${p.won} ❌${p.lost} ⏳${p.ongoing}) · ${p.conversionRate}% conv.`
        )
        .join('\n')
      return titulo + `\n👤 *Leads por solicitante*\n\n` + (linhas || 'Nenhum dado por solicitante.') + `\n\n_Total: ${resumo.total} leads_`
    }
    if (reportType === 'motivos') {
      const totalLost = resumo.lost
      const linhas = motivoPerdaData
        .map((item) => {
          const pct = totalLost > 0 ? Math.round((item.value / totalLost) * 100) : 0
          return `• ${item.name}: ${item.value} (${pct}%)`
        })
        .join('\n')
      return (
        titulo +
        `\n📉 *Motivos de perda*\n\n` +
        (linhas || 'Nenhuma lead perdida no período.') +
        (totalLost > 0 ? `\n\n_Total perdidas: ${totalLost}_` : '')
      )
    }
    if (reportType === 'motivos-area') {
      const totalLost = resumo.lost
      if (motivoPerdaPorAreaData.length === 0) {
        return (
          titulo +
          `\n📉 *Motivos de perda por área*\n\n` +
          'Nenhuma lead perdida no período.' +
          (totalLost > 0 ? `\n\n_Total perdidas: ${totalLost}_` : '')
        )
      }
      const blocos = motivoPerdaPorAreaData.map(({ area, totalLost: areaLost, motivos }) => {
        const linhasArea = motivos
          .map((item) => {
            const pct = areaLost > 0 ? Math.round((item.value / areaLost) * 100) : 0
            return `  · ${item.name}: ${item.value} (${pct}%)`
          })
          .join('\n')
        return `*${area}* (${areaLost} perdida${areaLost !== 1 ? 's' : ''})\n${linhasArea}`
      })
      return (
        titulo +
        `\n📉 *Motivos de perda por área*\n\n` +
        blocos.join('\n\n') +
        (totalLost > 0 ? `\n\n_Total perdidas: ${totalLost}_` : '')
      )
    }
    if (reportType === 'tipo-lead') {
      const linhas = tipoLeadComStatus
        .map((x) => `• ${x.name}: ${x.value} (✅${x.won} ❌${x.lost} ⏳${x.ongoing})`)
        .join('\n')
      return titulo + `\n📋 *Leads por tipo*\n\n` + (linhas || 'Nenhum dado por tipo de lead.') + `\n\n_Total: ${resumo.total} leads_`
    }
    if (reportType === 'indicacao') {
      const linhas = indicacaoComStatus
        .map((x) => `• ${x.name}: ${x.value} (✅${x.won} ❌${x.lost} ⏳${x.ongoing})`)
        .join('\n')
      return titulo + `\n📂 *Leads por indicação (categoria)*\n\n` + (linhas || 'Nenhum dado por indicação.') + `\n\n_Total: ${resumo.total} leads_`
    }
    if (reportType === 'nome-indicacao') {
      const linhas = nomeIndicacaoComStatusRelatorio
        .map((x) => `• ${x.name} (${x.tipoLead}, ${x.indicacao}): ${x.value} (✅${x.won} ❌${x.lost} ⏳${x.ongoing})`)
        .join('\n')
      return titulo + `\n👥 *Top indicadores (nome da indicação)*\n\n` + (linhas || 'Nenhum dado de nome indicação.') + `\n\n_Total: ${resumo.total} leads_`
    }
    if (reportType === 'perdidas-anotacao') {
      const perdidas = results.filter((r) => r.status === 'lost')
      const comAnotacao = perdidas.filter(
        (r) => (r.motivo_perda_anotacao ?? r.planilha?.motivo_perda_anotacao)?.trim()
      )
      const linhas = comAnotacao
        .map((r) => {
          const nome = r.nome_lead ?? r.razao_social ?? r.id_registro ?? `Linha ${r.rowIndex}`
          const motivo = (r.motivo_perda ?? r.planilha?.motivo_perda ?? '').trim() || '—'
          const anot = String(r.motivo_perda_anotacao ?? r.planilha?.motivo_perda_anotacao ?? '').trim()
          return `• ${nome}\n  Motivo: ${motivo}\n  Anotação: ${anot}`
        })
        .join('\n\n')
      const semAnotacao = perdidas.length - comAnotacao.length
      const rodape =
        perdidas.length > 0
          ? `\n\n_Total perdidas: ${perdidas.length} (${comAnotacao.length} com anotação${semAnotacao > 0 ? `, ${semAnotacao} sem anotação` : ''})_`
          : ''
      return titulo + `\n📝 *Perdidas com anotação do motivo*\n\n` + (linhas || 'Nenhuma lead perdida com anotação no período.') + rodape
    }
    return titulo + 'Selecione um tipo de relatório.'
  }, [
    reportType,
    filterAno,
    filterMes,
    filterFunil,
    resumo,
    results,
    leadsPorAreaParaRelatorio,
    performancePorSolicitante,
    motivoPerdaData,
    motivoPerdaPorAreaData,
    tipoLeadComStatus,
    indicacaoComStatus,
    nomeIndicacaoComStatusRelatorio,
  ])

  /** Contexto em texto para o assistente de IA (resumo dos dados atuais do dashboard) */
  const aiContextSummary = useMemo(() => {
    const parts: string[] = []
    parts.push(`Resumo: total ${resumo.total} leads | Ganhas: ${resumo.won} | Perdidas: ${resumo.lost} | Em andamento: ${resumo.ongoing}`)
    parts.push(`Taxa de conversão: ${resumo.conversionRate}% | Win rate: ${resumo.winRate}%`)
    if (performancePorSolicitante.length > 0) {
      parts.push('\nPor solicitante (top 5): ' + performancePorSolicitante.slice(0, 5).map((p) => `${p.nome}: ${p.total} (✅${p.won} ❌${p.lost})`).join('; '))
    }
    if (motivoPerdaData.length > 0) {
      parts.push('\nMotivos de perda (categoria): ' + motivoPerdaData.slice(0, 5).map((m) => `${m.name}: ${m.value}`).join('; '))
    }
    if (motivoPerdaPorAreaData.length > 0) {
      parts.push('\nMotivos por área: ' + motivoPerdaPorAreaData.map((a) => `${a.area}: ${a.totalLost}`).join('; '))
    }
    if (tipoLeadComStatus.length > 0) {
      parts.push('\nPor tipo de lead: ' + tipoLeadComStatus.map((x) => `${x.name}: ${x.value}`).join('; '))
    }
    if (indicacaoComStatus.length > 0) {
      parts.push('\nPor indicação (categoria): ' + indicacaoComStatus.map((x) => `${x.name}: ${x.value}`).join('; '))
    }
    if (nomeIndicacaoComStatusRelatorio.length > 0) {
      parts.push('\nTop indicadores (nome): ' + nomeIndicacaoComStatusRelatorio.slice(0, 8).map((x) => `${x.name}: ${x.value}`).join('; '))
    }
    if (leadsPorAreaParaRelatorio.length > 0) {
      parts.push('\nPor área: ' + leadsPorAreaParaRelatorio.map((x) => `${x.area}: ${x.total} (✅${x.won} ❌${x.lost})`).join('; '))
    }
    // Anotações de motivo de perda (motivo_perda_anotacao): texto livre que o usuário escreve ao marcar perda — a IA pode analisar padrões e respostas recorrentes
    const perdidasComAnotacao = results
      .filter((r) => r.status === 'lost')
      .map((r) => {
        const motivo = (r.motivo_perda ?? r.planilha?.motivo_perda ?? '').trim() || '—'
        const anot = String(r.motivo_perda_anotacao ?? r.planilha?.motivo_perda_anotacao ?? '').trim()
        return { motivo, anot }
      })
      .filter((x) => x.anot.length > 0)
    if (perdidasComAnotacao.length > 0) {
      parts.push('\n\n--- ANOTAÇÕES DE MOTIVO DE PERDA (motivo_perda_anotacao) ---')
      parts.push('Cada linha: [Motivo escolhido] | Anotação (texto livre):')
      const maxAnotLen = 400
      perdidasComAnotacao.slice(0, 200).forEach((x) => {
        const anotTrunc = x.anot.length > maxAnotLen ? x.anot.slice(0, maxAnotLen) + '…' : x.anot
        parts.push(`• [${x.motivo}] | ${anotTrunc}`)
      })
      if (perdidasComAnotacao.length > 200) {
        parts.push(`… e mais ${perdidasComAnotacao.length - 200} anotações.`)
      }
      parts.push('--- FIM ANOTAÇÕES ---')
    }
    // Negociações ganhas com valores e datas (Date_Create, Date_Update, data_assinatura_contrato, estado) — para a IA filtrar corretamente por período
    const ganhasComValores = results
      .filter((r) => r.status === 'win')
      .map((r) => {
        const nome = (r.nome_lead ?? r.razao_social ?? r.id_registro ?? '—')?.toString().trim() || '—'
        const valores = String(r.planilha?.valores ?? '').trim()
        const vFixo = String(r.valor_mensal_fixo_cc ?? r.planilha?.valor_mensal_fixo_cc ?? '').trim()
        const vExito = String(r.valor_exito_cc ?? r.planilha?.valor_exito_cc ?? '').trim()
        const vFechado = String(r.valor_mensal_preco_fechado_cc ?? r.planilha?.valor_mensal_preco_fechado_cc ?? '').trim()
        const exito = String(r.planilha?.exito ?? '').trim()
        const dateCreate = (r.created_at_iso ?? r.planilha?.date_create ?? r.planilha?.created_at ?? '').toString().trim()
        const dateUpdate = (r.updated_at_iso ?? r.planilha?.date_update ?? r.planilha?.updated_at ?? '').toString().trim()
        const dataAssinatura = String(r.planilha?.data_assinatura_contrato ?? '').trim()
        const estado = r.status ?? (r.planilha?.estado ?? '').toString().trim()
        return { nome, valores, vFixo, vExito, vFechado, exito, dateCreate, dateUpdate, dataAssinatura, estado }
      })
    if (ganhasComValores.length > 0) {
      parts.push('\n\n--- NEGOCIAÇÕES GANHAS (valores e datas) ---')
      parts.push('IMPORTANTE: Use estas datas para filtrar. Date_Create = quando a lead foi CRIADA; Date_Update = quando foi ATUALIZADA/FINALIZADA; data_assinatura_contrato = data de assinatura do contrato (se houver). Para "contratos assinados em dezembro" use data_assinatura_contrato OU Date_Update conforme o que fizer sentido; para "ganhas em dezembro" use Date_Update (mês da finalização).')
      parts.push('Cada linha: Nome | Date_Create | Date_Update | data_assinatura_contrato | estado | valores | mensal_fixo | exito_cc | preco_fechado | exito')
      ganhasComValores.slice(0, 150).forEach((x) => {
        const vals = [x.dateCreate || '—', x.dateUpdate || '—', x.dataAssinatura || '—', x.estado || 'win', x.valores || '—', x.vFixo || '—', x.vExito || '—', x.vFechado || '—', x.exito || '—'].join(' | ')
        parts.push(`• ${x.nome} | ${vals}`)
      })
      if (ganhasComValores.length > 150) {
        parts.push(`… e mais ${ganhasComValores.length - 150} negociações ganhas.`)
      }
      parts.push('--- FIM NEGOCIAÇÕES GANHAS ---')
    }
    return parts.join('\n')
  }, [
    resumo,
    results,
    performancePorSolicitante,
    motivoPerdaData,
    motivoPerdaPorAreaData,
    tipoLeadComStatus,
    indicacaoComStatus,
    nomeIndicacaoComStatusRelatorio,
    leadsPorAreaParaRelatorio,
  ])

  const aiPeriodLabel = useMemo(() => {
    const p =
      filterAno && filterMes
        ? `${MESES_LABEL[filterMes] ?? filterMes}/${filterAno}`
        : filterAno
          ? String(filterAno)
          : 'Todo o período'
    return filterFunil ? `${p} · ${filterFunil}` : p
  }, [filterAno, filterMes, filterFunil])

  const handleCopyReport = useCallback(() => {
    navigator.clipboard.writeText(reportText).then(
      () => {
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2000)
      },
      () => {}
    )
  }, [reportText])

  const openWppModal = useCallback(() => {
    setWppMessage(reportText)
    setWppError(null)
    setShowWppModal(true)
  }, [reportText])

  const closeWppModal = useCallback(() => {
    setShowWppModal(false)
    setWppError(null)
  }, [])

  const sendWppReport = useCallback(async () => {
    const telefone = wppNumber.trim().replace(/\D/g, '')
    const mensagem = wppMessage.trim()
    if (!telefone || !mensagem) return
    setWppSending(true)
    setWppError(null)
    try {
      const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: telefone, text: mensagem }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWppError(json.message || json.error || 'Falha ao enviar.')
        return
      }
      closeWppModal()
    } catch {
      setWppError('Erro de conexão. Verifique se a API e o webhook/Evolution estão configurados.')
    } finally {
      setWppSending(false)
    }
  }, [wppNumber, wppMessage, closeWppModal])

  if (!clientId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">Configure o Google OAuth</p>
        <p className="text-sm mt-1">
          Defina <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> no arquivo .env.
        </p>
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <FileSpreadsheet className="h-12 w-12 text-primary/60 mb-4" />
        <h2 className="text-lg font-semibold text-gray-800">Análise da planilha</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6 text-center max-w-md">
          Conecte com o Google para carregar os dados da planilha.
        </p>
        <button
          type="button"
          onClick={() => login()}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Conectar com Google
        </button>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-gray-500 mt-3">Carregando dados da planilha...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-medium">{error}</p>
        <button type="button" onClick={loadPlanilha} className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div
      className="min-h-full rounded-2xl space-y-6 pb-8"
      style={{
        background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.4) 0%, rgba(255, 255, 255, 1) 40%, rgba(236, 253, 245, 0.4) 100%)',
      }}
    >
      {/* Seção: Filtros */}
      <DashboardSection
        icon={<Filter className="h-5 w-5" />}
        title="Filtros"
        description="Período, funil, solicitante e área. Data: Date_Create (UTC)."
        fullWidth
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-600 sr-only">Filtros por período, funil, solicitante e área.</p>
          <p className="sr-only text-xs text-gray-500 mt-1">
            <strong>Funil:</strong> por padrão exibimos só <strong>Funil de vendas</strong> (para bater com sua contagem). Use “Todos os funis” para ver os demais. <strong>Etapas excluídas</strong> (não entram na contagem): {STAGES_IGNORADOS.join(', ')}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="filter-funil" className="text-sm font-medium text-gray-700">Funil:</label>
            <select
              id="filter-funil"
              value={filterFunil}
              onChange={(e) => setFilterFunil(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos os funis</option>
              {funisDisponiveis.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <label htmlFor="filter-solicitante" className="text-sm font-medium text-gray-700">Solicitante:</label>
            <select
              id="filter-solicitante"
              value={filterSolicitante}
              onChange={(e) => setFilterSolicitante(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos</option>
              {solicitantesDisponiveis.map(({ key, nome }) => (
                <option key={key} value={key}>{nome}</option>
              ))}
            </select>
            <label htmlFor="filter-area" className="text-sm font-medium text-gray-700">Área:</label>
            <select
              id="filter-area"
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas</option>
              {areasDisponiveis.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <label htmlFor="filter-ano" className="text-sm font-medium text-gray-700">Ano:</label>
            <select
              id="filter-ano"
              value={filterAno}
              onChange={(e) => {
                setFilterAno(e.target.value ? Number(e.target.value) : '')
                setFilterMes('')
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos os anos</option>
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <label htmlFor="filter-mes" className="text-sm font-medium text-gray-700">Mês:</label>
            <select
              id="filter-mes"
              value={filterMes}
              onChange={(e) => setFilterMes(e.target.value ? Number(e.target.value) : '')}
              disabled={!filterAno}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">Todos os meses</option>
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m] ?? m}</option>
              ))}
            </select>
          </div>
          {(filterAno || filterMes) && (
            <span className="text-sm text-gray-500">
              Período: {filterAno}{filterMes ? ` · ${MESES_LABEL[filterMes] ?? filterMes}` : ''} (por data de criação)
            </span>
          )}
          <button
            type="button"
            onClick={loadPlanilha}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          </div>
        </div>
      </DashboardSection>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}

      {/* Seção: Pipeline & Métricas (KPIs) */}
      <DashboardSection
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Pipeline & Métricas"
        description="Totais e indicadores do período conforme filtros."
        fullWidth
      >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-2xl border border-sky-200/80 bg-white p-5 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">no período</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-3">{resumo.total}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total de leads · Pipeline</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowWonLeadsPanel(true)
            setSelectedSolicitanteKey(null)
          }}
          className={cn(
            'rounded-2xl border p-5 shadow-md text-left transition-all hover:shadow-lg',
            showWonLeadsPanel && selectedSolicitanteKey === null && resumo.won > 0
              ? 'border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200'
              : 'border-emerald-200/80 bg-white hover:bg-emerald-50/30'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">ganhas</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-emerald-700 mt-3">{resumo.won}</p>
          <p className="text-sm text-gray-500 mt-0.5">Clique para ver lista</p>
        </button>
        <div className="rounded-2xl border border-rose-200/80 bg-white p-5 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">perdidas</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-rose-700 mt-3">{resumo.lost}</p>
          <p className="text-sm text-gray-500 mt-0.5">Leads perdidas</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <MinusCircle className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">ativo</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-gray-800 mt-3">{resumo.ongoing}</p>
          <p className="text-sm text-gray-500 mt-0.5">Em andamento</p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Percent className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">conversão</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-primary mt-3">{resumo.conversionRate}%</p>
          <p className="text-sm text-gray-600 mt-0.5">Ganhas / Total</p>
        </div>
        <div className="rounded-2xl border border-post/30 bg-post/5 p-5 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-post/20 text-post">
              <Target className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-post/20 px-2.5 py-0.5 text-xs font-semibold text-post">win rate</span>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-post mt-3">{resumo.winRate}%</p>
          <p className="text-sm text-gray-600 mt-0.5">Ganhas / (Ganhas + Perdidas)</p>
        </div>
      </div>
      </DashboardSection>

      {/* Grid 2 colunas: Motivos de perda | Resumo por status + Ranking + Relatórios */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Seção: Motivos de perda */}
      <DashboardSection
        icon={<AlertCircle className="h-5 w-5" />}
        title="Motivos de perda"
        description="Resumo geral e por área. Clique em um motivo para filtrar a lista de leads abaixo."
      >
        {motivoPerdaData.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhuma lead perdida ou motivo não preenchido.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Resumo geral ({resumo.lost} perdidas)</p>
              {(() => {
                const list = expandMotivosGeral ? motivoPerdaData : motivoPerdaData.slice(0, TOP_N)
                const CARD_COLORS = ['bg-sky-100 border-sky-200/80', 'bg-teal-100 border-teal-200/80', 'bg-amber-100 border-amber-200/80', 'bg-slate-100 border-slate-200/80', 'bg-rose-100 border-rose-200/80', 'bg-violet-100 border-violet-200/80']
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {list.map((item, idx) => {
                      const pct = resumo.lost > 0 ? Math.round((item.value / resumo.lost) * 100) : 0
                      const cardClass = CARD_COLORS[idx % CARD_COLORS.length]
                      const isActive = filterListaPorMotivo === item.name
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFilterListaPorMotivo(isActive ? null : item.name)}
                          className={cn(
                            'rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow text-left cursor-pointer',
                            cardClass,
                            isActive && 'ring-2 ring-primary ring-offset-2'
                          )}
                          title={isActive ? 'Clique para remover filtro na lista de leads' : 'Clique para filtrar lista de leads por este motivo'}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-gray-700 shadow-sm">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800 truncate flex-1 min-w-0" title={item.name}>{item.name}</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900 mt-2">{item.value} <span className="text-sm font-medium text-gray-600">({pct}%)</span></p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                            <div className="h-full rounded-full bg-gray-600/80 transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
              {motivoPerdaData.length > TOP_N && (
                <button
                  type="button"
                  onClick={() => setExpandMotivosGeral(!expandMotivosGeral)}
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
                >
                  {expandMotivosGeral ? (
                    <>Mostrar menos <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Ver todos os {motivoPerdaData.length} motivos <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              )}
            </div>
            {motivoPerdaPorAreaData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Por área de atuação</p>
                <p className="text-xs text-gray-500 mb-2">Clique na área para ver os motivos</p>
                <div className="space-y-1">
                  {motivoPerdaPorAreaData.map(({ area, totalLost, motivos }) => {
                    const isExpanded = expandedMotivosArea === area
                    const list = motivos.slice(0, TOP_N)
                    const hasMore = motivos.length > TOP_N
                    return (
                      <div key={area} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedMotivosArea(isExpanded ? null : area)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50/80 transition-colors"
                        >
                          <span className="font-semibold text-gray-800">{area}</span>
                          <span className="text-gray-500 text-sm shrink-0">({totalLost} perdida{totalLost !== 1 ? 's' : ''})</span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                            {list.map((item, idx) => {
                              const pct = totalLost > 0 ? Math.round((item.value / totalLost) * 100) : 0
                              const isActive = filterListaPorMotivo === item.name
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => setFilterListaPorMotivo(isActive ? null : item.name)}
                                  className={cn(
                                    'w-full flex items-center gap-2 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors',
                                    isActive && 'bg-primary/10 ring-1 ring-primary/30'
                                  )}
                                  title={isActive ? 'Clique para remover filtro na lista de leads' : 'Clique para filtrar lista de leads por este motivo'}
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-700">{idx + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex justify-between gap-2 text-xs">
                                      <span className="font-medium text-gray-800 truncate">{item.name}</span>
                                      <span className="text-red-600 font-semibold shrink-0">{item.value} ({pct}%)</span>
                                    </div>
                                    <div className="mt-0.5 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(pct, 4)}%` }} />
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                            {hasMore && (
                              <p className="text-xs text-gray-500 pt-0.5">+ {motivos.length - TOP_N} motivo(s)</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DashboardSection>

      {/* Coluna direita: Stage Funnel (Resumo) + Relatórios */}
      <div className="space-y-6">
      {/* Seção: Resumo por status (Stage Funnel) */}
      <DashboardSection
        icon={<BarChart2 className="h-5 w-5" />}
        title="Resumo por status"
        description="Distribuição Ganhas / Perdidas / Em andamento."
      >
        {resumoPieData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Nenhum dado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={resumoPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                {resumoPieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, '']} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </DashboardSection>

      {/* Seção: Relatórios e mensagens */}
      <DashboardSection
        icon={<Send className="h-5 w-5" />}
        title="Relatórios e mensagens"
        description="Monte mensagens a partir dos filtros. Copie ou envie no WhatsApp."
      >
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label htmlFor="report-type" className="text-sm font-medium text-gray-700">Tipo de relatório:</label>
          <select
            id="report-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportTypeOption)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary"
          >
            <option value="resumo">Resumo do período</option>
            <option value="area">Leads por área</option>
            <option value="solicitante">Leads por solicitante</option>
            <option value="motivos">Motivos de perda (resumo)</option>
            <option value="motivos-area">Motivos de perda por área</option>
            <option value="tipo-lead">Leads por tipo de lead</option>
            <option value="indicacao">Leads por indicação (categoria)</option>
            <option value="nome-indicacao">Top indicadores (nome indicação)</option>
            <option value="perdidas-anotacao">Perdidas com anotação do motivo</option>
          </select>
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
          >
            <Copy className="h-4 w-4" />
            {copyFeedback ? 'Copiado!' : 'Copiar mensagem'}
          </button>
          <button
            type="button"
            onClick={openWppModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar no WhatsApp
          </button>
        </div>
        <pre className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans overflow-x-auto max-h-48 overflow-y-auto">
          {reportText}
        </pre>
      </DashboardSection>
      </div>
      </div>

      {/* Seção: Tipo de lead, Indicação e Nome indicação — cards tecnológicos com ícones e manual */}
      <DashboardSection
        icon={<Users className="h-5 w-5" />}
        title="Tipo de lead, Indicação e Nome indicação"
        description="Origem dos leads conforme manual: Indicação, Lead Ativa, Digital e Passiva. Passe o mouse nos cards para ver o significado."
        fullWidth
      >
        {results.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Nenhum dado no período.</p>
        ) : (
          <div className="space-y-8">
            {/* Bloco: Tipo de lead — pódio (1º centro, 2º esquerda, 3º direita) + demais em grid */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Tipo de lead ({results.length} leads)</p>
              <p className="text-xs text-gray-500 mb-3">Clique em um tipo para ver todos os leads daquela segmentação.</p>
              {tipoLeadComStatus.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center rounded-xl bg-gray-50 border border-gray-100">Sem dados de tipo de lead na planilha.</p>
              ) : (
                <>
                  {/* Pódio: 2º esquerda, 1º centro (mais alto), 3º direita */}
                  {tipoLeadComStatus.length >= 3 && (
                    <div className="mb-8">
                      <div className="flex items-end justify-center gap-3 sm:gap-6" style={{ minHeight: '260px' }}>
                        {/* 2º lugar */}
                        <div className="flex flex-col items-center flex-1 max-w-[200px]">
                          <button
                            type="button"
                            onClick={() => setSelectedTipoLead(selectedTipoLead === tipoLeadComStatus[1].name ? null : tipoLeadComStatus[1].name)}
                            className={cn(
                              'flex flex-col items-center rounded-2xl border-2 px-4 py-4 min-w-[140px] max-w-[180px] min-h-[10rem] transition-all shadow-md cursor-pointer',
                              'bg-amber-50 border-amber-200/80 hover:shadow-lg',
                              selectedTipoLead === tipoLeadComStatus[1].name && 'ring-2 ring-primary ring-offset-2'
                            )}
                            title={TIPO_LEAD_MANUAL[tipoLeadComStatus[1].name]?.description ?? tipoLeadComStatus[1].name}
                          >
                            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-200/90 text-sm font-bold text-amber-900 shadow">2</span>
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-700 mb-2">
                              {TIPO_LEAD_MANUAL[tipoLeadComStatus[1].name]?.icon ?? <List className="h-7 w-7" />}
                            </div>
                            <p className="font-semibold text-gray-900 text-center text-sm leading-tight truncate w-full">{tipoLeadComStatus[1].name}</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{tipoLeadComStatus[1].value} <span className="text-xs font-medium text-gray-500">({results.length > 0 ? Math.round((tipoLeadComStatus[1].value / results.length) * 100) : 0}%)</span></p>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                              <span className="inline-flex rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">{tipoLeadComStatus[1].won} vend.</span>
                              <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{tipoLeadComStatus[1].ongoing} and.</span>
                              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{tipoLeadComStatus[1].lost} perd.</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-white/80 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${Math.max(results.length > 0 ? (tipoLeadComStatus[1].value / results.length) * 100 : 0, 6)}%` }} />
                            </div>
                          </button>
                          <div className="w-full rounded-t-lg bg-amber-200/90 py-2 text-center text-sm font-bold text-amber-900 shadow-inner">2º lugar</div>
                        </div>
                        {/* 1º lugar */}
                        <div className="flex flex-col items-center flex-1 max-w-[220px]">
                          <button
                            type="button"
                            onClick={() => setSelectedTipoLead(selectedTipoLead === tipoLeadComStatus[0].name ? null : tipoLeadComStatus[0].name)}
                            className={cn(
                              'flex flex-col items-center rounded-2xl border-2 px-4 py-4 min-w-[160px] max-w-[200px] min-h-[12rem] transition-all shadow-lg cursor-pointer',
                              'bg-violet-50 border-violet-200/80 hover:shadow-xl',
                              selectedTipoLead === tipoLeadComStatus[0].name && 'ring-2 ring-primary ring-offset-2'
                            )}
                            title={TIPO_LEAD_MANUAL[tipoLeadComStatus[0].name]?.description ?? tipoLeadComStatus[0].name}
                          >
                            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-300/90 text-base font-bold text-violet-900 shadow">1</span>
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-violet-100 text-violet-600 mb-2">
                              {TIPO_LEAD_MANUAL[tipoLeadComStatus[0].name]?.icon ?? <List className="h-8 w-8" />}
                            </div>
                            <p className="font-semibold text-gray-900 text-center text-base leading-tight truncate w-full">{tipoLeadComStatus[0].name}</p>
                            <p className="text-xl font-bold text-gray-800 mt-1">{tipoLeadComStatus[0].value} <span className="text-xs font-medium text-gray-500">({results.length > 0 ? Math.round((tipoLeadComStatus[0].value / results.length) * 100) : 0}%)</span></p>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                              <span className="inline-flex rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">{tipoLeadComStatus[0].won} vend.</span>
                              <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{tipoLeadComStatus[0].ongoing} and.</span>
                              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{tipoLeadComStatus[0].lost} perd.</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-white/80 overflow-hidden">
                              <div className="h-full rounded-full bg-violet-500/80" style={{ width: `${Math.max(results.length > 0 ? (tipoLeadComStatus[0].value / results.length) * 100 : 0, 6)}%` }} />
                            </div>
                            {TIPO_LEAD_MANUAL[tipoLeadComStatus[0].name]?.description && (
                              <p className="mt-2 text-xs text-gray-600 line-clamp-2 text-center leading-relaxed" title={TIPO_LEAD_MANUAL[tipoLeadComStatus[0].name].description}>{TIPO_LEAD_MANUAL[tipoLeadComStatus[0].name].description}</p>
                            )}
                          </button>
                          <div className="w-full rounded-t-lg bg-violet-300/90 py-2 text-center text-sm font-bold text-violet-900 shadow-inner">1º lugar</div>
                        </div>
                        {/* 3º lugar */}
                        <div className="flex flex-col items-center flex-1 max-w-[200px]">
                          <button
                            type="button"
                            onClick={() => setSelectedTipoLead(selectedTipoLead === tipoLeadComStatus[2].name ? null : tipoLeadComStatus[2].name)}
                            className={cn(
                              'flex flex-col items-center rounded-2xl border-2 px-4 py-4 min-w-[140px] max-w-[180px] min-h-[8rem] transition-all shadow-md cursor-pointer',
                              'bg-sky-50 border-sky-200/80 hover:shadow-lg',
                              selectedTipoLead === tipoLeadComStatus[2].name && 'ring-2 ring-primary ring-offset-2'
                            )}
                            title={TIPO_LEAD_MANUAL[tipoLeadComStatus[2].name]?.description ?? tipoLeadComStatus[2].name}
                          >
                            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-sky-200/90 text-xs font-bold text-sky-900 shadow">3</span>
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-600 mb-2">
                              {TIPO_LEAD_MANUAL[tipoLeadComStatus[2].name]?.icon ?? <List className="h-6 w-6" />}
                            </div>
                            <p className="font-semibold text-gray-900 text-center text-sm leading-tight truncate w-full">{tipoLeadComStatus[2].name}</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{tipoLeadComStatus[2].value} <span className="text-xs font-medium text-gray-500">({results.length > 0 ? Math.round((tipoLeadComStatus[2].value / results.length) * 100) : 0}%)</span></p>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                              <span className="inline-flex rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">{tipoLeadComStatus[2].won} vend.</span>
                              <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{tipoLeadComStatus[2].ongoing} and.</span>
                              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{tipoLeadComStatus[2].lost} perd.</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-white/80 overflow-hidden">
                              <div className="h-full rounded-full bg-sky-500/80" style={{ width: `${Math.max(results.length > 0 ? (tipoLeadComStatus[2].value / results.length) * 100 : 0, 6)}%` }} />
                            </div>
                          </button>
                          <div className="w-full rounded-t-lg bg-sky-200/90 py-2 text-center text-sm font-bold text-sky-900 shadow-inner">3º lugar</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Demais tipos (4º em diante) ou todos se menos de 3 */}
                  {tipoLeadComStatus.length > 3 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Demais tipos</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {tipoLeadComStatus.slice(3).map((item, idx) => {
                          const manual = TIPO_LEAD_MANUAL[item.name]
                          const pct = results.length > 0 ? Math.round((item.value / results.length) * 100) : 0
                          const realIdx = 3 + idx
                          const CARD_COLORS = ['bg-slate-50 border-slate-200/80', 'bg-rose-50 border-rose-200/80', 'bg-teal-50 border-teal-200/80']
                          const ICON_BG = ['bg-slate-100 text-slate-600', 'bg-rose-100 text-rose-600', 'bg-teal-100 text-teal-600']
                          const isSelected = selectedTipoLead === item.name
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => setSelectedTipoLead(isSelected ? null : item.name)}
                              className={cn(
                                'rounded-2xl border p-3 shadow-sm hover:shadow-md transition-all text-left cursor-pointer',
                                CARD_COLORS[idx % CARD_COLORS.length],
                                isSelected && 'ring-2 ring-primary ring-offset-2'
                              )}
                              title={manual?.description ?? item.name}
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700">{realIdx + 1}</span>
                                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ICON_BG[idx % ICON_BG.length])}>
                                  {manual?.icon ?? <List className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                  <p className="text-base font-bold text-gray-800">{item.value} <span className="text-xs font-medium text-gray-500">({pct}%)</span></p>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                                    <span className="inline-flex rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">{item.won} vend.</span>
                                    <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{item.ongoing} and.</span>
                                    <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{item.lost} perd.</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 h-1 w-full rounded-full bg-white/70 overflow-hidden">
                                <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${Math.max(pct, 6)}%` }} />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Se só 1 ou 2 tipos, mostrar em grid simples */}
                  {tipoLeadComStatus.length < 3 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {tipoLeadComStatus.map((item, idx) => {
                        const manual = TIPO_LEAD_MANUAL[item.name]
                        const pct = results.length > 0 ? Math.round((item.value / results.length) * 100) : 0
                        const CARD_COLORS = ['bg-violet-50 border-violet-200/80', 'bg-amber-50 border-amber-200/80']
                        const ICON_BG = ['bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600']
                        const isSelected = selectedTipoLead === item.name
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setSelectedTipoLead(isSelected ? null : item.name)}
                            className={cn(
                              'rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all text-left cursor-pointer',
                              CARD_COLORS[idx % 2],
                              isSelected && 'ring-2 ring-primary ring-offset-2'
                            )}
                            title={manual?.description ?? item.name}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ICON_BG[idx % 2])}>{manual?.icon ?? <List className="h-5 w-5" />}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                <p className="text-xl font-bold text-gray-800">{item.value} <span className="text-xs font-medium text-gray-500">({pct}%)</span></p>
                                <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                                  <span className="inline-flex rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">{item.won} vend.</span>
                                  <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{item.ongoing} and.</span>
                                  <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{item.lost} perd.</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 h-1.5 w-full rounded-full bg-white/70 overflow-hidden">
                              <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${Math.max(pct, 6)}%` }} />
                            </div>
                            {manual?.description && <p className="mt-2 text-xs text-gray-600 line-clamp-2 leading-relaxed" title={manual.description}>{manual.description}</p>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Lista de leads do tipo selecionado */}
                  {selectedTipoLead && (
                    <div className="mt-6 rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-white overflow-hidden shadow-lg">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-primary/20 bg-primary/10">
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                            {TIPO_LEAD_MANUAL[selectedTipoLead]?.icon ?? <List className="h-4 w-4" />}
                          </span>
                          Leads do tipo <strong>{selectedTipoLead}</strong> ({leadsPorTipoLead.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedTipoLead(null)}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="p-4 max-h-[420px] overflow-y-auto">
                        {leadsPorTipoLead.length === 0 ? (
                          <p className="text-sm text-gray-500 py-6 text-center">Nenhum lead neste tipo.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {leadsPorTipoLead.map((lead) => (
                              <button
                                key={lead.rowIndex}
                                type="button"
                                onClick={() => setSelectedLead(lead)}
                                className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
                              >
                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary" title={lead.nome_lead || lead.id_registro || ''}>
                                  {lead.nome_lead || lead.id_registro || `Linha ${lead.rowIndex}`}
                                </p>
                                <p className="text-xs text-gray-600 truncate mt-0.5" title={lead.razao_social || ''}>
                                  {lead.razao_social || '—'}
                                </p>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                      lead.status === 'win' && 'bg-post/20 text-post',
                                      lead.status === 'lost' && 'bg-red-100 text-red-700',
                                      (lead.status === 'ongoing' || (lead.status !== 'win' && lead.status !== 'lost')) && 'bg-gray-100 text-gray-600'
                                    )}
                                  >
                                    {lead.status === 'win' ? 'Ganha' : lead.status === 'lost' ? 'Perdida' : 'Em andamento'}
                                  </span>
                                  <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes →</span>
                                </div>
                                {getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') && (
                                  <p className="text-[10px] text-gray-500 mt-2 truncate" title={getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') ?? ''}>
                                    {getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '')}
                                  </p>
                                )}
                                {lead.status === 'lost' && (lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao)?.trim() && (
                                  <p className="text-[10px] text-red-600/90 mt-2 line-clamp-2 leading-snug" title={String(lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao).trim()}>
                                    {String(lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao).trim()}
                                  </p>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bloco: Indicação (categoria quando tipo = Indicação) — clique filtra a lista "Nome indicação" */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Indicação (categoria de quem indicou)</p>
              <p className="text-xs text-gray-500 mb-2">Clique em uma categoria para filtrar a lista &quot;Nome indicação&quot; abaixo.</p>
              {indicacaoChartData.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center rounded-xl bg-gray-50 border border-gray-100">Sem dados de indicação.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {indicacaoChartData.map((item, idx) => {
                    const totalIndicacao = indicacaoChartData.reduce((s, x) => s + x.value, 0)
                    const pct = totalIndicacao > 0 ? Math.round((item.value / totalIndicacao) * 100) : 0
                    const iconEl = INDICACAO_ICONS[item.name] ?? <UserPlus className="h-4 w-4" />
                    const CARD_COLORS = ['bg-teal-50 border-teal-200/80', 'bg-emerald-50 border-emerald-200/80', 'bg-cyan-50 border-cyan-200/80', 'bg-indigo-50 border-indigo-200/80', 'bg-violet-50 border-violet-200/80']
                    const cardClass = CARD_COLORS[idx % CARD_COLORS.length]
                    const isSelected = filterIndicacaoParaNome === item.name
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFilterIndicacaoParaNome(isSelected ? null : item.name)}
                        className={cn(
                          'rounded-2xl border p-3 shadow-sm hover:shadow-md transition-all text-left',
                          cardClass,
                          isSelected && 'ring-2 ring-primary ring-offset-2'
                        )}
                        title={isSelected ? 'Clique para remover filtro na lista Nome indicação' : 'Clique para filtrar a lista Nome indicação por esta categoria'}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-gray-600 shadow-sm">
                            {iconEl}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 truncate flex-1 min-w-0 text-left" title={item.name}>{item.name}</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900 mt-2">{item.value} <span className="text-xs font-medium text-gray-500">({pct}%)</span></p>
                        <div className="mt-2 h-1 w-full rounded-full bg-white/60 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${Math.max(pct, 6)}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bloco: Top indicadores (nome indicação) — filtrado por Indicação quando clicado */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Top indicadores (nome da indicação)</p>
                {filterIndicacaoParaNome && (
                  <>
                    <span className="text-xs text-gray-600">Filtrado por: <strong>{filterIndicacaoParaNome}</strong></span>
                    <button
                      type="button"
                      onClick={() => setFilterIndicacaoParaNome(null)}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Limpar filtro
                    </button>
                  </>
                )}
              </div>
              {nomeIndicacaoComStatus.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center rounded-xl bg-gray-50 border border-gray-100">
                  {filterIndicacaoParaNome ? `Nenhum nome de indicação na categoria "${filterIndicacaoParaNome}". Limpe o filtro para ver todos.` : 'Sem dados de nome indicação.'}
                </p>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="divide-y divide-gray-100">
                      {nomeIndicacaoComStatus.slice(0, 10).map((item, idx) => {
                        const isSelected = selectedNomeIndicacao === item.name
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setSelectedNomeIndicacao(isSelected ? null : item.name)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left',
                              isSelected && 'bg-primary/5 ring-inset ring-1 ring-primary/20'
                            )}
                            title={isSelected ? 'Clique para fechar a lista de leads' : 'Clique para ver os leads que esta pessoa indicou'}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {idx + 1}
                            </span>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                              <UserCheck className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-sm font-medium text-gray-800 truncate block" title={item.name}>{item.name}</span>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                <span className="inline-flex items-center rounded-full bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post" title="Vendidas">{item.won} vend.</span>
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600" title="Em andamento">{item.ongoing} and.</span>
                                <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title="Perdidas">{item.lost} perd.</span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-primary shrink-0">{item.value} lead{item.value !== 1 ? 's' : ''}</span>
                          </button>
                        )
                      })}
                    </div>
                    {nomeIndicacaoComStatus.length > 10 && (
                      <p className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-t border-gray-100">+ {nomeIndicacaoComStatus.length - 10} indicadores</p>
                    )}
                  </div>

                  {/* Mini lista: leads que essa pessoa indicou — cards */}
                  {selectedNomeIndicacao && leadsIndicadosPorNome.length > 0 && (
                    <div className="mt-4 rounded-2xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white overflow-hidden shadow-lg">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200/80 bg-amber-100/50">
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800">
                            <UserCheck className="h-4 w-4" />
                          </span>
                          Leads indicados por <strong>{selectedNomeIndicacao}</strong> ({leadsIndicadosPorNome.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedNomeIndicacao(null)}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="p-4 max-h-[360px] overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {leadsIndicadosPorNome.map((lead) => (
                            <button
                              key={lead.rowIndex}
                              type="button"
                              onClick={() => setSelectedLead(lead)}
                              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-amber-300/60 transition-all group"
                            >
                              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary" title={lead.nome_lead || lead.id_registro || ''}>
                                {lead.nome_lead || lead.id_registro || `Linha ${lead.rowIndex}`}
                              </p>
                              <p className="text-xs text-gray-600 truncate mt-0.5" title={lead.razao_social || ''}>
                                {lead.razao_social || '—'}
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                    lead.status === 'win' && 'bg-post/20 text-post',
                                    lead.status === 'lost' && 'bg-red-100 text-red-700',
                                    (lead.status === 'ongoing' || (lead.status !== 'win' && lead.status !== 'lost')) && 'bg-gray-100 text-gray-600'
                                  )}
                                >
                                  {lead.status === 'win' ? 'Ganha' : lead.status === 'lost' ? 'Perdida' : 'Em andamento'}
                                </span>
                                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes →</span>
                              </div>
                              {getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') && (
                                <p className="text-[10px] text-gray-500 mt-2 truncate" title={getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') ?? ''}>
                                  {getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '')}
                                </p>
                              )}
                              {lead.status === 'lost' && (lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao)?.trim() && (
                                <p className="text-[10px] text-red-600/90 mt-2 line-clamp-2 leading-snug" title={String(lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao).trim()}>
                                  {String(lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao).trim()}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedNomeIndicacao && leadsIndicadosPorNome.length === 0 && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <p className="text-sm text-gray-600">Nenhum lead encontrado para &quot;{selectedNomeIndicacao}&quot;.</p>
                      <button
                        type="button"
                        onClick={() => setSelectedNomeIndicacao(null)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DashboardSection>

      {/* Seção: Ranking de performance */}
      <DashboardSection
        icon={<Award className="h-5 w-5" />}
        title="Ranking de performance"
        description="Conversão e win rate por solicitante. Clique em um nome para filtrar a lista de leads abaixo e ver leads vendidas."
        fullWidth
      >
      {performancePorSolicitante.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Nenhum dado no período.</p>
      ) : (
        <>
          {/* Pódio: 2º esquerda, 1º centro (mais alto), 3º direita; base com degraus */}
          {performancePorSolicitante.length >= 3 && (
            <div className="mb-10">
              <div className="flex items-end justify-center gap-3 sm:gap-6" style={{ minHeight: '320px' }}>
                {/* 2º lugar */}
                <div className="flex flex-col items-center flex-1 max-w-[220px]">
                  <PodiumCard
                    p={performancePorSolicitante[1]}
                    position={2}
                    height="min-h-[12rem]"
                    medalClass="bg-gray-400 text-white"
                    onClick={() => {
                      setShowWonLeadsPanel(true)
                      setSelectedSolicitanteKey(selectedSolicitanteKey === performancePorSolicitante[1].emailKey ? null : performancePorSolicitante[1].emailKey)
                    }}
                    isSelected={selectedSolicitanteKey === performancePorSolicitante[1].emailKey}
                  />
                  <div className="w-full rounded-t-lg bg-gray-200/90 py-2 text-center text-sm font-bold text-gray-700 shadow-inner">
                    2º lugar
                  </div>
                </div>
                {/* 1º lugar */}
                <div className="flex flex-col items-center flex-1 max-w-[260px]">
                  <PodiumCard
                    p={performancePorSolicitante[0]}
                    position={1}
                    height="min-h-[15rem]"
                    medalClass="bg-amber-400 text-amber-900"
                    onClick={() => {
                      setShowWonLeadsPanel(true)
                      setSelectedSolicitanteKey(selectedSolicitanteKey === performancePorSolicitante[0].emailKey ? null : performancePorSolicitante[0].emailKey)
                    }}
                    isSelected={selectedSolicitanteKey === performancePorSolicitante[0].emailKey}
                  />
                  <div className="w-full rounded-t-lg bg-amber-400/90 py-2 text-center text-sm font-bold text-amber-900 shadow-inner">
                    1º lugar
                  </div>
                </div>
                {/* 3º lugar */}
                <div className="flex flex-col items-center flex-1 max-w-[220px]">
                  <PodiumCard
                    p={performancePorSolicitante[2]}
                    position={3}
                    height="min-h-[10rem]"
                    medalClass="bg-amber-700 text-amber-100"
                    onClick={() => {
                      setShowWonLeadsPanel(true)
                      setSelectedSolicitanteKey(selectedSolicitanteKey === performancePorSolicitante[2].emailKey ? null : performancePorSolicitante[2].emailKey)
                    }}
                    isSelected={selectedSolicitanteKey === performancePorSolicitante[2].emailKey}
                  />
                  <div className="w-full rounded-t-lg bg-amber-700/80 py-2 text-center text-sm font-bold text-amber-100 shadow-inner">
                    3º lugar
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-3">Passe o mouse sobre o card para ver ganhas, perdidas e taxas</p>
            </div>
          )}

          {/* Lista/grid de cards no mesmo estilo do pódio (demais colocados ou todos se menos de 3 no pódio) */}
          <div className="mt-6">
            {performancePorSolicitante.length > 3 && (
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Demais colocados</h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(expandRankingSolicitantes ? performancePorSolicitante : performancePorSolicitante.slice(0, TOP_N))
                .filter((_, i) => performancePorSolicitante.length < 3 || i >= 3)
                .map((p) => (
                  <button
                    key={p.emailKey}
                    type="button"
                    onClick={() => {
                      setShowWonLeadsPanel(true)
                      setSelectedSolicitanteKey(selectedSolicitanteKey === p.emailKey ? null : p.emailKey)
                    }}
                    className={cn(
                      'group flex flex-col items-center rounded-2xl border-2 px-4 py-4 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[140px]',
                      selectedSolicitanteKey === p.emailKey ? 'border-post bg-post/10 ring-2 ring-post/30 shadow-lg' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 shadow-md'
                    )}
                  >
                    <span className="mb-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-gray-700 shadow">
                      {p.rank}
                    </span>
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow mb-2 flex-shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-base ring-2 ring-white shadow mb-2 flex-shrink-0">
                        {(p.nome || '?').charAt(0)}
                      </div>
                    )}
                    <p className="font-semibold text-gray-900 text-sm leading-tight truncate w-full" title={p.nome}>
                      {p.nome}
                    </p>
                    {p.area && (
                      <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {p.area}
                      </span>
                    )}
                    {/* Detalhes no hover - mesmo estilo do pódio */}
                    <div className="mt-3 w-full pt-3 border-t border-gray-200/80 opacity-0 max-h-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-32 transition-all duration-300 text-left">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                        <span className="text-post font-semibold">{p.won} ganhas</span>
                        <span className="text-red-600">{p.lost} perdidas</span>
                        <span className="text-gray-500">{p.ongoing} and.</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <Percent className="h-2.5 w-2.5" />
                          {p.conversionRate}%
                        </span>
                        {p.won + p.lost > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-post/15 px-1.5 py-0.5 text-[10px] font-semibold text-post">
                            <Target className="h-2.5 w-2.5" />
                            {p.winRate}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200 overflow-hidden flex">
                        <div className="bg-post transition-all" style={{ width: `${p.total > 0 ? (p.won / p.total) * 100 : 0}%` }} title="Ganhas" />
                        <div className="bg-red-400 transition-all" style={{ width: `${p.total > 0 ? (p.lost / p.total) * 100 : 0}%` }} title="Perdidas" />
                        <div className="bg-gray-400 transition-all" style={{ width: `${p.total > 0 ? (p.ongoing / p.total) * 100 : 0}%` }} title="Em andamento" />
                      </div>
                    </div>
                  </button>
                ))}
            </div>
            {performancePorSolicitante.length > TOP_N && (
              <button
                type="button"
                onClick={() => setExpandRankingSolicitantes(!expandRankingSolicitantes)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all"
              >
                {expandRankingSolicitantes ? (
                  <>Mostrar menos (top {TOP_N}) <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Ver todos os {performancePorSolicitante.length} solicitantes <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </div>
        </>
      )}
      </DashboardSection>

      {/* Seção: Lista de leads (logo abaixo do pódio; filtrada por solicitante ou motivo ao clicar) */}
      <DashboardSection
        icon={<Table2 className="h-5 w-5" />}
        title="Lista de leads"
        description={
          selectedSolicitanteKey || filterListaPorMotivo
            ? `${listaLeadsFiltrada.length} registro(s) — filtrado por ${selectedSolicitanteKey ? getSolicitanteLabel(selectedSolicitanteKey === '(sem e-mail)' ? '' : selectedSolicitanteKey) : ''}${selectedSolicitanteKey && filterListaPorMotivo ? ' e ' : ''}${filterListaPorMotivo ? `motivo: ${filterListaPorMotivo}` : ''}. Clique em "Limpar filtros" para ver todos.`
            : `${listaLeadsFiltrada.length} registro(s). Primeiros ${expandListaLeads ? listaLeadsFiltrada.length : Math.min(LISTA_LEADS_INICIAL, listaLeadsFiltrada.length)} exibidos. Use "Ver" para detalhes.`
        }
        fullWidth
      >
        {(selectedSolicitanteKey || filterListaPorMotivo) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedSolicitanteKey(null)
                setFilterListaPorMotivo(null)
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Limpar filtros da lista
            </button>
          </div>
        )}
        {listaLeadsFiltrada.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            {results.length === 0 ? 'Nenhum lead no período/funil selecionado.' : 'Nenhum lead corresponde aos filtros. Limpe os filtros para ver todos.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[640px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 font-medium">
                    <th className="py-2 px-2 w-16">Ver</th>
                    <th className="py-2 px-2">Nome / Lead</th>
                    <th className="py-2 px-2">Razão social</th>
                    <th className="py-2 px-2">Etapa</th>
                    <th className="py-2 px-2">Funil</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Anotação motivo</th>
                    <th className="py-2 px-2">Solicitante</th>
                    <th className="py-2 px-2">Área</th>
                    <th className="py-2 px-2">Criação</th>
                    <th className="py-2 px-2">Atualização</th>
                  </tr>
                </thead>
                <tbody>
                  {[...listaLeadsFiltrada]
                    .sort((a, b) => {
                      const da = a.created_at_iso || ''
                      const db = b.created_at_iso || ''
                      return db.localeCompare(da)
                    })
                    .slice(0, expandListaLeads ? undefined : LISTA_LEADS_INICIAL)
                    .map((lead) => (
                    <tr key={lead.rowIndex} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium bg-primary text-white hover:bg-primary/90"
                        >
                          Ver
                        </button>
                      </td>
                      <td className="py-2.5 px-2 font-medium text-gray-900 max-w-[180px] truncate" title={lead.nome_lead || lead.id_registro || ''}>
                        {lead.nome_lead || lead.id_registro || `Linha ${lead.rowIndex}`}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700 max-w-[180px] truncate" title={lead.razao_social || ''}>
                        {lead.razao_social || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[140px] truncate">{lead.stage_name || '—'}</td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[140px] truncate">{lead.funil || '—'}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            lead.status === 'win' && 'bg-post/20 text-post',
                            lead.status === 'lost' && 'bg-red-100 text-red-700',
                            (lead.status === 'ongoing' || (!lead.status || (lead.status !== 'win' && lead.status !== 'lost'))) && 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {lead.status === 'win' ? 'Ganha' : lead.status === 'lost' ? 'Perdida' : 'Em andamento'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[200px]" title={lead.status === 'lost' ? (lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao) ?? undefined : undefined}>
                        {lead.status === 'lost' && (lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao)?.trim()
                          ? <span className="line-clamp-2 text-left">{String(lead.motivo_perda_anotacao ?? lead.planilha?.motivo_perda_anotacao).trim()}</span>
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[140px] truncate">
                        {getSolicitanteLabel((lead.email_solicitante ?? lead.email_notificar ?? '') || '')}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[120px] truncate" title={getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') ?? ''}>
                        {getAreaByEmail((lead.email_solicitante ?? lead.email_notificar ?? '') || '') ?? '—'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap" title="Data de criação (Date_Create)">
                        {lead.created_at_iso
                          ? new Date(lead.created_at_iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 whitespace-nowrap" title="Data de atualização (Date_Update)">
                        {lead.updated_at_iso
                          ? new Date(lead.updated_at_iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listaLeadsFiltrada.length > LISTA_LEADS_INICIAL && (
              <button
                type="button"
                onClick={() => setExpandListaLeads(!expandListaLeads)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {expandListaLeads ? (
                  <>Mostrar menos (primeiros {LISTA_LEADS_INICIAL}) <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Ver todos os {listaLeadsFiltrada.length} leads <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </>
        )}
      </DashboardSection>

      {/* Modal Enviar relatório no WhatsApp (usa API /api/enviar-whatsapp) */}
      {showWppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="wpp-relatorio-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 id="wpp-relatorio-modal-title" className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                Enviar relatório no WhatsApp
              </h2>
              <button type="button" onClick={closeWppModal} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp (DDD + celular)</label>
                <input
                  type="tel"
                  value={wppNumber}
                  onChange={(e) => setWppNumber(e.target.value)}
                  placeholder="Ex: 11999999999 ou 5511999999999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem (pode editar antes de enviar)</label>
                <textarea
                  value={wppMessage}
                  onChange={(e) => setWppMessage(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-y font-sans"
                />
              </div>
              {wppError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {wppError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button type="button" onClick={closeWppModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Fechar
              </button>
              <button
                type="button"
                onClick={sendWppReport}
                disabled={wppSending || !wppNumber.trim() || !wppMessage.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {wppSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    Enviar no WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seção: Etapas do funil */}
      <DashboardSection
        icon={<Filter className="h-5 w-5" />}
        title="Etapas do funil"
        description="Etapas oficiais do funil (ordem). A API exclui outras etapas. Selecione abaixo quais considerar (vazio = todas)."
        fullWidth
      >
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Etapas do Funil de vendas (ordem)</p>
          <p className="text-sm text-gray-800">{ETAPAS_FUNIL_VENDAS.join(' > ')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Etapas excluídas pela API (não entram)</p>
            <p className="text-sm text-gray-700">{STAGES_IGNORADOS.join(', ')}</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Etapas consideradas (após seu filtro)</p>
            {etapasConsideradasNosDados.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma etapa nos dados com os filtros atuais.</p>
            ) : (
              <p className="text-sm text-gray-800">{etapasConsideradasNosDados.join(', ')}</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Selecionar etapas a considerar</p>
          <p className="text-xs text-gray-500 mb-2">Marque as etapas que devem entrar na análise. Nenhuma seleção = todas.</p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setSelectedEtapas([])}
              className="text-xs font-medium px-2 py-1 rounded bg-primary text-white hover:bg-primary/90"
            >
              Considerar todas
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {etapasDisponiveisParaFiltro.length === 0 ? (
              <p className="text-sm text-gray-500">Carregue os dados para ver as etapas disponíveis.</p>
            ) : (
              etapasDisponiveisParaFiltro.map((etapa) => {
                const checked = selectedEtapas.length === 0 || selectedEtapas.includes(etapa)
                return (
                  <label key={etapa} className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (selectedEtapas.length === 0) {
                          setSelectedEtapas(etapasDisponiveisParaFiltro.filter((x) => x !== etapa))
                        } else if (selectedEtapas.includes(etapa)) {
                          const next = selectedEtapas.filter((x) => x !== etapa)
                          setSelectedEtapas(next.length === 0 ? [] : next)
                        } else {
                          setSelectedEtapas(sortEtapasByFunil([...selectedEtapas, etapa]))
                        }
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>{etapa}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      </DashboardSection>

      {/* Seção: Leads perdidas por solicitante */}
      <DashboardSection
        icon={<Activity className="h-5 w-5" />}
        title="Leads perdidas por solicitante"
        description="Quem mais perdeu no período. Top 5 em destaque."
      >
        {perdidasPorSolicitante.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhuma lead perdida.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {(expandPerdidasSolicitante ? perdidasPorSolicitante : perdidasPorSolicitante.slice(0, TOP_N)).map((item, idx) => (
                <div
                  key={item.emailKey}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                    {idx + 1}
                  </span>
                  {item.avatar ? (
                    <img src={item.avatar} alt="" className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 text-gray-500 text-sm font-medium">
                      {(item.nome || '?').charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-gray-800">{item.nome}</span>
                  <span className="rounded-full bg-red-100 px-3 py-0.5 text-sm font-semibold text-red-700">{item.total}</span>
                </div>
              ))}
            </div>
            {perdidasPorSolicitante.length > TOP_N && (
              <button
                type="button"
                onClick={() => setExpandPerdidasSolicitante(!expandPerdidasSolicitante)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {expandPerdidasSolicitante ? (
                  <>Mostrar menos <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Ver todos os {perdidasPorSolicitante.length} solicitantes <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </>
        )}
      </DashboardSection>

      {/* Lista de leads vendidas (ao clicar no card Ganhas ou em um solicitante) */}
      {showWonLeadsPanel && resumo.won > 0 && (
        <DashboardSection
          icon={<Users className="h-5 w-5" />}
          title={selectedSolicitanteKey ? `Leads vendidas: ${getSolicitanteLabel(selectedSolicitanteKey === '(sem e-mail)' ? '' : selectedSolicitanteKey)}` : 'Leads vendidas'}
          description="Clique em um lead para ver detalhes."
          fullWidth
        >
          <div className="flex items-center justify-end mb-4">
            <button
              type="button"
              onClick={() => {
                setShowWonLeadsPanel(false)
                setSelectedSolicitanteKey(null)
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Fechar lista
            </button>
          </div>
          {wonLeadsFiltradasPorSolicitante.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Nenhuma lead para exibir.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {wonLeadsFiltradasPorSolicitante.map((lead) => (
                <button
                  key={lead.rowIndex}
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 text-left hover:border-post hover:bg-post/5 transition-colors"
                >
                  <p className="font-medium text-gray-900 truncate">{lead.nome_lead || lead.id_registro || `Linha ${lead.rowIndex}`}</p>
                  <p className="text-sm text-gray-600 truncate">{lead.razao_social || '—'}</p>
                  <p className="text-xs text-gray-500 mt-1">{lead.stage_name || ''} · {lead.funil || ''}</p>
                </button>
              ))}
            </div>
          )}
        </DashboardSection>
      )}

      {/* Modal detalhe do lead (todas as colunas da planilha) */}
      {selectedLead && (() => {
        const planilha = selectedLead.planilha || {}
        const hasValue = (v: unknown) => v != null && String(v).trim() !== '' && String(v).trim() !== '[]'
        const sectionKeys = new Set([
          'stage_name', 'stage_id', 'nome', 'deal_id', 'estado', 'lead', 'nome_lead', 'funil',
          'solicitante', 'email_solicitante', 'razao_social', 'cnpj', 'demais_razoes_sociais', 'razao_social_completa', 'areas_analise', 'tipo_lead', 'tipo_de_lead', 'indicacao', 'nome_indicacao', 'cadastrado_por',
          'prazo_entrega_data', 'prazo_entrega_hora', 'local_reuniao', 'data_reuniao', 'horario_reuniao', 'havera_due_diligence', 'due_diligence', 'realizou_due_diligence', 'link_arquivo_due', 'areas_comparecimento', 'tipo_instrumento', 'limitacao_processos', 'limitacao_horas',
          'nome_ponto_focal', 'email_ponto_focal', 'telefone_ponto_focal', 'link_proposta', 'link_da_proposta', 'qualificacao_completa', 'areas_cp', 'gestor_contrato', 'gestor_contrato_cp', 'captador', 'tributacao', 'prazo_entrega_cp', 'data_primeiro_vencimento', 'informacoes_adicionais', 'demais_razoes_sociais_cp', 'razao_social_cp', 'cnpj_cp',
          'tipo_pagamento', 'exito', 'valores', 'prazo_entrega_contrato', 'data_assinatura_contrato', 'link_contrato', 'link_do_contrato', 'objeto_contrato_cc', 'prazo_contrato_cc', 'valor_mensal_fixo_cc', 'valor_mensal_preco_fechado_cc', 'valor_exito_cc', 'mensal_fixo_financeiro', 'mensal_preco_fechado_financeiro', 'mensal_escalonado_financeiro', 'mensal_variavel_financeiro', 'mensal_condicionado_financeiro', 'spot_financeiro', 'spot_manutencao_financeiro', 'spot_parcelado_financeiro', 'spot_parcelado_manutencao_financeiro', 'spot_condicionado_financeiro', 'exito_financeiro', 'repasse_acordado_financeiro',
          'rateio_porcentagem_insolvencia_financeiro', 'rateio_porcentagem_civel_financeiro', 'rateio_porcentagem_trabalhista_financeiro', 'rateio_porcentagem_tributario_financeiro', 'rateio_porcentagem_contratos_financeiro', 'rateio_porcentagem_add_financeiro', 'indice_reajuste_financeiro', 'periodicidade_reajuste_financeiro', 'observacoes_financeiro',
          'razao_social_financeiro', 'cpf_cnpj_financeiro', 'vigencia_contrato_financeiro', 'primeiro_faturamento_financeiro', 'responsavel_cliente_financeiro', 'posicao_responsavel_financeiro', 'email_responsavel_financeiro', 'telefone_responsavel_financeiro', 'status_financeiro', 'id_sharepoint', 'id_sharepoint_financeiro', 'status_cadastro', 'razao_social_principal_cadastro', 'cnpj_cpf_cadastro', 'endereco_cadastro', 'escopo_contratual_cadastro', 'qualificacao_socios_cadastro', 'consulta_auto_cadastro', 'info_adicionais_cadastro',
          'date_create', 'created_at', 'date_update', 'updated_at', 'motivo_perda', 'motivo_perda_anotacao',
        ])
        const sections: { title: string; keys: string[] }[] = [
          { title: 'Identificação', keys: ['stage_name', 'stage_id', 'nome', 'deal_id', 'estado', 'lead', 'nome_lead', 'funil'] },
          { title: 'Cadastro / Lead', keys: ['solicitante', 'email_solicitante', 'razao_social', 'cnpj', 'demais_razoes_sociais', 'razao_social_completa', 'areas_analise', 'tipo_lead', 'tipo_de_lead', 'indicacao', 'nome_indicacao', 'cadastrado_por'] },
          { title: 'Reunião / Due', keys: ['prazo_entrega_data', 'prazo_entrega_hora', 'local_reuniao', 'data_reuniao', 'horario_reuniao', 'havera_due_diligence', 'due_diligence', 'realizou_due_diligence', 'link_arquivo_due', 'areas_comparecimento', 'tipo_instrumento', 'limitacao_processos', 'limitacao_horas'] },
          { title: 'Proposta (CP)', keys: ['nome_ponto_focal', 'email_ponto_focal', 'telefone_ponto_focal', 'link_proposta', 'link_da_proposta', 'qualificacao_completa', 'areas_cp', 'gestor_contrato', 'gestor_contrato_cp', 'captador', 'tributacao', 'prazo_entrega_cp', 'data_primeiro_vencimento', 'informacoes_adicionais', 'demais_razoes_sociais_cp', 'razao_social_cp', 'cnpj_cp'] },
          { title: 'Contrato / Valores', keys: ['tipo_pagamento', 'exito', 'valores', 'prazo_entrega_contrato', 'data_assinatura_contrato', 'link_contrato', 'link_do_contrato', 'objeto_contrato_cc', 'prazo_contrato_cc', 'valor_mensal_fixo_cc', 'valor_mensal_preco_fechado_cc', 'valor_exito_cc', 'mensal_fixo_financeiro', 'mensal_preco_fechado_financeiro', 'mensal_escalonado_financeiro', 'mensal_variavel_financeiro', 'mensal_condicionado_financeiro', 'spot_financeiro', 'spot_manutencao_financeiro', 'spot_parcelado_financeiro', 'spot_parcelado_manutencao_financeiro', 'spot_condicionado_financeiro', 'exito_financeiro', 'repasse_acordado_financeiro'] },
          { title: 'Rateio e reajuste', keys: ['rateio_porcentagem_insolvencia_financeiro', 'rateio_porcentagem_civel_financeiro', 'rateio_porcentagem_trabalhista_financeiro', 'rateio_porcentagem_tributario_financeiro', 'rateio_porcentagem_contratos_financeiro', 'rateio_porcentagem_add_financeiro', 'indice_reajuste_financeiro', 'periodicidade_reajuste_financeiro', 'observacoes_financeiro'] },
          { title: 'Financeiro / Cadastro', keys: ['razao_social_financeiro', 'cpf_cnpj_financeiro', 'vigencia_contrato_financeiro', 'primeiro_faturamento_financeiro', 'responsavel_cliente_financeiro', 'posicao_responsavel_financeiro', 'email_responsavel_financeiro', 'telefone_responsavel_financeiro', 'status_financeiro', 'id_sharepoint', 'id_sharepoint_financeiro', 'status_cadastro', 'razao_social_principal_cadastro', 'cnpj_cpf_cadastro', 'endereco_cadastro', 'escopo_contratual_cadastro', 'qualificacao_socios_cadastro', 'consulta_auto_cadastro', 'info_adicionais_cadastro'] },
          { title: 'Datas e status', keys: ['date_create', 'created_at', 'date_update', 'updated_at', 'motivo_perda', 'motivo_perda_anotacao'] },
        ]
        const outrosKeys = Object.keys(planilha).filter((k) => hasValue(planilha[k]) && !sectionKeys.has(k))
        if (outrosKeys.length > 0) {
          sections.push({ title: 'Outros (planilha)', keys: outrosKeys })
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Detalhe da negociação ganha</h2>
                <button type="button" onClick={() => setSelectedLead(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome / Registro</p>
                  <p className="font-medium text-gray-900">{selectedLead.nome_lead || selectedLead.id_registro || `Linha ${selectedLead.rowIndex}`}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Razão Social</p>
                  <p className="text-gray-800">{selectedLead.razao_social || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etapa · Funil</p>
                  <p className="text-gray-800">{selectedLead.stage_name || '—'} · {selectedLead.funil || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Solicitante</p>
                  <p className="text-gray-800">{getSolicitanteLabel((selectedLead.email_solicitante ?? selectedLead.email_notificar ?? '') || '')}</p>
                </div>

                {sections.map(({ title, keys }) => {
                  const items = keys
                    .filter((k) => hasValue(planilha[k]))
                    .map((k) => ({ key: k, label: PLANILHA_LABELS[k] || k.replace(/_/g, ' '), value: String(planilha[k]).trim() }))
                  if (items.length === 0) return null
                  return (
                    <div key={title} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pb-1 border-b border-gray-200">{title}</p>
                      <dl className="grid gap-1.5 text-sm">
                        {items.map(({ key, label, value }) => (
                          <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                            <dt className="text-gray-600 font-medium shrink-0 sm:w-48">{label}</dt>
                            <dd className="text-gray-900 break-words">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )
                })}

                {(selectedLead.created_at_iso || selectedLead.updated_at_iso) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data criação · Data atualização</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Criação:</span> {selectedLead.created_at_iso ? new Date(selectedLead.created_at_iso).toLocaleString('pt-BR') : '—'}
                      {' · '}
                      <span className="font-medium">Atualização:</span> {selectedLead.updated_at_iso ? new Date(selectedLead.updated_at_iso).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                )}
                {selectedLead.deal_id && (
                  <a
                    href={`${RD_CRM_DEAL_URL}${selectedLead.deal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir no RD Station
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Assistente de IA: análise, sugestões e dúvidas (usa VITE_OPENAI_API_KEY) */}
      <AiAssistant contextSummary={aiContextSummary} periodLabel={aiPeriodLabel} />
    </div>
  )
}
