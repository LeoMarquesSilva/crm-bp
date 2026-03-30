/**
 * Geração do PowerPoint de Due Diligence a partir das métricas e dados do lead.
 * Slide 1: capa gerada com nome do cliente. Slides 2-4: imagens do modelo.
 * Em seguida: Passivo por área, Resumo, e slides por área apenas quando houver dados.
 * Sem merge OOXML para evitar corrupção/aviso de reparar.
 */
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import type {
  DueDiligenceLead,
  DueDiligenceAreaRow,
  DueDiligenceAreaId,
  AreaChartOptionsPartial,
  AreaChartKindOverride,
  LeadPptAreaChartDefaults,
  AreaChartSlideStyle,
} from './types'
import { calcularMetricasConsolidadas, type TodasMetricas, type MetricasConsolidadas } from './metrics'
import {
  resolveChartSlideStyle,
  buildPptxChartColors,
  toPptxHex,
  cloneDefaultStyle,
  applyStyleLayer,
} from './chartSlideStyles'

/** Ordem dos gráficos no PPTX → hex sem # para OOXML em cada `c:dLbls`, ou null. */
type ChartLabelBgQueue = (string | null)[]

function recordChartDataLabelBackground(queue: ChartLabelBgQueue | undefined, st: AreaChartSlideStyle) {
  if (!queue) return
  queue.push(st.dataLabelBackgroundHex ? toPptxHex(st.dataLabelBackgroundHex) : null)
}

function structuralGlobalChartStyle(structuralDefaults: LeadPptAreaChartDefaults | null): AreaChartSlideStyle {
  return applyStyleLayer(cloneDefaultStyle(), structuralDefaults?.chartGlobalStyle)
}

/** Fundo sólido no bloco de rótulos de dados (por gráfico), quando configurado. */
async function applyDataLabelBackgroundsToPptxBuffer(buffer: ArrayBuffer, backgrounds: ChartLabelBgQueue): Promise<ArrayBuffer> {
  if (!backgrounds.some((b) => b != null)) return buffer
  const zip = await JSZip.loadAsync(buffer)
  const chartFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/charts\/chart\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.replace(/^ppt\/charts\/chart(\d+)\.xml$/i, '$1'), 10) || 0
      const nb = parseInt(b.replace(/^ppt\/charts\/chart(\d+)\.xml$/i, '$1'), 10) || 0
      return na - nb
    })
  for (let i = 0; i < chartFiles.length; i++) {
    const hex = backgrounds[i]
    if (!hex) continue
    const name = chartFiles[i]
    const f = zip.files[name]
    if (!f || f.dir) continue
    let xml = await f.async('string')
    if (!xml.includes('<c:dLbls>')) continue
    const spPr = `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`
    xml = xml.replace(/<c:dLbls>/g, `<c:dLbls>${spPr}`)
    zip.file(name, xml)
  }
  return zip.generateAsync({ type: 'arraybuffer' })
}

function parseChartKindOverride(v: unknown): AreaChartKindOverride | null {
  if (v === 'pie' || v === 'donut' || v === 'bar' || v === 'barH' || v === 'line') return v
  return null
}

/** Título: prefs da área sobrescrevem defaults estruturais (localStorage / opções de geração). */
function resolveChartSlideTitle(
  structural: LeadPptAreaChartDefaults | null,
  areaRow: DueDiligenceAreaRow | undefined,
  slideId: string,
  defaultTitle: string
): string {
  const areaT = (areaRow?.area_chart_options as AreaChartOptionsPartial | undefined)?.chartSlideTitles?.[slideId]
  if (areaT != null && String(areaT).trim()) return String(areaT).trim()
  const g = structural?.chartSlideTitles?.[slideId]
  if (g != null && String(g).trim()) return String(g).trim()
  return defaultTitle
}

function resolveChartSlideKind(
  structural: LeadPptAreaChartDefaults | null,
  areaRow: DueDiligenceAreaRow | undefined,
  slideId: string,
  defaultKind: AreaChartKindOverride
): AreaChartKindOverride {
  const a = parseChartKindOverride((areaRow?.area_chart_options as AreaChartOptionsPartial | undefined)?.chartSlideKinds?.[slideId])
  if (a) return a
  const g = parseChartKindOverride(structural?.chartSlideKinds?.[slideId])
  if (g) return g
  return defaultKind
}

type PptxSlide = ReturnType<PptxGenJS['addSlide']>

type SeriesChartCtx = {
  structuralDefaults: LeadPptAreaChartDefaults | null
  areaRow?: DueDiligenceAreaRow
  slideId: string
  /** Lista ao lado do gráfico — esconde legenda do chart para centralizar rosca/total. */
  hideChartLegend?: boolean
}

function addSeriesChartByKind(
  pptx: PptxGenJS,
  slide: PptxSlide,
  box: { x: number; y: number; w: number; h: number },
  kind: AreaChartKindOverride,
  name: string,
  labels: string[],
  values: number[],
  ctx: SeriesChartCtx,
  chartLabelBgQueue?: ChartLabelBgQueue
) {
  const st = resolveChartSlideStyle(ctx.areaRow, ctx.slideId, ctx.structuralDefaults)
  const n = labels.length
  let chartColors = buildPptxChartColors(st, kind, n)
  if (kind === 'line') {
    const lh = toPptxHex(st.lineStroke)
    chartColors = Array(Math.max(4, n)).fill(lh)
  }

  const grid =
    st.showGrid
      ? {
          valGridLine: { style: 'solid' as const, color: toPptxHex(st.gridColor), size: 0.5 },
          catGridLine: { style: 'solid' as const, color: toPptxHex(st.gridColor), size: 0.5 },
        }
      : CHART_GRID_OFF

  const axisFont = {
    valAxisLabelFontFace: st.axisFontFace,
    catAxisLabelFontFace: st.axisFontFace,
    valAxisLabelFontSize: st.axisFontSize,
    catAxisLabelFontSize: st.axisFontSize,
    valAxisLabelColor: toPptxHex(st.axisLabelColor),
    catAxisLabelColor: toPptxHex(st.axisLabelColor),
  }

  const dataLabels =
    st.showDataLabels
      ? {
          dataLabelColor: toPptxHex(st.dataLabelColor),
          dataLabelFontSize: st.dataLabelFontSize,
          dataLabelFontFace: st.dataLabelFontFace,
          dataLabelPosition: st.dataLabelPosition,
        }
      : {}

  /** Pizza/rosca: rótulos no centro da fatia + sem linhas; borda tipo “premium” (PptxGenJS dataBorder). */
  const pieDonutSliceBorder =
    st.pieDonutSliceBorderHex != null && String(st.pieDonutSliceBorderHex).trim() !== ''
      ? { dataBorder: { pt: 1.25, color: toPptxHex(st.pieDonutSliceBorderHex) } as { pt: number; color: string } }
      : {}
  const pieDonutLabelOpts = st.showDataLabels
    ? {
        dataLabelColor: toPptxHex(st.dataLabelColor),
        dataLabelFontSize: st.dataLabelFontSize,
        dataLabelFontFace: st.dataLabelFontFace,
        dataLabelPosition: 'ctr' as const,
        showLeaderLines: false,
      }
    : { showLeaderLines: false }

  const plotArea = st.plotAreaFillHex
    ? { plotArea: { fill: { color: toPptxHex(st.plotAreaFillHex) } as { color: string } } }
    : {}

  const legendBase = {
    showLegend: ctx.hideChartLegend ? false : st.showLegend,
    legendFontFace: st.legendFontFace,
    legendFontSize: st.legendFontSize,
    legendPos: st.legendPos,
    legendColor: toPptxHex(st.legendColor),
  }

  /**
   * Não usar `shadow` em pizza/rosca: o PptxGenJS aplica sombra na série e em cada fatia (`c:dPt`),
   * e o PowerPoint costuma pedir “reparar” o arquivo. Sombra = só na prévia web (CSS).
   */
  const data = [{ name, labels, values }]

  if (kind === 'pie') {
    slide.addChart(pptx.ChartType.pie, data, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      ...legendBase,
      showPercent: st.showPercent,
      showValue: st.showDataLabels,
      chartColors,
      titleFontFace: st.axisFontFace,
      firstSliceAng: st.pieFirstSliceAngle,
      ...grid,
      ...pieDonutSliceBorder,
      ...pieDonutLabelOpts,
      ...plotArea,
    })
    recordChartDataLabelBackground(chartLabelBgQueue, st)
    return
  }
  if (kind === 'donut') {
    slide.addChart(pptx.ChartType.doughnut, data, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      ...legendBase,
      showPercent: st.showPercent,
      showValue: st.showDataLabels,
      holeSize: Math.min(90, Math.max(10, st.donutHolePercent)),
      chartColors,
      ...grid,
      ...pieDonutSliceBorder,
      ...pieDonutLabelOpts,
      ...plotArea,
    })
    recordChartDataLabelBackground(chartLabelBgQueue, st)
    return
  }
  if (kind === 'line') {
    slide.addChart(pptx.ChartType.line, data, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      lineDataSymbol: st.lineSymbol,
      lineSize: st.lineWidth,
      lineSmooth: st.lineSmooth,
      lineDataSymbolSize: st.lineDotSize,
      lineDataSymbolLineColor: toPptxHex(st.lineDotFill),
      chartColors,
      ...axisFont,
      ...grid,
      ...legendBase,
      ...(st.showDataLabels ? dataLabels : {}),
      ...plotArea,
    })
    return
  }
  if (kind === 'bar') {
    slide.addChart(pptx.ChartType.bar, data, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      barDir: 'col',
      barGapWidthPct: Math.min(500, Math.max(0, st.barGapWidthPct)),
      showValue: st.showDataLabels,
      chartColors,
      ...axisFont,
      ...grid,
      ...legendBase,
      ...(st.showDataLabels ? dataLabels : {}),
      ...plotArea,
    })
    recordChartDataLabelBackground(chartLabelBgQueue, st)
    return
  }
  slide.addChart(pptx.ChartType.bar, data, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    barDir: 'bar',
    barGapWidthPct: Math.min(500, Math.max(0, st.barGapWidthPct)),
    showValue: st.showDataLabels,
    chartColors,
    ...axisFont,
    ...grid,
    ...legendBase,
    ...(st.showDataLabels ? dataLabels : {}),
    ...plotArea,
  })
  recordChartDataLabelBackground(chartLabelBgQueue, st)
}

