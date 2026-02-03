/**
 * Aba "Leads fora do SLA": exibe leads do Funil de vendas parados na mesma etapa
 * há mais de 10 dias. Usa tempo desde última atualização (ou criação) como proxy
 * para "tempo na etapa". Dados da mesma API validar-sheets.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { Clock, Loader2, AlertCircle, RefreshCw, ExternalLink, FileSpreadsheet, User, MessageCircle, X, Filter, History } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { getTeamMember, getSolicitanteKey } from '@/data/teamAvatars'
import { supabase } from '@/lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'crm-bp-google-oauth'
const SESSION_ID_KEY = 'crm-bp-google-session-id'
const RD_CRM_DEAL_URL = 'https://crm.rdstation.com/app/deals/'
const PLANILHA_ID = import.meta.env.VITE_PLANILHA_ID || '14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI'
const PLANILHA_ABA = import.meta.env.VITE_PLANILHA_ABA || ''
const SLA_DIAS = 10

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
  dias_desde_atualizacao?: number | null
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
  const dias = r.dias_desde_atualizacao != null ? String(r.dias_desde_atualizacao) : '—'
  const linkRd = opts?.rdDealUrl ?? (r.deal_id ? `${RD_CRM_DEAL_URL}${r.deal_id}` : '')
  const gestor = opts?.gestorLabel ?? ''

  let msg = 'Olá,\n\n'
  msg += '⏱️ *Lead fora do SLA*\n\n'
  msg += '📋 *Lead:* *' + lead + '*\n'
  msg += '📍 *Etapa:* ' + etapa + '\n'
  msg += '⏳ *Dias na etapa:* ' + dias + ' dias (limite: ' + SLA_DIAS + ' dias)\n\n'
  if (linkRd) msg += '🔗 *Link no CRM:*\n' + linkRd + '\n\n'
  if (gestor) msg += '👤 *Gestor da negociação:* ' + gestor + '\n\n'
  msg += 'Por favor, atualize a negociação no CRM.'
  return msg
}

const DIAS_ALERTA_FOGO = 90

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
      const dias = r.dias_desde_atualizacao != null ? r.dias_desde_atualizacao : 0
      const etapa = (r.stage_name || '—').replace(/\*/g, '')
      const foginho = dias >= DIAS_ALERTA_FOGO ? '🔥 ' : ''
      msg += (i + 1) + '. ' + foginho + lead + ' — ' + dias + 'd (' + etapa + ')\n'
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
  const [wppModalBatch, setWppModalBatch] = useState<ResultRow[] | null>(null)
  const [wppNumber, setWppNumber] = useState('')
  const [wppMessage, setWppMessage] = useState('')
  const [wppSending, setWppSending] = useState(false)
  const [wppError, setWppError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ atual: number; total: number } | null>(null)

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

  useEffect(() => {
    if (accessToken && PLANILHA_ID.trim()) {
      handleCarregar()
    }
  }, [accessToken, handleCarregar])

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
        if (error || !row?.access_token) {
          setSessionRestoreAttempted(true)
          return
        }
        const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
        if (expiresAt <= Date.now() - TOKEN_GRACE_MS) {
          setSessionRestoreAttempted(true)
          return
        }
        setAccessToken(row.access_token)
        saveToken(row.access_token, Math.max(0, Math.round((expiresAt - Date.now()) / 1000)))
      })
    void Promise.resolve(chain).finally(() => setSessionRestoreAttempted(true))
  }, [accessToken])

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

  const results = data?.results ?? []
  const foraDoSla = useMemo(
    () =>
      results.filter((r) => {
        if (!isFunilDeVendas(r.funil)) return false
        if (!isOngoing(r.status)) return false
        if (isPaused(r.status)) return false
        const dias = r.dias_desde_atualizacao
        return dias != null && dias > SLA_DIAS
      }),
    [results]
  )

  // Marcar "atualizado no RD" em histórico SLA quando o lead sair da lista fora do SLA
  useEffect(() => {
    const db = supabase
    if (!db || !data?.results?.length) return
    const foraDoSlaKeys = new Set(foraDoSla.map((r) => `${PLANILHA_ID}|${PLANILHA_ABA ?? ''}|${r.rowIndex}`))
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
          const key = `${row.planilha_id ?? ''}|${row.nome_aba ?? ''}|${row.row_index ?? ''}`
          const aindaForaSla = foraDoSlaKeys.has(key) || (row.id_registro && foraDoSlaIdRegistros.has((row.id_registro || '').trim()))
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
        const dias = r.dias_desde_atualizacao
        return dias == null
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
          Negociações do <strong>Funil de vendas</strong> paradas na mesma etapa há mais de{' '}
          <strong>{SLA_DIAS} dias</strong>. Critério: tempo desde a última atualização (ou criação do registro).
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
                &gt; {SLA_DIAS} dias na etapa (Funil de vendas)
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
                Todos os leads em andamento do Funil de vendas estão dentro do prazo de {SLA_DIAS} dias.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Certifique-se de que a planilha possui colunas de data (ex.: &quot;Data de atualização&quot;,
                &quot;Última atualização&quot;, &quot;Data de criação&quot;) mapeadas para o cálculo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  {foraDoSlaFiltered.length} lead{foraDoSlaFiltered.length !== 1 ? 's' : ''} fora do SLA
                  {(filterSolicitante || filterSearch || filterEtapa) ? ' (filtrado)' : ''}
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
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="w-10 py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={foraDoSlaFiltered.length > 0 && selectedIds.size === foraDoSlaFiltered.length}
                            onChange={(e) => e.target.checked ? selectAllFiltered() : clearSelection()}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Etapa</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Solicitante</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Dias na etapa</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Última atualização</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {foraDoSlaFiltered.map((r) => {
                      const email = (r.email_solicitante ?? r.email_notificar ?? '').trim()
                      const member = email ? getTeamMember(email) : null
                      const refDate = r.updated_at_iso || r.created_at_iso
                      const refFmt = refDate
                        ? new Date(refDate).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : '—'
                      const key = rowKey(r)
                      return (
                        <tr key={key} className="hover:bg-gray-50/50">
                          <td className="w-10 py-3 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(key)}
                              onChange={() => toggleSelect(key)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="py-3 px-4 text-gray-800 font-medium">{r.id_registro || '—'}</td>
                          <td className="py-3 px-4 text-gray-600">{r.stage_name || '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {member?.avatar && (
                                <img
                                  src={member.avatar}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover bg-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              )}
                              <div>
                                <span className="text-gray-800">{(member?.name ?? email) || '—'}</span>
                                {member?.tag && (
                                  <span className="ml-1.5 text-xs text-gray-500">({member.tag})</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-amber-700">
                              {r.dias_desde_atualizacao != null ? r.dias_desde_atualizacao : '—'} dias
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{refFmt}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {r.deal_id && (
                                <a
                                  href={`${RD_CRM_DEAL_URL}${r.deal_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-sm"
                                >
                                  Abrir no CRM
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => openWppModal(r)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-sm font-medium"
                                title="Enviar notificação de SLA no WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Enviar no WhatsApp
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    </tbody>
                  </table>
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
                {wppModalRow.dias_desde_atualizacao != null && (
                  <> · <span className="text-amber-600">{wppModalRow.dias_desde_atualizacao} dias na etapa</span></>
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
