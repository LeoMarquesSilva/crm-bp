/** Áreas da Due Diligence */
export type DueDiligenceAreaId = 'civel' | 'trabalhista' | 'tributario' | 'recuperacao_creditos' | 'reestruturacao'

export const DUE_DILIGENCE_AREAS: { id: DueDiligenceAreaId; label: string }[] = [
  { id: 'civel', label: 'Cível' },
  { id: 'trabalhista', label: 'Trabalhista' },
  { id: 'tributario', label: 'Tributário' },
  { id: 'recuperacao_creditos', label: 'Recuperação de Créditos' },
  { id: 'reestruturacao', label: 'Reestruturação' },
]

export type DueDiligenceAreaStatus = 'pending' | 'no_processes' | 'done'

export interface DueDiligenceLead {
  id: string
  created_at: string
  updated_at: string
  id_registro: string | null
  deal_id: string | null
  razao_social: string
  cnpj: string | null
  nome_lead: string | null
}

export interface DueDiligenceAreaRow {
  id: string
  lead_id: string
  area: DueDiligenceAreaId
  status: DueDiligenceAreaStatus
  file_name: string | null
  file_url: string | null
  parsed_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DueDiligenceAreaWithMeta extends DueDiligenceAreaRow {
  label: string
}