/** Identidade visual do escritório (hex sem #) */
const BRAND = {
  primary: '101f2e',
  accent: 'd5b170',
  chartColors: ['101f2e', 'd5b170', '101f2e', 'd5b170'] as string[],
}

/** Fonte padrão para todo o PPT */
const FONT = 'Aptos'

const TXT = (opts: Record<string, unknown>) => ({ fontFace: FONT, ...opts })

/** Tipografia coluna lateral (texto + gráfico / rosca) */
const ROSCA_SIDE_BODY_PT = 16
const ROSCA_SIDE_POTENCIAL_PT = 18
const ROSCA_SIDE_TEXT = '333333'
/** Cor dos marcadores na lateral — alinhado ao accent da marca */
const SIDE_BULLET_COLOR = BRAND.accent

/** Linha da tabela-bullets: quadrado (principal) ou bolinha; célula 2 = texto. */
type SideBulletRowInput = {
  square: boolean
  body: string
  fontSize?: number
  bold?: boolean
  /** Linha em branco (espaçamento entre blocos no slide de área) */
  spacer?: boolean
}

/** Primeira linha com marcador quadrado; demais com bolinha (por bloco de texto). */
function contentLinesToSideBulletRows(lines: string[], firstLineSquare: boolean): SideBulletRowInput[] {
  let firstReal = true
  const out: SideBulletRowInput[] = []
  for (const raw of lines) {
    if (!raw.trim()) {
      out.push({ square: false, body: '', spacer: true })
      continue
    }
    out.push({
      square: firstLineSquare && firstReal,
      body: raw,
      fontSize: ROSCA_SIDE_BODY_PT,
    })
    firstReal = false
  }
  return out
}

/**
 * Lista lateral com marcador na cor SIDE_BULLET_COLOR (tabela 2 colunas: evita vários runs no mesmo `<a:p>`).
 * Quadrado = U+25AA; bolinha = U+2022.
 */
function addPptxSideBulletTable(slide: PptxSlide, box: { x: number; y: number; w: number; h: number }, rows: SideBulletRowInput[]) {
  if (!rows.length) return
  const bulletColW = 0.22
  const textColW = Math.max(0.45, box.w - bulletColW)
  const tableRows = rows.map((r) => {
    if (r.spacer) {
      return [
        { text: '\u00A0', options: { fontSize: 5, color: ROSCA_SIDE_TEXT } },
        { text: '\u00A0', options: { fontSize: 5, color: ROSCA_SIDE_TEXT } },
      ]
    }
    const fs = r.fontSize ?? ROSCA_SIDE_BODY_PT
    const mark = r.square ? '\u25AA' : '\u2022'
    return [
      {
        text: mark,
        options: {
          color: SIDE_BULLET_COLOR,
          fontSize: fs,
          align: 'right' as const,
          valign: 'top' as const,
        },
      },
      {
        text: r.body,
        options: {
          color: ROSCA_SIDE_TEXT,
          fontSize: fs,
          bold: r.bold ?? false,
          valign: 'top' as const,
        },
      },
    ]
  })
  slide.addTable(tableRows, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    colW: [bulletColW, textColW],
    border: { type: 'none', pt: 0 },
    fontFace: FONT,
    valign: 'top',
    margin: 0,
  })
}

/** Opções padrão para gráficos: sem linhas de grade, rótulos na base interna */
const CHART_GRID_OFF = { valGridLine: { style: 'none' as const }, catGridLine: { style: 'none' as const } }
const CHART_DATA_LABEL = { dataLabelColor: 'FFFFFF', dataLabelFontSize: 12, dataLabelPosition: 'inEnd' as const }

/** Dimensões Widescreen (33,867 x 19,05 cm) em polegadas */
const SLIDE_W = 13.333
const SLIDE_H = 7.5

/** Margens e área de conteúdo */
const MARGIN_X = 0.6
const CONTENT_W = SLIDE_W - 2 * MARGIN_X
const CONTENT_X = MARGIN_X

/** Layout do header (banner + título por cima) em slides de conteúdo */
const BANNER_Y = 0
const BANNER_H = 0.45
const TITLE_ON_BANNER_H = 0.35

const BANNER_URLS = ['/banner-header.png', '/banner-header.jpg']

/** Carrega imagem de URL e retorna base64 no formato PptxGenJS (image/png;base64,...) ou null se falhar */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (!result) return resolve(null)
        const m = result.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
        resolve(m ? `${m[1]};base64,${m[2]}` : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Retorna dimensões da imagem em pixels a partir do base64 (usa Image API do browser). */
async function getImageDimensionsFromData(data: string): Promise<{ width: number; height: number } | null> {
  if (typeof Image === 'undefined') return null
  const dataUrl = data.startsWith('data:') ? data : `data:${data}`
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Tenta carregar imagem de várias URLs (ex.: .png e .jpg). */
async function loadImageFromUrls(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const data = await loadImageAsBase64(url)
    if (data) return data
  }
  return null
}

/** Carrega banner com dimensões para preservar proporção (sem esticar). */
async function loadBannerWithDimensions(urls: string[]): Promise<{ data: string; width: number; height: number } | null> {
  for (const url of urls) {
    const data = await loadImageAsBase64(url)
    if (!data) continue
    const dims = await getImageDimensionsFromData(data)
    if (dims) return { data, ...dims }
  }
  return null
}

/** Info do banner para slides: dados + dimensões para layout proporcional */
type BannerInfo = { data: string; width: number; height: number } | null

/** Adiciona banner no topo (proporção preservada) e título por cima (Aptos SemiBold 36, maiúsculas, cor D5B170). */
function addSlideHeader(
  slide: { addText: (t: string, o?: object) => void; addImage: (o: object) => void },
  title: string,
  banner: BannerInfo
) {
  let bannerH = BANNER_H
  if (banner) {
    const aspectRatio = banner.width / banner.height
    const w = SLIDE_W
    const h = SLIDE_W / aspectRatio
    bannerH = h
    slide.addImage({
      data: banner.data,
      x: 0,
      y: BANNER_Y,
      w,
      h,
    })
  }
  const titleY = BANNER_Y + bannerH / 2 - 0.18
  slide.addText(title.toUpperCase(), TXT({
    x: 0,
    y: titleY,
    w: SLIDE_W,
    h: TITLE_ON_BANNER_H,
    fontFace: 'Aptos',
    fontSize: 36,
    bold: true,
    align: 'center',
    color: 'D5B170',
  }))
}

/** Slide 1: capa gerada com nome do cliente (variável [nome]). Slides 2-4: imagens do modelo quando disponíveis. */
async function addIntroSlides(pptx: PptxGenJS, lead: DueDiligenceLead): Promise<void> {
  addTitleSlide(pptx, lead)

  const slide2Urls = ['/model-slides/slide2.png', '/model-slides/slide2.jpg']
  const slide3Urls = ['/model-slides/slide3.png', '/model-slides/slide3.jpg']
  const slide4Urls = ['/model-slides/slide4.png', '/model-slides/slide4.jpg']

  const [img2, img3, img4] = await Promise.all([
    loadImageFromUrls(slide2Urls),
    loadImageFromUrls(slide3Urls),
    loadImageFromUrls(slide4Urls),
  ])

  for (const img of [img2, img3, img4]) {
    if (img) {
      const slide = pptx.addSlide()
      slide.addImage({
        data: img,
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        sizing: { type: 'cover', w: SLIDE_W, h: SLIDE_H },
      })
    }
  }
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

/** Texto completo (sem truncar com reticências). O parâmetro `max` é ignorado, mantido só por compatibilidade nas chamadas. */
function cutLabel(label: string, _max?: number): string {
  return String(label ?? '')
}

/** Normaliza espaços; mantém o texto integral do assunto (sem abreviações). */
function shortenAssunto(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function addTitleSlide(pptx: PptxGenJS, lead: DueDiligenceLead) {
  const slide = pptx.addSlide()
  slide.addText('Due Diligence', TXT({ x: 0, y: 2.2, w: SLIDE_W, h: 1, fontSize: 32, bold: true, align: 'center' }))
  slide.addText(lead.razao_social, TXT({ x: 0, y: 3.2, w: SLIDE_W, h: 0.6, fontSize: 22, align: 'center' }))
  if (lead.cnpj) {
    slide.addText(`CNPJ: ${lead.cnpj}`, TXT({ x: 0, y: 3.9, w: SLIDE_W, h: 0.4, fontSize: 14, align: 'center', color: '666666' }))
  }
}

/** Slide: Processos por CNPJ – nome da empresa, processos por área, total, gráfico. */
function addProcessosPorCnpjSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  cons: MetricasConsolidadas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  chartLabelBgQueue: ChartLabelBgQueue
): void {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Processos por CNPJ', banner)
  const o = (y: number) => y + contentOffset
  slide.addText(lead.razao_social, TXT({ x: CONTENT_X, y: o(0.55), w: CONTENT_W, h: 0.35, fontSize: 14, color: '444444' }))
  if (lead.cnpj) {
    slide.addText(`CNPJ: ${lead.cnpj}`, TXT({ x: CONTENT_X, y: o(0.85), w: CONTENT_W, h: 0.25, fontSize: 11, color: '666666' }))
  }
  const chartData = [...cons.processosPorArea.filter((p) => p.count > 0)].sort((a, b) => b.count - a.count)
  const labels = chartData.map((p) => p.area)
  const values = chartData.map((p) => p.count)
  if (labels.length > 0) {
    recordChartDataLabelBackground(chartLabelBgQueue, structuralGlobalChartStyle(structuralDefaults))
    const { x, w, h } = rectFullWidthChart(opts, 9, 4)
    slide.addChart(pptx.ChartType.bar, [{ name: 'Processos', labels, values }], {
      x,
      y: o(1.2),
      w,
      h,
      barDir: 'col',
      showLegend: false,
      showValue: true,
      chartColors: BRAND.chartColors,
      valAxisLabelFontFace: FONT,
      catAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 11,
      catAxisLabelFontSize: 11,
      ...CHART_GRID_OFF,
      ...CHART_DATA_LABEL,
    })
  } else {
    slide.addText('Nenhuma área com processos.', TXT({ x: CONTENT_X, y: o(2.5), w: CONTENT_W, h: 0.4, fontSize: 12, color: '666666', align: 'center' }))
  }
  slide.addText(`Total: ${cons.totalProcessos} processos`, TXT({ x: CONTENT_X, y: o(5.05), w: CONTENT_W, h: 0.3, fontSize: 12, bold: true }))
  const tableRows = cons.processosPorArea.filter((p) => p.count > 0)
  if (tableRows.length > 0) {
    const tableData: { text: string; options?: { bold?: boolean } }[][] = [
      [
        { text: 'Área', options: { bold: true } },
        { text: 'Processos', options: { bold: true } },
      ],
      ...tableRows.map((p) => [{ text: p.area }, { text: String(p.count) }]),
    ]
    slide.addTable(tableData, {
      x: CONTENT_X,
      y: o(5.35),
      w: CONTENT_W * 0.55,
      colW: [3.2, 1.2],
      fontSize: 10,
      border: { type: 'solid', color: 'cccccc', pt: 0.5 },
    })
  }
}

/** Slide: Passivo geral por CNPJ – nome, processos, valor envolvido, valor concursal. */
function addPassivoGeralPorCnpjSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  cons: MetricasConsolidadas,
  banner: BannerInfo,
  contentOffset: number,
  _opts: PptxChartOptions
): void {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Passivo geral por CNPJ', banner)
  const o = (y: number) => y + contentOffset
  slide.addText(lead.razao_social, TXT({ x: CONTENT_X, y: o(0.6), w: CONTENT_W, h: 0.35, fontSize: 14, color: '444444' }))
  if (lead.cnpj) {
    slide.addText(`CNPJ: ${lead.cnpj}`, TXT({ x: CONTENT_X, y: o(0.95), w: CONTENT_W, h: 0.25, fontSize: 11, color: '666666' }))
  }
  const items = [
    ...(cons.totalProcessos > 0 ? [`Processos: ${cons.totalProcessos}`] : []),
    ...(cons.valorEnvolvido > 0 ? [`Valor envolvido: ${fmtMoney(cons.valorEnvolvido)}`] : []),
    ...(cons.valorConcursal > 0 ? [`Valor concursal: ${fmtMoney(cons.valorConcursal)}`] : []),
  ]
  slide.addText(items.length > 0 ? items.join('\n') : 'Nenhum dado disponível.', TXT({ x: CONTENT_X, y: o(1.4), w: CONTENT_W, h: 2, fontSize: 14 }))
}

/** Slide: Processos por ano – todas as áreas, gráfico. */
function addProcessosPorAnoSlide(
  pptx: PptxGenJS,
  cons: MetricasConsolidadas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  chartLabelBgQueue: ChartLabelBgQueue
): void {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Processos por ano', banner)
  const o = (y: number) => y + contentOffset
  slide.addText('Todas as áreas consolidadas', TXT({ x: CONTENT_X, y: o(0.65), w: CONTENT_W, h: 0.3, fontSize: 12, color: '666666' }))
  const sortedAno = [...cons.processosPorAno].filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
  const labels = sortedAno.map((p) => p.label)
  const values = sortedAno.map((p) => p.value)
  if (labels.length > 0) {
    recordChartDataLabelBackground(chartLabelBgQueue, structuralGlobalChartStyle(structuralDefaults))
    const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4.2)
    slide.addChart(pptx.ChartType.bar, [{ name: 'Processos', labels, values }], {
      x,
      y: o(1),
      w,
      h,
      barDir: 'col',
      showLegend: false,
      showValue: true,
      chartColors: BRAND.chartColors,
      valAxisLabelFontFace: FONT,
      catAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 11,
      catAxisLabelFontSize: 11,
      ...CHART_GRID_OFF,
      ...CHART_DATA_LABEL,
    })
  } else {
    slide.addText('Sem dados de processos por ano.', TXT({ x: CONTENT_X, y: o(2.5), w: CONTENT_W, h: 0.4, fontSize: 12, color: '666666', align: 'center' }))
  }
}

