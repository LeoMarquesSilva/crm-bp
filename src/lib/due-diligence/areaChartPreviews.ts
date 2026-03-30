/**
 * Monta a lista de slides/gráficos passíveis de pré-visualização no modal por área,
 * espelhando o que o buildPptx gera.
 */
import type { TodasMetricas } from './metrics'
import { DUE_DILIGENCE_AREAS, type AreaChartKindOverride, type AreaChartOptionsPartial, type DueDiligenceAreaId, type DueDiligenceAreaRow } from './types'

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export type AreaChartPreviewKind = 'pie' | 'donut' | 'bar' | 'barH' | 'line' | 'table' | 'text'

/** Opções do seletor “Tipo de gráfico” no modal */
export const AREA_CHART_KIND_OPTIONS: { value: AreaChartKindOverride; label: string }[] = [
  { value: 'pie', label: 'Pizza' },
  { value: 'donut', label: 'Rosca' },
  { value: 'bar', label: 'Barras verticais' },
  { value: 'barH', label: 'Barras horizontais' },
  { value: 'line', label: 'Linha' },
]

export function chartSlideSupportsKindPicker(slide: AreaChartPreviewSlide): boolean {
  const k = slide.kind
  return k === 'pie' || k === 'donut' || k === 'bar' || k === 'barH' || k === 'line'
}

export interface AreaChartPreviewSlide {
  id: string
  defaultTitle: string
  description: string
  kind: AreaChartPreviewKind
  /** Série principal para Recharts */
  series: { label: string; value: number }[]
  table?: { headers: string[]; rows: string[][] }
  textLines?: string[]
  /** Exibir checkbox “incluir no PPT” */
  toggleable: boolean
}

