export type FunnelType = 'sales' | 'post'

export interface Field {
  name: string
  instruction: string
  example: string
  required?: boolean
  tag?: 'CP' | 'CC' | 'CE' | 'CA' | 'CADASTRO' | 'FINANCEIRO' // Tags para identificação de campos por etapa
}

export interface ChecklistItem {
  text: string
  required?: boolean
}

export interface Step {
  id: string
  number: number
  name: string
  subtitle: string
  description: string
  fields?: Field[]
  checklist?: ChecklistItem[]
  exitCriteria?: string
  alerts?: string[]
  nextSteps?: string[]
}

export interface FunnelData {
  type: FunnelType
  steps: Step[]
}
