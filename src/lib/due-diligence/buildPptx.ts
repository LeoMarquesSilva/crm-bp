/**
 * Geração do PowerPoint de Due Diligence a partir das métricas e dados do lead.
 * Slide 1: capa gerada com nome do cliente. Slides 2-4: imagens do modelo.
 * Em seguida: Passivo por área, Resumo, e slides por área apenas quando houver dados.
 * Sem merge OOXML para evitar corrupção/aviso de reparar.
 */
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import type { DueDiligenceLead, DueDiligenceAreaRow, DueDiligenceAreaId } from './types'
import { calcularMetricasConsolidadas, type TodasMetricas, type MetricasConsolidadas } from './metrics'

/** Verde água para fundo dos rótulos de dados (hex sem #) */
const AQUA_LABEL_BG = '20B2AA'

/** Adiciona fundo verde água nos rótulos de dados dos gráficos via pós-processamento OOXML */
async function addAquaBackgroundToDataLabels(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  const spPrAqua = `<c:spPr><a:solidFill><a:srgbClr val="${AQUA_LABEL_BG}"/></a:solidFill></c:spPr>`
  const chartFiles = Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))
  for (const name of chartFiles) {
    const f = zip.files[name]
    if (!f || f.dir) continue
    let xml = await f.async('string')
    if (xml.includes('<c:dLbls>')) {
      xml = xml.replace(/<c:dLbls>/g, `<c:dLbls>${spPrAqua}`)
      zip.file(name, xml)
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' })
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

function cutLabel(label: string, max = 14): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

/** Abrevia labels de assuntos trabalhistas para exibição no gráfico (ex.: "Adicional de Insalubridade" → "Insalubridade") */
const ASSUNTO_ABREV: Record<string, string> = {
  'Adicional de Insalubridade': 'Insalubridade',
  'Adicional de Periculosidade': 'Periculosidade',
  'Adicional Noturno': 'Adicional noturno',
  'Multa do Artigo 477 da CLT': 'Multa 477 CLT',
  'Multa do Artigo 467 da CLT': 'Multa 467 CLT',
  'Indenização por Dano Moral': 'Dano moral',
  'Horas Extras': 'Horas extras',
  'Verbas Rescisórias': 'Verbas rescisórias',
  'Rescisão Indireta': 'Rescisão indireta',
  'Acúmulo de Função': 'Acúmulo de função',
  'Salário por Acúmulo de Cargo/Função': 'Acúmulo de função',
  'Multa de 40% do FGTS': 'Multa 40% FGTS',
  'Aviso Prévio': 'Aviso prévio',
  'Férias Proporcionais': 'Férias proporcionais',
  'Décimo Terceiro Salário': '13º salário',
  'Décimo Terceiro Salário Proporcional': '13º proporcional',
  'Termo de Rescisão Contratual': 'Termo rescisão',
  'Responsabilidade Solidária/Subsidiária': 'Resp. solidária',
  'Salário por Fora - Integração': 'Salário por fora',
  'Integração em Verbas Rescisórias': 'Integração verbas',
  'Intervalo Intrajornada': 'Intervalo intrajornada',
  'Contrato de Experiência': 'Contrato experiência',
  'Contrato de Experiência - Nulidade': 'Contrato experiência',
  'Honorários Periciais': 'Honorários periciais',
  'Honorários na Justiça do Trabalho': 'Honorários JT',
  'Sucumbenciais': 'Sucumbenciais',
  'Liberação/Entrega das Guias': 'Liberação guias',
  'Levantamento do FGTS': 'Levantamento FGTS',
  'Estabilidade Provisória': 'Estabilidade provisória',
  'Dispensa Discriminatória': 'Dispensa discriminatória',
  'Reintegração/Readmissão ou Indenização Substitutiva': 'Reintegração',
  'Rescisão do Contrato de Trabalho': 'Rescisão contrato',
  'Dispensa / Rescisão do Contrato de Trabalho': 'Rescisão contrato',
  'Desconfiguração de Justa Causa': 'Desconfig. justa causa',
  'Descontos Indevidos': 'Descontos indevidos',
  'Descontos Salariais - Devolução': 'Descontos salariais',
  'Outros Descontos Salariais': 'Outros descontos',
  'Prorrogação do Horário Noturno': 'Prorrogação noturno',
  'Outros Agentes Insalubres': 'Outros insalubres',
  'Multa Prevista em Norma Coletiva': 'Multa norma coletiva',
  'Enquadramento Sindical': 'Enquadramento sindical',
  'Indenização por Dano Material': 'Dano material',
  'Indenização por Rescisão Antecipada do Contrato a Termo': 'Rescisão antecipada',
  'Plano de Saúde': 'Plano de saúde',
  'Seguro Desemprego': 'Seguro desemprego',
  'DIREITO DO TRABALHO': 'Direito do trabalho',
  'Direito Individual do Trabalho': 'Direito individual',
  'Adicional': 'Adicional',
  'Verbas Remuneratórias, Indenizatórias e Benefícios': 'Verbas remuneratórias',
  'N/F': 'N/F',
}
function shortenAssunto(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, ' ')
  return ASSUNTO_ABREV[trimmed] ?? trimmed
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
  contentOffset: number
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
    slide.addChart(pptx.ChartType.bar, [{ name: 'Processos', labels, values }], {
      x: 0.5,
      y: o(1.2),
      w: 9,
      h: 4,
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
  slide.addText(`Total: ${cons.totalProcessos} processos`, TXT({ x: CONTENT_X, y: o(5.2), w: CONTENT_W, h: 0.35, fontSize: 12, bold: true }))
}

/** Slide: Passivo geral por CNPJ – nome, processos, valor envolvido, valor concursal. */
function addPassivoGeralPorCnpjSlide(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  cons: MetricasConsolidadas,
  banner: BannerInfo,
  contentOffset: number
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
function addProcessosPorAnoSlide(pptx: PptxGenJS, cons: MetricasConsolidadas, banner: BannerInfo, contentOffset: number): void {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Processos por ano', banner)
  const o = (y: number) => y + contentOffset
  slide.addText('Todas as áreas consolidadas', TXT({ x: CONTENT_X, y: o(0.65), w: CONTENT_W, h: 0.3, fontSize: 12, color: '666666' }))
  const sortedAno = [...cons.processosPorAno].filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
  const labels = sortedAno.map((p) => p.label)
  const values = sortedAno.map((p) => p.value)
  if (labels.length > 0) {
    slide.addChart(pptx.ChartType.bar, [{ name: 'Processos', labels, values }], {
      x: CONTENT_X,
      y: o(1),
      w: CONTENT_W,
      h: 4.2,
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

/** Slide: passivo/crédito total por área (gráfico de barras). */
function addPassivoTotalPorAreaSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
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
    slide.addChart(pptx.ChartType.bar, [{ name: 'Valor', labels, values }], {
      x: CONTENT_X,
      y: o(0.9),
      w: CONTENT_W,
      h: 4.5,
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

function addResumoSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Resumo Executivo', banner)
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
  slide.addText(items.length > 0 ? items.join('\n') : 'Nenhum dado disponível.', TXT({ x: CONTENT_X, y: o(0.9), w: CONTENT_W, h: 3.5, fontSize: 12 }))
}

function addAreaSlide(
  pptx: PptxGenJS,
  areaLabel: string,
  content: string[],
  chartData: { labels: string[]; values: number[] } | undefined,
  banner: BannerInfo,
  contentOffset: number
) {
  const slide = pptx.addSlide()
  addSlideHeader(slide, `Área: ${areaLabel}`, banner)
  const o = (y: number) => y + contentOffset
  const colW = CONTENT_W * 0.55
  const chartW = CONTENT_W * 0.4
  const chartX = CONTENT_X + colW + 0.3
  slide.addText(content.join('\n'), TXT({ x: CONTENT_X, y: o(0.9), w: colW, h: 4, fontSize: 11 }))
  if (chartData && chartData.labels.length > 0 && chartData.values.length > 0) {
    const cd = chartData
    const sorted = cd.labels
      .map((l, i) => ({ label: l, value: cd.values[i] ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    if (sorted.length > 0) {
    slide.addChart(pptx.ChartType.bar, [{ name: '', labels: sorted.map((s) => s.label), values: sorted.map((s) => s.value) }], {
      x: chartX,
      y: o(1.2),
      w: chartW,
      h: 3.5,
      barDir: 'col',
      showLegend: false,
      showValue: true,
      chartColors: BRAND.chartColors,
      valAxisLabelFontFace: FONT,
      catAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 10,
      catAxisLabelFontSize: 10,
      ...CHART_GRID_OFF,
      ...CHART_DATA_LABEL,
    })
    }
  }
}

function addCivelSlides(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const c = m.civel
  if (!c) return
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
  addAreaSlide(pptx, 'Cível', lines, porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined, banner, contentOffset)
}

/** Slide Trabalhista: Processos ativos vs arquivados (pizza) */
function addTrabalhistaAtivosArquivadosSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const t = m.trabalhista
  if (!t || !t.ativosVsArquivados.length) return
  const filtered = t.ativosVsArquivados.filter((x) => x.value > 0)
  if (!filtered.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Trabalhista – Processos ativos e arquivados', banner)
  const o = (y: number) => y + contentOffset
  const sorted = [...filtered].sort((a, b) => b.value - a.value)
  const chartData = [
    { name: 'Processos', labels: sorted.map((x) => x.label), values: sorted.map((x) => x.value) },
  ]
  slide.addChart(pptx.ChartType.pie, chartData, {
    x: CONTENT_X + (CONTENT_W - 5.5) / 2,
    y: o(0.9),
    w: 5.5,
    h: 4,
    showLegend: true,
    showPercent: true,
    showValue: true,
    chartColors: BRAND.chartColors,
    legendFontFace: FONT,
    legendFontSize: 12,
    titleFontFace: FONT,
    ...CHART_GRID_OFF,
    ...CHART_DATA_LABEL,
  })
}

/** Slide Trabalhista: Fase processual – processos ativos e suspensos (total e valor por fase) */
function addTrabalhistaFaseSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const t = m.trabalhista
  if (!t || !t.porFaseAtivosSuspensos.length) return
  const filtered = t.porFaseAtivosSuspensos.filter((x) => x.count > 0)
  if (!filtered.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Fase processual – Processos ativos e suspensos', banner)
  const o = (y: number) => y + contentOffset
  slide.addText('Total de processos por fase e valor envolvido por fase', TXT({ x: CONTENT_X, y: o(0.6), w: CONTENT_W, h: 0.3, fontSize: 12, color: '666666' }))
  const chartData = [
    {
      name: 'Processos',
      labels: filtered.map((x) => cutLabel(x.label, 10)),
      values: filtered.map((x) => x.count),
    },
  ]
  slide.addChart(pptx.ChartType.bar, chartData, {
    x: CONTENT_X,
    y: o(1),
    w: 5.5,
    h: 4,
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
  const lines = filtered.map((x) => `${x.label}: ${x.count} processos – ${fmtMoney(x.valor)}`)
  const colGap = 0.3
  slide.addText(lines.join('\n'), TXT({ x: CONTENT_X + 5.5 + colGap, y: o(1), w: CONTENT_W - 5.5 - colGap, h: 4, fontSize: 11 }))
}

/** Slide Trabalhista: Principais pedidos (assuntos agregados ou tipo_pedido), com métricas */
function addTrabalhistaPrincipaisPedidosSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const t = m.trabalhista
  if (!t) return
  const dados = (t.assuntosAgregados.length ? t.assuntosAgregados : t.pedidosRecorrentes).filter((x) => x.value > 0)
  if (!dados.length) return
  const slide = pptx.addSlide()
  addSlideHeader(slide, 'Principais pedidos', banner)
  const o = (y: number) => y + contentOffset
  slide.addText(`Potencial Passivo Trabalhista: ${fmtMoney(t.potencialPassivo)}`, TXT({ x: CONTENT_X, y: o(0.55), w: CONTENT_W, h: 0.25, fontSize: 11 }))
  slide.addText(`Média valor de causa: ${fmtMoney(t.mediaValorCausa)}`, TXT({ x: CONTENT_X, y: o(0.78), w: CONTENT_W, h: 0.25, fontSize: 11 }))
  const sortedDesc = [...dados].sort((a, b) => b.value - a.value).slice(0, 12)
  const sorted = [...sortedDesc].reverse()
  const labels = t.assuntosAgregados.length ? sorted.map((x) => shortenAssunto(x.label)) : sorted.map((x) => cutLabel(x.label, 18))
  const chartData = [{ name: 'Quantidade', labels, values: sorted.map((x) => x.value) }]
  slide.addChart(pptx.ChartType.bar, chartData, {
    x: CONTENT_X,
    y: o(1.05),
    w: 6,
    h: 4,
    barDir: 'bar',
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
  const top2 = sortedDesc.slice(0, 2).map((x) => (t.assuntosAgregados.length ? shortenAssunto(x.label) : x.label))
  const pedColX = CONTENT_X + 6.3
  const pedColW = CONTENT_W - 6.3
  slide.addText(
    'Observa-se que os principais pedidos das reclamações trabalhistas são:',
    TXT({ x: pedColX, y: o(1.2), w: pedColW, h: 0.5, fontSize: 10 })
  )
  slide.addText(top2.map((l) => `• ${l}`).join('\n'), TXT({ x: pedColX, y: o(1.7), w: pedColW, h: 0.8, fontSize: 10 }))
}

function addTrabalhistaSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const t = m.trabalhista
  if (!t) return
  addTrabalhistaAtivosArquivadosSlide(pptx, m, banner, contentOffset)
  addTrabalhistaFaseSlide(pptx, m, banner, contentOffset)
  addTrabalhistaPrincipaisPedidosSlide(pptx, m, banner, contentOffset)
  const porFaseFilt = t.porFase.filter((x) => x.value > 0)
  const lines = [
    ...(t.potencialPassivo > 0 ? [`Potencial passivo trabalhista: ${fmtMoney(t.potencialPassivo)}`] : []),
    `Total de processos: ${t.totalProcessos}`,
    ...(t.mediaValorCausa > 0 ? [`Média do valor da causa: ${fmtMoney(t.mediaValorCausa)}`] : []),
    '',
    'Por fase: ' + (porFaseFilt.map((x) => `${x.label}: ${x.value} (${fmtMoney(x.valor)})`).join('; ') || '—'),
    'Por ano: ' + (t.porAno.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value}`).join(', ') || '—'),
  ]
  addAreaSlide(pptx, 'Trabalhista', lines, porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined, banner, contentOffset)
}

function addTributarioSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
  const t = m.tributario
  if (!t) return
  const listaFiltrada = t.listaJudicial.filter((x) => x.valor > 0).slice(0, 8)
  const lines = [
    ...(t.passivoJudicial > 0 ? [`Passivo judicial: ${fmtMoney(t.passivoJudicial)}`] : []),
    ...(t.passivoAdministrativo > 0 ? [`Passivo administrativo: ${fmtMoney(t.passivoAdministrativo)}`] : []),
    ...(listaFiltrada.length ? ['', ...listaFiltrada.map((x) => `${x.tipo} (${x.ano}): ${fmtMoney(x.valor)}`)] : []),
  ]
  if (lines.length === 0) lines.push('Nenhum dado disponível.')
  addAreaSlide(pptx, 'Tributário', lines, undefined, banner, contentOffset)
}

function addRecuperacaoSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
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
  addAreaSlide(pptx, 'Recuperação de Créditos', lines, porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined, banner, contentOffset)
}

function addReestruturacaoSlide(pptx: PptxGenJS, m: TodasMetricas, banner: BannerInfo, contentOffset: number) {
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
  addAreaSlide(pptx, 'Reestruturação', lines, porFaseFilt.length ? { labels: porFaseFilt.map((x) => x.label), values: porFaseFilt.map((x) => x.value) } : undefined, banner, contentOffset)
}

/** Opções de slides/gráficos a exibir no PowerPoint */
export interface PptxChartOptions {
  processosPorCnpj: boolean
  passivoGeralPorCnpj: boolean
  processosPorAno: boolean
  passivoTotalPorArea: boolean
  resumoExecutivo: boolean
  slideCivel: boolean
  slideTrabalhista: boolean
  slideTributario: boolean
  slideRecuperacao: boolean
  slideReestruturacao: boolean
}

export const DEFAULT_CHART_OPTIONS: PptxChartOptions = {
  processosPorCnpj: true,
  passivoGeralPorCnpj: true,
  processosPorAno: true,
  passivoTotalPorArea: true,
  resumoExecutivo: true,
  slideCivel: true,
  slideTrabalhista: true,
  slideTributario: true,
  slideRecuperacao: true,
  slideReestruturacao: true,
}

/** Calcula o deslocamento Y do conteúdo com base na altura do banner. */
function computeContentOffset(banner: BannerInfo): number {
  const bannerH = banner
    ? SLIDE_W / (banner.width / banner.height)
    : BANNER_H
  return BANNER_Y + bannerH - 0.4
}

/** Gera os slides de conteúdo conforme as opções. */
function buildContentSlides(
  pptx: PptxGenJS,
  lead: DueDiligenceLead,
  todasMetricas: TodasMetricas,
  consolidada: MetricasConsolidadas,
  opts: PptxChartOptions,
  banner: BannerInfo
): void {
  const contentOffset = computeContentOffset(banner)
  if (opts.processosPorCnpj) addProcessosPorCnpjSlide(pptx, lead, consolidada, banner, contentOffset)
  if (opts.passivoGeralPorCnpj) addPassivoGeralPorCnpjSlide(pptx, lead, consolidada, banner, contentOffset)
  if (opts.processosPorAno) addProcessosPorAnoSlide(pptx, consolidada, banner, contentOffset)
  if (opts.passivoTotalPorArea) addPassivoTotalPorAreaSlide(pptx, todasMetricas, banner, contentOffset)
  if (opts.resumoExecutivo) addResumoSlide(pptx, todasMetricas, banner, contentOffset)
  if (opts.slideCivel) addCivelSlides(pptx, todasMetricas, banner, contentOffset)
  if (opts.slideRecuperacao) addRecuperacaoSlide(pptx, todasMetricas, banner, contentOffset)
  if (opts.slideTrabalhista) addTrabalhistaSlide(pptx, todasMetricas, banner, contentOffset)
  if (opts.slideTributario) addTributarioSlide(pptx, todasMetricas, banner, contentOffset)
  if (opts.slideReestruturacao) addReestruturacaoSlide(pptx, todasMetricas, banner, contentOffset)
}

export type BuildPptxResult = Record<string, never>

export async function buildDueDiligencePptx(
  lead: DueDiligenceLead,
  areasData: DueDiligenceAreaRow[],
  todasMetricas: TodasMetricas,
  chartOptions?: Partial<PptxChartOptions>
): Promise<BuildPptxResult> {
  const opts = { ...DEFAULT_CHART_OPTIONS, ...chartOptions }
  const safeName = lead.razao_social.replace(/[^\w\s-]/g, '').slice(0, 50) || 'Due-Diligence'
  const fileName = `Due-Diligence-${safeName}.pptx`

  const areasMap = new Map<DueDiligenceAreaId, Record<string, unknown> | null>()
  for (const a of areasData) {
    areasMap.set(a.area, a.parsed_data ?? null)
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
  buildContentSlides(pptx, lead, todasMetricas, consolidada, opts, banner)

  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  const modifiedBuffer = await addAquaBackgroundToDataLabels(buffer)
  if (typeof document !== 'undefined') {
    const blob = new Blob([modifiedBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
  return {}
}
