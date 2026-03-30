import { supabase } from '@/lib/supabase'
import type {
  DueDiligenceLead,
  DueDiligenceAreaRow,
  DueDiligenceAreaId,
  DueDiligenceAreaStatus,
  AreaChartOptionsPartial,
  AreaDetailConfig,
  ManualProcessSlideRow,
  LeadPptAreaChartDefaults,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''
const API = (path: string) => `${API_BASE}/api${path}`

export async function listDueDiligenceLeads(): Promise<DueDiligenceLead[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DueDiligenceLead[]
}

export async function addDueDiligenceLead(lead: {
  id_registro?: string | null
  deal_id?: string | null
  razao_social: string
  cnpj?: string | null
  nome_lead?: string | null
}): Promise<DueDiligenceLead> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .insert({
      id_registro: lead.id_registro ?? null,
      deal_id: lead.deal_id ?? null,
      razao_social: lead.razao_social.trim(),
      cnpj: lead.cnpj?.trim() ?? null,
      nome_lead: lead.nome_lead?.trim() ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceLead
}

/** Defaults globais de gráficos (estilo/tipo/título por slide) para todos os decks deste lead. */
export async function updateLeadPptAreaChartDefaults(
  leadId: string,
  ppt_area_chart_defaults: LeadPptAreaChartDefaults | null
): Promise<DueDiligenceLead> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .update({ ppt_area_chart_defaults })
    .eq('id', leadId)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceLead
}

/** Persiste opções globais do PowerPoint (blocos, ordem, layout) no lead. */
export async function updateLeadPptChartOptions(
  leadId: string,
  ppt_chart_options: Record<string, unknown>
): Promise<DueDiligenceLead> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .update({ ppt_chart_options })
    .eq('id', leadId)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceLead
}

export async function updateDueDiligenceLead(
  id: string,
  lead: { razao_social?: string; cnpj?: string | null; nome_lead?: string | null }
): Promise<DueDiligenceLead> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload: Record<string, unknown> = {}
  if (lead.razao_social !== undefined) payload.razao_social = lead.razao_social.trim()
  if (lead.cnpj !== undefined) payload.cnpj = lead.cnpj?.trim() ?? null
  if (lead.nome_lead !== undefined) payload.nome_lead = lead.nome_lead?.trim() ?? null
  if (Object.keys(payload).length === 0) {
    const { data } = await supabase.from('due_diligence_leads').select('*').eq('id', id).single()
    return data as DueDiligenceLead
  }
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceLead
}

export async function deleteDueDiligenceLead(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.from('due_diligence_leads').delete().eq('id', id)
  if (error) throw error
}

/**
 * Cria um lead DUE no Supabase por empresa (razão social) e garante as linhas de área.
 * Não lança se Supabase não estiver configurado; falhas de rede são relançadas para o caller tratar.
 */
export async function syncDueDiligenceLeadsFromFunnel(
  items: { razao_social: string; cnpj?: string | null }[],
  nomeLead?: string | null
): Promise<void> {
  if (!supabase) return
  const nome = nomeLead?.trim() || null
  for (const item of items) {
    const rs = (item.razao_social || '').trim()
    if (!rs) continue
    const digits = (item.cnpj || '').replace(/\D/g, '')
    const lead = await addDueDiligenceLead({
      razao_social: rs,
      cnpj: digits.length ? digits : null,
      nome_lead: nome,
    })
    await ensureAreasForLead(lead.id)
  }
}

export async function ensureAreasForLead(leadId: string): Promise<DueDiligenceAreaRow[]> {
  if (!supabase) return []
  const areaIds: DueDiligenceAreaId[] = ['civel', 'trabalhista', 'tributario', 'recuperacao_creditos', 'reestruturacao']
  const { data: existing } = await supabase.from('due_diligence_areas').select('area').eq('lead_id', leadId)
  const existingAreas = new Set((existing ?? []).map((r) => r.area))
  const missing = areaIds.filter((a) => !existingAreas.has(a))
  if (missing.length > 0) {
    const { error: insertError } = await supabase.from('due_diligence_areas').insert(
      missing.map((area) => ({ lead_id: leadId, area, status: 'pending' }))
    )
    if (insertError) throw insertError
  }
  const { data, error } = await supabase
    .from('due_diligence_areas')
    .select('*')
    .eq('lead_id', leadId)
    .order('area')
  if (error) throw error
  return (data ?? []) as DueDiligenceAreaRow[]
}

export async function getAreasForLead(leadId: string): Promise<DueDiligenceAreaRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('due_diligence_areas')
    .select('*')
    .eq('lead_id', leadId)
    .order('area')
  if (error) throw error
  return (data ?? []) as DueDiligenceAreaRow[]
}

