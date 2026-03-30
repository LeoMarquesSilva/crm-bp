/**
 * Estilo por slide de gráfico (modal "Gráficos da área" + geração PPTX).
 */
import type {
  AreaChartKindOverride,
  AreaChartSlideStyle,
  AreaChartOptionsPartial,
  ChartDataLabelPositionPptx,
  ChartLegendPosPptx,
  ChartLineSymbolPptx,
  DueDiligenceAreaRow,
  LeadPptAreaChartDefaults,
} from './types'

export const CHART_LEGEND_POS_OPTIONS: { value: ChartLegendPosPptx; label: string }[] = [
  { value: 'r', label: 'Direita' },
  { value: 'b', label: 'Embaixo' },
  { value: 't', label: 'Em cima' },
  { value: 'l', label: 'Esquerda' },
  { value: 'tr', label: 'Topo direito' },
]

export const CHART_DATA_LABEL_POS_OPTIONS: { value: ChartDataLabelPositionPptx; label: string }[] = [
  { value: 'inEnd', label: 'Dentro (fim)' },
  { value: 'outEnd', label: 'Fora (fim)' },
  { value: 'ctr', label: 'Centro' },
  { value: 'bestFit', label: 'Melhor ajuste' },
  { value: 'b', label: 'Abaixo' },
  { value: 't', label: 'Acima' },
  { value: 'l', label: 'Esquerda' },
  { value: 'r', label: 'Direita' },
]

export const CHART_LINE_SYMBOL_OPTIONS: { value: ChartLineSymbolPptx; label: string }[] = [
  { value: 'circle', label: 'Círculo' },
  { value: 'square', label: 'Quadrado' },
  { value: 'diamond', label: 'Losango' },
  { value: 'triangle', label: 'Triângulo' },
  { value: 'dot', label: 'Ponto' },
  { value: 'dash', label: 'Traço' },
  { value: 'none', label: 'Nenhum' },
]

export const DEFAULT_AREA_CHART_SLIDE_STYLE: AreaChartSlideStyle = {
  colors: ['#101f2e', '#d5b170', '#2d5a4a', '#8b4513', '#3d5a80', '#7c6f64'],
  seriesFill: null,
  lineStroke: '#101f2e',
  lineDotFill: '#d5b170',
  showLegend: true,
  legendPos: 'r',
  legendFontFace: 'Aptos',
  legendFontSize: 10,
  legendColor: '#333333',
  showDataLabels: true,
  showPercent: true,
  dataLabelFontSize: 12,
  dataLabelColor: '#FFFFFF',
  dataLabelFontFace: 'Aptos',
  dataLabelPosition: 'inEnd',
  axisFontFace: 'Aptos',
  axisFontSize: 10,
  axisLabelColor: '#444444',
  showGrid: false,
  gridColor: '#DDDDDD',
  donutHolePercent: 52,
  pieFirstSliceAngle: 0,
  barGapWidthPct: 150,
  lineWidth: 3,
  lineDotSize: 6,
  lineSmooth: false,
  lineSymbol: 'circle',
  plotAreaFillHex: null,
  dataLabelBackgroundHex: null,
  /** null = sem contorno nas fatias (padrão). Cor opcional no editor. */
  pieDonutSliceBorderHex: null,
}