/** Séries de processos por ano de distribuição, uma por área com dados. */
function buildProcessosPorAnoPorAreaSeries(m: TodasMetricas): {
  labels: string[]
  series: { name: string; values: number[] }[]
} {
  const blocks: { name: string; porAno: { label: string; value: number }[] }[] = []
  if (m.civel?.porAno?.some((p) => p.value > 0)) blocks.push({ name: 'Cível', porAno: m.civel.porAno })
  if (m.trabalhista?.porAno?.some((p) => p.value > 0)) blocks.push({ name: 'Trabalhista', porAno: m.trabalhista.porAno })
  if (m.tributario) {
    const rows = m.tributario.listaJudicial.length
      ? m.tributario.listaJudicial.reduce(
          (acc, x) => {
            const k = x.ano || '—'
            acc[k] = (acc[k] ?? 0) + 1
            return acc
          },
          {} as Record<string, number>
        )
      : {}
    const porAno = Object.entries(rows).map(([label, value]) => ({ label, value }))
    if (porAno.some((p) => p.value > 0)) blocks.push({ name: 'Tributário', porAno })
  }
  const yearSet = new Set<string>()
  for (const b of blocks) {
    for (const p of b.porAno) {
      // Use any year key — exclude non-year-only placeholders
      if (p.value > 0 && p.label !== '—') yearSet.add(p.label)
    }
  }
  const labels = Array.from(yearSet).sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
  const series = blocks.map((b) => ({
    name: b.name,
    values: labels.map((y) => b.porAno.find((p) => p.label === y)?.value ?? 0),
  }))
  return { labels, series }
}

function addProcessosPorAnoPorAreaSlide(
  pptx: PptxGenJS,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  chartLabelBgQueue: ChartLabelBgQueue
): void {
  const { labels, series } = buildProcessosPorAnoPorAreaSeries(m)
  if (!labels.length || !series.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Processos por ano (por área)', banner)
  const o = (y: number) => y + contentOffset
  slide.addText('Distribuição por ano e por área jurisdicional', TXT({ x: CONTENT_X, y: o(0.6), w: CONTENT_W, h: 0.3, fontSize: 12, color: '666666' }))
  const chartSeries = series.map((s) => ({ name: s.name, labels, values: s.values }))
  recordChartDataLabelBackground(chartLabelBgQueue, structuralGlobalChartStyle(structuralDefaults))
  const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4.2)
  slide.addChart(pptx.ChartType.bar, chartSeries, {
    x,
    y: o(1),
    w,
    h,
    barDir: 'col',
    barGrouping: 'clustered',
    showLegend: true,
    showValue: true,
    chartColors: BRAND.chartColors,
    valAxisLabelFontFace: FONT,
    catAxisLabelFontFace: FONT,
    valAxisLabelFontSize: 10,
    catAxisLabelFontSize: 10,
    legendFontFace: FONT,
    legendFontSize: 10,
    ...CHART_GRID_OFF,
    ...CHART_DATA_LABEL,
  })
}

/** Slide: passivo/crédito total por área (gráfico de barras). */
function addPassivoTotalPorAreaSlide(
  pptx: PptxGenJS,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  chartLabelBgQueue: ChartLabelBgQueue
) {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Passivo total por área', banner)
  const o = (y: number) => y + contentOffset
  const r = m.resumo
  const civelPassivo = m.civel?.valorPoloPassivo ?? 0
  const items = [
    { label: 'Cível', value: civelPassivo },
    { label: 'Trabalhista', value: r.passivoTrabalhista },
    { label: 'Tributário', value: r.passivoTributario },
    { label: 'Recuperação (crédito)', value: m.recuperacao?.potencialCredito ?? r.potencialCreditoRecuperacao },
    { label: 'Reestruturação', value: m.reestruturacao?.valorTotal ?? 0 },
  ]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
  const labels = items.map((i) => i.label)
  const values = items.map((i) => i.value)
  if (labels.length > 0) {
    recordChartDataLabelBackground(chartLabelBgQueue, structuralGlobalChartStyle(structuralDefaults))
    const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4.5)
    slide.addChart(pptx.ChartType.bar, [{ name: 'Valor', labels, values }], {
      x,
      y: o(0.9),
      w,
      h,
      barDir: 'col',
      showLegend: false,
      showValue: true,
      chartColors: BRAND.chartColors,
      valAxisLabelFontFace: FONT,
      catAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 11,
      catAxisLabelFontSize: 11,
      ...CHART_GRID_OFF,
      ...CHART_DATA_LABEL,
    })
  } else {
    slide.addText('Nenhum valor por área.', TXT({ x: 0.5, y: o(2.5), w: 9, h: 0.4, fontSize: 12, color: '666666', align: 'center' }))
  }
}

function addResumoSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number, _opts: PptxChartOptions) {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Conclusão macro / Resumo executivo', banner)
  const o = (y: number) => y + contentOffset
  const r = m.resumo
  const rawItems = [
    { v: r.passivoTrabalhista, s: `1. Trabalhista – Potencial passivo trabalhista: ${fmtMoney(r.passivoTrabalhista)}` },
    { v: r.potencialCreditoRecuperacao, s: `2. Recuperação de Créditos – Potencial crédito localizado: ${fmtMoney(r.potencialCreditoRecuperacao)}` },
    { v: r.passivoTributario, s: `3. Tributário – Potencial passivo tributário: ${fmtMoney(r.passivoTributario)}` },
    { v: r.indicativoTotalCredito, s: `4. Indicativo total de crédito: ${fmtMoney(r.indicativoTotalCredito)}` },
    { v: r.indicativoTotalPassivo, s: `5. Indicativo total de passivo: ${fmtMoney(r.indicativoTotalPassivo)}` },
  ]
  const items = rawItems.filter((x) => x.v > 0).map((x) => x.s)
  const resumoX = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  const resumoW = CONTENT_X + CONTENT_W - resumoX
  const resumoLines = items.length > 0 ? items : ['Nenhum dado disponível.']
  addPptxSideBulletTable(slide, { x: resumoX, y: o(0.9), w: resumoW, h: 3.5 }, contentLinesToSideBulletRows(resumoLines, true))
}

