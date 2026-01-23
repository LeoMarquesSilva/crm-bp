export type FunnelType = 'sales' | 'post'

export interface Field {
  name: string
  instruction: string
  example: string
  required?: boolean
  tag?: 'CP' | 'CC' // Campos consolidados ou do contrato
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