/** Fontes comuns no PowerPoint / Office (prévia usa a mesma família quando disponível no sistema) */
export const CHART_UI_FONT_PRESETS: { value: string; label: string }[] = [
  { value: 'Aptos', label: 'Aptos' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
]

export function cloneDefaultStyle(): AreaChartSlideStyle {
  return { ...DEFAULT_AREA_CHART_SLIDE_STYLE, colors: [...DEFAULT_AREA_CHART_SLIDE_STYLE.colors] }
}

export function mergeAreaChartSlideStyle(partial?: Partial<AreaChartSlideStyle> | null): AreaChartSlideStyle {
  const base = DEFAULT_AREA_CHART_SLIDE_STYLE
  if (!partial) return { ...base, colors: [...base.colors] }
  return {
    ...base,
    ...partial,
    colors: partial.colors && partial.colors.length > 0 ? [...partial.colors] : [...base.colors],
  }
}

/** Aplica um layer parcial sobre um estilo já completo (para global + por slide). */
export function applyStyleLayer(base: AreaChartSlideStyle, layer: Partial<AreaChartSlideStyle> | undefined | null): AreaChartSlideStyle {
  if (!layer || Object.keys(layer).length === 0) return { ...base, colors: [...base.colors] }
  return {
    ...base,
    ...layer,
    colors: layer.colors && layer.colors.length > 0 ? [...layer.colors] : [...base.colors],
    seriesFill: layer.seriesFill !== undefined ? layer.seriesFill : base.seriesFill,
    plotAreaFillHex: layer.plotAreaFillHex !== undefined ? layer.plotAreaFillHex : base.plotAreaFillHex,
    dataLabelBackgroundHex:
      layer.dataLabelBackgroundHex !== undefined ? layer.dataLabelBackgroundHex : base.dataLabelBackgroundHex,
    pieDonutSliceBorderHex:
      layer.pieDonutSliceBorderHex !== undefined ? layer.pieDonutSliceBorderHex : base.pieDonutSliceBorderHex,
  }
}

/** Mescla default → prefs estruturais (navegador) → prefs da área (lead). */
export function resolveChartSlideStyle(
  areaRow: DueDiligenceAreaRow | undefined,
  slideId: string,
  structuralDefaults?: LeadPptAreaChartDefaults | null
): AreaChartSlideStyle {
  const opts = areaRow?.area_chart_options as AreaChartOptionsPartial | undefined
  let s = cloneDefaultStyle()
  s = applyStyleLayer(s, structuralDefaults?.chartGlobalStyle)
  s = applyStyleLayer(s, opts?.chartGlobalStyle)
  s = applyStyleLayer(s, structuralDefaults?.chartSlideStyles?.[slideId])
  s = applyStyleLayer(s, opts?.chartSlideStyles?.[slideId])
  return s
}

/** Diff para persistir apenas overrides em relação a uma base (ex.: global mesclado). */
export function diffChartStyleFromBase(merged: AreaChartSlideStyle, base: AreaChartSlideStyle): Partial<AreaChartSlideStyle> {
  const d: Partial<AreaChartSlideStyle> = {}
  if (!sameColors(merged.colors, base.colors)) d.colors = [...merged.colors]
  const keys: (keyof AreaChartSlideStyle)[] = [
    'seriesFill',
    'lineStroke',
    'lineDotFill',
    'showLegend',
    'legendPos',
    'legendFontFace',
    'legendFontSize',
    'legendColor',
    'showDataLabels',
    'showPercent',
    'dataLabelFontSize',
    'dataLabelColor',
    'dataLabelFontFace',
    'dataLabelPosition',
    'axisFontFace',
    'axisFontSize',
    'axisLabelColor',
    'showGrid',
    'gridColor',
    'donutHolePercent',
    'pieFirstSliceAngle',
    'barGapWidthPct',
    'lineWidth',
    'lineDotSize',
    'lineSmooth',
    'lineSymbol',
    'plotAreaFillHex',
    'dataLabelBackgroundHex',
    'pieDonutSliceBorderHex',
  ]
  for (const k of keys) {
    if (merged[k] !== base[k]) (d as Record<string, unknown>)[k] = merged[k]
  }
  return d
}

/** Hex sem `#`, 6 caracteres, para PptxGenJS */
export function toPptxHex(hex: string): string {
  const s = hex.trim().replace(/^#/, '')
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase()
  return '101F2E'
}

export function colorsToPptx(colors: string[]): string[] {
  return colors.map(toPptxHex)
}

/** Monta lista de cores de série para o PPT (categorias ou fatias). */
export function buildPptxChartColors(st: AreaChartSlideStyle, kind: AreaChartKindOverride, nLabels: number): string[] {
  const base = colorsToPptx(st.colors)
  const count = Math.max(4, nLabels, base.length)
  const out: string[] = []
  const singleHex = st.seriesFill ? toPptxHex(st.seriesFill) : null
  for (let i = 0; i < count; i++) {
    if ((kind === 'bar' || kind === 'barH') && singleHex) out.push(singleHex)
    else out.push(base[i % base.length])
  }
  return out
}

function sameColors(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((c, i) => c.toLowerCase() === b[i]?.toLowerCase())
}

/** Reduz ao que difere do default (para persistir só overrides). */
export function diffChartStyleFromDefault(merged: AreaChartSlideStyle): Partial<AreaChartSlideStyle> {
  return diffChartStyleFromBase(merged, DEFAULT_AREA_CHART_SLIDE_STYLE)
}