function addAreaSlide(
  pptx: PptxGenJS,
  _lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  areaLabel: string,
  content: string[],
  chartData: { labels: string[]; values: number[] } | undefined,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  headerTitle?: string,
  chartKindResolver?: { areaRow?: DueDiligenceAreaRow; slideId: string; defaultKind: AreaChartKindOverride }
) {
  const slide = pptx.addSlide()
  addSlideHeader(slide, headerTitle ?? `Área: ${areaLabel}`, banner)
  const o = (y: number) => y + contentOffset
  const scale = CHART_SIZE_SCALE[opts.chartSize]
  const gap = 0.3 + SIDE_LATERAL_GAP_EXTRA
  const textFrac = 0.55
  const chartFrac = 0.4
  const textW = CONTENT_W * textFrac
  const chartWBase = CONTENT_W * chartFrac
  const chartW = chartWBase * scale
  const chartH = 3.5 * scale
  const textLeft = opts.areaTextLeftChartRight

  let textX: number
  let chartX: number
  let textColW: number
  if (textLeft) {
    textX = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
    chartX = CONTENT_X + textW + gap
    textColW = textW
  } else {
    chartX = CONTENT_X
    textX = clampSideTextX(CONTENT_X + chartW + gap - ROSCA_TEXT_NUDGE_LEFT)
    textColW = CONTENT_W - chartW - gap
  }

  const textTopY = o(0.9)
  const chartTopY = textTopY + ROSCA_CHART_DROP
  addPptxSideBulletTable(slide, { x: textX, y: textTopY, w: textColW, h: 4 }, contentLinesToSideBulletRows(content, true))
  if (chartData && chartData.labels.length > 0 && chartData.values.length > 0) {
    const cd = chartData
    const sorted = cd.labels
      .map((l, i) => ({ label: l, value: cd.values[i] ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    if (sorted.length > 0) {
      const kind = chartKindResolver
        ? resolveChartSlideKind(structuralDefaults, chartKindResolver.areaRow, chartKindResolver.slideId, chartKindResolver.defaultKind)
        : 'bar'
      addSeriesChartByKind(
        pptx,
        slide,
        { x: chartX, y: chartTopY, w: chartW, h: chartH },
        kind,
        '',
        sorted.map((s) => s.label),
        sorted.map((s) => s.value),
        {
          structuralDefaults,
          areaRow: chartKindResolver?.areaRow,
          slideId: chartKindResolver?.slideId ?? '_macro_area_chart',
        },
        chartLabelBgQueue
      )
    }
  }
}

function civelChartFlag(areaRow: DueDiligenceAreaRow | undefined, key: keyof AreaChartOptionsPartial, defaultTrue: boolean): boolean {
  const po = areaRow?.area_chart_options as AreaChartOptionsPartial | null | undefined
  if (po && key in po && typeof po[key] === 'boolean') return po[key] as boolean
  return defaultTrue
}

function addCivelSlides(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  civelAreaRow?: DueDiligenceAreaRow
) {
  const c = m.civel
  if (!c) return
  const o = (y: number) => y + contentOffset

  if (civelChartFlag(civelAreaRow, 'civelShowRosca', true)) {
    const porSit = c.porSituacao.filter((x) => x.value > 0)
    if (porSit.length > 0) {
      const slide = pptx.addSlide()
      addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_rosca', 'Cível – Passivo por situação (rosca)'), banner)
      const total = porSit.reduce((s, x) => s + x.value, 0)
      const sortedSit = [...porSit].sort((a, b) => b.value - a.value)
      const kind = resolveChartSlideKind(structuralDefaults, civelAreaRow, 'civel_rosca', 'donut')
      const cy = o(ROSCA_SLIDE_CONTENT_Y)
      const lay = layoutRoscaComTextoLateral(opts, cy, { gapAdditional: SIDE_LATERAL_GAP_EXTRA })
      addPptxRoscaSideTextCivel(slide, lay, { total, sortedSit })
      const labels = sortedSit.map((x) => cutLabel(x.label, 14))
      const values = sortedSit.map((x) => x.value)
      addSeriesChartByKind(
        pptx,
        slide,
        { x: lay.chartX, y: lay.chartY, w: lay.chartW, h: lay.chartH },
        kind,
        'Situação',
        labels,
        values,
        {
          structuralDefaults,
          areaRow: civelAreaRow,
          slideId: 'civel_rosca',
          hideChartLegend: true,
        },
        chartLabelBgQueue
      )
      const stRosca = resolveChartSlideStyle(civelAreaRow, 'civel_rosca', structuralDefaults)
      const roscaTxtColor = toPptxHex(stRosca.colors[0] ?? '#101f2e')
      if (kind === 'donut') {
        const midY = lay.chartY + lay.chartH / 2
        slide.addText(String(total), TXT({
          x: lay.chartX,
          y: midY - 0.38,
          w: lay.chartW,
          h: 0.44,
          fontSize: 22,
          bold: true,
          align: 'center',
          color: roscaTxtColor,
        }))
        slide.addText('Total', TXT({
          x: lay.chartX,
          y: midY - 0.02,
          w: lay.chartW,
          h: 0.28,
          fontSize: 11,
          align: 'center',
          color: roscaTxtColor,
        }))
      } else if (kind === 'pie') {
        slide.addText(`Total: ${total}`, TXT({
          x: lay.chartX,
          y: lay.chartY + lay.chartH + 0.12,
          w: lay.chartW,
          h: 0.35,
          fontSize: 12,
          align: 'center',
          color: roscaTxtColor,
          bold: true,
        }))
      }
    }
  }

  if (civelChartFlag(civelAreaRow, 'civelShowSocio', true)) {
    const socio = c.socioPoloPassivo.filter((x) => x.value > 0)
    if (socio.length > 0) {
      const slide = pptx.addSlide()
      addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_socio', 'Cível – Sócio polo passivo'), banner)
      const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4)
      const kind = resolveChartSlideKind(structuralDefaults, civelAreaRow, 'civel_socio', 'barH')
      addSeriesChartByKind(
        pptx,
        slide,
        { x, y: o(1), w, h },
        kind,
        'Processos',
        socio.map((x) => cutLabel(x.label, 12)),
        socio.map((x) => x.value),
        { structuralDefaults, areaRow: civelAreaRow, slideId: 'civel_socio' },
        chartLabelBgQueue
      )
    }
  }

  if (civelChartFlag(civelAreaRow, 'civelShowTipoAcao', true)) {
    const porTipo = c.porTipo.filter((x) => x.value > 0)
    if (porTipo.length > 0) {
      const slide = pptx.addSlide()
      addSlideHeader(
        slide,
        resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_tipo_acao', 'Cível – Processos em trâmite por tipo de ação'),
        banner
      )
      const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4)
      const kind = resolveChartSlideKind(structuralDefaults, civelAreaRow, 'civel_tipo_acao', 'bar')
      addSeriesChartByKind(
        pptx,
        slide,
        { x, y: o(1), w, h },
        kind,
        'Processos',
        porTipo.map((x) => cutLabel(x.label, 14)),
        porTipo.map((x) => x.value),
        { structuralDefaults, areaRow: civelAreaRow, slideId: 'civel_tipo_acao' },
        chartLabelBgQueue
      )
    }
  }

  if (civelChartFlag(civelAreaRow, 'civelShowTabelaPolos', true)) {
    const slide = pptx.addSlide()
    addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_tabela_polos', 'Cível – Polos e valores'), banner)
    const rows: { text: string; options?: { bold?: boolean } }[][] = [
      [
        { text: 'Polo', options: { bold: true } },
        { text: 'Valor (R$)', options: { bold: true } },
      ],
      [{ text: 'Passivo (cliente)' }, { text: fmtMoney(c.valorPoloPassivo) }],
      [{ text: 'Ativo (cliente)' }, { text: fmtMoney(c.valorPoloAtivo) }],
    ]
    slide.addTable(rows, {
      x: CONTENT_X,
      y: o(0.85),
      w: CONTENT_W * 0.6,
      colW: [2.8, 2.2],
      fontSize: 11,
      border: { type: 'solid', color: 'cccccc', pt: 0.5 },
    })
  }

  if (civelChartFlag(civelAreaRow, 'civelShowCriticos', true)) {
    const manual = civelAreaRow?.manual_process_slides
    if (manual && manual.length > 0) {
      const slide = pptx.addSlide()
      addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_criticos', 'Cível – Processos críticos (detalhe)'), banner)
      const head: { text: string; options?: { bold?: boolean } }[] = [
        { text: 'Classe', options: { bold: true } },
        { text: 'Risco', options: { bold: true } },
        { text: 'Valor', options: { bold: true } },
        { text: 'Vara', options: { bold: true } },
        { text: 'Proc.', options: { bold: true } },
      ]
      const body = manual.slice(0, 8).map((r) => [
        { text: cutLabel(String(r.classe ?? '—'), 20) },
        { text: cutLabel(String(r.resumo_risco ?? '—'), 18) },
        { text: cutLabel(String(r.valor_causa ?? '—'), 12) },
        { text: cutLabel(String(r.vara ?? '—'), 14) },
        { text: cutLabel(String(r.numero_processo ?? '—'), 14) },
      ])
      slide.addTable([head, ...body], {
        x: CONTENT_X,
        y: o(0.85),
        w: CONTENT_W,
        colW: [1.6, 2.2, 1.2, 1.4, 1.6],
        fontSize: 8,
        border: { type: 'solid', color: 'cccccc', pt: 0.5 },
      })
      const nota = manual.map((r) => r.texto_livre).filter(Boolean)[0]
      if (nota) {
        slide.addText(String(nota), TXT({ x: CONTENT_X, y: o(4.2), w: CONTENT_W, h: 1.2, fontSize: 10, color: '444444' }))
      }
    }
  }

  const porFaseFilt = c.porFase.filter((x) => x.value > 0)
  const lines = [
    `Total de processos: ${c.totalProcessos}`,
    ...(c.valorPoloPassivo > 0 ? [`Potencial Passivo Cível: ${fmtMoney(c.valorPoloPassivo)}`] : []),
    ...(c.valorPoloAtivo > 0 ? [`Valor da causa (Polo Cliente: Ativo): ${fmtMoney(c.valorPoloAtivo)}`] : []),
    '',
    'Por posição: ' + (c.porPosicao.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por situação: ' + (c.porSituacao.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por fase: ' + (porFaseFilt.map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por ano: ' + (c.porAno.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
  ]
  addAreaSlide(
    pptx,
    lead,
    structuralDefaults,
    'Cível',
    lines,
    porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined,
    banner,
    contentOffset,
    opts,
    chartLabelBgQueue,
    resolveChartSlideTitle(structuralDefaults, civelAreaRow, 'civel_resumo_area', 'Área: Cível'),
    { areaRow: civelAreaRow, slideId: 'civel_resumo_area', defaultKind: 'bar' }
  )
}

/** Slide Trabalhista: Processos ativos vs arquivados (pizza) */
function addTrabalhistaAtivosArquivadosSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t || !t.ativosVsArquivados.length) return
  const filtered = t.ativosVsArquivados.filter((x) => x.value > 0)
  if (!filtered.length) return
  const slide = pptx.addSlide()
  addSlideHeader(
    slide,
    resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_pizza', 'Trabalhista – Processos ativos e arquivados'),
    banner
  )
  const o = (y: number) => y + contentOffset
  const sorted = [...filtered].sort((a, b) => b.value - a.value)
  const labels = sorted.map((x) => x.label)
  const values = sorted.map((x) => x.value)
  const totalProc = values.reduce((s, v) => s + v, 0)
  const cy = o(ROSCA_TRAB_SLIDE_CONTENT_Y)
  const hasPot = t.potencialPassivo > 0
  const lay = layoutRoscaComTextoLateral(opts, cy, {
    gapAdditional: ROSCA_TRAB_GAP_EXTRA,
    chartTopOffset: hasPot ? ROSCA_TRAB_CHART_TOP_AFTER_POTENCIAL : ROSCA_CHART_DROP,
  })
  addPptxRoscaSideTextTrabalhista(slide, lay, {
    potencialPassivo: t.potencialPassivo,
    sorted,
    totalProc,
  })
  const kind = resolveChartSlideKind(structuralDefaults, trabAreaRow, 'trab_pizza', 'donut')
  addSeriesChartByKind(
    pptx,
    slide,
    { x: lay.chartX, y: lay.chartY, w: lay.chartW, h: lay.chartH },
    kind,
    'Processos',
    labels,
    values,
    {
      structuralDefaults,
      areaRow: trabAreaRow,
      slideId: 'trab_pizza',
      hideChartLegend: true,
    },
    chartLabelBgQueue
  )
  const stPizza = resolveChartSlideStyle(trabAreaRow, 'trab_pizza', structuralDefaults)
  const trabCenterCol = toPptxHex(stPizza.colors[0] ?? '#101f2e')
  if (kind === 'donut') {
    const midY = lay.chartY + lay.chartH / 2
    slide.addText(String(totalProc), TXT({
      x: lay.chartX,
      y: midY - 0.38,
      w: lay.chartW,
      h: 0.44,
      fontSize: 22,
      bold: true,
      align: 'center',
      color: trabCenterCol,
    }))
    slide.addText('Total', TXT({
      x: lay.chartX,
      y: midY - 0.02,
      w: lay.chartW,
      h: 0.28,
      fontSize: 11,
      align: 'center',
      color: trabCenterCol,
    }))
  } else if (kind === 'pie') {
    slide.addText(`Total: ${totalProc}`, TXT({
      x: lay.chartX,
      y: lay.chartY + lay.chartH + 0.12,
      w: lay.chartW,
      h: 0.35,
      fontSize: 12,
      align: 'center',
      color: trabCenterCol,
      bold: true,
    }))
  }
}

/** Slide Trabalhista: Fase processual – processos ativos e suspensos (total e valor por fase) */
function addTrabalhistaFaseSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t || !t.porFaseAtivosSuspensos.length) return
  const filtered = t.porFaseAtivosSuspensos.filter((x) => x.count > 0)
  if (!filtered.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_fase', 'Fase processual – Processos ativos e suspensos'), banner)
  const o = (y: number) => y + contentOffset
  const subX = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  slide.addText('Total de processos por fase e valor envolvido por fase', TXT({
    x: subX,
    y: o(0.6),
    w: CONTENT_X + CONTENT_W - subX,
    h: 0.3,
    fontSize: 12,
    color: '666666',
  }))
  const kind = resolveChartSlideKind(structuralDefaults, trabAreaRow, 'trab_fase', 'bar')
  const phaseLabels = filtered.map((x) => cutLabel(x.label, 10))
  const phaseValues = filtered.map((x) => x.count)

  if (kind === 'bar' || kind === 'barH') {
    const scale = CHART_SIZE_SCALE[opts.chartSize]
    const chartW = 5.5 * scale
    const chartH = 4 * scale
    const colGap = 0.3 + SIDE_LATERAL_GAP_EXTRA
    const textW = CONTENT_W - chartW - colGap
    const textLeft = opts.areaTextLeftChartRight
    const textX = textLeft ? clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT) : clampSideTextX(CONTENT_X + chartW + colGap - ROSCA_TEXT_NUDGE_LEFT)
    const chartX = textLeft ? CONTENT_X + textW + colGap : CONTENT_X
    const textY = o(1)
    const chartY = textY + ROSCA_CHART_DROP
    const faseRows: SideBulletRowInput[] = filtered.map((row, i) => ({
      square: i === 0,
      body: `${cutLabel(row.label, 48)}: ${row.count} processos – ${fmtMoney(row.valor)}`,
      fontSize: ROSCA_SIDE_BODY_PT,
    }))
    addSeriesChartByKind(pptx, slide, { x: chartX, y: chartY, w: chartW, h: chartH }, kind, 'Processos', phaseLabels, phaseValues, {
      structuralDefaults,
      areaRow: trabAreaRow,
      slideId: 'trab_fase',
    }, chartLabelBgQueue)
    addPptxSideBulletTable(slide, { x: textX, y: textY, w: textW, h: 4 }, faseRows)
  } else {
    const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 3.5)
    const cy = o(1)
    addSeriesChartByKind(pptx, slide, { x, y: cy, w, h }, kind, 'Processos', phaseLabels, phaseValues, {
      structuralDefaults,
      areaRow: trabAreaRow,
      slideId: 'trab_fase',
    }, chartLabelBgQueue)
    const faseRowsElse: SideBulletRowInput[] = filtered.map((row, i) => ({
      square: i === 0,
      body: `${cutLabel(row.label, 48)}: ${row.count} processos – ${fmtMoney(row.valor)}`,
      fontSize: ROSCA_SIDE_BODY_PT,
    }))
    const tx = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
    addPptxSideBulletTable(slide, { x: tx, y: cy + h + 0.2, w: CONTENT_X + CONTENT_W - tx, h: 2.8 }, faseRowsElse)
  }
}

