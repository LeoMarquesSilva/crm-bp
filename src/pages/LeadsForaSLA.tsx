/**
 * Aba "Leads fora do SLA": exibe leads do Funil de vendas parados na mesma etapa
 * há mais de 10 dias. Usa tempo desde última atualização (ou criação) como proxy
 * para "tempo na etapa". Dados da mesma API validar-sheets.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { Clock, Loader2, AlertCircle, RefreshCw, ExternalLink, FileSpreadsheet, User, MessageCircle, X, Filter, History, Scale, Users, Crown, TrendingDown, FileCheck, Calculator, Briefcase, Eye } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { fixMojibake } from '@/lib/utils'
import { getTeamMember, getSolicitanteKey, getAreaByEmail } from '@/data/teamAvatars'
import { supabase } from '@/lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const API = (path: string) => `${API_BASE}/api${path}`
const STORAGE_KEY = 'crm-bp-google-oauth'
const SESSION_ID_KEY = 'crm-bp-google-session-id'
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'
const PLANILHA_ID = import.meta.env.VITE_PLANILHA_ID || '14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI'
const PLANILHA_ABA = import.meta.env.VITE_PLANILHA_ABA || ''
const SLA_DIAS = 10 // movimentação: > 10 dias sem mudar etapa
const SLA_DIAS_FOLLOWUP = 2 // follow-up: > 2 dias sem anotação (nos já atrasados em movimentação)

type ResultRow = {
  rowIndex: number
  valid: boolean
  errors: Array<{ field: string; message: string; comoCorrigir: string; valor_atual?: string }>
  email_notificar: string
  email_solicitante?: string
  id_registro: string
  stage_name?: string | null
  funil?: string | null
  status?: string | null
  deal_id?: string | null
  telefone_notificar?: string | null
  updated_at_iso?: string | null
  created_at_iso?: string | null
  follow_up_iso?: string | null
  follow_up_anotacao?: string | null
  dias_desde_movimentacao?: number | null
  dias_desde_followup?: number | null
  razao_social?: string | null
  nome_lead?: string | null
  planilha?: Record<string, unknown>
}

type ApiResponse = {
  results: ResultRow[]
  total: number
  comErros: number
}

const TOKEN_GRACE_MS = 60 * 1000

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = crypto.randomUUID?.() ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token, expires_at: Date.now() + sec * 1000 }))
  } catch {
    /* ignore */
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function isFunilDeVendas(funil: string | null | undefined): boolean {
  if (!funil || typeof funil !== 'string') return false
  return funil.trim().toLowerCase().includes('funil de vendas') || funil.trim().toLowerCase().includes('vendas')
}

function isOngoing(status: string | null | undefined): boolean {
  if (!status) return true
  const s = status.toLowerCase()
  return s !== 'won' && s !== 'win' && s !== 'lost' && s !== 'perda' && s !== 'ganho'
}

function isPaused(status: string | null | undefined): boolean {
  if (!status) return false
  return status.trim().toLowerCase() === 'paused'
}

function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '')
}

type SlaWppOpts = { gestorLabel?: string; rdDealUrl?: string }

function buildSlaWppMessage(r: ResultRow, opts?: SlaWppOpts): string {
  const lead = (r.id_registro || '—').replace(/\*/g, '')
  const etapa = r.stage_name || '—'
  const diasMov = r.dias_desde_movimentacao != null ? String(r.dias_desde_movimentacao) : '—'
  const linkRd = opts?.rdDealUrl ?? (r.deal_id ? `${RD_CRM_DEAL_URL}${r.deal_id}` : '')
  const gestor = opts?.gestorLabel ?? ''

  let msg = 'Olá,\n\n'
  msg += '⏱️ *Lead fora do SLA*\n\n'
  msg += '📋 *Lead:* *' + lead + '*\n'
  msg += '📍 *Etapa:* ' + etapa + '\n'
  msg += '⏳ *Dias sem movimentação:* ' + diasMov + ' dias (limite: ' + SLA_DIAS + ')\n'
  if (r.dias_desde_followup != null) {
    msg += '📝 *Dias sem follow-up:* ' + r.dias_desde_followup + ' dias (limite: ' + SLA_DIAS_FOLLOWUP + ')\n'
  }
  if (r.follow_up_iso) {
    const dataFormatada = new Date(r.follow_up_iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    msg += '📅 *Data do último follow-up:* ' + dataFormatada + '\n'
  }
  if (r.follow_up_anotacao && r.follow_up_anotacao.trim()) {
    const anot = fixMojibake(r.follow_up_anotacao)
    const preview = anot.length > 80 ? anot.slice(0, 80) + '…' : anot
    msg += '💬 *Última anotação:* ' + preview.replace(/\*/g, '') + '\n'
  }
  if (r.dias_desde_followup == null && !r.follow_up_iso && !r.follow_up_anotacao?.trim()) {
    msg += '📝 *Follow-up:* sem anotação\n'
  }
  msg += '\n'
  if (linkRd) msg += '🔗 *Link no CRM:*\n' + linkRd + '\n\n'
  if (gestor) msg += '👤 *Gestor da negociação:* ' + gestor + '\n\n'
  msg += 'Por favor, atualize a negociação no CRM.'
  return msg
}

const DIAS_ALERTA_FOGO = 90

/** Ícone por área (tag do solicitante) para cards e modal. */
const AREA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Sócio': Crown,
  'Cível': Scale,
  'Trabalhista': Users,
  'Distressed Deals': TrendingDown,
  'Reestruturação': RefreshCw,
  'Operações Legais': FileCheck,
  'Tributário': Calculator,
  'Societário e Contratos': Briefcase,
}

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
  nome_lead: 'Nome lead',
  funil: 'Funil',
  email_solicitante: 'E-mail solicitante',
  tipo_lead: 'Tipo de lead',
  indicacao: 'Indicação',
  nome_indicacao: 'Nome indicação',
  data_reuniao: 'Data reunião',
  local_reuniao: 'Local reunião',
  link_proposta: 'Link proposta',
  link_contrato: 'Link contrato',
  motivo_perda: 'Motivo perda',
  motivo_perda_anotacao: 'Anotação do motivo de perda',
  date_create: 'Data criação',
  date_update: 'Data atualização',
  follow_up: 'Follow-up',
  follow_up_anotacao: 'Anotação follow-up',
}

