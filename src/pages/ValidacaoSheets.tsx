import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Filter, User, RefreshCw, ExternalLink, MessageCircle, X, History, Search, XCircle, ChevronDown } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { getTeamMember, getSolicitanteKey } from '@/data/teamAvatars'
import { supabase } from '@/lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'crm-bp-google-oauth'
const SESSION_ID_KEY = 'crm-bp-google-session-id'
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'
const PLANILHA_ID = import.meta.env.VITE_PLANILHA_ID || '14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI'
const PLANILHA_ABA = import.meta.env.VITE_PLANILHA_ABA || ''

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

type HistoricoWppRow = {
  id: string
  created_at: string
  telefone: string
  mensagem: string
  id_registro: string | null
  email_notificar: string | null
  email_solicitante: string | null
  stage_name: string | null
  funil: string | null
  deal_id: string | null
  planilha_id: string | null
  nome_aba: string | null
  corrigido_em: string | null
  tempo_minutos: number | null
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

  // Aba Histórico de envios WhatsApp
  const [abaAtiva, setAbaAtiva] = useState<'validacao' | 'historico_wpp'>('validacao')
  const [historicoWpp, setHistoricoWpp] = useState<HistoricoWppRow[]>([])
  const [historicoWppLoading, setHistoricoWppLoading] = useState(false)
  const [historicoWppError, setHistoricoWppError] = useState<string | null>(null)

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
      .select('id, created_at, telefone, mensagem, id_registro, email_notificar, email_solicitante, stage_name, funil, deal_id, planilha_id, nome_aba, corrigido_em, tempo_minutos')
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
        .select('id, created_at, telefone, mensagem, id_registro, email_notificar, email_solicitante, stage_name, funil, deal_id, planilha_id, nome_aba, corrigido_em, tempo_minutos')
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
      const buscarPorLinha = () =>
        db
          .from('historico_envio_whatsapp')
          .select('id, created_at')
          .eq('planilha_id', PLANILHA_ID || '')
          .eq('nome_aba', PLANILHA_ABA ?? '')
          .eq('row_index', r.rowIndex)
          .is('corrigido_em', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

      const buscarPorIdRegistro = () =>
        db
          .from('historico_envio_whatsapp')
          .select('id, created_at')
          .eq('id_registro', String(r.id_registro ?? '').trim())
          .is('corrigido_em', null)
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
  }, [accessToken])

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
            A validação usa <strong>funil</strong> e <strong>stage_name</strong>. No <strong>Funil de vendas</strong>, todas as linhas são validadas (cadastro do lead: solicitante, e-mail, razão social, CNPJ, áreas, etc.). Na etapa <strong>Confecção de proposta</strong> também são exigidos: Nome completo do ponto focal/comercial (nome + sobrenome), e-mail válido e telefone (10–11 dígitos). Stages desconsiderados: Contato Inicial, Contato feito, Contato Trimestral, Descartados, Mensagem Enviada, Suspenso, Lead Quente, Contato Mensal, Lead Capturado. Status: Won = ganho, Lost = perda.
          </p>
        </>
      )}
        </>
      )}

      {abaAtiva === 'historico_wpp' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 bg-slate-50/50">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de envios WhatsApp
            </h2>
            <button
              type="button"
              onClick={recarregarHistoricoWpp}
              disabled={historicoWppLoading}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
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
              ) : historicoWpp.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  Nenhum envio registrado ainda. Os envios feitos pela Validação aparecerão aqui.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-700 text-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-semibold w-36">Data / Hora</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[120px]">Telefone</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[120px]">Lead</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[160px]">E-mail</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[140px]">Etapa</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[100px]">Funil</th>
                      <th className="text-left py-2.5 px-3 font-semibold min-w-[180px]">Mensagem</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-32">Corrigido em</th>
                      <th className="text-left py-2.5 px-3 font-semibold w-24">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoWpp.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-slate-50/70">
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-800">{h.telefone}</td>
                        <td className="py-2 px-3 font-medium text-gray-800 max-w-[120px] truncate" title={h.id_registro || ''}>
                          {h.id_registro || '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-700 max-w-[160px] truncate" title={h.email_notificar || h.email_solicitante || ''}>
                          {h.email_notificar || h.email_solicitante || '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{h.stage_name || '—'}</td>
                        <td className="py-2 px-3 text-gray-600 text-xs">{h.funil || '—'}</td>
                        <td className="py-2 px-3 text-gray-600 max-w-[180px]" title={h.mensagem}>
                          <span className="line-clamp-2">{h.mensagem || '—'}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {h.corrigido_em
                            ? new Date(h.corrigido_em).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {h.tempo_minutos != null ? (
                            <span className="text-emerald-700 font-medium" title={`${h.tempo_minutos} min até corrigir`}>
                              {h.tempo_minutos < 60
                                ? `${h.tempo_minutos} min`
                                : h.tempo_minutos < 1440
                                  ? `${Math.floor(h.tempo_minutos / 60)}h ${h.tempo_minutos % 60}min`
                                  : `${Math.floor(h.tempo_minutos / 1440)}d`}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
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
              {historicoWpp.length} registro(s). Ordenado do mais recente para o mais antigo.
            </p>
          )}
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