/** Slide Trabalhista: Principais pedidos (assuntos agregados ou tipo_pedido), com métricas */
function addTrabalhistaPrincipaisPedidosSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t) return
  const dados = (t.assuntosAgregados.length ? t.assuntosAgregados : t.pedidosRecorrentes).filter((x) => x.value > 0)
  if (!dados.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_principais_pedidos', 'Principais pedidos'), banner)
  const o = (y: number) => y + contentOffset
  const sortedDesc = [...dados].sort((a, b) => b.value - a.value).slice(0, 12)
  const sorted = [...sortedDesc].reverse()
  const labels = t.assuntosAgregados.length ? sorted.map((x) => shortenAssunto(x.label)) : sorted.map((x) => cutLabel(x.label, 18))
  const values = sorted.map((x) => x.value)
  const kind = resolveChartSlideKind(structuralDefaults, trabAreaRow, 'trab_principais_pedidos', 'barH')
  const scale = CHART_SIZE_SCALE[opts.chartSize]
  const chartW = 6 * scale
  const chartH = 4 * scale
  const colGap = 0.3 + SIDE_LATERAL_GAP_EXTRA
  const textW = CONTENT_W - chartW - colGap
  const textLeft = opts.areaTextLeftChartRight
  const chartX = textLeft ? CONTENT_X + textW + colGap : CONTENT_X
  const pedColX = textLeft ? clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT) : clampSideTextX(CONTENT_X + chartW + colGap - ROSCA_TEXT_NUDGE_LEFT)
  const pedColW = textW
  const top2 = sortedDesc.slice(0, 2).map((x) => (t.assuntosAgregados.length ? shortenAssunto(x.label) : x.label))

  let yCol = o(0.52)
  addPptxSideMetricBullet18(slide, { x: pedColX, y: yCol, w: pedColW, h: 0.48 }, 'Potencial passivo', fmtMoney(t.potencialPassivo))
  yCol += 0.52
  addPptxSideBulletTable(
    slide,
    {
      x: pedColX + ROSCA_TRAB_SUB_BULLET_INDENT,
      y: yCol,
      w: Math.max(1.2, pedColW - ROSCA_TRAB_SUB_BULLET_INDENT),
      h: 0.4,
    },
    [{ square: false, body: `Média valor de causa: ${fmtMoney(t.mediaValorCausa)}`, fontSize: ROSCA_SIDE_BODY_PT }]
  )
  yCol += 0.44

  const chartY = o(1.05) + ROSCA_CHART_DROP

  if (kind === 'bar' || kind === 'barH') {
    addSeriesChartByKind(pptx, slide, { x: chartX, y: chartY, w: chartW, h: chartH }, kind, 'Quantidade', labels, values, {
      structuralDefaults,
      areaRow: trabAreaRow,
      slideId: 'trab_principais_pedidos',
    }, chartLabelBgQueue)
    slide.addText(
      'Observa-se que os principais pedidos das reclamações trabalhistas são:',
      TXT({ x: pedColX, y: yCol, w: pedColW, h: 0.5, fontSize: ROSCA_SIDE_BODY_PT - 1, color: ROSCA_SIDE_TEXT })
    )
    yCol += 0.52
    const topRows: SideBulletRowInput[] = top2.map((l) => ({ square: false, body: l, fontSize: ROSCA_SIDE_BODY_PT, bold: true }))
    addPptxSideBulletTable(slide, { x: pedColX, y: yCol, w: pedColW, h: 1.2 }, topRows)
  } else {
    const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 3.4)
    const cy = o(1.05)
    addSeriesChartByKind(pptx, slide, { x, y: cy + ROSCA_CHART_DROP, w, h }, kind, 'Quantidade', labels, values, {
      structuralDefaults,
      areaRow: trabAreaRow,
      slideId: 'trab_principais_pedidos',
    }, chartLabelBgQueue)
    const ty = cy + h + ROSCA_CHART_DROP + 0.2
    const tx = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
    slide.addText(
      'Observa-se que os principais pedidos das reclamações trabalhistas são:',
      TXT({ x: tx, y: ty, w: CONTENT_X + CONTENT_W - tx, h: 0.45, fontSize: ROSCA_SIDE_BODY_PT - 1, color: ROSCA_SIDE_TEXT })
    )
    const topRowsElse: SideBulletRowInput[] = top2.map((l) => ({ square: false, body: l, fontSize: ROSCA_SIDE_BODY_PT, bold: true }))
    addPptxSideBulletTable(slide, { x: tx, y: ty + 0.45, w: CONTENT_X + CONTENT_W - tx, h: 1 }, topRowsElse)
  }
}

