import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Filter, User, RefreshCw, ExternalLink, MessageCircle, X, History, Search, XCircle, ChevronDown, Trash2, Settings, Eye, GripVertical, Send } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { getTeamMember, getSolicitanteKey } from '@/data/teamAvatars'
import { supabase } from '@/lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'crm-bp-google-oauth'
const SESSION_ID_KEY = 'crm-bp-google-session-id'
const STORAGE_KEY_VALIDATION_CONFIG = 'crm-bp-validation-config'
const STORAGE_KEY_COLUMN_OVERRIDES = 'crm-bp-column-overrides'
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'
const PLANILHA_ID = import.meta.env.VITE_PLANILHA_ID || '14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI'
const PLANILHA_ABA = import.meta.env.VITE_PLANILHA_ABA || ''

/** Monta uma única mensagem em lote listando vários leads (para reenviar em lote por telefone). */
function buildMensagemLoteHistorico(items: (HistoricoWppRow | HistoricoSlaAgrupadoRow)[]): string {
  if (items.length === 0) return ''
  let msg = '⏱️ *Leads ainda pendentes*\n\n'
  msg += 'Os seguintes leads ainda precisam de atualização:\n\n'
  items.forEach((item, i) => {
    const lead = (item.id_registro ?? '—').replace(/\*/g, '')
    const etapa = (item.stage_name ?? '—').replace(/\*/g, '')
    msg += (i + 1) + '. *' + lead + '* — ' + etapa + '\n'
    if (item.deal_id) msg += '   🔗 ' + RD_CRM_DEAL_URL + item.deal_id + '\n'
  })
  msg += '\nPor favor, atualize no CRM.'
  return msg
}

/** Fallback quando a API GET não retorna a configuração (ex.: dev sem API) */
const FALLBACK_DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  cadastro_lead: {
    solicitante: true,
    email: true,
    cadastrado_por: true,
    due_diligence: true,
    local_reuniao: true,
    tipo_de_lead: true,
    razao_social: true,
    cnpj: true,
    areas_analise: false, // não considerado mais na validação
    prazo_reuniao_due: true,
    horario_due: true,
    indicacao: true,
    nome_indicacao: true,
  },
  confecao_proposta: {
    razao_social_cp: true,
    cnpj_cp: true,
    qualificacao_completa: true,
    areas_objeto_contrato_cp: true,
    realizou_due_diligence: true,
    gestor_contrato_cp: true,
    nome_ponto_focal: true,
    email_ponto_focal: true,
    telefone_ponto_focal: true,
    captador_cp: true,
    tributacao_cp: true,
    prazo_entrega_cp: true,
    data_primeiro_vencimento_cp: true,
    informacoes_adicionais_cp: true,
    demais_razoes_sociais_cp: true,
  },
  proposta_enviada: {
    link_da_proposta: true, // obrigatório apenas nesta etapa
  },
  confecao_contrato: {
    tipo_pagamento_cc: true,
    objeto_contrato_cc: true,
    valores_cc: true,
    rateio_cc: true,
    prazo_contrato_cc: true,
    link_do_contrato: true,
  },
}

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
  status_raw?: string | null
  deal_id?: string | null
  telefone_notificar?: string | null
  areas?: string | null
}

type ApiResponse = {
  results: ResultRow[]
  total: number
  comErros: number
}

/** Configuração de quais campos validar: escopo -> campo -> ativo (true/false) */
type ValidationConfig = Record<string, Record<string, boolean>>

type HistoricoWppRow = {
  id: string
  created_at: string
  telefone: string
  mensagem: string
  id_registro: string | null
  row_index: number | null
  email_notificar: string | null
  email_solicitante: string | null
  stage_name: string | null
  funil: string | null
  deal_id: string | null
  planilha_id: string | null
  nome_aba: string | null
  corrigido_em: string | null
  tempo_minutos: number | null
  origem: string | null
}

/** Histórico SLA agrupado por lead (um “caso” = um lead, com qtd de envios e tempo sem resolução) */
type HistoricoSlaAgrupadoRow = {
  key: string
  rows: HistoricoWppRow[]
  qtd_envios: number
  primeira_vez_enviado_em: string
  ultima_vez_enviado_em: string
  corrigido_em: string | null
  tempo_minutos: number | null
  /** Dias desde o primeiro envio até hoje (quando ainda não corrigido) */
  tempo_sem_resolucao_dias: number | null
  id_registro: string | null
  telefone: string
  email_solicitante: string | null
  email_notificar: string | null
  stage_name: string | null
  funil: string | null
  deal_id: string | null
  mensagem: string
  planilha_id: string | null
  nome_aba: string | null
  row_index: number | null
}

/** Histórico Validação agrupado por lote (mesmo envio no WhatsApp = mesmo telefone + mesmo minuto; ex.: mensagem em grupo com vários leads) */
type HistoricoLoteRow = {
  key: string
  rows: HistoricoWppRow[]
  created_at: string
  telefone: string
  qtd_leads: number
  /** null se algum lead ainda pendente; senão data do último corrigido */
  corrigido_em: string | null
  mensagem: string
  email_solicitante: string | null
  email_notificar: string | null
  id_registro: string | null
  stage_name: string | null
  deal_id: string | null
  planilha_id: string | null
  nome_aba: string | null
  row_index: number | null
  isLote: true
}

const TOKEN_GRACE_MS = 60 * 1000

function loadStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { access_token, expires_at } = JSON.parse(raw)
    if (!access_token || !expires_at) return null
    const now = Date.now()
    if (expires_at <= now - TOKEN_GRACE_MS) {
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        access_token,
        expires_at: Date.now() + sec * 1000,
      })
    )
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

type WppMessageOpts = { gestorLabel?: string; rdDealUrl?: string }

function buildWppMessage(r: ResultRow, opts?: WppMessageOpts): string {
  const gestor = opts?.gestorLabel ?? ''
  const linkRd = opts?.rdDealUrl ?? ''
  const lead = r.id_registro || '—'
  const etapa = r.stage_name || '—'

  if (!r.valid && r.errors.length > 0) {
    let msg = 'Olá,\n\n'
    msg += '📋 *Lead:* *' + lead.replace(/\*/g, '') + '*\n'
    msg += '📍 Etapa: ' + etapa + '\n\n'
    msg += '⚠️ *O que precisa ajustar:*\n\n'

    const blocos = r.errors
      .map(
        (e) =>
          '• *' +
          (e.field || '').replace(/\*/g, '') +
          '*\n  ➜ Como está: ' +
          (e.valor_atual ?? '(vazio)') +
          '\n  ➜ Como deve ser: ' +
          e.comoCorrigir
      )
      .join('\n\n')
    msg += blocos + '\n\n'

    if (linkRd) {
      msg += '🔗 *Link para corrigir no RD:*\n' + linkRd + '\n\n'
    }
    if (gestor && gestor !== '—') {
      msg += '👤 *Responsável (quem cobrar):* ' + gestor + '\n\n'
    }
    msg += 'Por favor, corrija no CRM/planilha.'
    return msg
  }

  let msg = 'Olá,\n\n'
  msg += '📋 *Lead:* *' + lead.replace(/\*/g, '') + '*\n'
  msg += '📍 Etapa: ' + etapa + '\n\n'
  if (gestor && gestor !== '—') msg += '👤 *Responsável:* ' + gestor + '\n\n'
  if (linkRd) msg += '🔗 *Link no RD:*\n' + linkRd + '\n\n'
  msg += '[Mensagem personalizada]'
  return msg
}

function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '')
}