function cut(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function buildAreaChartPreviewSlides(
  areaId: DueDiligenceAreaId,
  todas: TodasMetricas,
  areaRow: DueDiligenceAreaRow
): AreaChartPreviewSlide[] {
  if (areaId === 'civel') {
    const c = todas.civel
    if (!c) {
      return [
        {
          id: 'civel_rosca',
          defaultTitle: 'Cível – Passivo por situação (rosca)',
          description: 'Sem dados de Cível importados para este lead.',
          kind: 'text',
          series: [],
          textLines: ['Carregue a planilha da área Cível para ver a prévia dos gráficos.'],
          toggleable: true,
        },
      ]
    }
    const manual = areaRow.manual_process_slides ?? []
    const tableCriticos =
      manual.length > 0
        ? {
            headers: ['Processo', 'Classe', 'Risco', 'Valor', 'Vara'],
            rows: manual.slice(0, 8).map((r) => [
              cut(String(r.numero_processo ?? '—'), 14),
              cut(String(r.classe ?? '—'), 16),
              cut(String(r.resumo_risco ?? '—'), 14),
              cut(String(r.valor_causa ?? '—'), 12),
              cut(String(r.vara ?? '—'), 14),
            ]),
          }
        : undefined

    return [
      {
        id: 'civel_rosca',
        defaultTitle: 'Cível – Passivo por situação (rosca)',
        description: 'Quantidade de processos por situação/status, com total no centro.',
        kind: 'donut',
        series: c.porSituacao.filter((x) => x.value > 0).map((x) => ({ label: x.label, value: x.value })),
        toggleable: true,
      },
      {
        id: 'civel_socio',
        defaultTitle: 'Cível – Sócio polo passivo',
        description: 'Processos por sócio no polo passivo (barras horizontais).',
        kind: 'barH',
        series: c.socioPoloPassivo.filter((x) => x.value > 0).map((x) => ({ label: cut(x.label, 24), value: x.value })),
        toggleable: true,
      },
      {
        id: 'civel_tipo_acao',
        defaultTitle: 'Cível – Processos por tipo de ação',
        description: 'Distribuição por tipo/classe de ação.',
        kind: 'bar',
        series: c.porTipo.filter((x) => x.value > 0).map((x) => ({ label: cut(x.label, 18), value: x.value })),
        toggleable: true,
      },
      {
        id: 'civel_tabela_polos',
        defaultTitle: 'Cível – Polos e valores',
        description: 'Tabela resumo polo passivo / ativo e valores de causa.',
        kind: 'table',
        series: [],
        table: {
          headers: ['Polo', 'Valor'],
          rows: [
            ['Passivo (cliente)', fmtMoney(c.valorPoloPassivo)],
            ['Ativo (cliente)', fmtMoney(c.valorPoloAtivo)],
          ],
        },
        toggleable: true,
      },
      {
        id: 'civel_criticos',
        defaultTitle: 'Cível – Processos críticos',
        description: 'Tabela com processos escolhidos em “Detalhar processos” / críticos.',
        kind: manual.length ? 'table' : 'text',
        series: [],
        table: tableCriticos,
        textLines: manual.length
          ? undefined
          : ['Marque processos e salve em “Detalhar processos” para ver a prévia, ou desative este slide.'],
        toggleable: true,
      },
      {
        id: 'civel_resumo_area',
        defaultTitle: 'Cível – Resumo (texto + mini gráfico por fase)',
        description: 'Slide consolidado com totais e gráfico por fase (sempre gerado com o bloco Cível).',
        kind: 'bar',
        series: c.porFase.filter((x) => x.value > 0).map((x) => ({ label: cut(x.label, 14), value: x.value })),
        toggleable: false,
      },
    ]
  }

  if (areaId === 'trabalhista') {
    const t = todas.trabalhista
    if (!t) {
      return [
        {
          id: 'trab_pizza',
          defaultTitle: 'Trabalhista – Ativos x arquivados',
          description: 'Sem dados trabalhistas.',
          kind: 'text',
          series: [],
          textLines: ['Carregue a planilha Trabalhista para ver as prévias.'],
          toggleable: true,
        },
      ]
    }
    const dadosPedidos = (t.assuntosAgregados.length ? t.assuntosAgregados : t.pedidosRecorrentes).filter((x) => x.value > 0)
    const faseRows = t.porFaseAtivosSuspensos
      .filter((x) => x.count > 0)
      .map((x) => [x.label, String(x.count), fmtMoney(x.valor)])

    return [
      {
        id: 'trab_pizza',
        defaultTitle: 'Trabalhista – Processos ativos e arquivados',
        description: 'Rosca por status (rótulos dentro das fatias + total no centro); no PPT também o potencial passivo.',
        kind: 'donut',
        series: t.ativosVsArquivados.filter((x) => x.value > 0).map((x) => ({ label: x.label, value: x.value })),
        textLines:
          t.potencialPassivo > 0 ? ['Potencial passivo', fmtMoney(t.potencialPassivo)] : undefined,
        toggleable: true,
      },
      {
        id: 'trab_fase',
        defaultTitle: 'Fase processual – ativos e suspensos',
        description: 'Barras por fase + tabela com quantidade e valor envolvido.',
        kind: 'bar',
        series: t.porFaseAtivosSuspensos.filter((x) => x.count > 0).map((x) => ({ label: cut(x.label, 12), value: x.count })),
        table:
          faseRows.length > 0
            ? { headers: ['Fase', 'Processos', 'Valor envolvido'], rows: faseRows }
            : undefined,
        toggleable: true,
      },
      {
        id: 'trab_principais_pedidos',
        defaultTitle: 'Principais pedidos',
        description: 'Barras horizontais — assuntos ou tipo de pedido agregados.',
        kind: 'barH',
        series: [...dadosPedidos]
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
          .map((x) => ({ label: cut(x.label, 28), value: x.value })),
        toggleable: true,
      },
      {
        id: 'trab_linha_ano',
        defaultTitle: 'Processos distribuídos por ano',
        description: 'Linha temporal; no PPT entra texto automático do ano de pico.',
        kind: 'line',
        series: [...t.porAno]
          .filter((p) => p.value > 0 && p.label !== '—')
          .sort((a, b) => {
            const na = parseInt(a.label, 10)
            const nb = parseInt(b.label, 10)
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
            return a.label.localeCompare(b.label)
          })
          .map((p) => ({ label: p.label, value: p.value })),
        textLines: t.textoResumoAno ? [t.textoResumoAno] : undefined,
        toggleable: true,
      },
      {
        id: 'trab_cascata',
        defaultTitle: 'Pedidos por processo (principais)',
        description: 'Barras horizontais por par processo × pedido.',
        kind: 'barH',
        series: [...t.pedidosPorProcesso]
          .filter((p) => p.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map((p) => ({
            label: cut(`${p.processo} — ${p.pedido}`, 32),
            value: p.count,
          })),
        toggleable: true,
      },
      {
        id: 'trab_audiencias',
        defaultTitle: 'Próximas audiências (opcional)',
        description: 'Lista textual; só entra no PPT se estiver marcado.',
        kind: 'text',
        series: [],
        textLines:
          t.proximasAudiencias.length > 0
            ? t.proximasAudiencias.slice(0, 12).map((a) => `• ${a.processo}: ${a.data}`)
            : ['Nenhuma data de audiência encontrada nas colunas mapeadas.'],
        toggleable: true,
      },
      {
        id: 'trab_casos',
        defaultTitle: 'Casos relevantes (opcional)',
        description: 'Lista textual a partir de flags/colunas nos dados.',
        kind: 'text',
        series: [],
        textLines:
          t.casosRelevantes.length > 0
            ? t.casosRelevantes.slice(0, 12).map((c) => `• ${c.processo}: ${c.texto}`)
            : ['Nenhum caso marcado como relevante.'],
        toggleable: true,
      },
      {
        id: 'trab_resumo_area',
        defaultTitle: 'Trabalhista – Resumo (texto + gráfico)',
        description: 'Slide final do bloco com totais e gráfico por fase.',
        kind: 'bar',
        series: t.porFase.filter((x) => x.value > 0).map((x) => ({ label: cut(x.label, 14), value: x.value })),
        toggleable: false,
      },
    ]
  }

  return [
    {
      id: 'generic',
      defaultTitle: areaId,
      description: 'Esta área usa apenas as opções globais “Gráficos a exibir”.',
      kind: 'text',
      series: [],
      textLines: ['Não há sub-gráficos configuráveis por área para Tributário, Recuperação ou Reestruturação neste modal.'],
      toggleable: false,
    },
  ]
}

/** Catálogo estável de slides de gráfico (ids = buildPptx + modal por área). Para página global de prefs. */
export interface GlobalChartSlideCatalogEntry {
  id: string
  areaId: DueDiligenceAreaId
  defaultTitle: string
  defaultKind: AreaChartPreviewKind
  supportsKindPicker: boolean
}

function areaLabel(id: DueDiligenceAreaId): string {
  return DUE_DILIGENCE_AREAS.find((a) => a.id === id)?.label ?? id
}

export const DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG: GlobalChartSlideCatalogEntry[] = [
  { id: 'civel_rosca', areaId: 'civel', defaultTitle: 'Cível – Passivo por situação (rosca)', defaultKind: 'donut', supportsKindPicker: true },
  { id: 'civel_socio', areaId: 'civel', defaultTitle: 'Cível – Sócio polo passivo', defaultKind: 'barH', supportsKindPicker: true },
  { id: 'civel_tipo_acao', areaId: 'civel', defaultTitle: 'Cível – Processos por tipo de ação', defaultKind: 'bar', supportsKindPicker: true },
  { id: 'civel_tabela_polos', areaId: 'civel', defaultTitle: 'Cível – Polos e valores', defaultKind: 'table', supportsKindPicker: false },
  { id: 'civel_criticos', areaId: 'civel', defaultTitle: 'Cível – Processos críticos', defaultKind: 'table', supportsKindPicker: false },
  { id: 'civel_resumo_area', areaId: 'civel', defaultTitle: 'Cível – Resumo da área', defaultKind: 'bar', supportsKindPicker: true },
  { id: 'trab_pizza', areaId: 'trabalhista', defaultTitle: 'Trabalhista – Processos ativos e arquivados', defaultKind: 'donut', supportsKindPicker: true },
  { id: 'trab_fase', areaId: 'trabalhista', defaultTitle: 'Fase processual – ativos e suspensos', defaultKind: 'bar', supportsKindPicker: true },
  { id: 'trab_principais_pedidos', areaId: 'trabalhista', defaultTitle: 'Principais pedidos', defaultKind: 'barH', supportsKindPicker: true },
  { id: 'trab_linha_ano', areaId: 'trabalhista', defaultTitle: 'Processos distribuídos por ano', defaultKind: 'line', supportsKindPicker: true },
  { id: 'trab_cascata', areaId: 'trabalhista', defaultTitle: 'Pedidos por processo (principais)', defaultKind: 'barH', supportsKindPicker: true },
  { id: 'trab_audiencias', areaId: 'trabalhista', defaultTitle: 'Próximas audiências', defaultKind: 'text', supportsKindPicker: false },
  { id: 'trab_casos', areaId: 'trabalhista', defaultTitle: 'Casos relevantes', defaultKind: 'text', supportsKindPicker: false },
  { id: 'trab_resumo_area', areaId: 'trabalhista', defaultTitle: 'Trabalhista – Resumo da área', defaultKind: 'bar', supportsKindPicker: true },
]

export function globalCatalogAreaLabel(entry: GlobalChartSlideCatalogEntry): string {
  return areaLabel(entry.areaId)
}

/** Mapeia id da prévia → chave booleana em AreaChartOptionsPartial (quando existe). */
export function previewIdToOptionKey(previewId: string): keyof AreaChartOptionsPartial | null {
  const map: Record<string, keyof AreaChartOptionsPartial> = {
    civel_rosca: 'civelShowRosca',
    civel_socio: 'civelShowSocio',
    civel_tipo_acao: 'civelShowTipoAcao',
    civel_tabela_polos: 'civelShowTabelaPolos',
    civel_criticos: 'civelShowCriticos',
    trab_pizza: 'trabalhistaShowPizza',
    trab_fase: 'trabalhistaShowFase',
    trab_principais_pedidos: 'trabalhistaShowPrincipaisPedidos',
    trab_linha_ano: 'trabalhistaShowLinhaAno',
    trab_cascata: 'trabalhistaShowCascataPedidos',
    trab_audiencias: 'includeOptionalAudiencias',
    trab_casos: 'includeOptionalCasos',
  }
  return map[previewId] ?? null
}