function trabChartFlag(areaRow: DueDiligenceAreaRow | undefined, key: keyof AreaChartOptionsPartial, defaultTrue: boolean): boolean {
  const po = areaRow?.area_chart_options as AreaChartOptionsPartial | null | undefined
  if (po && key in po && typeof po[key] === 'boolean') return po[key] as boolean
  return defaultTrue
}

function addTrabalhistaLinhaAnoSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t || !trabChartFlag(trabAreaRow, 'trabalhistaShowLinhaAno', true)) return
  const pts = t.porAno.filter((p) => p.value > 0 && p.label !== '—')
  if (pts.length === 0) return
  const sortedAsc = [...pts].sort((a, b) => {
    const na = parseInt(a.label, 10)
    const nb = parseInt(b.label, 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    return a.label.localeCompare(b.label)
  })
  const labels = sortedAsc.map((p) => p.label)
  const values = sortedAsc.map((p) => p.value)
  const slide = pptx.addSlide()
  addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_linha_ano', 'Trabalhista – Processos distribuídos por ano'), banner)
  const o = (y: number) => y + contentOffset
  const laX = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  const laW = CONTENT_X + CONTENT_W - laX
  if (t.textoResumoAno) {
    slide.addText(t.textoResumoAno, TXT({ x: laX, y: o(0.55), w: laW, h: 0.55, fontSize: ROSCA_SIDE_BODY_PT - 1, color: '444444' }))
  }
  const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 3.8)
  const kind = resolveChartSlideKind(structuralDefaults, trabAreaRow, 'trab_linha_ano', 'line')
  addSeriesChartByKind(pptx, slide, { x, y: o(1.15) + ROSCA_CHART_DROP, w, h }, kind, 'Processos', labels, values, {
    structuralDefaults,
    areaRow: trabAreaRow,
    slideId: 'trab_linha_ano',
  }, chartLabelBgQueue)
}

function addTrabalhistaCascataPedidosSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t || !t.pedidosPorProcesso.length) return
  const top = [...t.pedidosPorProcesso].filter((p) => p.count > 0).sort((a, b) => b.count - a.count).slice(0, 12)
  if (!top.length) return
  const slide = pptx.addSlide()
  addSlideHeader(
    slide,
    resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_cascata', 'Trabalhista – Pedidos por processo (principais)'),
    banner
  )
  const o = (y: number) => y + contentOffset
  const casX = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  slide.addText('Agregação por par (processo × pedido)', TXT({
    x: casX,
    y: o(0.58),
    w: CONTENT_X + CONTENT_W - casX,
    h: 0.28,
    fontSize: ROSCA_SIDE_BODY_PT - 1,
    color: '666666',
  }))
  const labels = top.map((p) => cutLabel(`${p.processo} — ${p.pedido}`, 28))
  const values = top.map((p) => p.count)
  const { x, w, h } = rectFullWidthChart(opts, CONTENT_W, 4.2)
  const kind = resolveChartSlideKind(structuralDefaults, trabAreaRow, 'trab_cascata', 'barH')
  addSeriesChartByKind(pptx, slide, { x, y: o(0.95) + ROSCA_CHART_DROP, w, h }, kind, 'Ocorrências', labels, values, {
    structuralDefaults,
    areaRow: trabAreaRow,
    slideId: 'trab_cascata',
  }, chartLabelBgQueue)
}

function addTrabalhistaAudienciasSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t?.proximasAudiencias.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_audiencias', 'Trabalhista – Próximas audiências'), banner)
  const o = (y: number) => y + contentOffset
  const ax = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  const aw = CONTENT_X + CONTENT_W - ax
  const audSlice = t.proximasAudiencias.slice(0, 15)
  const audRows: SideBulletRowInput[] = audSlice.map((a, i) => ({
    square: i === 0,
    body: `${cutLabel(a.processo, 56)}: ${a.data}`,
    fontSize: ROSCA_SIDE_BODY_PT,
  }))
  addPptxSideBulletTable(slide, { x: ax, y: o(0.85), w: aw, h: 4.5 }, audRows)
}

function addTrabalhistaCasosSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t?.casosRelevantes.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_casos', 'Trabalhista – Casos relevantes'), banner)
  const o = (y: number) => y + contentOffset
  const cx = clampSideTextX(CONTENT_X - ROSCA_TEXT_NUDGE_LEFT)
  const cw = CONTENT_X + CONTENT_W - cx
  const casoSlice = t.casosRelevantes.slice(0, 12)
  const casoRows: SideBulletRowInput[] = casoSlice.map((c, i) => ({
    square: i === 0,
    body: `${cutLabel(c.processo, 40)}: ${c.texto}`,
    fontSize: ROSCA_SIDE_BODY_PT,
  }))
  addPptxSideBulletTable(slide, { x: cx, y: o(0.85), w: cw, h: 4.5 }, casoRows)
}

function addTrabalhistaSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue,
  trabAreaRow?: DueDiligenceAreaRow
) {
  const t = m.trabalhista
  if (!t) return
  addTrabalhistaAtivosArquivadosSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, opts, chartLabelBgQueue, trabAreaRow)
  addTrabalhistaFaseSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, opts, chartLabelBgQueue, trabAreaRow)
  addTrabalhistaPrincipaisPedidosSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, opts, chartLabelBgQueue, trabAreaRow)
  addTrabalhistaLinhaAnoSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, opts, chartLabelBgQueue, trabAreaRow)
  if (trabChartFlag(trabAreaRow, 'trabalhistaShowCascataPedidos', true)) {
    addTrabalhistaCascataPedidosSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, opts, chartLabelBgQueue, trabAreaRow)
  }
  if (trabChartFlag(trabAreaRow, 'includeOptionalAudiencias', false)) {
    addTrabalhistaAudienciasSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, trabAreaRow)
  }
  if (trabChartFlag(trabAreaRow, 'includeOptionalCasos', false)) {
    addTrabalhistaCasosSlide(pptx, lead, structuralDefaults, m, banner, contentOffset, trabAreaRow)
  }
  const porFaseFilt = t.porFase.filter((x) => x.value > 0)
  const lines = [
    ...(t.potencialPassivo > 0 ? [`Potencial passivo trabalhista: ${fmtMoney(t.potencialPassivo)}`] : []),
    `Total de processos: ${t.totalProcessos}`,
    ...(t.mediaValorCausa > 0 ? [`Média do valor da causa: ${fmtMoney(t.mediaValorCausa)}`] : []),
    '',
    'Por fase: ' + (porFaseFilt.map((x) => `${x.label}: ${x.value} (${fmtMoney(x.valor)})`).join('; ') || '—'),
    'Por ano: ' + (t.porAno.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
  ]
  addAreaSlide(
    pptx,
    lead,
    structuralDefaults,
    'Trabalhista',
    lines,
    porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined,
    banner,
    contentOffset,
    opts,
    chartLabelBgQueue,
    resolveChartSlideTitle(structuralDefaults, trabAreaRow, 'trab_resumo_area', 'Área: Trabalhista'),
    { areaRow: trabAreaRow, slideId: 'trab_resumo_area', defaultKind: 'bar' }
  )
}

function addTributarioSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue
) {
  const t = m.tributario
  if (!t) return
  const listaFiltrada = t.listaJudicial.filter((x) => x.valor > 0).slice(0, 8)
  const lines = [
    ...(t.passivoJudicial > 0 ? [`Passivo judicial: ${fmtMoney(t.passivoJudicial)}`] : []),
    ...(t.passivoAdministrativo > 0 ? [`Passivo administrativo: ${fmtMoney(t.passivoAdministrativo)}`] : []),
    ...(listaFiltrada.length ? ['', ...listaFiltrada.map((x) => `${x.tipo} (${x.ano}): ${fmtMoney(x.valor)}`)] : []),
  ]
  if (lines.length === 0) lines.push('Nenhum dado disponível.')
  addAreaSlide(pptx, lead, structuralDefaults, 'Tributário', lines, undefined, banner, contentOffset, opts, chartLabelBgQueue)
}

function addRecuperacaoSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue
) {
  const r = m.recuperacao
  if (!r) return
  const porFaseFilt = r.porFase.filter((x) => x.value > 0)
  const lines = [
    `Total de processos: ${r.totalProcessos}`,
    ...(r.potencialCredito > 0 ? [`Potencial crédito: ${fmtMoney(r.potencialCredito)}`] : []),
    '',
    'Por fase: ' + (porFaseFilt.map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por tipo de ação: ' + (r.porTipoAcao.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por tipo de crédito: ' + (r.porTipoCredito.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
  ]
  addAreaSlide(
    pptx,
    lead,
    structuralDefaults,
    'Recuperação de Créditos',
    lines,
    porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined,
    banner,
    contentOffset,
    opts,
    chartLabelBgQueue
  )
}

function addReestruturacaoSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  structuralDefaults: LeadPptAreaChartDefaults | null,
  m: TodasMetricas,
  banner: BannerInfo,
  contentOffset: number,
  opts: PptxChartOptions,
  chartLabelBgQueue: ChartLabelBgQueue
) {
  const r = m.reestruturacao
  if (!r) return
  const porFaseFilt = r.porFase.filter((x) => x.value > 0)
  const lines = [
    `Total de processos: ${r.totalProcessos}`,
    ...(r.valorTotal > 0 ? [`Valor total: ${fmtMoney(r.valorTotal)}`] : []),
    '',
    'Por fase: ' + (porFaseFilt.map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
    'Por tipo de ação: ' + (r.porTipoAcao.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
  ]
  addAreaSlide(
    pptx,
    lead,
    structuralDefaults,
    'Reestruturação',
    lines,
    porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined,
    banner,
    contentOffset,
    opts,
    chartLabelBgQueue
  )
}

/** Identificadores dos blocos de conteúdo (cada um vira um ou mais slides se habilitado). */
export const PPTX_SLIDE_BLOCK_IDS = [
  'processosPorCnpj',
  'passivoGeralPorCnpj',
  'processosPorAno',
  'processosPorAnoPorArea',
  'passivoTotalPorArea',
  'resumoExecutivo',
  'slideCivel',
  'slideRecuperacao',
  'slideTrabalhista',
  'slideTributario',
  'slideReestruturacao',
] as const

export type PptxSlideBlockId = (typeof PPTX_SLIDE_BLOCK_IDS)[number]

/** Rótulos para UI (ordem dos slides no deck, após capa/modelo). */
export const PPTX_SLIDE_BLOCK_LABELS: Record<PptxSlideBlockId, string> = {
  processosPorCnpj: 'Processos por CNPJ',
  passivoGeralPorCnpj: 'Passivo geral por CNPJ',
  processosPorAno: 'Processos por ano (consolidado)',
  processosPorAnoPorArea: 'Processos por ano por área',
  passivoTotalPorArea: 'Passivo total por área',
  resumoExecutivo: 'Conclusão / resumo executivo',
  slideCivel: 'Área Cível',
  slideRecuperacao: 'Recuperação de créditos',
  slideTrabalhista: 'Área Trabalhista',
  slideTributario: 'Área Tributária',
  slideReestruturacao: 'Reestruturação',
}

/** Alinhamento horizontal do gráfico em slides de largura útil (não aplica ao lado-a-lado). */
export type PptxChartAlign = 'left' | 'center' | 'right'

/** Escala do gráfico (largura e altura proporcionais). */
export type PptxChartSizePreset = 'compact' | 'normal' | 'large'

/** Opções de slides/gráficos a exibir no PowerPoint */
export interface PptxChartOptions {
  processosPorCnpj: boolean
  passivoGeralPorCnpj: boolean
  processosPorAno: boolean
  processosPorAnoPorArea: boolean
  passivoTotalPorArea: boolean
  resumoExecutivo: boolean
  slideCivel: boolean
  slideTrabalhista: boolean
  slideTributario: boolean
  slideRecuperacao: boolean
  slideReestruturacao: boolean
  /** Ordem em que os blocos habilitados entram no deck (após slides de introdução). */
  slideOrder: PptxSlideBlockId[]
  /** Alinhamento do gráfico quando ocupa faixa total (CNPJ, ano, passivo por área, pizza central). */
  chartAlign: PptxChartAlign
  /** Tamanho relativo dos gráficos. */
  chartSize: PptxChartSizePreset
  /**
   * Slides com texto + gráfico lado a lado (áreas Cível, Trabalhista resumo, etc.):
   * `true` = texto à esquerda, gráfico à direita (padrão).
   * `false` = gráfico à esquerda, texto à direita.
   */
  areaTextLeftChartRight: boolean
}

const CHART_SIZE_SCALE: Record<PptxChartSizePreset, number> = {
  compact: 0.86,
  normal: 1,
  large: 1.14,
}

/** Texto da coluna da rosca mais próximo da borda esquerda; gráfico mantém X “de referência”. */
const ROSCA_TEXT_NUDGE_LEFT = 1.60
/** Gráfico um pouco abaixo do topo do bloco de texto (Cível / fallback). */
const ROSCA_CHART_DROP = 0.22
/** Topo do bloco rosca — Cível. */
const ROSCA_SLIDE_CONTENT_Y = 1.12
/** Trabalhista: bloco começa um pouco mais alto (referência layout). */
const ROSCA_TRAB_SLIDE_CONTENT_Y = 0.92
/** Trabalhista: altura da 1ª linha (Potencial) até alinhar o topo do gráfico logo abaixo. */
const ROSCA_TRAB_CHART_TOP_AFTER_POTENCIAL = 0.52
/** Trabalhista: espaço extra entre coluna de texto e rosca (faixa branca central). */
const ROSCA_TRAB_GAP_EXTRA = 0.38
/** Mesmo espaço extra texto↔gráfico nos demais slides em coluna (área resumo, fase, pedidos, etc.). */
const SIDE_LATERAL_GAP_EXTRA = ROSCA_TRAB_GAP_EXTRA

type RoscaLayoutExtras = {
  gapAdditional?: number
  /** Se definido, `chartY = contentTopY + valor` (em polegadas). Senão usa `ROSCA_CHART_DROP`. */
  chartTopOffset?: number
}

/** Geometria opcional para coluna texto + gráfico (padrão = rosca). */
type ColunaTextoGraficoGeometry = {
  textFrac?: number
  chartBaseW?: number
  chartBaseH?: number
  baseGap?: number
}

function clampSideTextX(x: number): number {
  return Math.max(0.2, x)
}

/**
 * Coluna de texto + gráfico (rosca, barras lado a lado, etc.): mesmo deslocamento à esquerda e gap que a rosca.
 */
function layoutColunaTextoGrafico(
  opts: PptxChartOptions,
  contentTopY: number,
  geometry?: ColunaTextoGraficoGeometry,
  extras?: RoscaLayoutExtras
): {
  textX: number
  textY: number
  textW: number
  textH: number
  chartX: number
  chartY: number
  chartW: number
  chartH: number
} {
  const scale = CHART_SIZE_SCALE[opts.chartSize]
  const textFrac = geometry?.textFrac ?? 0.42
  const chartBaseW = geometry?.chartBaseW ?? 3.45
  const chartBaseH = geometry?.chartBaseH ?? 3.75
  const gap = (geometry?.baseGap ?? 0.3) + (extras?.gapAdditional ?? 0)
  const textW = CONTENT_W * textFrac
  let chartW = Math.min(chartBaseW * scale, CONTENT_W - textW - gap - 0.15)
  const chartH = chartBaseH * scale
  const textH = Math.max(chartH, 3.25)
  const textLeft = opts.areaTextLeftChartRight
  let textX: number
  let chartX: number
  if (opts.chartAlign === 'center') {
    const totalW = textW + gap + chartW
    const startX = CONTENT_X + (CONTENT_W - totalW) / 2
    if (textLeft) {
      textX = startX - ROSCA_TEXT_NUDGE_LEFT
      chartX = startX + textW + gap
    } else {
      chartX = startX
      textX = startX + chartW + gap - ROSCA_TEXT_NUDGE_LEFT
    }
  } else if (textLeft) {
    textX = CONTENT_X - ROSCA_TEXT_NUDGE_LEFT
    chartX = CONTENT_X + textW + gap
  } else {
    chartX = CONTENT_X
    textX = CONTENT_X + chartW + gap - ROSCA_TEXT_NUDGE_LEFT
  }
  textX = clampSideTextX(textX)
  const chartY = contentTopY + (extras?.chartTopOffset ?? ROSCA_CHART_DROP)
  return {
    textX,
    textY: contentTopY,
    textW,
    textH,
    chartX,
    chartY,
    chartW,
    chartH,
  }
}

/** Alias: layout da rosca (Cível / Trabalhista) — centralizado ou alinhado à margem. */
function layoutRoscaComTextoLateral(
  opts: PptxChartOptions,
  contentTopY: number,
  extras?: RoscaLayoutExtras
) {
  return layoutColunaTextoGrafico(opts, contentTopY, undefined, extras)
}

type RoscaTextLay = ReturnType<typeof layoutRoscaComTextoLateral>

/** Primeira métrica da coluna (Potencial passivo + valor em real) — marcador quadrado, 18pt negrito. */
function addPptxSideMetricBullet18(
  slide: PptxSlide,
  box: { x: number; y: number; w: number; h: number },
  labelBold: string,
  valueFormatted: string
) {
  addPptxSideBulletTable(slide, box, [
    {
      square: true,
      body: `${labelBold}: ${valueFormatted}`,
      fontSize: ROSCA_SIDE_POTENCIAL_PT,
      bold: true,
    },
  ])
}

/** Indentação dos sub-marcadores (Ativos / Arquivados / Total) em polegadas — ref. slide modelo. */
const ROSCA_TRAB_SUB_BULLET_INDENT = 0.24

/** Coluna Trabalhista: primeiro bloco = Potencial passivo (quadrado); lista com bolinhas; indent quando há potencial. */
function addPptxRoscaSideTextTrabalhista(
  slide: PptxSlide,
  lay: RoscaTextLay,
  args: { potencialPassivo: number; sorted: { label: string; value: number }[]; totalProc: number }
) {
  let y = lay.textY
  const { textX: x, textW: w, textH } = lay
  const bottom = lay.textY + textH

  if (args.potencialPassivo > 0) {
    const hPot = 0.48
    addPptxSideMetricBullet18(slide, { x, y, w, h: hPot }, 'Potencial passivo', fmtMoney(args.potencialPassivo))
    y += hPot + 0.1
  }

  const bodyRows: SideBulletRowInput[] = [
    ...args.sorted.map((r, i) => ({
      square: args.potencialPassivo <= 0 && i === 0,
      body: `${r.label}: ${r.value} processo(s)`,
      fontSize: ROSCA_SIDE_BODY_PT,
    })),
    { square: false, body: `Total: ${args.totalProc} processo(s)`, fontSize: ROSCA_SIDE_BODY_PT },
  ]
  const remaining = Math.max(0.55, bottom - y)
  const subX = x + (args.potencialPassivo > 0 ? ROSCA_TRAB_SUB_BULLET_INDENT : 0)
  const subW = Math.max(1.2, w - (args.potencialPassivo > 0 ? ROSCA_TRAB_SUB_BULLET_INDENT : 0))
  addPptxSideBulletTable(slide, { x: subX, y, w: subW, h: remaining }, bodyRows)
}

/** Coluna de texto à esquerda da rosca — Cível: mesmo padrão tipográfico dos bullets. */
function addPptxRoscaSideTextCivel(slide: PptxSlide, lay: RoscaTextLay, args: { total: number; sortedSit: { label: string; value: number }[] }) {
  const { textX: x, textY: y, textW: w, textH: h } = lay
  const civelRows: SideBulletRowInput[] = [
    { square: true, body: `Total: ${args.total} processo(s)`, fontSize: ROSCA_SIDE_BODY_PT },
    ...args.sortedSit.map((s) => ({
      square: false,
      body: `${cutLabel(s.label, 28)}: ${s.value} processo(s)`,
      fontSize: ROSCA_SIDE_BODY_PT,
    })),
  ]
  addPptxSideBulletTable(slide, { x, y, w, h }, civelRows)
}

/** Retângulo do gráfico em largura útil com alinhamento e escala. */
function rectFullWidthChart(opts: PptxChartOptions, baseW: number, baseH: number): { x: number; w: number; h: number } {
  const scale = CHART_SIZE_SCALE[opts.chartSize]
  const maxW = CONTENT_W * 0.98
  let w = Math.min(baseW * scale, maxW)
  const h = baseH * scale
  if (w > maxW) w = maxW
  let x = CONTENT_X
  if (opts.chartAlign === 'center') x = CONTENT_X + (CONTENT_W - w) / 2
  if (opts.chartAlign === 'right') x = CONTENT_X + CONTENT_W - w
  return { x, w, h }
}

const DEFAULT_SLIDE_ORDER: PptxSlideBlockId[] = [
  'resumoExecutivo',
  'processosPorCnpj',
  'passivoGeralPorCnpj',
  'processosPorAnoPorArea',
  'passivoTotalPorArea',
  'slideCivel',
  'slideRecuperacao',
  'slideTrabalhista',
  'slideTributario',
  'slideReestruturacao',
  'processosPorAno',
]

export const DEFAULT_CHART_OPTIONS: PptxChartOptions = {
  processosPorCnpj: true,
  passivoGeralPorCnpj: true,
  processosPorAno: false,
  processosPorAnoPorArea: true,
  passivoTotalPorArea: true,
  resumoExecutivo: true,
  slideCivel: true,
  slideTrabalhista: true,
  slideTributario: true,
  slideRecuperacao: true,
  slideReestruturacao: true,
  slideOrder: [...DEFAULT_SLIDE_ORDER],
  chartAlign: 'center',
  chartSize: 'normal',
  areaTextLeftChartRight: true,
}

/** Mescla preferências salvas com padrões e corrige `slideOrder` (ids válidos, sem duplicata). */
export function normalizePptxChartOptions(partial?: Partial<PptxChartOptions>): PptxChartOptions {
  const boolKeys = [
    'processosPorCnpj',
    'passivoGeralPorCnpj',
    'processosPorAno',
    'processosPorAnoPorArea',
    'passivoTotalPorArea',
    'resumoExecutivo',
    'slideCivel',
    'slideTrabalhista',
    'slideTributario',
    'slideRecuperacao',
    'slideReestruturacao',
  ] as const
  const base = { ...DEFAULT_CHART_OPTIONS }
  for (const k of boolKeys) {
    if (partial && typeof partial[k] === 'boolean') base[k] = partial[k]
  }
  const allowed = new Set<string>(PPTX_SLIDE_BLOCK_IDS)
  const order = partial?.slideOrder
  if (!Array.isArray(order) || order.length === 0) {
    base.slideOrder = [...DEFAULT_SLIDE_ORDER]
    return base
  }
  const seen = new Set<string>()
  const cleaned: PptxSlideBlockId[] = []
  for (const id of order) {
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id)
      cleaned.push(id as PptxSlideBlockId)
    }
  }
  for (const id of PPTX_SLIDE_BLOCK_IDS) {
    if (!seen.has(id)) cleaned.push(id)
  }
  base.slideOrder = cleaned

  if (partial?.chartAlign === 'left' || partial?.chartAlign === 'center' || partial?.chartAlign === 'right') {
    base.chartAlign = partial.chartAlign
  }
  if (partial?.chartSize === 'compact' || partial?.chartSize === 'normal' || partial?.chartSize === 'large') {
    base.chartSize = partial.chartSize
  }
  if (typeof partial?.areaTextLeftChartRight === 'boolean') {
    base.areaTextLeftChartRight = partial.areaTextLeftChartRight
  }

  return base
}

/** Calcula o deslocamento Y do conteúdo com base na altura do banner. */
function computeContentOffset(banner: BannerInfo): number {
  const bannerH = banner
    ? SLIDE_W / (banner.width / banner.height)
    : BANNER_H
  return BANNER_Y + bannerH - 0.4
}

/** Gera os slides de conteúdo conforme as opções e a ordem configurada. */
function buildContentSlides(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  todasMetricas: TodasMetricas,
  consolidada: MetricasConsolidadas,
  opts: PptxChartOptions,
  banner: BannerInfo,
  areasData: DueDiligenceAreaRow[],
  structuralDefaults: LeadPptAreaChartDefaults | null,
  chartLabelBgQueue: ChartLabelBgQueue
): void {
  const contentOffset = computeContentOffset(banner)
  const civelRow = areasData.find((a) => a.area === 'civel')
  const trabRow = areasData.find((a) => a.area === 'trabalhista')
  for (const blockId of opts.slideOrder) {
    if (!opts[blockId]) continue
    switch (blockId) {
      case 'processosPorCnpj':
        addProcessosPorCnpjSlide(pptx, lead, consolidada, banner, contentOffset, opts, structuralDefaults, chartLabelBgQueue)
        break
      case 'passivoGeralPorCnpj':
        addPassivoGeralPorCnpjSlide(pptx, lead, consolidada, banner, contentOffset, opts)
        break
      case 'processosPorAno':
        addProcessosPorAnoSlide(pptx, consolidada, banner, contentOffset, opts, structuralDefaults, chartLabelBgQueue)
        break
      case 'processosPorAnoPorArea':
        addProcessosPorAnoPorAreaSlide(pptx, todasMetricas, banner, contentOffset, opts, structuralDefaults, chartLabelBgQueue)
        break
      case 'passivoTotalPorArea':
        addPassivoTotalPorAreaSlide(pptx, todasMetricas, banner, contentOffset, opts, structuralDefaults, chartLabelBgQueue)
        break
      case 'resumoExecutivo':
        addResumoSlide(pptx, todasMetricas, banner, contentOffset, opts)
        break
      case 'slideCivel':
        addCivelSlides(
          pptx,
          lead,
          structuralDefaults,
          todasMetricas,
          banner,
          contentOffset,
          mergeChartOptionsForArea(opts, civelRow),
          chartLabelBgQueue,
          civelRow
        )
        break
      case 'slideRecuperacao':
        addRecuperacaoSlide(pptx, lead, structuralDefaults, todasMetricas, banner, contentOffset, opts, chartLabelBgQueue)
        break
      case 'slideTrabalhista':
        addTrabalhistaSlide(
          pptx,
          lead,
          structuralDefaults,
          todasMetricas,
          banner,
          contentOffset,
          mergeChartOptionsForArea(opts, trabRow),
          chartLabelBgQueue,
          trabRow
        )
        break
      case 'slideTributario':
        addTributarioSlide(pptx, lead, structuralDefaults, todasMetricas, banner, contentOffset, opts, chartLabelBgQueue)
        break
      case 'slideReestruturacao':
        addReestruturacaoSlide(pptx, lead, structuralDefaults, todasMetricas, banner, contentOffset, opts, chartLabelBgQueue)
        break
      default:
        break
    }
  }
}

export interface BuildPptxResult {
  buffer: ArrayBuffer
  fileName: string
}

/** Mescla opções globais do PPT com prefs gravadas na área (`area_chart_options`). */
export function mergeChartOptionsForArea(
  global: PptxChartOptions,
  area: DueDiligenceAreaRow | undefined
): PptxChartOptions {
  if (!area?.area_chart_options || typeof area.area_chart_options !== 'object') return global
  const partial = area.area_chart_options as Partial<PptxChartOptions> & { enabledBlockIds?: string[] }
  const next = normalizePptxChartOptions({ ...global, ...partial })
  if (Array.isArray(partial.enabledBlockIds) && partial.enabledBlockIds.length > 0) {
    const allowed = new Set(partial.enabledBlockIds)
    const asBool = next as unknown as Record<string, boolean>
    for (const id of PPTX_SLIDE_BLOCK_IDS) {
      asBool[id] = allowed.has(id)
    }
  }
  return next
}

/** Opções efetivas por área para blocos multi-slide (Cível, Trabalhista). */
export function getEffectiveChartOptionsForAreas(
  global: PptxChartOptions,
  areasData: DueDiligenceAreaRow[]
): Map<DueDiligenceAreaId, PptxChartOptions> {
  const map = new Map<DueDiligenceAreaId, PptxChartOptions>()
  for (const a of areasData) {
    map.set(a.area, mergeChartOptionsForArea(global, a))
  }
  return map
}

export async function buildDueDiligencePptx(
  lead: DueDiligenceLead,
  areasData: DueDiligenceAreaRow[],
  todasMetricas: TodasMetricas,
  chartOptions?: Partial<PptxChartOptions>,
  options?: { download?: boolean; structuralChartDefaults?: LeadPptAreaChartDefaults | null }
): Promise<BuildPptxResult> {
  const structuralDefaults = options?.structuralChartDefaults ?? null
  const opts = normalizePptxChartOptions(chartOptions)
  const safeName = lead.razao_social.replace(/[^\w\s-]/g, '').slice(0, 50) || 'Due-Diligence'
  const fileName = `Due-Diligence-${safeName}.pptx`

  const areasMap = new Map<DueDiligenceAreaId, Record<string, unknown> | null>()
  for (const a of areasData) {
    if (a.skipped_presentation) areasMap.set(a.area, null)
    else areasMap.set(a.area, a.parsed_data ?? null)
  }
  const consolidada = calcularMetricasConsolidadas(areasMap)

  const pptx = new PptxGenJS()
  pptx.title = `Due Diligence - ${lead.razao_social}`
  pptx.author = 'Bismarchi | Pires'
  pptx.defineLayout({ name: 'WIDESCREEN', width: SLIDE_W, height: SLIDE_H })
  pptx.layout = 'WIDESCREEN'
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  await addIntroSlides(pptx, lead)
  const banner = await loadBannerWithDimensions(BANNER_URLS)
  const chartLabelBgQueue: ChartLabelBgQueue = []
  buildContentSlides(pptx, lead, todasMetricas, consolidada, opts, banner, areasData, structuralDefaults, chartLabelBgQueue)

  const rawBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  const buffer = await applyDataLabelBackgroundsToPptxBuffer(rawBuffer, chartLabelBgQueue)
  const shouldDownload = options?.download !== false
  if (shouldDownload && typeof document !== 'undefined') {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
  return { buffer, fileName }
}