export function ValidacaoSheets() {
  const [accessToken, setAccessToken] = useState<string | null>(() => loadStoredToken())
  const [sessionRestoreAttempted, setSessionRestoreAttempted] = useState(() => !!loadStoredToken())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)

  // Filtros
  const [filterSearchLead, setFilterSearchLead] = useState('')
  const [filterArea, setFilterArea] = useState<string>('')
  const [filterSolicitante, setFilterSolicitante] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterStageName, setFilterStageName] = useState<string>('')
  const [filterFunil, setFilterFunil] = useState<string>('')
  const [mostrarSoComErro, setMostrarSoComErro] = useState(false)

  // Modal Enviar no WhatsApp
  const [wppModalRow, setWppModalRow] = useState<ResultRow | null>(null)
  const [wppNumber, setWppNumber] = useState('')
  const [wppMessage, setWppMessage] = useState('')
  const [wppSending, setWppSending] = useState(false)
  const [wppError, setWppError] = useState<string | null>(null)

  // Dropdown Solicitante (fechar ao clicar fora)
  const solicitanteDropdownRef = useRef<HTMLDivElement>(null)
  const [solicitanteOpen, setSolicitanteOpen] = useState(false)

  // Configuração de validação: quais campos validar (carregado da API GET + localStorage)
  const [defaultValidationConfig, setDefaultValidationConfig] = useState<ValidationConfig | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string[]> | null>(null)
  const [columnOverrides, setColumnOverrides] = useState<Record<string, string>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_COLUMN_OVERRIDES) : null
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      /* ignore */
    }
    return {}
  })
  const [columnOverrideNewCol, setColumnOverrideNewCol] = useState('')
  const [columnOverrideNewKey, setColumnOverrideNewKey] = useState('')
  const [validationConfig, setValidationConfig] = useState<ValidationConfig>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_VALIDATION_CONFIG) : null
      if (raw) {
        const parsed = JSON.parse(raw) as ValidationConfig
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      /* ignore */
    }
    return {}
  })

  // Aba Histórico de envios WhatsApp (Correção e SLA são diferentes)
  const location = useLocation()
  const [abaAtiva, setAbaAtiva] = useState<'validacao' | 'historico_wpp'>('validacao')
  const [historicoFiltro, setHistoricoFiltro] = useState<'validacao' | 'sla'>('validacao')
  const [historicoWpp, setHistoricoWpp] = useState<HistoricoWppRow[]>([])
  const [historicoWppLoading, setHistoricoWppLoading] = useState(false)
  const [historicoWppError, setHistoricoWppError] = useState<string | null>(null)
  const [historicoDeletingId, setHistoricoDeletingId] = useState<string | null>(null)
  const [historicoFilterResponsavel, setHistoricoFilterResponsavel] = useState<string>('')
  const [historicoFilterStatus, setHistoricoFilterStatus] = useState<'todos' | 'pendente' | 'atualizado'>('todos')
  const [historicoFilterLead, setHistoricoFilterLead] = useState('')
  const [historicoFilterDataDe, setHistoricoFilterDataDe] = useState('')
  const [historicoFilterDataAte, setHistoricoFilterDataAte] = useState('')
  const [historicoDetailRow, setHistoricoDetailRow] = useState<HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow | null>(null)
  const [historicoDeleteConfirm, setHistoricoDeleteConfirm] = useState<{ id?: string; ids?: string[]; id_registro?: string } | null>(null)
  const [historicoVerPorLote, setHistoricoVerPorLote] = useState(true)
  const [historicoSlaVerPorLote, setHistoricoSlaVerPorLote] = useState(true)
  const [reenviarRow, setReenviarRow] = useState<HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow | null>(null)
  const [reenviarNumber, setReenviarNumber] = useState('')
  const [reenviarMessage, setReenviarMessage] = useState('')
  const [reenviarSending, setReenviarSending] = useState(false)
  const [reenviarError, setReenviarError] = useState<string | null>(null)
  const [selectedReenviar, setSelectedReenviar] = useState<Set<string>>(new Set())
  const [reenviarLoteModalOpen, setReenviarLoteModalOpen] = useState(false)
  const [reenviarLoteProgress, setReenviarLoteProgress] = useState<{ atual: number; total: number; enviados: number; falhas: number } | null>(null)
  const [historicoColWidths, setHistoricoColWidths] = useState<Record<string, number>>({
    sel: 44,
    status: 120,
    qtd_envios: 90,
    primeiro_envio: 120,
    ultimo_envio: 120,
    tempo_sem_resolucao: 120,
    enviado_em: 140,
    corrigido_em: 140,
    tempo: 80,
    lead: 160,
    telefone: 120,
    responsavel: 180,
    etapa: 120,
    mensagem: 220,
    acao: 80,
  })
  const historicoResizeRef = useRef<{ col: string; startX: number; startW: number } | null>(null)

  // Carregar lista de campos da API (GET) para montar a UI de configuração; mesclar com config salvo
  useEffect(() => {
    if (!API_BASE) return
    let cancelled = false
    fetch(`${API_BASE}/api/validar-sheets`, { method: 'GET' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { defaultValidationConfig?: ValidationConfig; columnMapping?: Record<string, string[]> } | null) => {
        if (cancelled || !json?.defaultValidationConfig) return
        setDefaultValidationConfig(json.defaultValidationConfig)
        if (json.columnMapping) setColumnMapping(json.columnMapping)
        setValidationConfig((prev) => {
          const next: ValidationConfig = {}
          for (const scope of Object.keys(json.defaultValidationConfig!)) {
            next[scope] = { ...json.defaultValidationConfig![scope], ...(prev[scope] || {}) }
          }
          return next
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Persistir configuração de validação no localStorage ao mudar
  useEffect(() => {
    if (typeof window === 'undefined' || Object.keys(validationConfig).length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY_VALIDATION_CONFIG, JSON.stringify(validationConfig))
    } catch {
      /* ignore */
    }
  }, [validationConfig])

  // Persistir overrides de mapeamento no localStorage ao mudar
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (Object.keys(columnOverrides).length === 0) {
        localStorage.removeItem(STORAGE_KEY_COLUMN_OVERRIDES)
      } else {
        localStorage.setItem(STORAGE_KEY_COLUMN_OVERRIDES, JSON.stringify(columnOverrides))
      }
    } catch {
      /* ignore */
    }
  }, [columnOverrides])

  // Abrir aba Histórico quando vier da página SLA (link "Ver histórico"); abrir com filtro SLA
  useEffect(() => {
    const state = location.state as { openHistoricoWpp?: boolean; historicoFiltro?: 'validacao' | 'sla' } | null
    if (state?.openHistoricoWpp) {
      setAbaAtiva('historico_wpp')
      if (state.historicoFiltro === 'sla') setHistoricoFiltro('sla')
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.state, location.pathname])

  const openWppModal = useCallback((r: ResultRow) => {
    setWppModalRow(r)
    setWppNumber(onlyDigits(r.telefone_notificar || ''))
    const email = r.email_solicitante || r.email_notificar || ''
    const member = email ? getTeamMember(email) : null
    const gestorLabel = member?.tag ? `${member.tag} (${email})` : email || '—'
    const rdDealUrl = r.deal_id ? `${RD_CRM_DEAL_URL}${r.deal_id}` : undefined
    setWppMessage(buildWppMessage(r, { gestorLabel, rdDealUrl }))
    setWppError(null)
  }, [])
  const closeWppModal = useCallback(() => {
    setWppModalRow(null)
    setWppError(null)
  }, [])

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
        setWppError(json.message || json.error || 'Falha ao enviar.')
        return
      }
      if (supabase) {
        await supabase.from('historico_envio_whatsapp').insert({
          origem: 'validacao',
          telefone: telefone.length <= 11 ? `55${telefone}` : telefone,
          mensagem,
          id_registro: (wppModalRow.id_registro || '').trim() || null,
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

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      const sec = typeof tokenResponse.expires_in === 'number' && tokenResponse.expires_in > 0 ? tokenResponse.expires_in : 3600
      setAccessToken(tokenResponse.access_token)
      saveToken(tokenResponse.access_token, sec)
      if (supabase) {
        const sessionId = getOrCreateSessionId()
        if (sessionId) {
          supabase
            .from('sessoes_google')
            .upsert(
              {
                session_id: sessionId,
                access_token: tokenResponse.access_token,
                expires_at: new Date(Date.now() + sec * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'session_id' }
            )
            .then(() => {})
        }
      }
    setError(null)
    setData(null)
  },
    onError: () => setError('Não foi possível conectar com o Google. Tente novamente.'),
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
  })

  const disconnect = () => {
    setAccessToken(null)
    clearStoredToken()
    if (supabase) {
      const sessionId = getOrCreateSessionId()
      if (sessionId) supabase.from('sessoes_google').delete().eq('session_id', sessionId).then(() => {})
    }
    setData(null)
  }

  // Restaura sessão do Supabase quando o token local está vazio (ex.: outra aba ou localStorage limpo)
  useEffect(() => {
    if (accessToken || !supabase) {
      if (!accessToken) setSessionRestoreAttempted(true)
      return
    }
    const sessionId = getOrCreateSessionId()
    if (!sessionId) {
      setSessionRestoreAttempted(true)
      return
    }
    const chain = supabase
      .from('sessoes_google')
      .select('access_token, expires_at')
      .eq('session_id', sessionId)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (error || !row?.access_token) return
        const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
        if (expiresAt <= Date.now() - TOKEN_GRACE_MS) return
        const sec = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
        saveToken(row.access_token, sec)
        setAccessToken(row.access_token)
      })
    void Promise.resolve(chain).finally(() => setSessionRestoreAttempted(true))
  }, [accessToken])

  // Carrega histórico de envios WhatsApp quando a aba é exibida
  useEffect(() => {
    if (abaAtiva !== 'historico_wpp' || !supabase) return
    let cancelled = false
    setHistoricoWppLoading(true)
    setHistoricoWppError(null)
    const chain = supabase
      .from('historico_envio_whatsapp')
      .select('id, created_at, telefone, mensagem, id_registro, row_index, email_notificar, email_solicitante, stage_name, funil, deal_id, planilha_id, nome_aba, corrigido_em, tempo_minutos, origem')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data: rows, error: err }) => {
        if (cancelled) return
        if (err) {
          setHistoricoWppError(err.message || 'Erro ao carregar histórico.')
          setHistoricoWpp([])
          return
        }
        setHistoricoWpp((rows as HistoricoWppRow[]) || [])
      })
    void Promise.resolve(chain).finally(() => {
      if (!cancelled) setHistoricoWppLoading(false)
    })
    return () => { cancelled = true }
  }, [abaAtiva])

  // Fechar dropdown Solicitante ao clicar fora
  useEffect(() => {
    const el = solicitanteDropdownRef.current
    if (!el) return
    const onPointerDown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) setSolicitanteOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const recarregarHistoricoWpp = useCallback(() => {
    if (abaAtiva === 'historico_wpp' && supabase) {
      setHistoricoWppLoading(true)
      setHistoricoWppError(null)
      const chain = supabase
        .from('historico_envio_whatsapp')
        .select('id, created_at, telefone, mensagem, id_registro, row_index, email_notificar, email_solicitante, stage_name, funil, deal_id, planilha_id, nome_aba, corrigido_em, tempo_minutos, origem')
        .order('created_at', { ascending: false })
        .limit(500)
        .then(({ data: rows, error: err }) => {
          if (err) {
            setHistoricoWppError(err.message || 'Erro ao carregar histórico.')
            setHistoricoWpp([])
            return
          }
          setHistoricoWpp((rows as HistoricoWppRow[]) || [])
        })
      void Promise.resolve(chain).finally(() => setHistoricoWppLoading(false))
    }
  }, [abaAtiva])

  const historicoFiltradoPorOrigem = useMemo(() => {
    return historicoWpp.filter((h) =>
      historicoFiltro === 'validacao'
        ? (h.origem === 'validacao' || h.origem == null)
        : h.origem === 'sla'
    )
  }, [historicoWpp, historicoFiltro])

  /** SLA: agrupa por lead (id_registro + row_index + planilha_id + nome_aba) — um caso = um lead, com qtd de envios e tempo sem resolução */
  const historicoSlaAgrupado = useMemo(() => {
    if (historicoFiltro !== 'sla') return []
    const map = new Map<string, HistoricoWppRow[]>()
    historicoFiltradoPorOrigem.forEach((h) => {
      const key = [h.id_registro ?? '', h.row_index ?? -999, h.planilha_id ?? '', h.nome_aba ?? ''].join('|')
      const list = map.get(key) ?? []
      list.push(h)
      map.set(key, list)
    })
    const now = Date.now()
    return Array.from(map.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const primeira = sorted[sorted.length - 1]!.created_at
      const ultima = sorted[0]!.created_at
      const corrigidoRow = rows.find((r) => r.corrigido_em)
      const corrigido_em = corrigidoRow?.corrigido_em ?? null
      const tempo_minutos = corrigidoRow?.tempo_minutos ?? null
      const primeiraMs = new Date(primeira).getTime()
      const tempo_sem_resolucao_dias = corrigido_em ? null : Math.floor((now - primeiraMs) / 86400000)
      const latest = sorted[0]!
      return {
        key,
        rows: sorted,
        qtd_envios: rows.length,
        primeira_vez_enviado_em: primeira,
        ultima_vez_enviado_em: ultima,
        corrigido_em,
        tempo_minutos,
        tempo_sem_resolucao_dias,
        id_registro: latest.id_registro,
        telefone: latest.telefone,
        email_solicitante: latest.email_solicitante,
        email_notificar: latest.email_notificar,
        stage_name: latest.stage_name,
        funil: latest.funil,
        deal_id: latest.deal_id,
        mensagem: latest.mensagem,
        planilha_id: latest.planilha_id ?? null,
        nome_aba: latest.nome_aba ?? null,
        row_index: latest.row_index ?? null,
      } satisfies HistoricoSlaAgrupadoRow
    })
  }, [historicoFiltradoPorOrigem, historicoFiltro])

  const historicoResponsaveisUnicos = useMemo(() => {
    const set = new Set<string>()
    historicoFiltradoPorOrigem.forEach((h) => {
      const email = (h.email_solicitante || h.email_notificar || '').trim()
      if (email) {
        const member = getTeamMember(email)
        set.add(member ? `${member.name}|${email}` : email)
      }
    })
    return Array.from(set)
      .map((s) => {
        const [name, email] = s.includes('|') ? s.split('|') : [s, s]
        return { name, email }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [historicoFiltradoPorOrigem])

  const historicoFiltrado = useMemo(() => {
    if (historicoFiltro === 'sla') {
      let list: HistoricoSlaAgrupadoRow[] = historicoSlaAgrupado
      if (historicoFilterResponsavel) {
        list = list.filter((g) => {
          const email = (g.email_solicitante || g.email_notificar || '').trim()
          const member = email ? getTeamMember(email) : null
          const name = member?.name ?? email
          return name === historicoFilterResponsavel || email === historicoFilterResponsavel
        })
      }
      if (historicoFilterStatus === 'pendente') {
        list = list.filter((g) => !g.corrigido_em)
      } else if (historicoFilterStatus === 'atualizado') {
        list = list.filter((g) => !!g.corrigido_em)
      }
      if (historicoFilterLead.trim()) {
        const q = historicoFilterLead.trim().toLowerCase()
        list = list.filter((g) => (g.id_registro ?? '').toLowerCase().includes(q))
      }
      if (historicoFilterDataDe) {
        const de = new Date(historicoFilterDataDe)
        de.setHours(0, 0, 0, 0)
        list = list.filter((g) => g.rows.some((r) => new Date(r.created_at) >= de))
      }
      if (historicoFilterDataAte) {
        const ate = new Date(historicoFilterDataAte)
        ate.setHours(23, 59, 59, 999)
        list = list.filter((g) => g.rows.some((r) => new Date(r.created_at) <= ate))
      }
      return list
    }
    let list = historicoFiltradoPorOrigem
    if (historicoFilterResponsavel) {
      list = list.filter((h) => {
        const email = (h.email_solicitante || h.email_notificar || '').trim()
        const member = email ? getTeamMember(email) : null
        const name = member?.name ?? email
        return name === historicoFilterResponsavel || email === historicoFilterResponsavel
      })
    }
    if (historicoFilterStatus === 'pendente') {
      list = list.filter((h) => !h.corrigido_em)
    } else if (historicoFilterStatus === 'atualizado') {
      list = list.filter((h) => !!h.corrigido_em)
    }
    if (historicoFilterLead.trim()) {
      const q = historicoFilterLead.trim().toLowerCase()
      list = list.filter((h) => (h.id_registro ?? '').toLowerCase().includes(q))
    }
    if (historicoFilterDataDe) {
      const de = new Date(historicoFilterDataDe)
      de.setHours(0, 0, 0, 0)
      list = list.filter((h) => new Date(h.created_at) >= de)
    }
    if (historicoFilterDataAte) {
      const ate = new Date(historicoFilterDataAte)
      ate.setHours(23, 59, 59, 999)
      list = list.filter((h) => new Date(h.created_at) <= ate)
    }
    return list
  }, [
    historicoFiltro,
    historicoSlaAgrupado,
    historicoFiltradoPorOrigem,
    historicoFilterResponsavel,
    historicoFilterStatus,
    historicoFilterLead,
    historicoFilterDataDe,
    historicoFilterDataAte,
  ])

  /** Validação: agrupa por lote (mesmo telefone + mesmo minuto) — uma linha = um envio em lote (ex.: mensagem no grupo com vários leads) */
  const historicoValidacaoAgrupadoPorLote = useMemo((): HistoricoLoteRow[] => {
    if (historicoFiltro !== 'validacao') return []
    const list = historicoFiltrado as HistoricoWppRow[]
    const map = new Map<string, HistoricoWppRow[]>()
    list.forEach((h) => {
      const minuto = new Date(h.created_at).toISOString().slice(0, 16)
      const key = `${h.telefone}|${minuto}`
      const rows = map.get(key) ?? []
      rows.push(h)
      map.set(key, rows)
    })
    return Array.from(map.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const first = sorted[0]!
      const corrigidoRow = sorted.find((r) => r.corrigido_em)
      const allCorrigido = sorted.every((r) => r.corrigido_em)
      const corrigido_em = allCorrigido && corrigidoRow ? corrigidoRow.corrigido_em : null
      return {
        key,
        rows: sorted,
        created_at: first.created_at,
        telefone: first.telefone,
        qtd_leads: sorted.length,
        corrigido_em,
        mensagem: first.mensagem,
        email_solicitante: first.email_solicitante,
        email_notificar: first.email_notificar,
        id_registro: sorted.length === 1 ? first.id_registro : null,
        stage_name: first.stage_name,
        deal_id: first.deal_id,
        planilha_id: first.planilha_id ?? null,
        nome_aba: first.nome_aba ?? null,
        row_index: first.row_index ?? null,
        isLote: true as const,
      } satisfies HistoricoLoteRow
    })
  }, [historicoFiltro, historicoFiltrado])

  /** SLA: agrupa por lote (mesmo telefone + mesmo minuto) — uma linha = um envio em lote no grupo */
  const historicoSlaAgrupadoPorLote = useMemo((): HistoricoLoteRow[] => {
    if (historicoFiltro !== 'sla') return []
    const grupos = historicoFiltrado as HistoricoSlaAgrupadoRow[]
    const rawRows = grupos.flatMap((g) => g.rows)
    const map = new Map<string, HistoricoWppRow[]>()
    rawRows.forEach((h) => {
      const minuto = new Date(h.created_at).toISOString().slice(0, 16)
      const key = `${h.telefone}|${minuto}`
      const rows = map.get(key) ?? []
      rows.push(h)
      map.set(key, rows)
    })
    return Array.from(map.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const first = sorted[0]!
      const allCorrigido = sorted.every((r) => r.corrigido_em)
      const corrigidoRow = sorted.find((r) => r.corrigido_em)
      const corrigido_em = allCorrigido && corrigidoRow ? corrigidoRow.corrigido_em : null
      return {
        key,
        rows: sorted,
        created_at: first.created_at,
        telefone: first.telefone,
        qtd_leads: sorted.length,
        corrigido_em,
        mensagem: first.mensagem,
        email_solicitante: first.email_solicitante,
        email_notificar: first.email_notificar,
        id_registro: sorted.length === 1 ? first.id_registro : null,
        stage_name: first.stage_name,
        deal_id: first.deal_id,
        planilha_id: first.planilha_id ?? null,
        nome_aba: first.nome_aba ?? null,
        row_index: first.row_index ?? null,
        isLote: true as const,
      } satisfies HistoricoLoteRow
    })
  }, [historicoFiltro, historicoFiltrado])

  /** Lista efetivamente exibida: SLA = por lote (se ativado) ou por caso/lead; Validação = por lote (se ativado) ou por lead */
  const historicoDisplayList = useMemo((): (HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow)[] => {
    if (historicoFiltro === 'sla') return historicoSlaVerPorLote ? historicoSlaAgrupadoPorLote : (historicoFiltrado as HistoricoSlaAgrupadoRow[])
    if (historicoVerPorLote) return historicoValidacaoAgrupadoPorLote
    return historicoFiltrado as HistoricoWppRow[]
  }, [historicoFiltro, historicoFiltrado, historicoSlaVerPorLote, historicoSlaAgrupadoPorLote, historicoVerPorLote, historicoValidacaoAgrupadoPorLote])

  const abrirModalReenviar = useCallback((h: HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow) => {
    const telefone = 'telefone' in h ? h.telefone : (h as HistoricoWppRow).telefone
    const mensagem = 'mensagem' in h ? h.mensagem : (h as HistoricoWppRow).mensagem
    setReenviarRow(h)
    setReenviarNumber(telefone.replace(/\D/g, ''))
    setReenviarMessage(mensagem || '')
    setReenviarError(null)
  }, [])

  const fecharModalReenviar = useCallback(() => {
    setReenviarRow(null)
    setReenviarError(null)
  }, [])

  /** Itens pendentes do histórico atual (para "Selecionar todos pendentes") */
  const historicoPendentes = useMemo(() => {
    return historicoDisplayList.filter((item) => {
      if ('isLote' in item && item.isLote) return item.rows.some((r) => !r.corrigido_em)
      if ('rows' in item) return !(item as HistoricoSlaAgrupadoRow).corrigido_em
      return !(item as HistoricoWppRow).corrigido_em
    })
  }, [historicoDisplayList])

  const getKeyOrId = (item: HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow): string =>
    'key' in item ? item.key : (item as HistoricoWppRow).id

  const toggleReenviarSelection = useCallback((keyOrId: string) => {
    setSelectedReenviar((prev) => {
      const next = new Set(prev)
      if (next.has(keyOrId)) next.delete(keyOrId)
      else next.add(keyOrId)
      return next
    })
  }, [])

  const selectAllPendentesReenviar = useCallback(() => {
    setSelectedReenviar(new Set(historicoPendentes.map((item) => getKeyOrId(item))))
  }, [historicoPendentes])

  const clearReenviarSelection = useCallback(() => {
    setSelectedReenviar(new Set())
  }, [])

  const selectedReenviarItems = useMemo(() => {
    const set = selectedReenviar
    return historicoDisplayList.filter((item) => set.has(getKeyOrId(item)))
  }, [historicoDisplayList, selectedReenviar])

  /** Quantidade de números de telefone distintos nos itens selecionados (um envio por número) */
  const selectedReenviarNumNumeros = useMemo(() => {
    const keys = new Set<string>()
    selectedReenviarItems.forEach((item) => {
      const tel = ('rows' in item ? item.telefone : item.telefone).replace(/\D/g, '')
      keys.add(tel.length <= 11 ? `55${tel}` : tel)
    })
    return keys.size
  }, [selectedReenviarItems])

  const enviarReenviarLote = useCallback(async () => {
    if (selectedReenviarItems.length === 0) return
    // Achata lotes/casos em linhas e agrupa por telefone: um envio por número, com uma única mensagem listando todos os leads
    const porTelefone = new Map<string, HistoricoWppRow[]>()
    selectedReenviarItems.forEach((item) => {
      const rows: HistoricoWppRow[] = 'rows' in item ? item.rows : [item as HistoricoWppRow]
      rows.forEach((r) => {
        const tel = r.telefone.replace(/\D/g, '')
        const key = tel.length <= 11 ? `55${tel}` : tel
        const list = porTelefone.get(key) ?? []
        list.push(r)
        porTelefone.set(key, list)
      })
    })
    const grupos = Array.from(porTelefone.entries())
    setReenviarLoteProgress({ atual: 0, total: grupos.length, enviados: 0, falhas: 0 })
    let enviados = 0
    let falhas = 0
    for (let i = 0; i < grupos.length; i++) {
      const [numeroFormatado, items] = grupos[i]!
      const mensagem = buildMensagemLoteHistorico(items)
      setReenviarLoteProgress((p) => (p ? { ...p, atual: i + 1 } : null))
      try {
        const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: numeroFormatado,
            text: mensagem,
            id_registro: items[0]?.id_registro ?? undefined,
          }),
        })
        if (res.ok) {
          enviados++
          if (supabase) {
            const origemRef = items[0]
            const origem = origemRef && 'rows' in origemRef ? 'sla' : (origemRef?.origem === 'sla' ? 'sla' : 'validacao')
            const rowsToInsert = items.map((item) =>
              'rows' in item
                ? {
                    origem,
                    telefone: numeroFormatado,
                    mensagem,
                    id_registro: item.id_registro ?? null,
                    row_index: item.row_index ?? null,
                    email_notificar: item.email_notificar ?? null,
                    email_solicitante: item.email_solicitante ?? null,
                    stage_name: item.stage_name ?? null,
                    funil: item.funil ?? null,
                    deal_id: item.deal_id ?? null,
                    planilha_id: item.planilha_id ?? PLANILHA_ID ?? null,
                    nome_aba: item.nome_aba ?? PLANILHA_ABA ?? null,
                  }
                : {
                    origem: item.origem === 'sla' ? 'sla' : 'validacao',
                    telefone: numeroFormatado,
                    mensagem,
                    id_registro: (item.id_registro ?? '').trim() || null,
                    row_index: item.row_index ?? null,
                    email_notificar: item.email_notificar || null,
                    email_solicitante: item.email_solicitante || null,
                    stage_name: item.stage_name || null,
                    funil: item.funil || null,
                    deal_id: item.deal_id || null,
                    planilha_id: item.planilha_id || PLANILHA_ID || null,
                    nome_aba: item.nome_aba || PLANILHA_ABA || null,
                  }
            )
            await supabase.from('historico_envio_whatsapp').insert(rowsToInsert)
          }
        } else {
          falhas++
        }
      } catch {
        falhas++
      }
      setReenviarLoteProgress((p) => (p ? { ...p, enviados, falhas } : null))
      if (i < grupos.length - 1) {
        await new Promise((r) => setTimeout(r, 800))
      }
    }
    clearReenviarSelection()
    recarregarHistoricoWpp()
  }, [selectedReenviarItems, supabase, clearReenviarSelection])

  const fecharReenviarLoteModal = useCallback(() => {
    setReenviarLoteModalOpen(false)
    setReenviarLoteProgress(null)
  }, [])

  const enviarReenviar = useCallback(async () => {
    if (!reenviarRow || !reenviarNumber.trim() || !reenviarMessage.trim()) return
    const telefone = reenviarNumber.trim().replace(/\D/g, '')
    if (telefone.length < 10) {
      setReenviarError('Informe um número válido (DDD + celular).')
      return
    }
    setReenviarSending(true)
    setReenviarError(null)
    const numeroFormatado = telefone.length <= 11 ? `55${telefone}` : telefone
    const idRegistro = reenviarRow.id_registro ?? undefined
    try {
      const res = await fetch(`${API_BASE}/api/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: numeroFormatado, text: reenviarMessage.trim(), id_registro: idRegistro }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReenviarError((json.message ?? json.error) || 'Falha ao enviar.')
        return
      }
      if (supabase) {
        const origem = 'rows' in reenviarRow ? 'sla' : (reenviarRow.origem === 'sla' ? 'sla' : 'validacao')
        const payload =
          'rows' in reenviarRow
            ? {
                origem,
                telefone: numeroFormatado,
                mensagem: reenviarMessage.trim(),
                id_registro: reenviarRow.id_registro ?? null,
                row_index: reenviarRow.row_index ?? null,
                email_notificar: reenviarRow.email_notificar ?? null,
                email_solicitante: reenviarRow.email_solicitante ?? null,
                stage_name: reenviarRow.stage_name ?? null,
                funil: reenviarRow.funil ?? null,
                deal_id: reenviarRow.deal_id ?? null,
                planilha_id: reenviarRow.planilha_id ?? PLANILHA_ID ?? null,
                nome_aba: reenviarRow.nome_aba ?? PLANILHA_ABA ?? null,
              }
            : {
                origem: reenviarRow.origem === 'sla' ? 'sla' : 'validacao',
                telefone: numeroFormatado,
                mensagem: reenviarMessage.trim(),
                id_registro: (reenviarRow.id_registro ?? '').trim() || null,
                row_index: reenviarRow.row_index ?? null,
                email_notificar: reenviarRow.email_notificar || null,
                email_solicitante: reenviarRow.email_solicitante || null,
                stage_name: reenviarRow.stage_name || null,
                funil: reenviarRow.funil || null,
                deal_id: reenviarRow.deal_id || null,
                planilha_id: reenviarRow.planilha_id || PLANILHA_ID || null,
                nome_aba: reenviarRow.nome_aba || PLANILHA_ABA || null,
              }
        await supabase.from('historico_envio_whatsapp').insert(payload)
      }
      fecharModalReenviar()
      recarregarHistoricoWpp()
    } catch (e) {
      setReenviarError('Erro de conexão. Verifique se a API e o webhook estão configurados.')
    } finally {
      setReenviarSending(false)
    }
  }, [reenviarRow, reenviarNumber, reenviarMessage, fecharModalReenviar])

  const abrirModalExcluirHistorico = useCallback((h: HistoricoWppRow | HistoricoSlaAgrupadoRow | HistoricoLoteRow) => {
    if ('rows' in h) {
      setHistoricoDeleteConfirm({ ids: h.rows.map((r) => r.id), id_registro: h.id_registro ?? undefined })
    } else {
      setHistoricoDeleteConfirm({ id: (h as HistoricoWppRow).id, id_registro: (h as HistoricoWppRow).id_registro ?? undefined })
    }
  }, [])

  const confirmarExcluirHistorico = useCallback(async () => {
    if (!supabase || !historicoDeleteConfirm) return
    const ids = historicoDeleteConfirm.ids ?? (historicoDeleteConfirm.id ? [historicoDeleteConfirm.id] : [])
    setHistoricoDeleteConfirm(null)
    const firstId = ids[0]
    if (firstId) setHistoricoDeletingId(firstId)
    setHistoricoWppError(null)
    try {
      const { error } = await supabase.from('historico_envio_whatsapp').delete().in('id', ids)
      if (error) {
        setHistoricoWppError(error.message || 'Erro ao excluir.')
        return
      }
      const idSet = new Set(ids)
      setHistoricoWpp((prev) => prev.filter((r) => !idSet.has(r.id)))
    } finally {
      setHistoricoDeletingId(null)
    }
  }, [supabase, historicoDeleteConfirm])

  const historicoStartResize = useCallback((col: string, startX: number) => {
    const startW = historicoColWidths[col] ?? 120
    const ref = { col, startX, startW }
    historicoResizeRef.current = ref
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - ref.startX
      setHistoricoColWidths((prev) => ({
        ...prev,
        [ref.col]: Math.max(60, ref.startW + delta),
      }))
    }
    const onUp = () => {
      historicoResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [historicoColWidths])

  // Quando uma validação mostra leads válidos, marca os envios correspondentes como "corrigido" e registra o tempo.
  // Busca por (planilha_id, nome_aba, row_index) para não depender de id_registro, que pode mudar quando a pessoa corrige (ex.: preenche "nome").
  useEffect(() => {
    const db = supabase
    if (!db || !data?.results?.length) return
    const validRows = data.results.filter((r) => r.valid)
    if (validRows.length === 0) {
      console.log('[Histórico WhatsApp] Validação com', data.results.length, 'resultados, nenhum válido para marcar como corrigido.')
      return
    }
    console.log('[Histórico WhatsApp] Marcando correções para', validRows.length, 'linha(s) válida(s). Planilha:', PLANILHA_ID, 'Aba:', PLANILHA_ABA || '(padrão)')
    const now = new Date()
    const promises: Promise<void>[] = []
    validRows.forEach((r) => {
      // Só marca "corrigido" em envios de Correção (Validação), não SLA
      const buscarPorLinha = () =>
        db
          .from('historico_envio_whatsapp')
          .select('id, created_at')
          .eq('planilha_id', PLANILHA_ID || '')
          .eq('nome_aba', PLANILHA_ABA ?? '')
          .eq('row_index', r.rowIndex)
          .is('corrigido_em', null)
          .or('origem.eq.validacao,origem.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

      const buscarPorIdRegistro = () =>
        db
          .from('historico_envio_whatsapp')
          .select('id, created_at')
          .eq('id_registro', String(r.id_registro ?? '').trim())
          .is('corrigido_em', null)
          .or('origem.eq.validacao,origem.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

      const p = buscarPorLinha()
        .then(({ data: row, error: err1 }) => {
          if (err1) {
            if ((err1 as { code?: string })?.code !== '42703') {
              console.warn('[Histórico WhatsApp] Busca por linha falhou (linha', r.rowIndex, '):', err1)
            }
            return buscarPorIdRegistro()
          }
          if (row) return Promise.resolve({ data: row, error: null } as Awaited<ReturnType<typeof buscarPorLinha>>)
          return buscarPorIdRegistro()
        })
        .then((res: { data: { id: string; created_at: string } | null; error: unknown }) => {
          const row = res?.data ?? null
          if (res?.error) {
            console.warn('[Histórico WhatsApp] Busca por id_registro falhou:', r.id_registro, res.error)
            return
          }
          if (!row) return
          const sentAt = new Date(row.created_at).getTime()
          const tempoMinutos = Math.round((now.getTime() - sentAt) / 60000)
          const corrigidoEm = new Date(sentAt + tempoMinutos * 60000).toISOString()
          return db
            .from('historico_envio_whatsapp')
            .update({
              corrigido_em: corrigidoEm,
              tempo_minutos: tempoMinutos,
            })
            .eq('id', row.id)
            .select('id')
            .then(({ data: updatedRows, error: updateErr }) => {
              if (updateErr) {
                console.error('[Histórico WhatsApp] Erro ao marcar como corrigido (linha', r.rowIndex, '):', updateErr)
                return
              }
              if (!updatedRows || updatedRows.length === 0) {
                console.warn(
                  '[Histórico WhatsApp] Update retornou 0 linhas (id=', row.id, '). Provável causa: política de UPDATE faltando ou RLS bloqueando. Crie a política "Permitir update historico_wpp" no Supabase (ver docs/SUPABASE-HISTORICO-WHATSAPP.md).'
                )
                return
              }
              console.log('[Histórico WhatsApp] Marcado como corrigido: linha', r.rowIndex, r.id_registro, 'em', tempoMinutos, 'min')
            })
        })
      promises.push(Promise.resolve(p).then(() => {}))
    })
    Promise.allSettled(promises).then(() => {
      setTimeout(recarregarHistoricoWpp, 800)
    })
  }, [data, supabase, recarregarHistoricoWpp])

  const toggleValidationField = useCallback((scope: string, field: string, enabled: boolean) => {
    setValidationConfig((prev) => ({
      ...prev,
      [scope]: { ...(prev[scope] || {}), [field]: enabled },
    }))
  }, [])

  const allValidationKeys = useMemo(() => {
    const set = new Set<string>()
    const config = defaultValidationConfig ?? FALLBACK_DEFAULT_VALIDATION_CONFIG
    Object.values(config).forEach((fields) => Object.keys(fields).forEach((k) => set.add(k)))
    if (columnMapping) Object.keys(columnMapping).forEach((k) => set.add(k))
    return Array.from(set).sort()
  }, [defaultValidationConfig, columnMapping])

  const normalizeColumnName = useCallback((s: string) => {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  }, [])

  const addColumnOverride = useCallback(() => {
    const col = normalizeColumnName(columnOverrideNewCol)
    const key = columnOverrideNewKey.trim()
    if (!col || !key) return
    setColumnOverrides((prev) => ({ ...prev, [col]: key }))
    setColumnOverrideNewCol('')
    setColumnOverrideNewKey('')
  }, [columnOverrideNewCol, columnOverrideNewKey, normalizeColumnName])

  const removeColumnOverride = useCallback((col: string) => {
    setColumnOverrides((prev) => {
      const next = { ...prev }
      delete next[col]
      return next
    })
  }, [])

  const handleValidar = useCallback(async () => {
    if (!accessToken) {
      setError('Conecte-se com o Google primeiro.')
      return
    }
    if (!PLANILHA_ID.trim()) {
      setError('Configure VITE_PLANILHA_ID em .env ou .env.local.')
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
          validationConfig: Object.keys(validationConfig).length > 0 ? validationConfig : undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.message || json.error || 'Erro ao validar planilha.')
        return
      }

      setData(json)
      setFilterSearchLead('')
      setFilterArea('')
      setFilterSolicitante('')
      setFilterStatus('')
      setFilterStageName('')
      setFilterFunil('')
      setMostrarSoComErro(false)
    } catch (e) {
      setError(
        'Não foi possível falar com o servidor. Use "npm run dev" (sobe front + API local), "vercel dev" ou faça deploy para testar.'
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, validationConfig, columnOverrides])

  // Ao entrar na página, validar a planilha fixa se já estiver conectado
  useEffect(() => {
    if (accessToken && PLANILHA_ID.trim()) {
      handleValidar()
    }
  }, [accessToken, handleValidar])

  const results = data?.results ?? []
  const comErros = results.filter((r) => !r.valid)

  // Opções para filtros: uma entrada por pessoa (renato@bismarchipires e renato@bpplaw = mesma pessoa)
  const solicitantesUnicos = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      set.add(key)
    })
    return Array.from(set).sort()
  }, [results])

  // Área = tag do solicitante (e-mail → getTeamMember().tag: Sócio, Cível, Trabalhista, etc.)
  const areasUnicas = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const m = e ? getTeamMember(e) : null
      if (m?.tag) set.add(m.tag)
    })
    return Array.from(set).sort()
  }, [results])

  const stageNamesUnicos = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const s = (r.stage_name ?? '').trim()
      if (s) set.add(s)
    })
    return Array.from(set).sort()
  }, [results])

  const funisUnicos = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const f = (r.funil ?? '').trim()
      if (f) set.add(f)
    })
    return Array.from(set).sort()
  }, [results])

  // Resultados filtrados
  const resultadosFiltrados = useMemo(() => {
    let list = results
    if (filterSearchLead.trim()) {
      const q = filterSearchLead.trim().toLowerCase()
      list = list.filter((r) => (r.id_registro ?? '').toLowerCase().includes(q))
    }
    if (filterArea) {
      list = list.filter((r) => {
        const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
        const m = e ? getTeamMember(e) : null
        return m?.tag === filterArea
      })
    }
    if (filterSolicitante) {
      list = list.filter((r) => {
        const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
        const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
        return key === filterSolicitante
      })
    }
    if (filterStatus) {
      list = list.filter((r) => (r.status ?? '') === filterStatus)
    }
    if (filterStageName) {
      list = list.filter((r) => (r.stage_name ?? '').trim() === filterStageName)
    }
    if (filterFunil) {
      list = list.filter((r) => (r.funil ?? '').trim() === filterFunil)
    }
    if (mostrarSoComErro) {
      list = list.filter((r) => !r.valid)
    }
    return list
  }, [results, filterSearchLead, filterArea, filterSolicitante, filterStatus, filterStageName, filterFunil, mostrarSoComErro])

  // Agrupar por pessoa (renato@bismarchipires e renato@bpplaw = mesma pessoa “Renato Vallim”)
  const errosPorResponsavel = useMemo(() => {
    const map = new Map<string, number>()
    comErros.forEach((r) => {
      const e = (r.email_solicitante ?? r.email_notificar ?? '').trim()
      const key = e ? getSolicitanteKey(e) : '(sem e-mail)'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [comErros])

  const statusLabel: Record<string, string> = {
    lost: 'Perda (Lost)',
    win: 'Ganho (Won)',
    ongoing: 'Em andamento (Ongoing)',
  }

  const [vistaResultados, setVistaResultados] = useState<'cards' | 'planilha'>('planilha')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-primary flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8" />
          Validar planilha (Google Sheets)
        </h1>
        <p className="text-gray-600 mt-1">
          Conecte sua planilha e valide os dados conforme o manual de etapas. Use o e-mail do solicitante para
          filtrar quem deve ser cobrado.
        </p>
      </div>

      {/* Abas: Validação | Histórico WhatsApp */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setAbaAtiva('validacao')}
          className={`px-4 py-2.5 font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
            abaAtiva === 'validacao'
              ? 'bg-white border border-b-0 border-gray-200 text-primary shadow-sm -mb-px'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Validação
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('historico_wpp')}
          className={`px-4 py-2.5 font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
            abaAtiva === 'historico_wpp'
              ? 'bg-white border border-b-0 border-gray-200 text-primary shadow-sm -mb-px'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <History className="h-4 w-4" />
          Histórico WhatsApp
        </button>
      </div>

      {abaAtiva === 'validacao' && (
        <>
      {/* O que estamos validando – abre/fecha (atualizado junto com novas verificações na API) */}
      <details className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            O que estamos validando
          </span>
          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 text-sm text-gray-700 space-y-4">
          <p className="font-medium text-gray-800">A validação confere os dados conforme o manual de etapas. Por etapa (Funil de vendas):</p>

          <div>
            <p className="font-semibold text-gray-800 mb-1">1. Cadastro do Lead (todas as etapas do Funil de vendas)</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600 ml-2">
              <li>Obrigatórios: Solicitante, E-mail do Solicitante, Cadastro realizado por, Haverá Due Diligence?, Razão Social, CNPJ/CPF, Local da Reunião, Tipo de Lead</li>
              <li><strong>Se Haverá Due Diligence? = Sim:</strong> Prazo de Entrega da Due (data ou &quot;A definir&quot;), Horário de Entrega da Due (horário ou &quot;A definir&quot;)</li>
              <li><strong>Se Tipo de Lead = Indicação:</strong> Indicação e Nome da Indicação</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">2. Confecção de Proposta [CP] (quando etapa = Confecção de Proposta)</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600 ml-2">
              <li>Razão Social [CP] (MAIÚSCULO), CNPJ [CP], Qualificação completa (endereço, CEP, e-mail ou N/A)</li>
              <li>Áreas Objeto do contrato [CP], Realizou Due Diligence? [CP] (Sim/Não), Gestor do Contrato [CP]</li>
              <li>Nome, E-mail e Telefone do ponto focal / Comercial [CP], Captador [CP]</li>
              <li>Tributação [CP] (Líquido/Englobando Tributos ou Bruto/Sem Tributos)</li>
              <li>Prazo para entrega [CP] (DD/MM/AAAA, mín. 2 dias úteis), Data do primeiro vencimento [CP]</li>
              <li>Informações adicionais [CP] (ou N/A), Demais Razões Sociais [CP] (ou N/A)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">3. Proposta Enviada (quando etapa = Proposta Enviada)</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600 ml-2">
              <li>Link da Proposta (obrigatório apenas nesta etapa)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">4. Confecção de Contrato [CC] (quando etapa = Confecção de Contrato)</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600 ml-2">
              <li>Tipo de pagamento [CC], Objeto do contrato [CC], valores conforme tipo (R$), Rateio % por área, Prazo, Link do contrato</li>
            </ul>
          </div>

          <p className="text-gray-500 text-xs border-t border-gray-100 pt-2">
            Referência: <code className="bg-gray-100 px-1 rounded">docs/ETAPAS-DE-VENDAS-REFERENCIA.md</code>. Esta seção é atualizada quando novas verificações são adicionadas na API.
          </p>
        </div>
      </details>

      {/* Configuração: ativar/desativar validações por campo */}
      <details className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuração de validação
          </span>
          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 text-sm text-gray-700 space-y-4">
          <p className="font-medium text-gray-800">
            Marque ou desmarque os campos que deseja validar. As alterações são salvas automaticamente e usadas na próxima validação.
          </p>
          {(defaultValidationConfig ?? FALLBACK_DEFAULT_VALIDATION_CONFIG) && (
            <div className="space-y-4">
              {Object.entries(defaultValidationConfig ?? FALLBACK_DEFAULT_VALIDATION_CONFIG).map(([scope, fields]) => {
                const scopeLabel =
                  scope === 'cadastro_lead'
                    ? 'Cadastro do Lead'
                    : scope === 'confecao_proposta'
                      ? 'Confecção de Proposta [CP]'
                      : scope === 'proposta_enviada'
                        ? 'Proposta Enviada'
                        : scope === 'confecao_contrato'
                          ? 'Confecção de Contrato [CC]'
                          : scope.replace(/_/g, ' ')
                const scopeConfig = validationConfig[scope] ?? {}
                return (
                  <div key={scope} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <p className="font-semibold text-gray-800 mb-2">{scopeLabel}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(fields).map(([fieldKey]) => {
                        const enabled = scopeConfig[fieldKey] ?? fields[fieldKey] ?? true
                        const fieldLabel = fieldKey
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())
                        return (
                          <label key={fieldKey} className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => toggleValidationField(scope, fieldKey, e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary/20"
                            />
                            <span className="text-gray-700">{fieldLabel}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="font-medium text-gray-800 mb-2">Configurar qual coluna é cada variável (mapeamento manual)</p>
            <p className="text-sm text-gray-600 mb-2">
              Se a sua planilha usa um nome de coluna diferente do padrão, defina aqui qual coluna da planilha corresponde a qual campo de validação. Coluna: nome normalizado (minúsculas, sem acentos, espaços → _). Campo: chave usada na validação (ex.: <code className="bg-gray-100 px-1 rounded">email</code>, <code className="bg-gray-100 px-1 rounded">link_da_proposta</code>).
            </p>
            {Object.entries(columnOverrides).length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {Object.entries(columnOverrides).map(([col, key]) => (
                  <li key={col} className="flex items-center gap-2">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded">{col}</code>
                    <span className="text-gray-500">→</span>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded">{key}</code>
                    <button
                      type="button"
                      onClick={() => removeColumnOverride(col)}
                      className="p-1 rounded text-red-600 hover:bg-red-50"
                      title="Remover override"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="text"
                placeholder="Coluna (ex: minha_coluna_email)"
                value={columnOverrideNewCol}
                onChange={(e) => setColumnOverrideNewCol(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <select
                value={columnOverrideNewKey}
                onChange={(e) => setColumnOverrideNewKey(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent min-w-[180px]"
              >
                <option value="">Campo de validação</option>
                {allValidationKeys.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addColumnOverride}
                disabled={!columnOverrideNewCol.trim() || !columnOverrideNewKey.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>
          <details className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <summary className="px-3 py-2 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100">
              Mapeamento: coluna da planilha → campo de validação
            </summary>
            <div className="px-3 pb-3 pt-1 border-t border-gray-100 text-sm">
              <p className="text-gray-600 mb-2">
                Cada campo de validação é alimentado por uma ou mais colunas da planilha (nome normalizado: minúsculas, sem acentos, espaços → _). Se a sua planilha usar outro nome, inclua no <code className="bg-gray-100 px-1 rounded">COLUMN_TO_KEY</code> em <code className="bg-gray-100 px-1 rounded">api/validar-sheets.js</code>. Ver{' '}
                <code className="bg-gray-100 px-1 rounded">docs/MAPEAMENTO-VALIDACAO-PLANILHA.md</code>.
              </p>
              {columnMapping && Object.keys(columnMapping).length > 0 ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2 font-semibold text-gray-800 border border-gray-200">Campo de validação (chave)</th>
                        <th className="py-1.5 px-2 font-semibold text-gray-800 border border-gray-200">Colunas na planilha (uma delas deve existir)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(defaultValidationConfig ?? FALLBACK_DEFAULT_VALIDATION_CONFIG) &&
                        Object.entries(defaultValidationConfig ?? FALLBACK_DEFAULT_VALIDATION_CONFIG).map(([scope, fields]) =>
                          Object.keys(fields).map((key) => {
                            const cols = columnMapping[key]
                            if (!cols || cols.length === 0) return null
                            return (
                              <tr key={`${scope}-${key}`} className="border-b border-gray-100">
                                <td className="py-1 px-2 font-medium text-gray-800 border border-gray-200 align-top">
                                  {key.replace(/_/g, ' ')}
                                </td>
                                <td className="py-1 px-2 text-gray-600 border border-gray-200 align-top">
                                  <code className="text-xs">{cols.join(', ')}</code>
                                </td>
                              </tr>
                            )
                          })
                        )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">Carregue a página com a API disponível para ver o mapeamento.</p>
              )}
            </div>
          </details>
        </div>
      </details>

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
                  Configure <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> no arquivo{' '}
                  <code className="bg-amber-100 px-1 rounded">.env</code>. Veja{' '}
                  <code className="bg-amber-100 px-1 rounded">docs/CONFIGURACAO-GOOGLE-SHEETS.md</code>.
                </Alert>
              )}
              <button
                type="button"
                onClick={() => login()}
                disabled={!clientId}
                className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 text-gray-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Conectar com Google
              </button>
            </>
          )
        ) : (
          <button
            type="button"
            onClick={handleValidar}
            disabled={loading || !PLANILHA_ID.trim()}
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5" />
                Atualizar
              </>
            )}
          </button>
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
          {/* Resumo + botão Atualizar */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{data.total}</p>
                <p className="text-xs text-gray-500 mt-1">linhas validadas</p>
              </div>
              <div className="bg-white border-2 border-red-200 rounded-xl p-5 shadow-sm bg-red-50/30">
                <p className="text-sm font-medium text-red-600 uppercase tracking-wide">Com erro</p>
                <p className="text-3xl font-bold text-red-700 mt-1">{data.comErros}</p>
                <p className="text-xs text-red-600/80 mt-1">precisam de ajuste</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">OK</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{data.total - data.comErros}</p>
                <p className="text-xs text-gray-500 mt-1">sem pendências</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleValidar()}
              disabled={loading}
              className="flex-shrink-0 px-4 py-2.5 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2 self-start"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              Atualizar
            </button>
          </div>

          {/* Leads com erro por responsável */}
          {errosPorResponsavel.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="h-5 w-5" />
                Por solicitante (leads com erro)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {errosPorResponsavel.map(([key, count]) => {
                  const member = key !== '(sem e-mail)' ? getTeamMember(key) : null
                  const displayName = member?.name ?? (key === '(sem e-mail)' ? 'Sem e-mail' : key)
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
                        <p className="text-2xl font-bold text-primary mt-1">
                          {count} lead{count !== 1 ? 's' : ''} com erro{count !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Clique para filtrar</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filtros + toggle de vista */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Exibir como:</span>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setVistaResultados('planilha')}
                    className={`px-3 py-1.5 text-sm font-medium ${vistaResultados === 'planilha' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Planilha
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaResultados('cards')}
                    className={`px-3 py-1.5 text-sm font-medium ${vistaResultados === 'cards' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Cards
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[220px] flex-1 max-w-sm">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar lead</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filterSearchLead}
                    onChange={(e) => setFilterSearchLead(e.target.value)}
                    placeholder="Nome do lead, razão social..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {filterSearchLead && (
                    <button
                      type="button"
                      onClick={() => setFilterSearchLead('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      aria-label="Limpar busca"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                <select
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {areasUnicas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px]" ref={solicitanteDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitante</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSolicitanteOpen((o) => !o)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center gap-2 text-left hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {filterSolicitante ? (
                      <>
                        {getTeamMember(filterSolicitante)?.avatar ? (
                          <img
                            src={getTeamMember(filterSolicitante)!.avatar}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-gray-200"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                        )}
                        <span className="truncate flex-1">
                          {getTeamMember(filterSolicitante)?.name ?? (filterSolicitante === '(sem e-mail)' ? 'Sem e-mail' : filterSolicitante)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span className="text-gray-500 flex-1">Todos</span>
                      </>
                    )}
                    <ChevronDown className={`h-4 w-4 text-gray-500 flex-shrink-0 transition-transform ${solicitanteOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {solicitanteOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterSolicitante('')
                          setSolicitanteOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 text-gray-700"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span>Todos</span>
                      </button>
                      {solicitantesUnicos.map((key) => {
                        const m = key !== '(sem e-mail)' ? getTeamMember(key) : null
                        const displayName = m?.name ?? (key === '(sem e-mail)' ? 'Sem e-mail' : key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setFilterSolicitante(key)
                              setSolicitanteOpen(false)
                            }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 ${filterSolicitante === key ? 'bg-primary/5 text-primary' : 'text-gray-700'}`}
                          >
                            {m?.avatar ? (
                              <img
                                src={m.avatar}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-gray-200"
                                onError={(ev) => {
                                  const t = ev.target as HTMLImageElement
                                  t.style.display = 'none'
                                  const fallback = t.nextElementSibling
                                  if (fallback instanceof HTMLElement) fallback.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <div className={`w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center ${m?.avatar ? 'hidden' : ''}`}>
                              <User className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <span className="truncate">{displayName}</span>
                            {m?.tag && (
                              <span className="ml-auto px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 flex-shrink-0">
                                {m.tag}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Todos</option>
                  <option value="lost">{statusLabel.lost}</option>
                  <option value="win">{statusLabel.win}</option>
                  <option value="ongoing">{statusLabel.ongoing}</option>
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                <select
                  value={filterStageName}
                  onChange={(e) => setFilterStageName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {stageNamesUnicos.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Funil</label>
                <select
                  value={filterFunil}
                  onChange={(e) => setFilterFunil(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Todos</option>
                  {funisUnicos.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={mostrarSoComErro}
                  onChange={(e) => setMostrarSoComErro(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">Só com erro</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setFilterSearchLead('')
                  setFilterArea('')
                  setFilterSolicitante('')
                  setFilterStatus('')
                  setFilterStageName('')
                  setFilterFunil('')
                  setMostrarSoComErro(false)
                }}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-300 flex items-center gap-1.5 shrink-0"
              >
                <XCircle className="h-4 w-4" />
                Limpar filtros
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {resultadosFiltrados.length} de {results.length} linha(s) exibida(s)
            </p>
          </div>

          {/* Vista em Planilha (estilo spreadsheet: densa, listrada, cabeçalho fixo) */}
          {vistaResultados === 'planilha' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-700 text-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-semibold w-14">#</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[140px]">Registro</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[180px]">E-mail (quem cobrar)</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[160px]">Stage</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[120px]">Funil</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-28">Status</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-24">Validação</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-20">CRM</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-20">WhatsApp</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[200px]">Erros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosFiltrados.map((r, idx) => (
                      <tr
                        key={r.rowIndex}
                        className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} ${!r.valid ? 'bg-red-50/80' : ''}`}
                      >
                        <td className="py-2 px-3 font-mono text-gray-500 tabular-nums">{r.rowIndex}</td>
                        <td className="py-2 px-3 font-medium text-gray-800 max-w-[140px] truncate" title={r.id_registro || ''}>
                          {r.id_registro || '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-700 max-w-[220px]">
                          {(() => {
                            const em = r.email_solicitante || r.email_notificar || ''
                            const mem = em ? getTeamMember(em) : null
                            return (
                              <div className="flex items-center gap-2 min-w-0">
                                {mem?.avatar ? (
                                  <img
                                    src={mem.avatar}
                                    alt=""
                                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-gray-200"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="truncate block text-sm" title={em}>{em || '—'}</span>
                                  {mem?.tag && (
                                    <span className="text-[10px] text-slate-500">{mem.tag}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{r.stage_name || '—'}</td>
                        <td className="py-2 px-3 text-gray-600 text-xs">{r.funil || '—'}</td>
                        <td className="py-2 px-3">
                          {r.status ? (
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded inline-block ${
                                r.status === 'win' ? 'bg-emerald-100 text-emerald-800' : r.status === 'lost' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {statusLabel[r.status] ?? r.status_raw ?? r.status}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.valid ? (
                            <span className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" /> Ajustar
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.deal_id ? (
                            <a
                              href={`${RD_CRM_DEAL_URL}${r.deal_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
                              title="Abrir negociação no RD Station CRM"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              CRM
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => openWppModal(r)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-medium"
                            title="Enviar notificação no WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WPP
                          </button>
                        </td>
                        <td className="py-2 px-3 max-w-md">
                          {r.errors.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1 text-red-700 text-xs">
                              {r.errors.map((e, i) => (
                                <li key={i}>
                                  <strong>{e.field}</strong>: {e.message}
                                  <span className="block pl-4 mt-0.5 text-red-600">
                                    Atual: <em>{e.valor_atual ?? '(vazio)'}</em> — Deve ser: {e.comoCorrigir}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                {resultadosFiltrados.length} linha(s). Rolagem horizontal/vertical disponível. Status: Won = Ganho, Lost = Perda.
              </p>
            </div>
          )}

          {/* Vista em Cards */}
          {vistaResultados === 'cards' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Resultados</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {resultadosFiltrados.map((r) => (
                  <div
                    key={r.rowIndex}
                    className={`rounded-xl border-2 p-4 shadow-sm ${
                      r.valid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 truncate" title={r.id_registro || ''}>
                          {r.id_registro || `Linha ${r.rowIndex}`}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Linha {r.rowIndex}
                          {r.stage_name && (
                            <span className="ml-2 text-gray-500">• {r.stage_name}</span>
                          )}
                        </p>
                        {(() => {
                          const em = r.email_solicitante || r.email_notificar || ''
                          const mem = em ? getTeamMember(em) : null
                          return (
                            <div className="flex items-center gap-2 mt-1 min-w-0">
                              {mem?.avatar ? (
                                <img
                                  src={mem.avatar}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm text-gray-600 truncate" title={em}>
                                  {em || '—'}
                                </p>
                                {mem?.tag && (
                                  <span className="text-xs text-slate-500">{mem.tag}</span>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.funil && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {r.funil}
                            </span>
                          )}
                          {r.status && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                r.status === 'win' ? 'bg-green-100 text-green-800' : r.status === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {statusLabel[r.status] ?? r.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {r.valid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-medium">
                            <AlertCircle className="h-4 w-4" /> Ajustar
                          </span>
                        )}
                        {r.deal_id && (
                          <a
                            href={`${RD_CRM_DEAL_URL}${r.deal_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium"
                            title="Abrir negociação no RD Station CRM"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir no CRM
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openWppModal(r)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-sm font-medium"
                          title="Enviar notificação no WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar no WhatsApp
                        </button>
                      </div>
                    </div>
                    {!r.valid && r.errors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <p className="text-xs font-semibold text-red-700 mb-2">Erros:</p>
                        <ul className="space-y-2 text-sm text-red-800">
                          {r.errors.map((e, i) => (
                            <li key={i} className="flex flex-col gap-0.5">
                              <span className="font-medium">{e.field}</span>
                              <span className="text-red-700 text-xs">{e.message}</span>
                              <span className="text-xs text-red-600/90">
                                Atual: <em>{e.valor_atual ?? '(vazio)'}</em>
                              </span>
                              <span className="text-xs text-emerald-700 font-medium">
                                Deve ser: {e.comoCorrigir}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            A validação usa <strong>funil</strong> e <strong>stage_name</strong>. No <strong>Funil de vendas</strong>, todas as linhas são validadas (cadastro do lead: solicitante, e-mail, razão social, CNPJ, etc.). Na etapa <strong>Confecção de proposta</strong> também são exigidos: Nome completo do ponto focal/comercial (nome + sobrenome), e-mail válido e telefone (10–11 dígitos). Stages desconsiderados: Contato Inicial, Contato feito, Contato Trimestral, Descartados, Mensagem Enviada, Suspenso, Lead Quente, Contato Mensal, Lead Capturado. Status: Won = ganho, Lost = perda.
          </p>
        </>
      )}
        </>
      )}

      {abaAtiva === 'historico_wpp' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 p-4 border-b border-gray-200 bg-slate-50/50">
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico: Correção (Validação) e SLA
              </h2>
              <p className="text-sm text-gray-600 max-w-2xl">
                {historicoFiltro === 'validacao'
                  ? 'Correção (Validação): quando enviamos notificação de erro no WhatsApp e quando o lead corrigiu os dados (validação passou a considerar OK).'
                  : 'SLA: quando enviamos notificação de lead fora do SLA no WhatsApp e quando o lead foi atualizado no RD (saiu da lista de atrasados).'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoricoFiltro('validacao')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historicoFiltro === 'validacao' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  Correção (Validação)
                </button>
                <button
                  type="button"
                  onClick={() => setHistoricoFiltro('sla')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historicoFiltro === 'sla' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  SLA
                </button>
              </div>
              {historicoFiltro === 'sla' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Ver:</span>
                  <button
                    type="button"
                    onClick={() => setHistoricoSlaVerPorLote(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historicoSlaVerPorLote ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Por lote (envio no grupo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoricoSlaVerPorLote(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!historicoSlaVerPorLote ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Por caso (lead)
                  </button>
                </div>
              )}
              {historicoFiltro === 'validacao' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Ver:</span>
                  <button
                    type="button"
                    onClick={() => setHistoricoVerPorLote(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historicoVerPorLote ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Por lote (envio no grupo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoricoVerPorLote(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!historicoVerPorLote ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Por lead
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
                  <Filter className="h-4 w-4" />
                  Filtros:
                </span>
                <select
                  value={historicoFilterResponsavel}
                  onChange={(e) => setHistoricoFilterResponsavel(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Todos os responsáveis</option>
                  {historicoResponsaveisUnicos.map(({ name, email }) => (
                    <option key={email} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={historicoFilterStatus}
                  onChange={(e) => setHistoricoFilterStatus(e.target.value as 'todos' | 'pendente' | 'atualizado')}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="todos">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="atualizado">Atualizado no RD</option>
                </select>
                <input
                  type="text"
                  placeholder="Buscar por lead..."
                  value={historicoFilterLead}
                  onChange={(e) => setHistoricoFilterLead(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <input
                  type="date"
                  value={historicoFilterDataDe}
                  onChange={(e) => setHistoricoFilterDataDe(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  title="Enviado a partir de"
                />
                <span className="text-gray-500 text-sm">até</span>
                <input
                  type="date"
                  value={historicoFilterDataAte}
                  onChange={(e) => setHistoricoFilterDataAte(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  title="Enviado até"
                />
              </div>
              {historicoPendentes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={selectAllPendentesReenviar}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100"
                  >
                    Selecionar todos pendentes ({historicoPendentes.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearReenviarSelection}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Limpar seleção
                  </button>
                  {selectedReenviar.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setReenviarLoteModalOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                    >
                      <Send className="h-4 w-4" />
                      Reenviar em lote ({selectedReenviar.size})
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={recarregarHistoricoWpp}
              disabled={historicoWppLoading}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 text-sm font-medium flex-shrink-0"
            >
              {historicoWppLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar
            </button>
          </div>
          {!supabase && (
            <div className="p-6 text-center text-amber-700 bg-amber-50 border-b border-amber-200">
              Supabase não configurado. Defina <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> e{' '}
              <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> em <code className="bg-amber-100 px-1 rounded">.env.local</code>.
            </div>
          )}
          {supabase && historicoWppError && (
            <Alert variant="error" className="m-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {historicoWppError}
            </Alert>
          )}
          {supabase && !historicoWppError && (
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
              {historicoWppLoading && historicoWpp.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Carregando histórico...
                </div>
              ) : historicoDisplayList.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  {historicoFiltro === 'validacao'
                    ? 'Nenhum envio de Correção (Validação) registrado. Os envios feitos na tela Validação aparecerão aqui.'
                    : 'Nenhum envio de SLA registrado. Os envios feitos na tela Leads fora do SLA aparecerão aqui.'}
                </div>
              ) : (
                <table className="w-full text-sm border-collapse table-fixed">
                  <thead className="bg-slate-700 text-slate-100 sticky top-0 z-10">
                    <tr>
                      {(
                        historicoFiltro === 'sla' && !historicoSlaVerPorLote
                          ? [
                              { key: 'sel', label: 'Sel.' },
                              { key: 'status', label: 'Status' },
                              { key: 'qtd_envios', label: 'Qtd envios' },
                              { key: 'primeiro_envio', label: 'Primeiro envio' },
                              { key: 'ultimo_envio', label: 'Último envio' },
                              { key: 'tempo_sem_resolucao', label: 'Tempo sem resolução' },
                              { key: 'lead', label: 'Lead' },
                              { key: 'telefone', label: 'Telefone' },
                              { key: 'responsavel', label: 'Responsável' },
                              { key: 'etapa', label: 'Etapa' },
                              { key: 'mensagem', label: 'Mensagem' },
                              { key: 'acao', label: 'Ação' },
                            ]
                          : historicoFiltro === 'validacao' && !historicoVerPorLote
                            ? [
                              { key: 'sel', label: 'Sel.' },
                              { key: 'status', label: 'Status' },
                              { key: 'enviado_em', label: 'Enviado no WhatsApp em' },
                              { key: 'corrigido_em', label: 'Corrigido em' },
                              { key: 'tempo', label: 'Tempo' },
                              { key: 'lead', label: 'Lead' },
                              { key: 'telefone', label: 'Telefone' },
                              { key: 'responsavel', label: 'Responsável' },
                              { key: 'etapa', label: 'Etapa' },
                              { key: 'mensagem', label: 'Mensagem' },
                              { key: 'acao', label: 'Ação' },
                            ]
                            : [
                              { key: 'sel', label: 'Sel.' },
                              { key: 'status', label: 'Status' },
                              { key: 'enviado_em', label: 'Enviado no WhatsApp em' },
                              { key: 'corrigido_em', label: 'Corrigido em' },
                              { key: 'tempo', label: 'Tempo' },
                              { key: 'lead', label: 'Leads' },
                              { key: 'telefone', label: 'Telefone' },
                              { key: 'responsavel', label: 'Responsável' },
                              { key: 'etapa', label: 'Etapa' },
                              { key: 'mensagem', label: 'Mensagem' },
                              { key: 'acao', label: 'Ação' },
                            ]
                      ).map(({ key, label }) => (
                        <th
                          key={key}
                          className="text-left py-2.5 px-3 font-semibold relative group"
                          style={{ width: historicoColWidths[key] ?? 120 }}
                        >
                          {label}
                          <span
                            role="separator"
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/30 flex items-center justify-center select-none"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              historicoStartResize(key, e.clientX)
                            }}
                            title="Arraste para redimensionar a coluna"
                          >
                            <GripVertical className="h-4 w-4 opacity-60 pointer-events-none" />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historicoFiltro === 'sla' && historicoSlaVerPorLote
                      ? (historicoDisplayList as HistoricoLoteRow[]).map((lote) => (
                          <tr key={lote.key} className="border-b border-gray-100 hover:bg-slate-50/70">
                            <td className="py-2 px-3" style={{ width: historicoColWidths.sel }}>
                              {lote.rows.some((r) => !r.corrigido_em) && (
                                <input
                                  type="checkbox"
                                  checked={selectedReenviar.has(lote.key)}
                                  onChange={() => toggleReenviarSelection(lote.key)}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  title="Selecionar para reenviar em lote"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.status }}>
                              {lote.corrigido_em ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800" title="Todos os leads do lote atualizados no RD">
                                  Atualizado no RD
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Algum lead do lote ainda pendente">
                                  {lote.rows.some((r) => r.corrigido_em) ? 'Parcial' : 'Pendente'}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" style={{ width: historicoColWidths.enviado_em }} title="Data/hora do envio no WhatsApp">
                              {new Date(lote.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" title="Quando todos os leads do lote foram atualizados no RD">
                              {lote.corrigido_em ? new Date(lote.corrigido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.tempo }}>
                              {lote.rows.every((r) => r.tempo_minutos != null) && lote.rows.length > 0 ? (
                                <span className="text-emerald-700 font-medium text-xs">Resolvido</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-800" style={{ width: historicoColWidths.lead }} title={lote.rows.map((r) => r.id_registro || '—').join(', ')}>
                              <span className="text-primary">{lote.qtd_leads} lead{lote.qtd_leads !== 1 ? 's' : ''}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-800">{lote.telefone}</td>
                            <td className="py-2 px-3 text-gray-700 max-w-[160px]" title={lote.email_solicitante || lote.email_notificar || ''}>
                              {(() => {
                                const email = (lote.email_solicitante || lote.email_notificar || '').trim()
                                const member = email ? getTeamMember(email) : null
                                if (member) {
                                  return (
                                    <span className="inline-flex items-center gap-2">
                                      <img src={member.avatar} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                      <span className="truncate">{member.name}</span>
                                    </span>
                                  )
                                }
                                return email ? <span className="truncate">{email}</span> : '—'
                              })()}
                            </td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.etapa }}>{lote.stage_name || '—'}</td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.mensagem }} title={lote.mensagem}>
                              <span className="line-clamp-2">{lote.mensagem || '—'}</span>
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.acao }}>
                              <div className="inline-flex items-center gap-1">
                                {lote.rows.some((r) => !r.corrigido_em) && (
                                  <button
                                    type="button"
                                    onClick={() => abrirModalReenviar(lote)}
                                    className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                                    title="Reenviar mensagem no WhatsApp"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                                <button type="button" onClick={() => setHistoricoDetailRow(lote)} className="p-1.5 rounded text-gray-600 hover:bg-gray-100" title="Ver detalhes do lote">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirModalExcluirHistorico(lote)}
                                  disabled={historicoDeletingId != null && lote.rows.some((r) => r.id === historicoDeletingId)}
                                  className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir todo o lote"
                                >
                                  {historicoDeletingId != null && lote.rows.some((r) => r.id === historicoDeletingId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      : historicoFiltro === 'sla' && !historicoSlaVerPorLote
                        ? (historicoDisplayList as HistoricoSlaAgrupadoRow[]).map((g) => (
                          <tr key={g.key} className="border-b border-gray-100 hover:bg-slate-50/70">
                            <td className="py-2 px-3" style={{ width: historicoColWidths.sel }}>
                              {!g.corrigido_em && (
                                <input
                                  type="checkbox"
                                  checked={selectedReenviar.has(g.key)}
                                  onChange={() => toggleReenviarSelection(g.key)}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  title="Selecionar para reenviar em lote"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.status }}>
                              {g.corrigido_em ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800" title="Lead atualizado no RD">
                                  Atualizado no RD
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Aguardando atualização no RD">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-gray-800 font-medium" style={{ width: historicoColWidths.qtd_envios }} title="Quantas vezes já enviei a mensagem">
                              {g.qtd_envios}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" style={{ width: historicoColWidths.primeiro_envio }} title="Data do primeiro envio">
                              {new Date(g.primeira_vez_enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" style={{ width: historicoColWidths.ultimo_envio }} title="Data do último envio">
                              {new Date(g.ultima_vez_enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.tempo_sem_resolucao }}>
                              {g.tempo_sem_resolucao_dias != null ? (
                                <span className="text-amber-700 font-medium" title="Dias desde o primeiro envio sem resolução">
                                  {g.tempo_sem_resolucao_dias === 0 ? '< 1 dia' : g.tempo_sem_resolucao_dias === 1 ? '1 dia' : `${g.tempo_sem_resolucao_dias} dias`}
                                </span>
                              ) : g.tempo_minutos != null ? (
                                <span className="text-emerald-700 text-xs">Resolvido</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-800 truncate" style={{ width: historicoColWidths.lead }} title={g.id_registro || ''}>
                              {g.deal_id ? (
                                <a href={`https://crm.rdstation.com/app/deals/${g.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {g.id_registro || g.deal_id}
                                </a>
                              ) : (
                                g.id_registro || '—'
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-800">{g.telefone}</td>
                            <td className="py-2 px-3 text-gray-700 max-w-[160px]" title={g.email_solicitante || g.email_notificar || ''}>
                              {(() => {
                                const email = (g.email_solicitante || g.email_notificar || '').trim()
                                const member = email ? getTeamMember(email) : null
                                if (member) {
                                  return (
                                    <span className="inline-flex items-center gap-2">
                                      <img src={member.avatar} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                      <span className="truncate">{member.name}</span>
                                    </span>
                                  )
                                }
                                return email ? <span className="truncate">{email}</span> : '—'
                              })()}
                            </td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.etapa }}>{g.stage_name || '—'}</td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.mensagem }} title={g.mensagem}>
                              <span className="line-clamp-2">{g.mensagem || '—'}</span>
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.acao }}>
                              <div className="inline-flex items-center gap-1">
                                {!g.corrigido_em && (
                                  <button
                                    type="button"
                                    onClick={() => abrirModalReenviar(g)}
                                    className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                                    title="Reenviar mensagem no WhatsApp"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                                <button type="button" onClick={() => setHistoricoDetailRow(g)} className="p-1.5 rounded text-gray-600 hover:bg-gray-100" title="Ver detalhes (todos os envios)">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirModalExcluirHistorico(g)}
                                  disabled={historicoDeletingId != null && g.rows.some((r) => r.id === historicoDeletingId)}
                                  className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir todos os envios deste caso"
                                >
                                  {historicoDeletingId != null && g.rows.some((r) => r.id === historicoDeletingId) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      : historicoVerPorLote
                        ? (historicoDisplayList as HistoricoLoteRow[]).map((lote) => (
                            <tr key={lote.key} className="border-b border-gray-100 hover:bg-slate-50/70">
                              <td className="py-2 px-3" style={{ width: historicoColWidths.sel }}>
                                {lote.rows.some((r) => !r.corrigido_em) && (
                                  <input
                                    type="checkbox"
                                    checked={selectedReenviar.has(lote.key)}
                                    onChange={() => toggleReenviarSelection(lote.key)}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    title="Selecionar para reenviar em lote"
                                  />
                                )}
                              </td>
                              <td className="py-2 px-3" style={{ width: historicoColWidths.status }}>
                                {lote.corrigido_em ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800" title="Todos os leads do lote atualizados no RD">
                                    Atualizado no RD
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Algum lead do lote ainda pendente">
                                    {lote.rows.some((r) => r.corrigido_em) ? 'Parcial' : 'Pendente'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-gray-600 whitespace-nowrap" style={{ width: historicoColWidths.enviado_em }} title="Data/hora do envio no WhatsApp">
                                {new Date(lote.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2 px-3 text-gray-600 whitespace-nowrap" title="Quando todos os leads do lote foram corrigidos">
                                {lote.corrigido_em ? new Date(lote.corrigido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="py-2 px-3" style={{ width: historicoColWidths.tempo }}>
                                {lote.rows.every((r) => r.tempo_minutos != null) && lote.rows.length > 0 ? (
                                  <span className="text-emerald-700 font-medium text-xs">Resolvido</span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-medium text-gray-800" style={{ width: historicoColWidths.lead }} title={lote.rows.map((r) => r.id_registro || '—').join(', ')}>
                                <span className="text-primary">{lote.qtd_leads} lead{lote.qtd_leads !== 1 ? 's' : ''}</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-gray-800">{lote.telefone}</td>
                              <td className="py-2 px-3 text-gray-700 max-w-[160px]" title={lote.email_solicitante || lote.email_notificar || ''}>
                                {(() => {
                                  const email = (lote.email_solicitante || lote.email_notificar || '').trim()
                                  const member = email ? getTeamMember(email) : null
                                  if (member) {
                                    return (
                                      <span className="inline-flex items-center gap-2">
                                        <img src={member.avatar} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                        <span className="truncate">{member.name}</span>
                                      </span>
                                    )
                                  }
                                  return email ? <span className="truncate">{email}</span> : '—'
                                })()}
                              </td>
                              <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.etapa }}>{lote.stage_name || '—'}</td>
                              <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.mensagem }} title={lote.mensagem}>
                                <span className="line-clamp-2">{lote.mensagem || '—'}</span>
                              </td>
                              <td className="py-2 px-3" style={{ width: historicoColWidths.acao }}>
                                <div className="inline-flex items-center gap-1">
                                  {lote.rows.some((r) => !r.corrigido_em) && (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalReenviar(lote)}
                                      className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                                      title="Reenviar mensagem no WhatsApp"
                                    >
                                      <Send className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button type="button" onClick={() => setHistoricoDetailRow(lote)} className="p-1.5 rounded text-gray-600 hover:bg-gray-100" title="Ver detalhes do lote">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => abrirModalExcluirHistorico(lote)}
                                    disabled={historicoDeletingId != null && lote.rows.some((r) => r.id === historicoDeletingId)}
                                    className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Excluir todo o lote"
                                  >
                                    {historicoDeletingId != null && lote.rows.some((r) => r.id === historicoDeletingId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        : (historicoFiltrado as HistoricoWppRow[]).map((h) => (
                          <tr key={h.id} className="border-b border-gray-100 hover:bg-slate-50/70">
                            <td className="py-2 px-3" style={{ width: historicoColWidths.sel }}>
                              {!h.corrigido_em && (
                                <input
                                  type="checkbox"
                                  checked={selectedReenviar.has(h.id)}
                                  onChange={() => toggleReenviarSelection(h.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  title="Selecionar para reenviar em lote"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.status }}>
                              {h.corrigido_em ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800" title="Lead atualizado no RD (validação detectou correção)">
                                  Atualizado no RD
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Aguardando atualização no RD">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" style={{ width: historicoColWidths.enviado_em }} title="Data/hora do envio no WhatsApp">
                              {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap" title="Quando a validação detectou o lead OK no RD">
                              {h.corrigido_em ? new Date(h.corrigido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.tempo }}>
                              {h.tempo_minutos != null ? (
                                <span className="text-emerald-700 font-medium" title={`${h.tempo_minutos} min entre envio e atualização no RD`}>
                                  {h.tempo_minutos < 60 ? `${h.tempo_minutos} min` : h.tempo_minutos < 1440 ? `${Math.floor(h.tempo_minutos / 60)}h ${h.tempo_minutos % 60}min` : `${Math.floor(h.tempo_minutos / 1440)}d`}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-800 truncate" style={{ width: historicoColWidths.lead }} title={h.id_registro || ''}>
                              {h.deal_id ? (
                                <a href={`https://crm.rdstation.com/app/deals/${h.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {h.id_registro || h.deal_id}
                                </a>
                              ) : (
                                h.id_registro || '—'
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-800">{h.telefone}</td>
                            <td className="py-2 px-3 text-gray-700 max-w-[160px]" title={h.email_solicitante || h.email_notificar || ''}>
                              {(() => {
                                const email = (h.email_solicitante || h.email_notificar || '').trim()
                                const member = email ? getTeamMember(email) : null
                                if (member) {
                                  return (
                                    <span className="inline-flex items-center gap-2">
                                      <img src={member.avatar} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                      <span className="truncate">{member.name}</span>
                                    </span>
                                  )
                                }
                                return email ? <span className="truncate">{email}</span> : '—'
                              })()}
                            </td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.etapa }}>{h.stage_name || '—'}</td>
                            <td className="py-2 px-3 text-gray-600 truncate" style={{ width: historicoColWidths.mensagem }} title={h.mensagem}>
                              <span className="line-clamp-2">{h.mensagem || '—'}</span>
                            </td>
                            <td className="py-2 px-3" style={{ width: historicoColWidths.acao }}>
                              <div className="inline-flex items-center gap-1">
                                {!h.corrigido_em && (
                                  <button
                                    type="button"
                                    onClick={() => abrirModalReenviar(h)}
                                    className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                                    title="Reenviar mensagem no WhatsApp"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                                <button type="button" onClick={() => setHistoricoDetailRow(h)} className="p-1.5 rounded text-gray-600 hover:bg-gray-100" title="Ver detalhes">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirModalExcluirHistorico(h)}
                                  disabled={historicoDeletingId === h.id}
                                  className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir registro do histórico"
                                >
                                  {historicoDeletingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {supabase && historicoWpp.length > 0 && (
            <p className="text-xs text-gray-500 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
              {historicoFiltro === 'sla'
                ? historicoSlaVerPorLote
                  ? `${historicoDisplayList.length} lote(s) (SLA). Cada linha = um envio no grupo (vários leads). "Leads" = quantos leads na mensagem.`
                  : `${historicoDisplayList.length} caso(s) (SLA). Cada linha = um lead; "Qtd envios" = quantas vezes já enviei; "Tempo sem resolução" = dias desde o primeiro envio.`
                : historicoVerPorLote
                  ? `${historicoDisplayList.length} lote(s) Correção (Validação). Cada linha = um envio no grupo (vários leads). "Leads" = quantos leads na mensagem.`
                  : `${historicoFiltrado.length} registro(s) Correção (Validação). "Corrigido" = validação passou a considerar o lead OK.`}
              {historicoFiltro === 'sla' && ' "Atualizado no RD" = lead saiu da lista de fora do SLA.'}
            </p>
          )}
        </div>
      )}

      {/* Modal Detalhes do histórico */}
      {historicoDetailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="historico-detail-title">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary text-white">
              <h2 id="historico-detail-title" className="font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                {'isLote' in historicoDetailRow && historicoDetailRow.isLote
                  ? 'Detalhes do lote'
                  : 'rows' in historicoDetailRow
                    ? 'Detalhes do caso (SLA)'
                    : 'Detalhes do registro'}
              </h2>
              <button type="button" onClick={() => setHistoricoDetailRow(null)} className="p-1.5 rounded-lg hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-sm">
              {'isLote' in historicoDetailRow && historicoDetailRow.isLote ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Enviado no WhatsApp em</span>
                      {new Date(historicoDetailRow.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Leads no lote</span>
                      <span className="font-semibold text-primary">{historicoDetailRow.qtd_leads}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Status</span>
                      {historicoDetailRow.corrigido_em ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Todos atualizados no RD</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          {historicoDetailRow.rows.some((r) => r.corrigido_em) ? 'Parcial' : 'Pendente'}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Telefone</span>
                      <span className="font-mono">{historicoDetailRow.telefone}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-medium mb-2">Mensagem enviada</span>
                    <pre className="p-3 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap break-words text-xs line-clamp-6">{historicoDetailRow.mensagem || '—'}</pre>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-medium mb-2">Leads deste lote ({historicoDetailRow.rows.length})</span>
                    <ul className="space-y-2 max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                      {historicoDetailRow.rows.map((r, i) => (
                        <li key={r.id} className="p-3 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-800">
                              {r.deal_id ? (
                                <a href={`https://crm.rdstation.com/app/deals/${r.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {r.id_registro || r.deal_id}
                                </a>
                              ) : (
                                r.id_registro || '—'
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{r.stage_name || '—'}</p>
                          </div>
                          <span className={r.corrigido_em ? 'text-emerald-700 text-xs font-medium' : 'text-amber-700 text-xs font-medium'}>
                            {r.corrigido_em ? `Corrigido em ${new Date(r.corrigido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Pendente'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : 'rows' in historicoDetailRow ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Status</span>
                      {historicoDetailRow.corrigido_em ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Atualizado no RD</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pendente</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Qtd envios</span>
                      <span className="font-semibold text-primary">{historicoDetailRow.qtd_envios}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Primeiro envio</span>
                      {new Date(historicoDetailRow.primeira_vez_enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Último envio</span>
                      {new Date(historicoDetailRow.ultima_vez_enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Tempo sem resolução</span>
                      {historicoDetailRow.tempo_sem_resolucao_dias != null ? (
                        <span className="text-amber-700 font-medium">
                          {historicoDetailRow.tempo_sem_resolucao_dias === 0 ? '< 1 dia' : historicoDetailRow.tempo_sem_resolucao_dias === 1 ? '1 dia' : `${historicoDetailRow.tempo_sem_resolucao_dias} dias`}
                        </span>
                      ) : historicoDetailRow.tempo_minutos != null ? (
                        <span className="text-emerald-700">Resolvido em {historicoDetailRow.tempo_minutos < 60 ? `${historicoDetailRow.tempo_minutos} min` : historicoDetailRow.tempo_minutos < 1440 ? `${Math.floor(historicoDetailRow.tempo_minutos / 60)}h` : `${Math.floor(historicoDetailRow.tempo_minutos / 1440)}d`}</span>
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 block text-xs font-medium">Lead</span>
                      {historicoDetailRow.deal_id ? (
                        <a href={`https://crm.rdstation.com/app/deals/${historicoDetailRow.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {historicoDetailRow.id_registro || historicoDetailRow.deal_id}
                        </a>
                      ) : (
                        historicoDetailRow.id_registro || '—'
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Telefone</span>
                      <span className="font-mono">{historicoDetailRow.telefone}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Responsável</span>
                      {(() => {
                        const email = (historicoDetailRow.email_solicitante || historicoDetailRow.email_notificar || '').trim()
                        const member = email ? getTeamMember(email) : null
                        return member ? <span className="inline-flex items-center gap-2"><img src={member.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />{member.name}</span> : email || '—'
                      })()}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Etapa</span>
                      {historicoDetailRow.stage_name || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-medium mb-2">Histórico de envios ({historicoDetailRow.rows.length})</span>
                    <ul className="space-y-2 max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                      {historicoDetailRow.rows.map((r, i) => (
                        <li key={r.id} className="p-3 bg-gray-50/50">
                          <p className="text-xs text-gray-500 font-medium">
                            Envio {i + 1} — {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                          <pre className="mt-1 text-gray-800 whitespace-pre-wrap break-words text-xs line-clamp-3">{r.mensagem || '—'}</pre>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Status</span>
                      {historicoDetailRow.corrigido_em ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Atualizado no RD</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pendente</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Enviado no WhatsApp em</span>
                      {new Date(historicoDetailRow.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">{historicoFiltro === 'validacao' ? 'Corrigido em' : 'Atualizado no RD em'}</span>
                      {historicoDetailRow.corrigido_em ? new Date(historicoDetailRow.corrigido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Tempo</span>
                      {historicoDetailRow.tempo_minutos != null ? (historicoDetailRow.tempo_minutos < 60 ? `${historicoDetailRow.tempo_minutos} min` : historicoDetailRow.tempo_minutos < 1440 ? `${Math.floor(historicoDetailRow.tempo_minutos / 60)}h ${historicoDetailRow.tempo_minutos % 60}min` : `${Math.floor(historicoDetailRow.tempo_minutos / 1440)}d`) : '—'}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 block text-xs font-medium">Lead</span>
                      {historicoDetailRow.deal_id ? (
                        <a href={`https://crm.rdstation.com/app/deals/${historicoDetailRow.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {historicoDetailRow.id_registro || historicoDetailRow.deal_id}
                        </a>
                      ) : (
                        historicoDetailRow.id_registro || '—'
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Telefone</span>
                      <span className="font-mono">{historicoDetailRow.telefone}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Responsável</span>
                      {(() => {
                        const email = (historicoDetailRow.email_solicitante || historicoDetailRow.email_notificar || '').trim()
                        const member = email ? getTeamMember(email) : null
                        if (member) return <span className="inline-flex items-center gap-2"><img src={member.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />{member.name}</span>
                        return email || '—'
                      })()}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Etapa</span>
                      {historicoDetailRow.stage_name || '—'}
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs font-medium">Funil</span>
                      {historicoDetailRow.funil || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-medium mb-1">Mensagem</span>
                    <pre className="p-3 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap break-words max-h-48 overflow-y-auto border border-gray-100">
                      {historicoDetailRow.mensagem || '—'}
                    </pre>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setHistoricoDetailRow(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação excluir histórico (identidade visual do sistema) */}
      {historicoDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="historico-delete-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="bg-primary text-white px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="" className="h-10 w-10 object-contain flex-shrink-0" />
                <div>
                  <h2 id="historico-delete-title" className="font-semibold text-lg">
                    {historicoDeleteConfirm.ids && historicoDeleteConfirm.ids.length > 1
                      ? `Excluir todos os ${historicoDeleteConfirm.ids.length} envios deste caso?`
                      : 'Excluir registro do histórico?'}
                  </h2>
                  <p className="text-white/90 text-sm mt-0.5">
                    Esta ação não desfaz o envio no WhatsApp. O(s) registro(s) será(ão) removido(s) apenas da lista.
                  </p>
                </div>
              </div>
              {historicoDeleteConfirm.id_registro && (
                <p className="text-white/80 text-sm">
                  Lead: <strong>{historicoDeleteConfirm.id_registro}</strong>
                </p>
              )}
            </div>
            <div className="p-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={() => setHistoricoDeleteConfirm(null)}
                className="px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluirHistorico}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reenviar em lote */}
      {reenviarLoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reenviar-lote-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className={`px-6 pt-6 pb-4 ${reenviarLoteProgress ? 'bg-gray-100' : 'bg-emerald-600 text-white'}`}>
              <h2 id="reenviar-lote-title" className="font-semibold text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                {reenviarLoteProgress ? 'Enviando...' : 'Reenviar em lote'}
              </h2>
              {!reenviarLoteProgress ? (
                <p className="text-white/90 text-sm mt-2">
                  Será enviada <strong>uma mensagem por número</strong> de telefone, com a lista de todos os leads pendentes daquele número (como nos envios em lote). {selectedReenviarItems.length} lead(s) selecionado(s). Deseja continuar?
                </p>
              ) : (
                <p className="text-gray-700 text-sm mt-2">
                  {reenviarLoteProgress.atual < reenviarLoteProgress.total ? (
                    <>Enviando {reenviarLoteProgress.atual} de {reenviarLoteProgress.total}...</>
                  ) : (
                    <>Concluído: <strong>{reenviarLoteProgress.enviados}</strong> enviados{reenviarLoteProgress.falhas > 0 ? <>, <strong>{reenviarLoteProgress.falhas}</strong> falhas</> : null}.</>
                  )}
                </p>
              )}
            </div>
            <div className="p-6 flex flex-col sm:flex-row gap-3 justify-end">
              {!reenviarLoteProgress ? (
                <>
                  <button
                    type="button"
                    onClick={fecharReenviarLoteModal}
                    className="px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => { enviarReenviarLote(); }}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar {selectedReenviarNumNumeros} mensagem(ns) (1 por número)
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={fecharReenviarLoteModal}
                  className="px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Reenviar mensagem (do histórico, pendentes) */}
      {reenviarRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reenviar-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-emerald-600 text-white">
              <h2 id="reenviar-modal-title" className="font-semibold flex items-center gap-2">
                <Send className="h-5 w-5" />
                Reenviar mensagem no WhatsApp
              </h2>
              <button type="button" onClick={fecharModalReenviar} className="p-1.5 rounded-lg hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Lead: <strong>{reenviarRow.id_registro || '—'}</strong>
                {reenviarRow.stage_name && <> · {reenviarRow.stage_name}</>}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número (DDD + celular)</label>
                <input
                  type="tel"
                  value={reenviarNumber}
                  onChange={(e) => setReenviarNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="11999999999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem (pode editar)</label>
                <textarea
                  value={reenviarMessage}
                  onChange={(e) => setReenviarMessage(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                />
              </div>
              {reenviarError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {reenviarError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button type="button" onClick={fecharModalReenviar} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviarReenviar}
                disabled={reenviarSending || !reenviarNumber.trim() || !reenviarMessage.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {reenviarSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Reenviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar no WhatsApp */}
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
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número (DDD + celular, ex. 11999999999)</label>
                <input
                  type="tel"
                  value={wppNumber}
                  onChange={(e) => setWppNumber(e.target.value)}
                  placeholder="5511999999999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={wppMessage}
                  onChange={(e) => setWppMessage(e.target.value)}
                  rows={8}
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
                    Enviar
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
