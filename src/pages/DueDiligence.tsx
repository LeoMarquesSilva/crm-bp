/**
 * Página Due Diligence: listar leads incluídos, upload de planilhas por área,
 * marcar "não há processos", e gerar PowerPoint ao concluir todas as áreas.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import {
  FileCheck,
  Plus,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Building2,
  Cloud,
  Pencil,
  Trash2,
  Settings2,
  Search,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Scale,
  Briefcase,
  Landmark,
  Wallet,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  listDueDiligenceLeads,
  addDueDiligenceLead,
  updateDueDiligenceLead,
  deleteDueDiligenceLead,
  ensureAreasForLead,
  getAreasForLead,
  setAreaStatus,
  uploadDueDiligenceFile,
  updateAreaPresentationFields,
  uploadDueDiligenceFinalPptx,
  updateDueDiligenceLeadFinalPpt,
  updateLeadPptChartOptions,
} from '@/lib/due-diligence/api'
import { PostUploadTableModal, type PostUploadDraft } from '@/components/due-diligence/PostUploadTableModal'
import { AreaChartsPrefsModal, AreaProcessDetailModal } from '@/components/due-diligence/AreaPresentationModals'
import { parseExcelFile, validateParsedRows, extractHeadersFromExcel, suggestColumnMapping } from '@/lib/due-diligence/parseExcel'
import { readStructuralChartDefaults } from '@/lib/due-diligence/structuralChartDefaultsStorage'
import {
  buildDueDiligencePptx,
  DEFAULT_CHART_OPTIONS,
  normalizePptxChartOptions,
  PPTX_SLIDE_BLOCK_IDS,
  PPTX_SLIDE_BLOCK_LABELS,
  type PptxChartOptions,
} from '@/lib/due-diligence/buildPptx'
import { calcularTodasMetricas, calcularMetricasConsolidadas } from '@/lib/due-diligence/metrics'
import { buildAreaChartPreviewSlides } from '@/lib/due-diligence/areaChartPreviews'
import {
  DUE_DILIGENCE_AREAS,
  type DueDiligenceLead as DDLead,
  type DueDiligenceAreaRow,
  type DueDiligenceAreaId,
  type AreaChartOptionsPartial,
} from '@/lib/due-diligence/types'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || ''
const API = (path: string) => `${API_BASE}/api${path}`
const DRIVE_TOKEN_KEY = 'crm-bp-google-drive-token'

const AREA_ICONS: Record<string, typeof Scale> = {
  civel: Scale,
  trabalhista: Briefcase,
  tributario: Landmark,
  recuperacao_creditos: Wallet,
  reestruturacao: RefreshCw,
}
const DRIVE_EXPIRES_KEY = 'crm-bp-google-drive-expires'

function getStoredDriveToken(): string | null {
  try {
    const exp = localStorage.getItem(DRIVE_EXPIRES_KEY)
    if (exp && Date.now() > parseInt(exp, 10)) return null
    return localStorage.getItem(DRIVE_TOKEN_KEY)
  } catch {
    return null
  }
}

function saveDriveToken(accessToken: string, expiresInSeconds: number) {
  try {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    localStorage.setItem(DRIVE_TOKEN_KEY, accessToken)
    localStorage.setItem(DRIVE_EXPIRES_KEY, String(expiresAt))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Normaliza CNPJ removendo não-dígitos */
function normalizeCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return ''
  return cnpj.replace(/\D/g, '')
}

/** Valida formato do CNPJ (14 dígitos) */
function isValidCnpjFormat(cnpj: string | null | undefined): boolean {
  const n = normalizeCnpj(cnpj)
  if (!n) return true
  return n.length === 14 && /^\d{14}$/.test(n)
}