/** Mensagem consolidada para enviar vários leads: resumo por gestor, sem "Olá". */
function buildSlaWppBatchMessage(rows: ResultRow[], getMember: (email: string) => { name?: string } | null): string {
  if (rows.length === 0) return ''
  const byKey = new Map<string, ResultRow[]>()
  rows.forEach((r) => {
    const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
    const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(r)
  })
  const entries = Array.from(byKey.entries()).sort((a, b) => b[1].length - a[1].length)
  const numResp = entries.length
  const numLeads = rows.length

  let msg = '📊 *Resumo SLA (Atrasos)*\n'
  msg += 'Responsáveis: ' + numResp + ' | Leads: ' + numLeads + '\n\n'

  entries.forEach(([key, list]) => {
    const member = key !== '(sem e-mail)' ? getMember(key) : null
    const nome = (member?.name ?? (key === '(sem e-mail)' ? 'Sem e-mail' : key)) as string
    const count = list.length
    const icon = count >= 5 ? '⚠️' : '⏳'
    msg += icon + ' *' + nome.replace(/\*/g, '') + '* — ' + count + ' lead' + (count !== 1 ? 's' : '') + ' em atraso\n'

    list.forEach((r, i) => {
      const lead = (r.id_registro || '—').replace(/\*/g, '')
      const dias = r.dias_desde_movimentacao != null ? r.dias_desde_movimentacao : 0
      const etapa = (r.stage_name || '—').replace(/\*/g, '')
      const foginho = dias >= DIAS_ALERTA_FOGO ? '🔥 ' : ''
      msg += (i + 1) + '. ' + foginho + lead + ' — ' + dias + 'd mov (' + etapa + ')\n'
      if (r.follow_up_iso || r.dias_desde_followup != null || (r.follow_up_anotacao && r.follow_up_anotacao.trim())) {
        if (r.follow_up_iso) {
          const dataFormatada = new Date(r.follow_up_iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          msg += '   📅 Último follow-up: ' + dataFormatada
          if (r.dias_desde_followup != null) msg += ' (' + r.dias_desde_followup + 'd atrás)'
          msg += '\n'
        } else if (r.dias_desde_followup != null) {
          msg += '   📅 Último follow-up: ' + r.dias_desde_followup + 'd atrás\n'
        }
        if (r.follow_up_anotacao && r.follow_up_anotacao.trim()) {
          const anot = fixMojibake(r.follow_up_anotacao)
          const preview = anot.length > 60 ? anot.slice(0, 60) + '…' : anot
          msg += '   💬 Última anotação: ' + preview.replace(/\*/g, '') + '\n'
        }
      }
      if (r.deal_id) msg += '   🔗 ' + RD_CRM_DEAL_URL + r.deal_id + '\n'
    })
    msg += '────────────────\n\n'
  })

  return msg.trimEnd()
}

export function LeadsForaSLA() {
  const [accessToken, setAccessToken] = useState<string | null>(() => loadStoredToken())
  const [sessionRestoreAttempted, setSessionRestoreAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [filterSolicitante, setFilterSolicitante] = useState<string>('')
  const [filterSearch, setFilterSearch] = useState<string>('')
  const [filterEtapa, setFilterEtapa] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [wppModalRow, setWppModalRow] = useState<ResultRow | null>(null)
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<ResultRow | null>(null)
  const [wppModalBatch, setWppModalBatch] = useState<ResultRow[] | null>(null)
  const [wppNumber, setWppNumber] = useState('')
  const [wppMessage, setWppMessage] = useState('')
  const [wppSending, setWppSending] = useState(false)
  const [wppError, setWppError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ atual: number; total: number } | null>(null)
  const [syncFollowUpLoading, setSyncFollowUpLoading] = useState(false)

  const handleCarregar = useCallback(async () => {
    if (!accessToken || !PLANILHA_ID.trim()) {
      setError(accessToken ? 'Configure VITE_PLANILHA_ID em .env ou .env.local.' : 'Conecte-se com o Google primeiro.')
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
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
    } catch (e) {
      setError(
        'Não foi possível falar com o servidor. Use "npm run dev", "vercel dev" ou faça deploy para testar.'
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const handleSyncFollowUp = useCallback(async () => {
    if (!accessToken || !PLANILHA_ID.trim()) {
      setError(accessToken ? 'Configure VITE_PLANILHA_ID.' : 'Conecte-se com o Google primeiro.')
      return
    }
    setSyncFollowUpLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/sync-anotacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          spreadsheetId: PLANILHA_ID.trim(),
          sheetName: (PLANILHA_ABA || '').trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || json.error || 'Erro ao sincronizar follow-up.')
        return
      }
      setError(null)
      handleCarregar()
    } catch (e) {
      setError('Não foi possível falar com o servidor.')
    } finally {
      setSyncFollowUpLoading(false)
    }
  }, [accessToken, handleCarregar])

  useEffect(() => {
    if (accessToken && PLANILHA_ID.trim()) {
      handleCarregar()
    }
  }, [accessToken, handleCarregar])

  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(API('/google-oauth-refresh'), { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.access_token) return false
      const sec = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600
      setAccessToken(json.access_token)
      saveToken(json.access_token, sec)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (accessToken || !supabase) {
      if (!accessToken) setSessionRestoreAttempted(true)
      return
    }
    const tryRestore = async (sessionId: string): Promise<boolean> => {
      const { data: row, error } = await supabase
        .from('sessoes_google')
        .select('access_token, expires_at')
        .eq('session_id', sessionId)
        .maybeSingle()
      if (error || !row?.access_token) return false
      const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
      if (expiresAt > Date.now() - TOKEN_GRACE_MS) {
        setAccessToken(row.access_token)
        saveToken(row.access_token, Math.max(0, Math.round((expiresAt - Date.now()) / 1000)))
        return true
      }
      return tryRefreshToken()
    }
    ;(async () => {
      let ok = await tryRestore(getOrCreateSessionId())
      if (!ok) ok = await tryRestore('shared')
      setSessionRestoreAttempted(true)
    })()
  }, [accessToken, supabase, tryRefreshToken])

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  const login = useGoogleLogin({
    flow: 'auth-code',
    // access_type=offline + prompt=consent garantem o refresh_token para renovação automática
    access_type: 'offline',
    prompt: 'consent',
    onSuccess: async (codeResponse: { code?: string }) => {
      const code = codeResponse?.code
      if (!code) {
        setError('Resposta inválida do Google.')
        return
      }
      try {
        const res = await fetch(API('/google-oauth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: window.location.origin }),
        })
        const json = await res.json()
        if (!res.ok || !json.access_token) {
          setError(json.error || 'Não foi possível conectar com o Google.')
          return
        }
        const sec = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600
        setAccessToken(json.access_token)
        saveToken(json.access_token, sec)
        setError(null)
        setData(null)
      } catch {
        setError('Não foi possível conectar com o Google. Tente novamente.')
      }
    },
    onError: () => setError('Não foi possível conectar com o Google. Tente novamente.'),
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly',
  })

  const disconnect = () => {
    setAccessToken(null)
    clearStoredToken()
    setData(null)
  }

  const results = data?.results ?? []
  const foraDoSla = useMemo(
    () =>
      results.filter((r) => {
        if (!isFunilDeVendas(r.funil)) return false
        if (!isOngoing(r.status)) return false
        if (isPaused(r.status)) return false
        const diasMov = r.dias_desde_movimentacao
        const diasFollow = r.dias_desde_followup
        if (diasMov == null || diasMov <= SLA_DIAS) return false
        if (diasFollow == null) return true
        return diasFollow > SLA_DIAS_FOLLOWUP
      }),
    [results]
  )

  // Marcar "atualizado no RD" em histórico SLA quando o lead sair da lista fora do SLA
  // DESATIVADO: a marcação automática estava marcando incorretamente. Use SQL no Supabase para limpar corrigido_em se necessário.
  const SLA_AUTO_MARCAR_CORRIGIDO = false
  useEffect(() => {
    if (!SLA_AUTO_MARCAR_CORRIGIDO) return
    const db = supabase
    if (!db || !data?.results?.length) return
    if (foraDoSla.length === 0) return
    const planilhaIdNorm = (PLANILHA_ID || '').trim()
    const planilhaAbaNorm = (PLANILHA_ABA ?? '').trim()
    const resultsPorRowIndex = new Map<number, ResultRow>()
    data.results.forEach((r) => resultsPorRowIndex.set(r.rowIndex, r))
    const foraDoSlaRowIndices = new Set(foraDoSla.map((r) => r.rowIndex))
    const foraDoSlaKeys = new Set(foraDoSla.map((r) => `${planilhaIdNorm}|${planilhaAbaNorm}|${r.rowIndex}`))
    const foraDoSlaIdRegistros = new Set(foraDoSla.map((r) => (r.id_registro ?? '').trim()).filter(Boolean))
    let cancelled = false
    db.from('historico_envio_whatsapp')
      .select('id, created_at, row_index, id_registro, planilha_id, nome_aba')
      .eq('origem', 'sla')
      .is('corrigido_em', null)
      .limit(300)
      .then(({ data: rows, error }) => {
        if (cancelled || error || !rows?.length) return
        const now = Date.now()
        rows.forEach((row: { id: string; created_at: string; row_index: number | null; id_registro: string | null; planilha_id: string | null; nome_aba: string | null }) => {
          const rowPlanilhaId = (row.planilha_id ?? '').trim()
          const rowNomeAba = (row.nome_aba ?? '').trim()
          if (rowPlanilhaId !== planilhaIdNorm) return
          const ri = row.row_index != null ? Number(row.row_index) : null
          if (ri == null) return
          if (!resultsPorRowIndex.has(ri)) return
          const aindaForaSla =
            foraDoSlaRowIndices.has(ri) ||
            foraDoSlaKeys.has(`${rowPlanilhaId}|${rowNomeAba}|${ri}`) ||
            (row.id_registro && foraDoSlaIdRegistros.has((row.id_registro || '').trim()))
          if (!aindaForaSla) {
            const sentAt = new Date(row.created_at).getTime()
            const tempoMinutos = Math.round((now - sentAt) / 60000)
            const corrigidoEm = new Date(sentAt + tempoMinutos * 60000).toISOString()
            db.from('historico_envio_whatsapp')
              .update({ corrigido_em: corrigidoEm, tempo_minutos: tempoMinutos })
              .eq('id', row.id)
              .then(() => {})
          }
        })
      })
    return () => { cancelled = true }
  }, [data, foraDoSla, supabase])

  const slaPorSolicitante = useMemo(() => {
    const map = new Map<string, number>()
    foraDoSla.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [foraDoSla])

  const etapasUnicas = useMemo(() => {
    const set = new Set<string>()
    foraDoSla.forEach((r) => {
      const s = (r.stage_name ?? '').trim()
      if (s) set.add(s)
    })
    return Array.from(set).sort()
  }, [foraDoSla])

  const foraDoSlaFiltered = useMemo(() => {
    let list = foraDoSla
    if (filterSolicitante) {
      list = list.filter((r) => {
        const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
        const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
        return key === filterSolicitante
      })
    }
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase()
      list = list.filter((r) => (r.id_registro ?? '').toLowerCase().includes(q))
    }
    if (filterEtapa) {
      list = list.filter((r) => (r.stage_name ?? '').trim() === filterEtapa)
    }
    return list
  }, [foraDoSla, filterSolicitante, filterSearch, filterEtapa])

  const rowKey = (r: ResultRow) => `${r.rowIndex}-${r.id_registro ?? ''}`

  const selectedRows = useMemo(() => foraDoSlaFiltered.filter((r) => selectedIds.has(rowKey(r))), [foraDoSlaFiltered, selectedIds])

  const toggleSelect = useCallback((key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(foraDoSlaFiltered.map((r) => rowKey(r))))
  }, [foraDoSlaFiltered])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const semData = useMemo(
    () =>
      results.filter((r) => {
        if (!isFunilDeVendas(r.funil)) return false
        if (!isOngoing(r.status)) return false
        return r.dias_desde_movimentacao == null
      }),
    [results]
  )

  const openWppModal = useCallback((r: ResultRow) => {
    setWppModalRow(r)
    setWppModalBatch(null)
    setWppNumber(onlyDigits(r.telefone_notificar || ''))
    const email = (r.email_solicitante ?? r.email_notificar ?? '').trim()
    const member = email ? getTeamMember(email) : null
    const gestorLabel = member?.tag ? `${member.tag} · ${member.name ?? email}` : (member?.name ?? email) || '—'
    const rdDealUrl = r.deal_id ? `${RD_CRM_DEAL_URL}${r.deal_id}` : undefined
    setWppMessage(buildSlaWppMessage(r, { gestorLabel, rdDealUrl }))
    setWppError(null)
  }, [])

  const closeWppModal = useCallback(() => {
    setWppModalRow(null)
    setWppModalBatch(null)
    setWppError(null)
    setBatchProgress(null)
  }, [])

  const openWppBatch = useCallback(() => {
    setWppModalRow(null)
    const rows = selectedRows.length > 0 ? selectedRows : foraDoSlaFiltered
    setWppModalBatch([...rows])
    setWppNumber('')
    setWppMessage('')
    setWppError(null)
    setBatchProgress(null)
  }, [foraDoSlaFiltered, selectedRows])

  const sendWpp = useCallback(async () => {
    if (!wppModalRow || !wppNumber.trim() || !wppMessage.trim()) return
    setWppSending(true)
    setWppError(null)
    const telefone = wppNumber.trim().replace(/\D/g, '')
    const mensagem = wppMessage.trim()
    try {
      const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: telefone,
          text: mensagem,
          id_registro: wppModalRow.id_registro || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWppError((json.message ?? json.error) || 'Falha ao enviar.')
        return
      }
      if (supabase) {
        await supabase.from('historico_envio_whatsapp').insert({
          origem: 'sla',
          telefone: telefone.length <= 11 ? `55${telefone}` : telefone,
          mensagem,
          id_registro: (wppModalRow.id_registro ?? '').trim() || null,
          row_index: wppModalRow.rowIndex ?? null,
          email_notificar: wppModalRow.email_notificar || null,
          email_solicitante: wppModalRow.email_solicitante || null,
          stage_name: wppModalRow.stage_name || null,
          funil: wppModalRow.funil || null,
          deal_id: wppModalRow.deal_id || null,
          planilha_id: PLANILHA_ID || null,
          nome_aba: PLANILHA_ABA || null,
        })
      }
      closeWppModal()
    } catch (e) {
      setWppError('Erro de conexão. Verifique se a API e o webhook/Evolution estão configurados.')
    } finally {
      setWppSending(false)
    }
  }, [wppModalRow, wppNumber, wppMessage, closeWppModal])

  const sendWppBatchParaNumero = useCallback(async () => {
    if (!wppModalBatch || wppModalBatch.length === 0 || !wppNumber.trim()) return
    const telefone = wppNumber.trim().replace(/\D/g, '')
    if (telefone.length < 10) {
      setWppError('Informe um número válido (DDD + celular).')
      return
    }
    setWppSending(true)
    setWppError(null)
    const mensagem = buildSlaWppBatchMessage(wppModalBatch, getTeamMember)
    try {
      const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: telefone.length <= 11 ? `55${telefone}` : telefone,
          text: mensagem,
          id_registro: wppModalBatch[0]?.id_registro || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWppError((json.message ?? json.error) || 'Falha ao enviar.')
        return
      }
      if (supabase) {
        const telefoneFormatado = telefone.length <= 11 ? `55${telefone}` : telefone
        const rows = wppModalBatch.map((r) => ({
          origem: 'sla',
          telefone: telefoneFormatado,
          mensagem,
          id_registro: (r.id_registro ?? '').trim() || null,
          row_index: r.rowIndex ?? null,
          email_notificar: r.email_notificar || null,
          email_solicitante: r.email_solicitante || null,
          stage_name: r.stage_name || null,
          funil: r.funil || null,
          deal_id: r.deal_id || null,
          planilha_id: PLANILHA_ID || null,
          nome_aba: PLANILHA_ABA || null,
        }))
        const { error } = await supabase.from('historico_envio_whatsapp').insert(rows)
        if (error) {
          console.warn('[SLA lote para número] Histórico não registrado:', error.message)
          setWppError(`Enviado, mas histórico não gravado: ${error.message}. Verifique Supabase.`)
        } else {
          closeWppModal()
        }
      } else {
        closeWppModal()
      }
    } catch (e) {
      setWppError('Erro de conexão. Verifique se a API e o webhook/Evolution estão configurados.')
    } finally {
      setWppSending(false)
    }
  }, [wppModalBatch, wppNumber, closeWppModal])

  const sendWppBatch = useCallback(async () => {
    if (!wppModalBatch || wppModalBatch.length === 0) return
    const comTelefone = wppModalBatch.filter((r) => onlyDigits(r.telefone_notificar || '').length >= 10)
    if (comTelefone.length === 0) {
      setWppError('Nenhum lead da lista possui telefone para envio.')
      return
    }
    setWppSending(true)
    setWppError(null)
    const total = comTelefone.length
    let enviados = 0
    let falhas = 0
    let historicoFalhas = 0
    for (let i = 0; i < comTelefone.length; i++) {
      const r = comTelefone[i]
      setBatchProgress({ atual: i + 1, total })
      const telefone = onlyDigits(r.telefone_notificar || '')
      if (telefone.length < 10) continue
      const email = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const member = email ? getTeamMember(email) : null
      const gestorLabel = member?.tag ? `${member.tag} · ${member.name ?? email}` : (member?.name ?? email) || '—'
      const rdDealUrl = r.deal_id ? `${RD_CRM_DEAL_URL}${r.deal_id}` : undefined
      const mensagem = buildSlaWppMessage(r, { gestorLabel, rdDealUrl })
      try {
        const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: telefone.length <= 11 ? `55${telefone}` : telefone,
            text: mensagem,
            id_registro: r.id_registro || undefined,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          enviados++
          if (supabase) {
            const { error } = await supabase.from('historico_envio_whatsapp').insert({
              origem: 'sla',
              telefone: telefone.length <= 11 ? `55${telefone}` : telefone,
              mensagem,
              id_registro: (r.id_registro ?? '').trim() || null,
              row_index: r.rowIndex ?? null,
              email_notificar: r.email_notificar || null,
              email_solicitante: r.email_solicitante || null,
              stage_name: r.stage_name || null,
              funil: r.funil || null,
              deal_id: r.deal_id || null,
              planilha_id: PLANILHA_ID || null,
              nome_aba: PLANILHA_ABA || null,
            })
            if (error) {
              historicoFalhas++
              console.warn('[SLA lote] Histórico não registrado para', r.id_registro, error.message)
            }
          } else {
            historicoFalhas += 1
          }
        } else falhas++
      } catch {
        falhas++
      }
      if (i < comTelefone.length - 1) await new Promise((r) => setTimeout(r, 800))
    }
    setWppSending(false)
    setBatchProgress(null)
    if (falhas > 0) {
      setWppError(`Enviados: ${enviados}. Falhas no envio: ${falhas}.`)
    } else if (!supabase && enviados > 0) {
      setWppError(
        `Enviados: ${enviados}. O histórico não foi gravado: Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local (veja docs/INTEGRACAO-SUPABASE.md).`
      )
    } else if (historicoFalhas > 0) {
      setWppError(
        `Enviados: ${enviados}. Histórico não registrado para ${historicoFalhas} envio(s). Verifique as políticas da tabela historico_envio_whatsapp no Supabase (docs/SUPABASE-HISTORICO-WHATSAPP.md).`
      )
    } else {
      closeWppModal()
    }
  }, [wppModalBatch, closeWppModal])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-primary flex items-center gap-2">
          <Clock className="h-8 w-8" />
          Leads fora do SLA
        </h1>
        <p className="text-gray-600 mt-1">
          Negociações do <strong>Funil de vendas</strong> fora do SLA: &gt; {SLA_DIAS} dias sem movimentação E &gt;{' '}
          {SLA_DIAS_FOLLOWUP} dias sem follow-up (anotação). Clique em &quot;Sincronizar Follow-up&quot; para atualizar
          anotações.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        {!accessToken ? (
          !sessionRestoreAttempted && supabase ? (
            <div className="flex items-center gap-2 text-gray-600 py-2">
              <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
              <span>Verificando sessão...</span>
            </div>
          ) : (
            <>
              {!clientId && (
                <Alert variant="warning">
                  Configure <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> no{' '}
                  <code className="bg-amber-100 px-1 rounded">.env</code>.
                </Alert>
              )}
              <button
                type="button"
                onClick={() => login()}
                disabled={!clientId}
                className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 text-gray-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="h-5 w-5" />
                Conectar com Google
              </button>
            </>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCarregar}
              disabled={loading || !PLANILHA_ID.trim()}
              className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Atualizar
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSyncFollowUp}
              disabled={syncFollowUpLoading || loading || !PLANILHA_ID.trim()}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              title="Buscar anotações do RD e preencher coluna follow_up"
            >
              {syncFollowUpLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <History className="h-5 w-5" />
                  Sincronizar Follow-up
                </>
              )}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              Desconectar
            </button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="error" className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </Alert>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-amber-200 rounded-xl p-5 shadow-sm bg-amber-50/30">
              <p className="text-sm font-medium text-amber-700 uppercase tracking-wide">Fora do SLA</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{foraDoSla.length}</p>
              <p className="text-xs text-amber-600/80 mt-1">
                &gt; {SLA_DIAS}d mov + &gt; {SLA_DIAS_FOLLOWUP}d sem follow-up
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Sem data</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{semData.length}</p>
              <p className="text-xs text-gray-500 mt-1">em andamento, sem data de atualização</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Funil vendas</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {results.filter((r) => isFunilDeVendas(r.funil) && isOngoing(r.status)).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">em andamento</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <span className="text-sm text-gray-700">
                Histórico de <strong>envios no WhatsApp</strong> e de <strong>atualização no RD (SLA)</strong>
              </span>
            </div>
            <Link
              to="/validacao"
              state={{ openHistoricoWpp: true, historicoFiltro: 'sla' as const }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-800 font-medium text-sm hover:bg-slate-200 transition-colors"
            >
              <History className="h-4 w-4" />
              Ver histórico completo
            </Link>
          </div>

          {slaPorSolicitante.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="h-5 w-5" />
                Por gestor da negociação (solicitante)
              </h3>
              <p className="text-sm text-gray-500">Clique em um card para filtrar a lista por solicitante.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {slaPorSolicitante.map(([key, count]) => {
                  const member = key !== '(sem e-mail)' ? getTeamMember(key) : null
                  const displayName = (member?.name ?? (key === '(sem e-mail)' ? 'Sem e-mail' : key)) as string
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setFilterSolicitante(filterSolicitante === key ? '' : key)}
                      className={`text-left p-4 rounded-xl border-2 transition-colors flex items-start gap-3 ${
                        filterSolicitante === key
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 hover:border-primary/50 bg-white'
                      }`}
                    >
                      {member?.avatar ? (
                        <img
                          src={member.avatar}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 truncate" title={displayName}>
                          {displayName}
                        </p>
                        {member?.tag && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                            {member.tag}
                          </span>
                        )}
                        <p className="text-2xl font-bold text-amber-700 mt-1">
                          {count} atrasado{count !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Clique para filtrar</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {filterSolicitante && (
                <button
                  type="button"
                  onClick={() => setFilterSolicitante('')}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Limpar filtro por solicitante
                </button>
              )}
            </div>
          )}

          {foraDoSla.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Buscar lead</label>
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Nome ou razão social..."
                    className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Etapa</label>
                  <select
                    value={filterEtapa}
                    onChange={(e) => setFilterEtapa(e.target.value)}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Todas</option>
                    {etapasUnicas.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => { setFilterSearch(''); setFilterEtapa(''); setFilterSolicitante(''); }}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )}

          {foraDoSla.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center text-gray-600">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">Nenhum lead fora do SLA</p>
              <p className="text-sm mt-1">
                Todos os leads estão dentro do prazo: movimentação ≤ {SLA_DIAS} dias e follow-up ≤ {SLA_DIAS_FOLLOWUP}{' '}
                dias (quando atrasado em movimentação).
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Use &quot;Sincronizar Follow-up&quot; para atualizar as anotações do RD na planilha.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-white overflow-hidden shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-primary/20 bg-primary/10">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <User className="h-4 w-4" />
                    </span>
                    {filterSolicitante ? (
                      <>
                        Leads fora do SLA de{' '}
                        <strong>
                          {filterSolicitante !== '(sem e-mail)'
                            ? (getTeamMember(filterSolicitante)?.name ?? filterSolicitante)
                            : 'Sem e-mail'}
                        </strong>{' '}
                        ({foraDoSlaFiltered.length})
                      </>
                    ) : (
                      <>
                        Leads fora do SLA
                        {(filterSearch || filterEtapa) && ' (filtrado)'}
                        {' '}({foraDoSlaFiltered.length})
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="text-sm font-medium text-gray-600 hover:text-primary"
                    >
                      Selecionar todos
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-sm font-medium text-gray-600 hover:text-primary"
                    >
                      Desmarcar
                    </button>
                    <span className="text-gray-400 text-sm ml-1">
                      {selectedIds.size > 0 ? `${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={openWppBatch}
                      disabled={foraDoSlaFiltered.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Abrir mensagens para copiar e colar no WhatsApp (número você coloca manualmente)"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {selectedRows.length > 0
                        ? `WhatsApp (${selectedRows.length} selecionado${selectedRows.length !== 1 ? 's' : ''})`
                        : `WhatsApp (${foraDoSlaFiltered.length} lead${foraDoSlaFiltered.length !== 1 ? 's' : ''})`}
                    </button>
                  </div>
                </div>
                <div className="p-4 max-h-[560px] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {foraDoSlaFiltered.map((r) => {
                      const email = (r.email_solicitante ?? r.email_notificar ?? '').trim()
                      const member = email ? getTeamMember(email) : null
                      const areaVal = getAreaByEmail(email)
                      const AreaIco = areaVal && areaVal in AREA_ICONS ? AREA_ICONS[areaVal] : null
                      const leadName = r.nome_lead || r.id_registro || `Linha ${r.rowIndex}`
                      const key = rowKey(r)
                      const followUpDate = r.follow_up_iso ? new Date(r.follow_up_iso).toLocaleDateString('pt-BR') : null
                      const followUpRaw = fixMojibake(r.follow_up_anotacao)
                      const followUpPreview = followUpRaw
                        ? (followUpRaw.length > 50 ? followUpRaw.slice(0, 50) + '…' : followUpRaw)
                        : null
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(key)}
                              onChange={() => toggleSelect(key)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate" title={leadName}>
                                {leadName}
                              </p>
                              <p className="text-xs text-gray-600 truncate mt-0.5" title={fixMojibake(r.razao_social) || ''}>
                                {fixMojibake(r.razao_social) || '—'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                              SLA
                            </span>
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                              {r.dias_desde_movimentacao != null ? r.dias_desde_movimentacao : '—'}d sem mov.
                            </span>
                            {r.stage_name && (
                              <span className="inline-flex rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                                {r.stage_name}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-600" title={followUpRaw || undefined}>
                            <span className="font-medium text-gray-700">Último Follow-Up: </span>
                            {followUpDate || r.dias_desde_followup != null || followUpPreview ? (
                              <>
                                {followUpDate && <span>{followUpDate}</span>}
                                {followUpDate && r.dias_desde_followup != null && <span className="text-gray-400"> · </span>}
                                {r.dias_desde_followup != null && (
                                  <span className="text-gray-500">({r.dias_desde_followup}d atrás)</span>
                                )}
                                {followUpPreview && (
                                  <span className="block mt-1">
                                    <span className="font-medium text-gray-600">Última anotação: </span>
                                    <span className="text-gray-500 truncate block">{followUpPreview}</span>
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-amber-600">Sem registro</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 py-1">
                            {member?.avatar ? (
                              <img
                                src={member.avatar}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover flex-shrink-0 bg-gray-200 ring-2 ring-gray-100"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center ring-2 ring-gray-100">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate" title={member?.name ?? (r.planilha as Record<string, unknown>)?.solicitante ?? email}>
                                {member?.name ?? ((r.planilha as Record<string, unknown>)?.solicitante as string)?.trim() ?? (email || '—')}
                              </p>
                              {(areaVal || (r.planilha as Record<string, unknown>)?.areas_analise) && (
                                <p className="flex items-center gap-1 text-[10px] text-gray-500 truncate mt-0.5" title={String((areaVal ?? (r.planilha as Record<string, unknown>)?.areas_analise) ?? '')}>
                                  {AreaIco && <AreaIco className="h-3 w-3 flex-shrink-0 text-gray-400" />}
                                  <span className="truncate">{(areaVal ?? String((r.planilha as Record<string, unknown>)?.areas_analise ?? '').trim()) || '—'}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedLeadDetail(r)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium"
                              title="Ver detalhes completos do lead"
                            >
                              <Eye className="h-4 w-4" />
                              Ver detalhes
                            </button>
                            {r.deal_id && (
                              <a
                                href={`${RD_CRM_DEAL_URL}${r.deal_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                                title="Abrir no RD Station"
                              >
                                <ExternalLink className="h-4 w-4" />
                                CRM
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openWppModal(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-medium"
                              title="Enviar no WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {semData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5" />
                Em andamento sem data de atualização ({semData.length})
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Estes leads estão no Funil de vendas e em andamento, mas a planilha não possui data de
                atualização/criação (ou o nome da coluna não foi reconhecido). Inclua colunas como
                &quot;Data de atualização&quot; ou &quot;Última atualização&quot; para que entrem no cálculo do SLA.
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                  Ver registros
                </summary>
                <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                  {semData.slice(0, 20).map((r) => (
                    <li key={`nodate-${r.rowIndex}`}>
                      {r.id_registro || `Linha ${r.rowIndex}`} · {r.stage_name || '—'}
                    </li>
                  ))}
                  {semData.length > 20 && (
                    <li className="text-gray-500">… e mais {semData.length - 20}</li>
                  )}
                </ul>
              </details>
            </div>
          )}
        </>
      )}

      {/* Modal detalhes do lead */}
      {selectedLeadDetail && (() => {
        const lead = selectedLeadDetail
        const planilha = (lead.planilha || {}) as Record<string, unknown>
        const hasValue = (v: unknown) => v != null && String(v).trim() !== '' && String(v).trim() !== '[]'
        const sectionKeys = new Set([
          'stage_name', 'stage_id', 'nome', 'deal_id', 'estado', 'lead', 'nome_lead', 'funil',
          'solicitante', 'email_solicitante', 'razao_social', 'cnpj', 'areas_analise', 'tipo_lead', 'indicacao', 'nome_indicacao',
          'prazo_entrega_data', 'local_reuniao', 'data_reuniao', 'horario_reuniao', 'link_proposta', 'link_contrato', 'link_da_proposta', 'link_do_contrato',
          'nome_ponto_focal', 'email_ponto_focal', 'telefone_ponto_focal', 'motivo_perda', 'motivo_perda_anotacao',
          'date_create', 'created_at', 'date_update', 'updated_at', 'follow_up', 'follow_up_anotacao',
        ])
        const sections: { title: string; keys: string[] }[] = [
          { title: 'Identificação', keys: ['stage_name', 'stage_id', 'nome', 'deal_id', 'estado', 'lead', 'nome_lead', 'funil'] },
          { title: 'Cadastro / Lead', keys: ['solicitante', 'email_solicitante', 'razao_social', 'cnpj', 'areas_analise', 'tipo_lead', 'indicacao', 'nome_indicacao'] },
          { title: 'Reunião / Proposta', keys: ['prazo_entrega_data', 'local_reuniao', 'data_reuniao', 'horario_reuniao', 'link_proposta', 'link_da_proposta', 'nome_ponto_focal', 'email_ponto_focal', 'telefone_ponto_focal', 'link_contrato', 'link_do_contrato'] },
          { title: 'Datas e status', keys: ['date_create', 'created_at', 'date_update', 'updated_at', 'follow_up', 'follow_up_anotacao', 'motivo_perda', 'motivo_perda_anotacao'] },
        ]
        const outrosKeys = Object.keys(planilha).filter((k) => hasValue(planilha[k]) && !sectionKeys.has(k))
        if (outrosKeys.length > 0) {
          sections.push({ title: 'Outros', keys: outrosKeys })
        }
        const modalLeadEmail = (lead.email_solicitante ?? lead.email_notificar ?? '') || ''
        const modalAvatar = getTeamMember(modalLeadEmail)?.avatar ?? null
        const modalArea = getAreaByEmail(modalLeadEmail) ?? ''
        const ModalAreaIcon = modalArea && modalArea in AREA_ICONS ? AREA_ICONS[modalArea] : null
        const leadName = lead.nome_lead || lead.id_registro || `Linha ${lead.rowIndex}`

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedLeadDetail(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex-shrink-0 relative px-5 py-4 border-b border-gray-200 bg-gray-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 truncate pr-8">{leadName}</h2>
                    {lead.razao_social && (
                      <p className="text-sm text-gray-600 truncate mt-0.5">{fixMojibake(lead.razao_social)}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
                        Fora do SLA
                      </span>
                      {lead.stage_name && (
                        <span className="inline-flex rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {lead.stage_name}
                        </span>
                      )}
                      {lead.funil && (
                        <span className="inline-flex rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          {lead.funil}
                        </span>
                      )}
                      <span className="text-amber-700 font-medium text-xs">
                        {lead.dias_desde_movimentacao != null ? lead.dias_desde_movimentacao : '—'} dias sem movimentação
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedLeadDetail(null)} className="absolute top-4 right-4 p-2 rounded-xl text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors" aria-label="Fechar">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-white px-3 py-2.5 shadow-sm">
                  {modalAvatar ? (
                    <img src={modalAvatar} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                      {(getTeamMember(modalLeadEmail)?.name || '?').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{getTeamMember(modalLeadEmail)?.name ?? (modalLeadEmail || '—')}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      {ModalAreaIcon && <ModalAreaIcon className="h-3.5 w-3.5 text-primary" />}
                      {modalArea || '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {sections.map(({ title, keys }) => {
                  const items = keys
                    .filter((k) => hasValue(planilha[k]))
                    .map((k) => ({ key: k, label: PLANILHA_LABELS[k] || k.replace(/_/g, ' '), value: String(planilha[k]).trim() }))
                  if (items.length === 0) return null
                  return (
                    <div key={title} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider pb-2 border-b border-gray-200">{title}</p>
                      <dl className="grid gap-2 text-sm">
                        {items.map(({ key, label, value }) => (
                          <div key={key} className="flex flex-col sm:flex-row sm:gap-3 sm:items-start">
                            <dt className="text-gray-600 font-medium shrink-0 sm:w-44">{label}</dt>
                            <dd className="text-gray-900 break-words mt-0.5 sm:mt-0">{fixMojibake(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )
                })}
                {(lead.created_at_iso || lead.updated_at_iso) && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider pb-2 border-b border-gray-200">Datas</p>
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium text-gray-800">Criação:</span> {lead.created_at_iso ? new Date(lead.created_at_iso).toLocaleString('pt-BR') : '—'}
                      <span className="mx-2 text-gray-300">·</span>
                      <span className="font-medium text-gray-800">Atualização:</span> {lead.updated_at_iso ? new Date(lead.updated_at_iso).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                )}
                {lead.deal_id && (
                  <a
                    href={`${RD_CRM_DEAL_URL}${lead.deal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
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

      {/* Modal enviar no WhatsApp (um lead) */}
      {wppModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="wpp-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 id="wpp-modal-title" className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                Enviar no WhatsApp
              </h2>
              <button type="button" onClick={closeWppModal} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Lead: <strong>{wppModalRow.id_registro}</strong>
                {wppModalRow.stage_name && <> · {wppModalRow.stage_name}</>}
                {wppModalRow.dias_desde_movimentacao != null && (
                  <> · <span className="text-amber-600">{wppModalRow.dias_desde_movimentacao} dias sem movimentação</span></>
                )}
                {wppModalRow.dias_desde_followup != null && (
                  <> · <span>{wppModalRow.dias_desde_followup}d sem follow-up</span></>
                )}
              </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={wppMessage}
                  onChange={(e) => setWppMessage(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
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
                onClick={sendWpp}
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

      {/* Modal enviar resumo SLA no WhatsApp (vários leads) — uma mensagem consolidada, campo para número */}
      {wppModalBatch && wppModalBatch.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="wpp-batch-title">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 id="wpp-batch-title" className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                Enviar no WhatsApp ({wppModalBatch.length} lead{wppModalBatch.length !== 1 ? 's' : ''})
              </h2>
              <button type="button" onClick={closeWppModal} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem (resumo agrupado por gestor)</label>
                <textarea
                  readOnly
                  value={buildSlaWppBatchMessage(wppModalBatch, getTeamMember)}
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-y bg-gray-50 font-mono text-gray-800"
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
                onClick={sendWppBatchParaNumero}
                disabled={wppSending || !wppNumber.trim()}
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
    </div>
  )
}