export async function setAreaStatus(
  areaId: string,
  status: DueDiligenceAreaStatus,
  opts?: {
    file_name?: string | null
    file_url?: string | null
    parsed_data?: Record<string, unknown> | null
    area_chart_options?: AreaChartOptionsPartial | null
    area_detail_config?: AreaDetailConfig | null
    manual_process_slides?: ManualProcessSlideRow[] | null
    skipped_presentation?: boolean
  }
): Promise<DueDiligenceAreaRow> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload: Record<string, unknown> = { status, ...opts }
  const { data, error } = await supabase
    .from('due_diligence_areas')
    .update(payload)
    .eq('id', areaId)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceAreaRow
}

/**
 * Envia o arquivo para o Google Drive e retorna o link (webViewLink).
 * Requer accessToken com scope drive ou drive.file.
 */
export async function uploadDueDiligenceFile(
  _leadId: string,
  _area: DueDiligenceAreaId,
  file: File,
  accessToken: string
): Promise<string> {
  const buffer = await file.arrayBuffer()
  const fileBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const res = await fetch(API('/upload-google-drive'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      file_name: file.name,
      file_base64: fileBase64,
      mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  })
  const text = await res.text()
  let data: { error?: string; error_description?: string; webViewLink?: string; id?: string }
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        'A API de upload não respondeu. Use "npm run dev" (não só "npm run dev:vite") para subir o servidor da API em http://localhost:3001.'
      )
    }
    throw new Error('Resposta inválida da API de upload.')
  }
  if (!res.ok) {
    const errMsg =
      data.error ||
      data.error_description ||
      (res.status === 401
        ? 'Token expirado. Clique em "Conectar Google Drive" novamente.'
        : res.status === 403
          ? 'Sem permissão para enviar ao Drive. Reconecte o Google Drive para conceder acesso.'
          : 'Falha ao enviar para o Drive')
    throw new Error(errMsg)
  }
  return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
}

/** Atualiza apenas campos JSON/prefs de uma área (sem mudar status). */
export async function updateAreaPresentationFields(
  areaId: string,
  fields: {
    parsed_data?: Record<string, unknown> | null
    area_chart_options?: AreaChartOptionsPartial | null
    area_detail_config?: AreaDetailConfig | null
    manual_process_slides?: ManualProcessSlideRow[] | null
    skipped_presentation?: boolean
  }
): Promise<DueDiligenceAreaRow> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload: Record<string, unknown> = {}
  for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
    const v = fields[k]
    if (v !== undefined) payload[k] = v
  }
  if (Object.keys(payload).length === 0) {
    const { data } = await supabase.from('due_diligence_areas').select('*').eq('id', areaId).single()
    return data as DueDiligenceAreaRow
  }
  const { data, error } = await supabase
    .from('due_diligence_areas')
    .update(payload)
    .eq('id', areaId)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceAreaRow
}

export async function updateDueDiligenceLeadFinalPpt(
  leadId: string,
  final: { final_ppt_url: string | null; final_ppt_file_id?: string | null }
): Promise<DueDiligenceLead> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('due_diligence_leads')
    .update({
      final_ppt_url: final.final_ppt_url,
      final_ppt_file_id: final.final_ppt_file_id ?? null,
    })
    .eq('id', leadId)
    .select()
    .single()
  if (error) throw error
  return data as DueDiligenceLead
}

/**
 * Envia PPT final para pasta "Due Diligence / {razao_social}" no Drive e retorna { webViewLink, id }.
 */
export async function uploadDueDiligenceFinalPptx(
  leadId: string,
  razaoSocial: string,
  fileBase64: string,
  fileName: string,
  accessToken: string
): Promise<{ webViewLink: string; id: string }> {
  const res = await fetch(API('/upload-google-drive'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      file_name: fileName,
      file_base64: fileBase64,
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      due_diligence_folder: true,
      due_diligence_razao_social: razaoSocial.trim(),
    }),
  })
  const text = await res.text()
  let data: { error?: string; error_description?: string; webViewLink?: string; id?: string }
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Resposta inválida da API de upload.')
  }
  if (!res.ok) {
    const errMsg =
      data.error ||
      data.error_description ||
      (res.status === 401
        ? 'Token expirado. Reconecte o Google Drive.'
        : res.status === 403
          ? 'Sem permissão no Drive.'
          : 'Falha ao enviar PPT final')
    throw new Error(errMsg)
  }
  const id = data.id || ''
  const webViewLink = data.webViewLink || (id ? `https://drive.google.com/file/d/${id}/view` : '')
  if (!webViewLink) throw new Error('Resposta sem link do arquivo.')
  return { webViewLink, id }
}
