import { supabase } from '@/lib/supabase'
import type { DueDiligenceLead, DueDiligenceAreaRow, DueDiligenceAreaId, DueDiligenceAreaStatus } from './types'

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
