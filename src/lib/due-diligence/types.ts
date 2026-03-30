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
  final_ppt_url?: string | null
  final_ppt_file_id?: string | null
  /** Prefs globais do deck (mesma forma que PptxChartOptions no buildPptx) */
  ppt_chart_options?: Record<string, unknown> | null
  /** Defaults de estilo/tipo/título dos gráficos por slide (antes do merge por área) */
  ppt_area_chart_defaults?: LeadPptAreaChartDefaults | null
}

/** Tipos de gráfico que o usuário pode escolher no modal e que o PPTX suporta */
export type AreaChartKindOverride = 'pie' | 'donut' | 'bar' | 'barH' | 'line'

export type ChartLegendPosPptx = 'b' | 'l' | 'r' | 't' | 'tr'

export type ChartDataLabelPositionPptx = 'b' | 'bestFit' | 'ctr' | 'l' | 'r' | 't' | 'inEnd' | 'outEnd'

export type ChartLineSymbolPptx = 'circle' | 'dash' | 'diamond' | 'dot' | 'none' | 'square' | 'triangle'

/**
 * Estilo visual por slide de gráfico (chave = id em areaChartPreviews).
 * Campos são persistidos apenas quando diferentes do default (ver chartSlideStyles.ts).
 */
export interface AreaChartSlideStyle {
  /** Paleta (#RRGGBB); séries / fatias rotacionam */
  colors: string[]
  /** Cor única barras (null = usar paleta por categoria) */
  seriesFill: string | null
  lineStroke: string
  lineDotFill: string
  showLegend: boolean
  legendPos: ChartLegendPosPptx
  legendFontFace: string
  legendFontSize: number
  legendColor: string
  showDataLabels: boolean
  showPercent: boolean
  dataLabelFontSize: number
  dataLabelColor: string
  dataLabelFontFace: string
  dataLabelPosition: ChartDataLabelPositionPptx
  axisFontFace: string
  axisFontSize: number
  axisLabelColor: string
  showGrid: boolean
  gridColor: string
  /** Buraco rosca / donut no PPT (% 10–90) */
  donutHolePercent: number
  pieFirstSliceAngle: number
  barGapWidthPct: number
  lineWidth: number
  lineDotSize: number
  lineSmooth: boolean
  lineSymbol: ChartLineSymbolPptx
  /** Fundo área de plotagem PPT, RRGGBB sem # ou com #; null = padrão do tema */
  plotAreaFillHex: string | null
  /** Fundo (caixa) atrás dos rótulos de dados no PPT; null = sem fundo extra */
  dataLabelBackgroundHex: string | null
  /** Contorno das fatias (pizza/rosca); null = sem borda. PPT: dataBorder; prévia: stroke nas Cell */
  pieDonutSliceBorderHex: string | null
}

/**
 * Defaults de gráficos do PPT para o lead (aplicados antes das prefs por área).
 * Mesma estrutura parcial que em área: estilo global, tipo/título/estilo por id de slide.
 */
export interface LeadPptAreaChartDefaults {
  chartGlobalStyle?: Partial<AreaChartSlideStyle>
  chartSlideKinds?: Record<string, AreaChartKindOverride>
  chartSlideStyles?: Record<string, Partial<AreaChartSlideStyle>>
  chartSlideTitles?: Record<string, string>
}

/** Opções de gráficos persistidas por área (parcial; mescla com prefs globais) */
export interface AreaChartOptionsPartial {
  /** IDs de blocos globais a forçar quando definido */
  enabledBlockIds?: string[]
  includeOptionalAudiencias?: boolean
  includeOptionalCasos?: boolean
  civelShowRosca?: boolean
  civelShowSocio?: boolean
  civelShowTipoAcao?: boolean
  civelShowTabelaPolos?: boolean
  civelShowCriticos?: boolean
  trabalhistaShowCascataPedidos?: boolean
  trabalhistaShowLinhaAno?: boolean
  /** Pizza ativos x arquivados (default true) */
  trabalhistaShowPizza?: boolean
  /** Fase + tabela (default true) */
  trabalhistaShowFase?: boolean
  /** Principais pedidos (default true) */
  trabalhistaShowPrincipaisPedidos?: boolean
  /** Títulos customizados por slide (chaves = ids em areaChartPreviews) */
  chartSlideTitles?: Record<string, string>
  /**
   * Tipo de gráfico por slide (ids em areaChartPreviews).
   * Só se aplica a slides com gráfico (pizza, rosca, barras, linha); tabela/texto ignoram.
   */
  chartSlideKinds?: Record<string, AreaChartKindOverride>
  /** Estilo por slide de gráfico (ids areaChartPreviews); valores parciais mesclados com default */
  chartSlideStyles?: Record<string, Partial<AreaChartSlideStyle>>
  /** Estilo global da área: aplicado a todos os slides antes dos ajustes por slide */
  chartGlobalStyle?: Partial<AreaChartSlideStyle>
  [key: string]: unknown
}

export interface AreaDetailConfig {
  /** Números de processo selecionados para slides de detalhe */
  selectedProcessNumbers?: string[]
  /** Texto livre associado */
  detailNote?: string
  [key: string]: unknown
}

export interface ManualProcessSlideRow {
  numero_processo?: string
  texto_livre?: string
  classe?: string
  resumo_risco?: string
  valor_causa?: string
  vara?: string
  polos?: string
  socio?: string
  fase?: string
  [key: string]: unknown
}

export interface DueDiligenceAreaRow {
  id: string
  lead_id: string
  area: DueDiligenceAreaId
  status: DueDiligenceAreaStatus
  file_name: string | null
  file_url: string | null
  parsed_data: Record<string, unknown> | null
  area_chart_options?: AreaChartOptionsPartial | null
  area_detail_config?: AreaDetailConfig | null
  manual_process_slides?: ManualProcessSlideRow[] | null
  skipped_presentation?: boolean
  created_at: string
  updated_at: string
}

export interface DueDiligenceAreaWithMeta extends DueDiligenceAreaRow {
  label: string
}