function areaReadyForPpt(a: DueDiligenceAreaRow): boolean {
  return a.status === 'done' || a.status === 'no_processes' || a.skipped_presentation === true
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Formata valor em reais */
function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function DueDiligence() {
  const [leads, setLeads] = useState<DDLead[]>([])
  const [selectedLead, setSelectedLead] = useState<DDLead | null>(null)
  const [areas, setAreas] = useState<DueDiligenceAreaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({ razao_social: '', cnpj: '', nome_lead: '' })
  const [adding, setAdding] = useState(false)
  const [editLead, setEditLead] = useState<DDLead | null>(null)
  const [editForm, setEditForm] = useState({ razao_social: '', cnpj: '', nome_lead: '' })
  const [updating, setUpdating] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<DDLead | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [areaToRemove, setAreaToRemove] = useState<{ areaRow: DueDiligenceAreaRow; label: string } | null>(null)
  const [removingArea, setRemovingArea] = useState(false)
  const [ddWorkspaceTab, setDdWorkspaceTab] = useState<'areas' | 'ppt'>('areas')
  const [pptDeckSaving, setPptDeckSaving] = useState(false)
  const CHART_OPTIONS_KEY = 'crm-bp-ppt-chart-options'
  const [chartOptions, setChartOptions] = useState<PptxChartOptions>(() => normalizePptxChartOptions())

  useEffect(() => {
    try {
      localStorage.setItem(CHART_OPTIONS_KEY, JSON.stringify(chartOptions))
    } catch {
      /* ignore */
    }
  }, [chartOptions])
  const [uploadingArea, setUploadingArea] = useState<DueDiligenceAreaId | null>(null)
  const [postUploadDraft, setPostUploadDraft] = useState<PostUploadDraft | null>(null)
  const [areaChartsFor, setAreaChartsFor] = useState<DueDiligenceAreaRow | null>(null)
  const [areaDetailFor, setAreaDetailFor] = useState<DueDiligenceAreaRow | null>(null)
  const [generating, setGenerating] = useState(false)
  const [creatingTest, setCreatingTest] = useState(false)
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => getStoredDriveToken())
  const [driveConnecting, setDriveConnecting] = useState(false)

  /** Lead de teste para usar com os Excel de exemplo (RICO INDUSTRIAL) */
  const TEST_LEAD = {
    razao_social: 'RICO INDUSTRIAL LTDA',
    cnpj: null as string | null,
    nome_lead: 'RICO INDUSTRIAL (teste)',
  }

  const loadLeads = useCallback(async () => {
    if (!supabase) {
      setError('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local. Execute também o SQL em supabase/migrations para criar as tabelas.')
      setLoading(false)
      return
    }
    setError(null)
    try {
      const data = await listDueDiligenceLeads()
      setLeads(data)
      if (selectedLead && !data.find((l) => l.id === selectedLead.id)) {
        setSelectedLead(null)
        setAreas([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apenas id importa para checar se lead ainda existe
  }, [selectedLead?.id])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const tryRefreshDriveToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(API('/google-oauth-refresh'), { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.access_token) return false
      const sec = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600
      saveDriveToken(json.access_token, sec)
      setDriveAccessToken(json.access_token)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const stored = getStoredDriveToken()
    if (stored) {
      setDriveAccessToken(stored)
      return
    }
    const db = supabase
    if (!db) return
    const run = async () => {
      const { data: row, error } = await db
        .from('sessoes_google')
        .select('access_token, expires_at')
        .eq('session_id', 'shared')
        .maybeSingle()
      if (error || !row?.access_token) return
      const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
      if (expiresAt > Date.now() - 60000) {
        const sec = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
        saveDriveToken(row.access_token, sec)
        setDriveAccessToken(row.access_token)
        return
      }
      await tryRefreshDriveToken()
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cliente supabase é estável
  }, [tryRefreshDriveToken])

  const loginDrive = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: async (codeResponse: { code?: string }) => {
      const code = codeResponse?.code
      if (!code) {
        setError('Resposta inválida do Google.')
        setDriveConnecting(false)
        return
      }
      setDriveConnecting(true)
      setError(null)
      try {
        const res = await fetch(API('/google-oauth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin,
            session_id: 'shared',
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.access_token) {
          setError(json.error || 'Não foi possível conectar o Google Drive.')
          setDriveConnecting(false)
          return
        }
        const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600
        saveDriveToken(json.access_token, expiresIn)
        setDriveAccessToken(json.access_token)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro de rede.'
        setError(`Erro ao conectar o Google Drive: ${msg}. Verifique se a API está rodando (npm run dev) e se GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão no .env.`)
      } finally {
        setDriveConnecting(false)
      }
    },
    onError: () => {
      setError('Não foi possível conectar o Google Drive.')
      setDriveConnecting(false)
    },
  })

  const loadAreas = useCallback(
    async (leadId: string) => {
      if (!supabase) return
      try {
        let list = await getAreasForLead(leadId)
        if (list.length < DUE_DILIGENCE_AREAS.length) {
          list = await ensureAreasForLead(leadId)
        }
        setAreas(list)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar áreas.')
      }
    },
    []
  )

  useEffect(() => {
    if (selectedLead) {
      loadAreas(selectedLead.id)
    } else {
      setAreas([])
    }
  }, [selectedLead, loadAreas])

  const leadPptOptsSerialized = useMemo(() => {
    if (!selectedLead) return ''
    return JSON.stringify(selectedLead.ppt_chart_options ?? null)
  }, [selectedLead?.id, selectedLead?.ppt_chart_options])

  useEffect(() => {
    setDdWorkspaceTab('areas')
  }, [selectedLead?.id])

  /** Hidrata opções globais do deck: banco (por lead) → localStorage → padrão */
  useEffect(() => {
    if (!selectedLead) return
    const raw = selectedLead.ppt_chart_options
    if (raw != null && typeof raw === 'object' && Object.keys(raw as object).length > 0) {
      setChartOptions(normalizePptxChartOptions(raw as Partial<PptxChartOptions>))
      return
    }
    try {
      const s = localStorage.getItem(CHART_OPTIONS_KEY)
      if (s) {
        setChartOptions(normalizePptxChartOptions(JSON.parse(s) as Partial<PptxChartOptions>))
        return
      }
    } catch {
      /* ignore */
    }
    setChartOptions(normalizePptxChartOptions())
  }, [selectedLead?.id, leadPptOptsSerialized])

  const savePptDeckToLead = async () => {
    if (!selectedLead || !supabase) return
    setPptDeckSaving(true)
    setError(null)
    try {
      const payload = JSON.parse(JSON.stringify(chartOptions)) as Record<string, unknown>
      const updated = await updateLeadPptChartOptions(selectedLead.id, payload)
      setSelectedLead(updated)
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      setSuccess('Configuração global do PowerPoint salva neste lead.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar configuração do PowerPoint.')
    } finally {
      setPptDeckSaving(false)
    }
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.razao_social.trim()) return
    const cnpjVal = addForm.cnpj.trim() || null
    if (cnpjVal) {
      if (!isValidCnpjFormat(cnpjVal)) {
        setError('CNPJ inválido. Informe 14 dígitos (com ou sem formatação).')
        return
      }
      const norm = normalizeCnpj(cnpjVal)
      if (leads.some((l) => l.cnpj && normalizeCnpj(l.cnpj) === norm)) {
        setError('Já existe um lead com este CNPJ.')
        return
      }
    }
    setAdding(true)
    setError(null)
    try {
      const lead = await addDueDiligenceLead({
        razao_social: addForm.razao_social.trim(),
        cnpj: cnpjVal,
        nome_lead: addForm.nome_lead.trim() || null,
      })
      setLeads((prev) => [lead, ...prev])
      setAddForm({ razao_social: '', cnpj: '', nome_lead: '' })
      setModalOpen(false)
      setSelectedLead(lead)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao incluir lead.')
    } finally {
      setAdding(false)
    }
  }

  const handleCreateTestLead = async () => {
    if (!supabase) return
    setCreatingTest(true)
    setError(null)
    try {
      const lead = await addDueDiligenceLead(TEST_LEAD)
      setLeads((prev) => [lead, ...prev])
      setSelectedLead(lead)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Erro ao criar lead de teste.'
      const details = e && typeof e === 'object' && 'details' in e ? String((e as { details?: string }).details) : ''
      const hint = e && typeof e === 'object' && 'hint' in e ? String((e as { hint?: string }).hint) : ''
      let full = [msg, details, hint].filter(Boolean).join(' — ')
      if (full.toLowerCase().includes('policy') || full.toLowerCase().includes('row-level security') || full.toLowerCase().includes('permission denied')) {
        full += ' Execute o SQL em supabase/migrations/20250313000001_due_diligence_rls.sql no Supabase.'
      }
      if (full.toLowerCase().includes('does not exist') || full.toLowerCase().includes('relation')) {
        full += ' Execute primeiro o SQL em supabase/migrations/20250313000000_due_diligence.sql no Supabase.'
      }
      setError(full)
    } finally {
      setCreatingTest(false)
    }
  }

  const handleOpenEdit = (lead: DDLead, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditLead(lead)
    setEditForm({
      razao_social: lead.razao_social,
      cnpj: lead.cnpj ?? '',
      nome_lead: lead.nome_lead ?? '',
    })
  }

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLead || !editForm.razao_social.trim()) return
    const cnpjVal = editForm.cnpj.trim() || null
    if (cnpjVal) {
      if (!isValidCnpjFormat(cnpjVal)) {
        setError('CNPJ inválido. Informe 14 dígitos (com ou sem formatação).')
        return
      }
      const norm = normalizeCnpj(cnpjVal)
      if (leads.some((l) => l.id !== editLead.id && l.cnpj && normalizeCnpj(l.cnpj) === norm)) {
        setError('Já existe outro lead com este CNPJ.')
        return
      }
    }
    setUpdating(true)
    setError(null)
    try {
      const updated = await updateDueDiligenceLead(editLead.id, {
        razao_social: editForm.razao_social.trim(),
        cnpj: cnpjVal,
        nome_lead: editForm.nome_lead.trim() || null,
      })
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      if (selectedLead?.id === updated.id) setSelectedLead(updated)
      setEditLead(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar lead.')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteLead = async () => {
    if (!leadToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteDueDiligenceLead(leadToDelete.id)
      setLeads((prev) => prev.filter((l) => l.id !== leadToDelete.id))
      if (selectedLead?.id === leadToDelete.id) {
        setSelectedLead(null)
        setAreas([])
      }
      setLeadToDelete(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir lead.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSetNoProcesses = async (areaRow: DueDiligenceAreaRow) => {
    if (!supabase) return
    try {
      await setAreaStatus(areaRow.id, 'no_processes', { skipped_presentation: false })
      setAreas((prev) =>
        prev.map((a) => (a.id === areaRow.id ? { ...a, status: 'no_processes' as const, skipped_presentation: false } : a))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar área.')
    }
  }

  const handleUnsetNoProcesses = async (areaRow: DueDiligenceAreaRow) => {
    if (!supabase) return
    try {
      await setAreaStatus(areaRow.id, 'pending', {
        file_name: null,
        file_url: null,
        parsed_data: null,
        skipped_presentation: false,
      })
      setAreas((prev) =>
        prev.map((a) =>
          a.id === areaRow.id
            ? {
                ...a,
                status: 'pending' as const,
                file_name: null,
                file_url: null,
                parsed_data: null,
                skipped_presentation: false,
              }
            : a
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao desmarcar área.')
    }
  }

  const handleToggleSkipPresentation = async (areaRow: DueDiligenceAreaRow) => {
    if (!supabase) return
    const next = !areaRow.skipped_presentation
    try {
      await updateAreaPresentationFields(areaRow.id, { skipped_presentation: next })
      setAreas((prev) => prev.map((a) => (a.id === areaRow.id ? { ...a, skipped_presentation: next } : a)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar área.')
    }
  }

  const handleRemoveReport = async () => {
    if (!areaToRemove || !supabase) return
    setRemovingArea(true)
    setError(null)
    try {
      await setAreaStatus(areaToRemove.areaRow.id, 'pending', {
        file_name: null,
        file_url: null,
        parsed_data: null,
        skipped_presentation: false,
      })
      setAreas((prev) =>
        prev.map((a) =>
          a.id === areaToRemove.areaRow.id
            ? {
                ...a,
                status: 'pending' as const,
                file_name: null,
                file_url: null,
                parsed_data: null,
                skipped_presentation: false,
              }
            : a
        )
      )
      setAreaToRemove(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover relatório.')
    } finally {
      setRemovingArea(false)
    }
  }

  const handleFileSelect = async (areaRow: DueDiligenceAreaRow, areaId: DueDiligenceAreaId, file: File) => {
    if (!selectedLead || !supabase) return
    const token = driveAccessToken || getStoredDriveToken()
    if (!token) {
      setError('Conecte o Google Drive para enviar planilhas (botão "Conectar Google Drive" acima).')
      return
    }
    setUploadingArea(areaId)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const headersResult = extractHeadersFromExcel(buffer)
      if (!headersResult.ok || !headersResult.data) {
        setError(headersResult.error || 'Erro ao ler planilha.')
        setUploadingArea(null)
        return
      }
      const suggested = suggestColumnMapping(headersResult.data.headers, areaId)
      const cleanMapping = Object.fromEntries(
        Object.entries(suggested).filter(([, v]) => v?.trim())
      ) as Record<string, string>
      const result = parseExcelFile(buffer, areaId, {
        columnMapping: Object.keys(cleanMapping).length ? cleanMapping : undefined,
      })
      if (!result.ok || !result.data) {
        setError(result.error || 'Erro ao ler planilha.')
        setUploadingArea(null)
        return
      }
      const validation = validateParsedRows(areaId, result.data.rows)
      if (!validation.valid) {
        setError(validation.message || 'Planilha inválida para esta área.')
        setUploadingArea(null)
        return
      }
      let fileUrl: string
      try {
        fileUrl = await uploadDueDiligenceFile(selectedLead.id, areaId, file, token)
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
        const isTokenError = /token|expirado|401|403|permissão/i.test(msg)
        if (isTokenError && (await tryRefreshDriveToken())) {
          const newToken = getStoredDriveToken()
          if (newToken) {
            fileUrl = await uploadDueDiligenceFile(selectedLead.id, areaId, file, newToken)
          } else {
            throw uploadErr
          }
        } else {
          throw uploadErr
        }
      }
      const parsedData = { rows: result.data.rows, columnMapping: result.data.columnMapping }
      setPostUploadDraft({
        areaRowId: areaRow.id,
        areaId,
        fileName: file.name,
        fileUrl,
        parsedData: parsedData as { rows: Record<string, unknown>[]; columnMapping: Record<string, string> },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no upload ou parse.')
    } finally {
      setUploadingArea(null)
    }
  }

  const allAreasComplete = areas.length === DUE_DILIGENCE_AREAS.length && areas.every(areaReadyForPpt)
  const areasCompleteCount = areas.filter(areaReadyForPpt).length

  const confirmPostUploadRows = async (rows: Record<string, unknown>[]) => {
    if (!postUploadDraft || !supabase) return
    const areaRow = areas.find((a) => a.id === postUploadDraft.areaRowId)
    if (!areaRow) return
    const parsedData = {
      rows,
      columnMapping: postUploadDraft.parsedData.columnMapping,
    }
    await setAreaStatus(areaRow.id, 'done', {
      file_name: postUploadDraft.fileName,
      file_url: postUploadDraft.fileUrl,
      parsed_data: parsedData as Record<string, unknown>,
      skipped_presentation: false,
    })
    setAreas((prev) =>
      prev.map((a) =>
        a.id === areaRow.id
          ? {
              ...a,
              status: 'done' as const,
              file_name: postUploadDraft.fileName,
              file_url: postUploadDraft.fileUrl,
              parsed_data: parsedData as Record<string, unknown>,
              skipped_presentation: false,
            }
          : a
      )
    )
    setPostUploadDraft(null)
  }

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads
    const q = leadSearch.toLowerCase().trim()
    return leads.filter(
      (l) =>
        l.razao_social.toLowerCase().includes(q) ||
        (l.cnpj && normalizeCnpj(l.cnpj).includes(q.replace(/\D/g, ''))) ||
        (l.nome_lead && l.nome_lead.toLowerCase().includes(q))
    )
  }, [leads, leadSearch])

  const previewMetricas = useMemo(() => {
    if (!allAreasComplete || !selectedLead) return null
    const areasMap = new Map<DueDiligenceAreaId, Record<string, unknown> | null>()
    for (const a of areas) {
      if (a.skipped_presentation) areasMap.set(a.area, null)
      else areasMap.set(a.area, a.parsed_data ?? null)
    }
    const todas = calcularTodasMetricas(areasMap)
    const consolidada = calcularMetricasConsolidadas(areasMap)
    return { ...todas, consolidada }
  }, [allAreasComplete, selectedLead, areas])

  const areaChartPreviewSlides = useMemo(() => {
    if (!areaChartsFor) return []
    const amap = new Map<DueDiligenceAreaId, Record<string, unknown> | null>()
    for (const a of areas) {
      if (a.skipped_presentation) amap.set(a.area, null)
      else amap.set(a.area, a.parsed_data ?? null)
    }
    const todas = calcularTodasMetricas(amap)
    return buildAreaChartPreviewSlides(areaChartsFor.area, todas, areaChartsFor)
  }, [areaChartsFor, areas])

  const processOptionsForDetail = useMemo(() => {
    if (!areaDetailFor?.parsed_data?.rows) return [] as { value: string; label: string }[]
    const rows = areaDetailFor.parsed_data.rows as Record<string, unknown>[]
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const r of rows) {
      const n = String(r.numero_processo ?? r.processo ?? '').trim()
      if (!n || seen.has(n)) continue
      seen.add(n)
      out.push({ value: n, label: n })
    }
    return out
  }, [areaDetailFor])

  const handleGeneratePptx = useCallback(async () => {
    if (!selectedLead || !allAreasComplete) return
    setGenerating(true)
    setError(null)
    setWarning(null)
    setSuccess(null)
    try {
      const areasMap = new Map<DueDiligenceAreaId, Record<string, unknown> | null>()
      for (const a of areas) {
        if (a.skipped_presentation) areasMap.set(a.area, null)
        else areasMap.set(a.area, a.parsed_data ?? null)
      }
      const metricas = calcularTodasMetricas(areasMap)
      const { buffer, fileName } = await buildDueDiligencePptx(selectedLead, areas, metricas, chartOptions, {
        download: false,
        structuralChartDefaults: readStructuralChartDefaults(),
      })
      if (typeof document !== 'undefined') {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      }
      let driveMsg = ''
      const token = driveAccessToken || getStoredDriveToken()
      if (token) {
        try {
          const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
          const safe = `${ts}_${fileName.replace(/\.pptx$/i, '')}.pptx`
          const b64 = arrayBufferToBase64(buffer)
          const { webViewLink, id } = await uploadDueDiligenceFinalPptx(selectedLead.id, selectedLead.razao_social, b64, safe, token)
          const updated = await updateDueDiligenceLeadFinalPpt(selectedLead.id, {
            final_ppt_url: webViewLink,
            final_ppt_file_id: id,
          })
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          setSelectedLead((prev) => (prev?.id === updated.id ? updated : prev))
          driveMsg = ` PPT final salvo no Google Drive (pasta Due Diligence).`
        } catch (driveErr) {
          setWarning(
            driveErr instanceof Error
              ? `${driveErr.message} O arquivo foi baixado localmente.`
              : 'Não foi possível enviar o PPT ao Drive; arquivo baixado localmente.'
          )
        }
      } else {
        setWarning('Google Drive não conectado: o PPT foi apenas baixado. Conecte o Drive para gravar na pasta Due Diligence.')
      }
      setSuccess(`PowerPoint gerado! "${fileName}" baixado.${driveMsg}`)
      setTimeout(() => setSuccess(null), 8000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PowerPoint.')
    } finally {
      setGenerating(false)
    }
  }, [selectedLead, areas, allAreasComplete, chartOptions, driveAccessToken])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-7 w-7 text-primary" />
            Due Diligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Inclua leads, envie as planilhas por área, marque &quot;não há processos&quot; ou &quot;pular na apresentação&quot;. Os arquivos vão ao Google Drive. Quando todas as áreas estiverem concluídas (ou sem dados/pular), gere o PowerPoint — o arquivo final também pode ser salvo na pasta Due Diligence no Drive.
          </p>
          {selectedLead && (
            <div className="mt-3 flex items-center gap-2">
              {driveAccessToken ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                  <Cloud className="h-4 w-4" />
                  Google Drive conectado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setDriveConnecting(true); loginDrive() }}
                  disabled={driveConnecting}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {driveConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  Conectar Google Drive
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreateTestLead}
            disabled={!supabase || creatingTest}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary text-primary font-medium hover:bg-primary/5 transition disabled:opacity-50"
          >
            {creatingTest ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
            Criar lead de teste
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition"
          >
            <Plus className="h-5 w-5" />
            Incluir lead
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto p-1 hover:bg-amber-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {warning && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{warning}</span>
          <button type="button" onClick={() => setWarning(null)} className="ml-auto p-1 hover:bg-blue-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-emerald-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de leads */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Leads em Due Diligence</h2>
          {leads.length > 0 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white"
              />
            </div>
          )}
          <ul className="space-y-2">
            {leads.length === 0 ? (
              <li className="p-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-center text-sm text-gray-500">
                Nenhum lead incluído. Clique em &quot;Incluir lead&quot;.
              </li>
            ) : filteredLeads.length === 0 ? (
              <li className="p-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-center text-sm text-gray-500">
                Nenhum lead encontrado para &quot;{leadSearch}&quot;.
              </li>
            ) : (
              filteredLeads.map((lead, i) => (
                <motion.li
                  key={lead.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  <motion.div
                    layout
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
                      selectedLead?.id === lead.id
                        ? 'bg-primary/5 border-primary shadow-md shadow-primary/10'
                        : 'bg-white border-gray-200 hover:border-primary/30 hover:shadow-sm'
                    )}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{lead.razao_social}</div>
                      {lead.cnpj && <div className="text-xs text-gray-500 truncate mt-0.5">{lead.cnpj}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(lead, e)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLeadToDelete(lead)
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                </motion.li>
              ))
            )}
          </ul>
        </div>

        {/* Áreas do lead selecionado */}
        <div className="lg:col-span-2">
          {!selectedLead ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 px-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Building2 className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium text-gray-600">Selecione um lead para enviar planilhas e marcar as áreas.</p>
              <p className="text-xs text-gray-400 mt-1">Os leads aparecem na coluna à esquerda</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                  Áreas – {selectedLead.razao_social}
                </h2>
                {selectedLead.final_ppt_url && (
                  <a
                    href={selectedLead.final_ppt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Abrir último PPT final no Drive
                  </a>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600">
                    {areasCompleteCount}/{DUE_DILIGENCE_AREAS.length} concluídas
                  </span>
                  <div className="w-28 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(areasCompleteCount / DUE_DILIGENCE_AREAS.length) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => setDdWorkspaceTab('areas')}
                  className={cn(
                    'flex-1 sm:flex-none min-w-[10rem] px-4 py-2 rounded-lg text-sm font-medium transition',
                    ddWorkspaceTab === 'areas'
                      ? 'bg-white text-primary shadow-sm border border-primary/20'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Áreas e planilhas
                </button>
                <button
                  type="button"
                  onClick={() => setDdWorkspaceTab('ppt')}
                  className={cn(
                    'flex-1 sm:flex-none min-w-[10rem] px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center justify-center gap-2',
                    ddWorkspaceTab === 'ppt'
                      ? 'bg-white text-primary shadow-sm border border-primary/20'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Configuração do PowerPoint
                </button>
              </div>

              {ddWorkspaceTab === 'areas' && (
                <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DUE_DILIGENCE_AREAS.map(({ id, label }, idx) => {
                  const areaRow = areas.find((a) => a.area === id)
                  const isUploading = uploadingArea === id
                  const isDone = areaRow?.status === 'done'
                  const isNoProcesses = areaRow?.status === 'no_processes'
                  const isSkippedDeck = areaRow?.skipped_presentation === true
                  const isPending = !areaRow || areaRow.status === 'pending'
                  const AreaIcon = AREA_ICONS[id] ?? Scale
                  return (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className={cn(
                        'border-2 rounded-xl p-4 transition-all duration-200 shadow-sm',
                        isDone && 'border-emerald-300 bg-emerald-50/80',
                        isNoProcesses && 'border-sky-300 bg-sky-50/80',
                        isSkippedDeck && !isDone && !isNoProcesses && 'border-violet-300 bg-violet-50/80',
                        isPending && 'border-gray-200 bg-white hover:border-primary/20 hover:shadow-md'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                            isDone && 'bg-emerald-100 text-emerald-600',
                            isNoProcesses && 'bg-sky-100 text-sky-600',
                            isSkippedDeck && !isDone && !isNoProcesses && 'bg-violet-100 text-violet-700',
                            isPending && 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : isNoProcesses ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <AreaIcon className="h-5 w-5" />
                          )}
                        </div>
                        <span className="font-semibold text-gray-900">{label}</span>
                      </div>
                      {areaRow && (
                        <>
                          {isNoProcesses ? (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked
                                onChange={() => handleUnsetNoProcesses(areaRow)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sky-700">Não há processos nesta área</span>
                              <span className="text-xs text-gray-500">(clique para desmarcar)</span>
                            </label>
                          ) : isDone ? (
                            <div className="space-y-2">
                              <p className="text-xs text-emerald-700 truncate" title={areaRow.file_name ?? ''}>
                                {areaRow.file_url ? (
                                  <a
                                    href={areaRow.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                  >
                                    {areaRow.file_name ?? 'Planilha enviada'}
                                  </a>
                                ) : (
                                  areaRow.file_name ?? 'Planilha enviada'
                                )}
                              </p>
                                <div className="flex items-center gap-2">
                                <label
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border-2 border-gray-200 text-gray-700 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all duration-200',
                                    isUploading && 'opacity-50 cursor-not-allowed pointer-events-none'
                                  )}
                                >
                                  <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      if (f) handleFileSelect(areaRow, id, f)
                                      e.target.value = ''
                                    }}
                                  />
                                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                  {isUploading ? 'Enviando...' : 'Editar'}
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setAreaToRemove({ areaRow, label: DUE_DILIGENCE_AREAS.find((a) => a.id === id)?.label ?? id })}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remover
                                </button>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setAreaChartsFor(areaRow)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/5"
                                  >
                                    Gráficos da área
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAreaDetailFor(areaRow)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    Detalhar processos
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => handleSetNoProcesses(areaRow)}
                                  className="rounded border-gray-300"
                                />
                                Não há processos nesta área
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer text-violet-800">
                                <input
                                  type="checkbox"
                                  checked={isSkippedDeck}
                                  onChange={() => handleToggleSkipPresentation(areaRow)}
                                  className="rounded border-gray-300"
                                />
                                Pular esta área na apresentação (sem planilha)
                              </label>
                              <div className="relative group">
                                <input
                                  type="file"
                                  accept=".xlsx,.xls"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) handleFileSelect(areaRow, id, f)
                                    e.target.value = ''
                                  }}
                                />
                                <div className={cn(
                                  'flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm font-medium transition-all duration-200',
                                  isUploading
                                    ? 'border-primary/30 bg-primary/5 text-primary'
                                    : 'border-gray-200 bg-gray-50 text-gray-600 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary'
                                )}>
                                  {isUploading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Upload className="h-5 w-5" />
                                  )}
                                  <span>{isUploading ? 'Enviando...' : 'Enviar planilha Excel'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {allAreasComplete && previewMetricas && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden shadow-lg shadow-gray-200/50"
                >
                  <div className="bg-gradient-to-r from-primary to-primary-dark px-5 py-3">
                    <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Preview antes de gerar
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Resumo geral */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/80 p-4 border border-gray-200 shadow-sm"
                      >
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total processos</div>
                        <div className="text-xl font-bold text-primary mt-1">
                          {previewMetricas.consolidada.totalProcessos}
                        </div>
                      </motion.div>
                      {previewMetricas.consolidada.valorEnvolvido > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 }}
                          className="rounded-xl bg-gradient-to-br from-sales/10 to-sales/5 p-4 border border-sales/20 shadow-sm"
                        >
                          <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Valor envolvido</div>
                          <div className="text-lg font-bold text-gray-900 mt-1">
                            {fmtMoney(previewMetricas.consolidada.valorEnvolvido)}
                          </div>
                        </motion.div>
                      )}
                      {previewMetricas.consolidada.valorConcursal > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 }}
                          className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 border border-emerald-200 shadow-sm"
                        >
                          <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Valor concursal</div>
                          <div className="text-lg font-bold text-gray-900 mt-1">
                            {fmtMoney(previewMetricas.consolidada.valorConcursal)}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Por área */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Por área</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {DUE_DILIGENCE_AREAS.map(({ id, label }, idx) => {
                          const areaRow = areas.find((a) => a.area === id)
                          const isNoProcesses = areaRow?.status === 'no_processes'
                          const isSkippedDeck = areaRow?.skipped_presentation === true
                          const count = previewMetricas.consolidada.processosPorArea.find((p) => p.area === label)?.count ?? 0
                          const AreaIcon = AREA_ICONS[id] ?? Scale
                          return (
                            <motion.div
                              key={id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + idx * 0.05 }}
                              className={cn(
                                'rounded-xl border-2 p-4 shadow-sm transition-colors',
                                isNoProcesses ? 'bg-sky-50/80 border-sky-200' : isSkippedDeck ? 'bg-violet-50/80 border-violet-200' : 'bg-white border-gray-200 hover:border-primary/20'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-lg',
                                    isNoProcesses ? 'bg-sky-100 text-sky-600' : isSkippedDeck ? 'bg-violet-100 text-violet-700' : 'bg-primary/10 text-primary'
                                  )}>
                                    <AreaIcon className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-gray-800">{label}</span>
                                </div>
                                {isNoProcesses ? (
                                  <span className="text-xs text-sky-600 font-medium px-2 py-0.5 rounded-full bg-sky-100">Sem processos</span>
                                ) : isSkippedDeck ? (
                                  <span className="text-xs text-violet-700 font-medium px-2 py-0.5 rounded-full bg-violet-100">Fora do deck</span>
                                ) : (
                                  <span className="text-sm font-bold text-primary">{count} processos</span>
                                )}
                              </div>
                              {!isNoProcesses && !isSkippedDeck && (
                                <div className="space-y-1 text-xs text-gray-600">
                                  {id === 'civel' && previewMetricas.civel && (previewMetricas.civel.valorPoloAtivo > 0 || previewMetricas.civel.valorPoloPassivo > 0) && (
                                    <>
                                      {previewMetricas.civel.valorPoloPassivo > 0 && (
                                        <div className="flex justify-between">
                                          <span>Potencial Passivo Cível:</span>
                                          <span>{fmtMoney(previewMetricas.civel.valorPoloPassivo)}</span>
                                        </div>
                                      )}
                                      {previewMetricas.civel.valorPoloAtivo > 0 && (
                                        <div className="flex justify-between">
                                          <span>Valor da causa (Polo Cliente: Ativo):</span>
                                          <span>{fmtMoney(previewMetricas.civel.valorPoloAtivo)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {id === 'trabalhista' && previewMetricas.trabalhista && previewMetricas.trabalhista.potencialPassivo > 0 && (
                                    <div className="flex justify-between">
                                      <span>Potencial passivo:</span>
                                      <span>{fmtMoney(previewMetricas.trabalhista.potencialPassivo)}</span>
                                    </div>
                                  )}
                                  {id === 'tributario' && previewMetricas.tributario && (previewMetricas.tributario.passivoJudicial > 0 || previewMetricas.tributario.passivoAdministrativo > 0) && (
                                    <>
                                      {previewMetricas.tributario.passivoJudicial > 0 && (
                                        <div className="flex justify-between">
                                          <span>Passivo judicial:</span>
                                          <span>{fmtMoney(previewMetricas.tributario.passivoJudicial)}</span>
                                        </div>
                                      )}
                                      {previewMetricas.tributario.passivoAdministrativo > 0 && (
                                        <div className="flex justify-between">
                                          <span>Passivo administrativo:</span>
                                          <span>{fmtMoney(previewMetricas.tributario.passivoAdministrativo)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {id === 'recuperacao_creditos' && previewMetricas.recuperacao && previewMetricas.recuperacao.potencialCredito > 0 && (
                                    <div className="flex justify-between">
                                      <span>Potencial crédito:</span>
                                      <span>{fmtMoney(previewMetricas.recuperacao.potencialCredito)}</span>
                                    </div>
                                  )}
                                  {id === 'reestruturacao' && previewMetricas.reestruturacao && previewMetricas.reestruturacao.valorTotal > 0 && (
                                    <div className="flex justify-between">
                                      <span>Valor total:</span>
                                      <span>{fmtMoney(previewMetricas.reestruturacao.valorTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Totais gerais */}
                    {previewMetricas.resumo && (previewMetricas.resumo.indicativoTotalPassivo > 0 || previewMetricas.resumo.potencialCreditoRecuperacao > 0 || (previewMetricas.trabalhista && previewMetricas.trabalhista.potencialPassivo > 0) || (previewMetricas.civel && (previewMetricas.civel.valorPoloAtivo > 0 || previewMetricas.civel.valorPoloPassivo > 0))) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 p-5 space-y-4 shadow-sm"
                      >
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Totais gerais
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {previewMetricas.resumo.indicativoTotalPassivo > 0 && (
                            <div className="rounded-lg bg-white/80 p-3 border border-primary/10">
                              <div className="text-xs text-gray-600 font-medium">Indicativo total passivo</div>
                              <div className="text-lg font-bold text-primary">{fmtMoney(previewMetricas.resumo.indicativoTotalPassivo)}</div>
                            </div>
                          )}
                          {((previewMetricas.trabalhista?.potencialPassivo ?? previewMetricas.resumo?.passivoTrabalhista ?? 0) > 0) && (
                            <div className="rounded-lg bg-white/80 p-3 border border-primary/10">
                              <div className="text-xs text-gray-600 font-medium">Potencial Passivo Trabalhista</div>
                              <div className="text-lg font-bold text-gray-900">{fmtMoney(previewMetricas.trabalhista?.potencialPassivo ?? previewMetricas.resumo?.passivoTrabalhista ?? 0)}</div>
                            </div>
                          )}
                          {previewMetricas.resumo.potencialCreditoRecuperacao > 0 && (
                            <div className="rounded-lg bg-white/80 p-3 border border-primary/10">
                              <div className="text-xs text-gray-600 font-medium">Potencial crédito (Recuperação)</div>
                              <div className="text-lg font-bold text-emerald-700">{fmtMoney(previewMetricas.resumo.potencialCreditoRecuperacao)}</div>
                            </div>
                          )}
                          {previewMetricas.civel && previewMetricas.civel.valorPoloPassivo > 0 && (
                            <div className="rounded-lg bg-white/80 p-3 border border-primary/10">
                              <div className="text-xs text-gray-600 font-medium">Potencial Passivo Cível</div>
                              <div className="text-lg font-bold text-gray-900">{fmtMoney(previewMetricas.civel.valorPoloPassivo)}</div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
                </>
              )}

              {ddWorkspaceTab === 'ppt' && (
                <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 space-y-5 shadow-sm">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">PowerPoint: ordem e conteúdo global</h3>
                    <p className="text-xs text-gray-500 mt-1">Válido para a geração do deck deste lead (após capa e slides modelo). Salve para guardar no servidor.</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Marque quais blocos entram no deck e defina a ordem. Isto é complementar aos ajustes por área (botão &quot;Gráficos da área&quot; em cada card).
                  </p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    {PPTX_SLIDE_BLOCK_IDS.map((id) => (
                      <label key={id} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={chartOptions[id]}
                          onChange={(e) => setChartOptions((o) => ({ ...o, [id]: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-800">{PPTX_SLIDE_BLOCK_LABELS[id]}</span>
                      </label>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">Ordem no PowerPoint</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Use as setas para mover o bloco. A posição dentro de cada slide (esquerda/direita do gráfico) continua fixa no template.
                    </p>
                    <ul className="space-y-1.5 rounded-lg border border-gray-200 p-2 bg-white">
                      {chartOptions.slideOrder.map((id, index) => (
                        <li
                          key={id}
                          className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-2 py-1.5"
                        >
                          <span className="text-xs text-gray-400 w-5 tabular-nums">{index + 1}.</span>
                          <span className="flex-1 text-sm text-gray-800">{PPTX_SLIDE_BLOCK_LABELS[id]}</span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() =>
                                setChartOptions((o) => {
                                  if (index <= 0) return o
                                  const slideOrder = [...o.slideOrder]
                                  ;[slideOrder[index - 1], slideOrder[index]] = [slideOrder[index], slideOrder[index - 1]]
                                  return { ...o, slideOrder }
                                })
                              }
                              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Subir"
                              aria-label="Mover para cima"
                            >
                              <ChevronUp className="h-4 w-4 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              disabled={index >= chartOptions.slideOrder.length - 1}
                              onClick={() =>
                                setChartOptions((o) => {
                                  if (index >= o.slideOrder.length - 1) return o
                                  const slideOrder = [...o.slideOrder]
                                  ;[slideOrder[index], slideOrder[index + 1]] = [slideOrder[index + 1], slideOrder[index]]
                                  return { ...o, slideOrder }
                                })
                              }
                              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Descer"
                              aria-label="Mover para baixo"
                            >
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">Posição e tamanho dos gráficos</h4>
                    <p className="text-xs text-gray-500">
                      Válido para gráficos em largura total (CNPJ, ano, passivo) e pizza; nos slides com texto + gráfico (áreas), também troca o lado do gráfico.
                    </p>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Alinhamento (slide único gráfico)</label>
                      <div className="flex flex-wrap gap-2">
                        {(['left', 'center', 'right'] as const).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setChartOptions((o) => ({ ...o, chartAlign: a }))}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              chartOptions.chartAlign === a ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Tamanho do gráfico</label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ['compact', 'Compacto'],
                            ['normal', 'Normal'],
                            ['large', 'Grande'],
                          ] as const
                        ).map(([bid, label]) => (
                          <button
                            key={bid}
                            type="button"
                            onClick={() => setChartOptions((o) => ({ ...o, chartSize: bid }))}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              chartOptions.chartSize === bid ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={chartOptions.areaTextLeftChartRight}
                        onChange={(e) => setChartOptions((o) => ({ ...o, areaTextLeftChartRight: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <span>Texto à esquerda, gráfico à direita (slides em duas colunas)</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setChartOptions(normalizePptxChartOptions({ ...chartOptions, slideOrder: [...DEFAULT_CHART_OPTIONS.slideOrder] }))}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Restaurar ordem padrão
                    </button>
                    <button
                      type="button"
                      disabled={pptDeckSaving || !supabase}
                      onClick={() => void savePptDeckToLead()}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90',
                        (pptDeckSaving || !supabase) && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {pptDeckSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Salvar configuração no lead
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDdWorkspaceTab('ppt')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  <Settings2 className="h-5 w-5" />
                  Abrir config. global do PPT
                </button>
                <button
                  type="button"
                  disabled={!allAreasComplete || generating}
                  onClick={handleGeneratePptx}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition',
                    allAreasComplete && !generating
                      ? 'bg-primary text-white hover:opacity-90'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {generating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5" />
                  )}
                  Gerar PowerPoint
                </button>
                {areas.length === DUE_DILIGENCE_AREAS.length && !allAreasComplete && (
                  <p className="text-xs text-amber-600 mt-2">
                    Conclua todas as {DUE_DILIGENCE_AREAS.length} áreas (planilha, &quot;não há processos&quot; ou &quot;pular na apresentação&quot;).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {postUploadDraft && (
        <PostUploadTableModal
          draft={postUploadDraft}
          onClose={() => setPostUploadDraft(null)}
          onConfirm={confirmPostUploadRows}
        />
      )}
      {areaChartsFor && (
        <AreaChartsPrefsModal
          areaRow={areaChartsFor}
          areaLabel={DUE_DILIGENCE_AREAS.find((a) => a.id === areaChartsFor.area)?.label ?? areaChartsFor.area}
          previewSlides={areaChartPreviewSlides}
          onClose={() => setAreaChartsFor(null)}
          onSave={async (opts: AreaChartOptionsPartial) => {
            const updated = await updateAreaPresentationFields(areaChartsFor.id, { area_chart_options: opts })
            setAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
            if (selectedLead) await loadAreas(selectedLead.id)
          }}
        />
      )}
      {areaDetailFor && (
        <AreaProcessDetailModal
          areaRow={areaDetailFor}
          areaLabel={DUE_DILIGENCE_AREAS.find((a) => a.id === areaDetailFor.area)?.label ?? areaDetailFor.area}
          processOptions={processOptionsForDetail}
          onClose={() => setAreaDetailFor(null)}
          onSave={async (config, manualRows) => {
            const updated = await updateAreaPresentationFields(areaDetailFor.id, {
              area_detail_config: config,
              manual_process_slides: manualRows,
            })
            setAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
          }}
        />
      )}

      {/* Modal Incluir lead */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Incluir lead na Due Diligence</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão social *</label>
                <input
                  type="text"
                  value={addForm.razao_social}
                  onChange={(e) => setAddForm((f) => ({ ...f, razao_social: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nome da empresa"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={addForm.cnpj}
                  onChange={(e) => setAddForm((f) => ({ ...f, cnpj: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do lead</label>
                <input
                  type="text"
                  value={addForm.nome_lead}
                  onChange={(e) => setAddForm((f) => ({ ...f, nome_lead: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adding || !addForm.razao_social.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Incluir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar lead */}
      {editLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Editar lead</h3>
              <button type="button" onClick={() => setEditLead(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão social *</label>
                <input
                  type="text"
                  value={editForm.razao_social}
                  onChange={(e) => setEditForm((f) => ({ ...f, razao_social: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nome da empresa"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm((f) => ({ ...f, cnpj: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do lead</label>
                <input
                  type="text"
                  value={editForm.nome_lead}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome_lead: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditLead(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating || !editForm.razao_social.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar exclusão */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Excluir lead</h3>
              <button type="button" onClick={() => setLeadToDelete(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Deseja realmente excluir <strong>{leadToDelete.razao_social}</strong>? As áreas e planilhas associadas serão removidas.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteLead}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar remoção de relatório */}
      {areaToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Remover relatório</h3>
              <button type="button" onClick={() => setAreaToRemove(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Deseja remover o relatório da área <strong>{areaToRemove.label}</strong>? O arquivo permanecerá no Google Drive, mas os dados serão desvinculados. Você poderá enviar uma nova planilha.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAreaToRemove(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRemoveReport}
                disabled={removingArea}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {removingArea ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
