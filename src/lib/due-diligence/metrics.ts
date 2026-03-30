/**
 * Cálculo de métricas por área a partir de parsed_data para o resumo executivo e slides.
 */
import type { DueDiligenceAreaId } from './types'

function parseNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    // Aceita formatos como: "R$ 1.234,56", "1234.56", "- 2.345,00"
    const raw = String(v).trim()
    const cleaned = raw
      .replace(/[^\d,.\-]/g, '')
      .replace(/\.(?=.*[,])/g, '') // remove separador de milhar quando houver decimal com vírgula
      .replace(',', '.')
    const n = parseFloat(cleaned)
    if (!Number.isNaN(n)) return n
  }
  return 0
}

function getRows(parsed: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!parsed || !Array.isArray(parsed.rows)) return []
  return parsed.rows as Record<string, unknown>[]
}

/** Soma da coluna valor_causa ou valor */
function sumValor(rows: Record<string, unknown>[]): number {
  return rows.reduce((acc, r) => {
    const v = r.valor_causa ?? r.valor ?? r.valor_da_causa
    return acc + parseNum(v)
  }, 0)
}

/** Soma coluna específica (ex.: valor_envolvido, valor_concursal) */
function sumCol(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, r) => acc + parseNum(r[key]), 0)
}

/** Extrai ano de data (ex.: "31/07/2025", "31-07-2025", número Excel, Date) */
function extrairAnoDeData(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    if (v > 1000) {
      // Excel serial date: dias desde 1900-01-01
      const d = new Date((v - 25569) * 86400 * 1000)
      return String(d.getFullYear())
    }
    return null
  }
  if (v instanceof Date) return String(v.getFullYear())
  const s = String(v).trim()
  if (!s) return null
  // DD/MM/YYYY ou DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return m1[3]
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m2) return m2[1]
  // Apenas ano (4 dígitos)
  const m3 = s.match(/\b(19|20)\d{2}\b/)
  if (m3) return m3[0]
  return null
}

/** Agrupa por chave e conta */
function groupCount(rows: Record<string, unknown>[], key: string): { label: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = String(r[key] ?? '—').trim() || '—'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

export interface ResumoExecutivo {
  passivoTrabalhista: number
  potencialCreditoRecuperacao: number
  passivoTributario: number
  indicativoTotalCredito: number
  indicativoTotalPassivo: number
}

export interface MetricasCivel {
  totalProcessos: number
  porPosicao: { label: string; value: number }[]
  socioPoloPassivo: { label: string; value: number }[]
  porSituacao: { label: string; value: number }[]
  porRegiao: { label: string; value: number }[]
  porTipo: { label: string; value: number }[]
  porAno: { label: string; value: number }[]
  porFase: { label: string; value: number }[]
  valorPoloAtivo: number
  valorPoloPassivo: number
}

export interface MetricasTrabalhista {
  potencialPassivo: number
  porFase: { label: string; value: number; valor: number }[]
  porAno: { label: string; value: number }[]
  pedidosRecorrentes: { label: string; value: number }[]
  mediaValorCausa: number
  totalProcessos: number
  /** Ativos vs Arquivados para gráfico de pizza */
  ativosVsArquivados: { label: string; value: number }[]
  /** Por fase (apenas ativos e suspensos) com total e valor envolvido */
  porFaseAtivosSuspensos: { label: string; count: number; valor: number }[]
  /** Assuntos agregados (split por vírgula/linha, normalizados e contados) */
  assuntosAgregados: { label: string; value: number }[]
}

export interface MetricasTributario {
  passivoJudicial: number
  passivoAdministrativo: number
  listaJudicial: { tipo: string; ano: string; valor: number }[]
}

export interface MetricasRecuperacao {
  totalProcessos: number
  porFase: { label: string; value: number }[]
  porTipoAcao: { label: string; value: number }[]
  porTipoCredito: { label: string; value: number }[]
  potencialCredito: number
}

export interface MetricasReestruturacao {
  totalProcessos: number
  porFase: { label: string; value: number }[]
  porTipoAcao: { label: string; value: number }[]
  valorTotal: number
}

export interface TodasMetricas {
  resumo: ResumoExecutivo
  civel: MetricasCivel | null
  trabalhista: MetricasTrabalhista | null
  tributario: MetricasTributario | null
  recuperacao: MetricasRecuperacao | null
  reestruturacao: MetricasReestruturacao | null
}

export function calcularResumoExecutivo(areas: Map<DueDiligenceAreaId, Record<string, unknown> | null>): ResumoExecutivo {
  const trabRows = getRows(areas.get('trabalhista') ?? null)
  const recRows = getRows(areas.get('recuperacao_creditos') ?? null)
  const tribRows = getRows(areas.get('tributario') ?? null)
  const civelRows = getRows(areas.get('civel') ?? null)

  const passivoTrabalhista = sumValor(trabRows)
  const potencialCreditoRecuperacao = sumValor(recRows)
  const passivoTributario = sumValor(tribRows)
  const valorPoloPassivoCivel = civelRows.reduce((acc, r) => {
    const poloCliente = String(r.polo_cliente ?? r.posicao ?? r.posicao_do_cliente ?? '').toLowerCase()
    if (poloCliente.includes('passivo')) return acc + parseNum(r.valor_causa ?? r.valor ?? r.valor_da_causa)
    return acc
  }, 0)
  const indicativoTotalCredito = potencialCreditoRecuperacao
  const indicativoTotalPassivo = passivoTrabalhista + valorPoloPassivoCivel + passivoTributario

  return {
    passivoTrabalhista,
    potencialCreditoRecuperacao,
    passivoTributario,
    indicativoTotalCredito,
    indicativoTotalPassivo,
  }
}

/** Verifica se Polo Cliente indica Passivo (coluna polo_cliente ou posicao) */
function isPoloClientePassivo(r: Record<string, unknown>): boolean {
  const poloCliente = String(r.polo_cliente ?? r.posicao ?? r.posicao_do_cliente ?? '').toLowerCase()
  return poloCliente.includes('passivo')
}

export function calcularMetricasCivel(parsed: Record<string, unknown> | null): MetricasCivel | null {
  const rows = getRows(parsed)
  if (rows.length === 0) return null
  const valorPassivo = rows.reduce((acc, r) => {
    if (!isPoloClientePassivo(r)) return acc
    return acc + parseNum(r.valor_causa ?? r.valor ?? r.valor_da_causa)
  }, 0)
  const valorAtivo = rows.reduce((acc, r) => {
    const poloCliente = String(r.polo_cliente ?? r.posicao ?? r.posicao_do_cliente ?? '').toLowerCase()
    if (poloCliente.includes('ativo') || poloCliente.includes('autora')) return acc + parseNum(r.valor_causa ?? r.valor ?? r.valor_da_causa)
    return acc
  }, 0)
  return {
    totalProcessos: rows.length,
    porPosicao: groupCount(rows, 'posicao').length ? groupCount(rows, 'posicao') : groupCount(rows, 'polo_ativo'),
    socioPoloPassivo: groupCount(rows, 'socio_polo_passivo').length ? groupCount(rows, 'socio_polo_passivo') : [],
    porSituacao: groupCount(rows, 'situacao').length ? groupCount(rows, 'situacao') : groupCount(rows, 'situacao_processual'),
    porRegiao: groupCount(rows, 'regiao').length ? groupCount(rows, 'regiao') : groupCount(rows, 'foro'),
    porTipo: groupCount(rows, 'tipo_acao').length ? groupCount(rows, 'tipo_acao') : groupCount(rows, 'classe_acao'),
    porAno: groupCount(rows, 'ano'),
    porFase: groupCount(rows, 'fase'),
    valorPoloAtivo: valorAtivo,
    valorPoloPassivo: valorPassivo,
  }
}

function isArquivado(situacao: string): boolean {
  const s = situacao.toLowerCase()
  return s.includes('arquiv')
}

function isAtivoOuSuspenso(situacao: string): boolean {
  const s = situacao.toLowerCase()
  return s.includes('ativo') || s.includes('andamento') || s.includes('em curso') || s.includes('suspens') || s.includes('distribu')
}

export function calcularMetricasTrabalhista(parsed: Record<string, unknown> | null): MetricasTrabalhista | null {
  const rows = getRows(parsed)
  if (rows.length === 0) return null
  const vEnvolvido = sumCol(rows, 'valor_envolvido')
  const totalValor = vEnvolvido > 0 ? vEnvolvido : sumValor(rows)
  const porFase = groupCount(rows, 'fase').map((f) => {
    const faseRows = rows.filter((r) => String(r.fase ?? '').trim() === f.label)
    const valor = faseRows.reduce((a, r) => {
      const v = r.valor_envolvido ?? r.valor_causa ?? r.valor
      return a + parseNum(v)
    }, 0)
    return { ...f, valor }
  })

  const ativos = rows.filter((r) => isAtivoOuSuspenso(String(r.situacao ?? r.fase ?? '')))
  const arquivados = rows.filter((r) => isArquivado(String(r.situacao ?? '')))
  const outros = rows.filter((r) => {
    const sit = String(r.situacao ?? '').trim()
    return sit && !isArquivado(sit) && !isAtivoOuSuspenso(sit)
  })
  const ativosVsArquivados: { label: string; value: number }[] = []
  const countAtivos = ativos.length + outros.length
  const countArquivados = arquivados.length
  if (countAtivos > 0) ativosVsArquivados.push({ label: 'Ativos', value: countAtivos })
  if (countArquivados > 0) ativosVsArquivados.push({ label: 'Arquivados', value: countArquivados })
  if (ativosVsArquivados.length === 0) ativosVsArquivados.push({ label: 'Total', value: rows.length })

  const rowsAtivosSuspensos = rows.filter((r) => !isArquivado(String(r.situacao ?? '')))
  const faseMap = new Map<string, { count: number; valor: number }>()
  for (const r of rowsAtivosSuspensos) {
    const fase = String(r.fase ?? '—').trim() || '—'
    const v = r.valor_envolvido ?? r.valor_causa ?? r.valor
    const entry = faseMap.get(fase) ?? { count: 0, valor: 0 }
    entry.count += 1
    entry.valor += parseNum(v)
    faseMap.set(fase, entry)
  }
  const porFaseAtivosSuspensos = Array.from(faseMap.entries())
    .map(([label, { count, valor }]) => ({ label, count, valor }))
    .sort((a, b) => b.count - a.count)

  const assuntosMap = new Map<string, number>()
  for (const r of rows) {
    const raw = String(r.assuntos ?? '').trim()
    if (!raw) continue
    const partes = raw.split(/[,\n]+/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
    for (const assunto of partes) {
      assuntosMap.set(assunto, (assuntosMap.get(assunto) ?? 0) + 1)
    }
  }
  const assuntosAgregados = Array.from(assuntosMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  // Por ano: extrair de "Data da distribuição" (31/07/2025) ou coluna ano
  const anoMap = new Map<string, number>()
  for (const r of rows) {
    const ano =
      extrairAnoDeData(r.data_distribuicao ?? r.data_da_distribuicao) ??
      (String(r.ano ?? '').trim() || null)
    const label = ano ?? '—'
    anoMap.set(label, (anoMap.get(label) ?? 0) + 1)
  }
  const porAno = Array.from(anoMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const na = parseInt(a.label, 10)
      const nb = parseInt(b.label, 10)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return nb - na
      if (!Number.isNaN(na)) return -1
      if (!Number.isNaN(nb)) return 1
      return a.label.localeCompare(b.label)
    })

  return {
    potencialPassivo: totalValor,
    porFase,
    porAno,
    pedidosRecorrentes: groupCount(rows, 'tipo_pedido'),
    mediaValorCausa: rows.length ? totalValor / rows.length : 0,
    totalProcessos: rows.length,
    ativosVsArquivados,
    porFaseAtivosSuspensos,
    assuntosAgregados,
  }
}

export function calcularMetricasTributario(parsed: Record<string, unknown> | null): MetricasTributario | null {
  const rows = getRows(parsed)
  if (rows.length === 0) return null
  const total = sumValor(rows)
  const listaJudicial = rows.slice(0, 20).map((r) => ({
    tipo: String(r.tipo_acao ?? r.tipo ?? '—'),
    ano: String(r.ano ?? '—'),
    valor: parseNum(r.valor ?? r.valor_causa),
  }))
  return {
    passivoJudicial: total,
    passivoAdministrativo: 0,
    listaJudicial,
  }
}

export function calcularMetricasRecuperacao(parsed: Record<string, unknown> | null): MetricasRecuperacao | null {
  const rows = getRows(parsed)
  if (rows.length === 0) return null
  return {
    totalProcessos: rows.length,
    porFase: groupCount(rows, 'fase'),
    porTipoAcao: groupCount(rows, 'tipo_acao'),
    porTipoCredito: groupCount(rows, 'tipo_credito'),
    potencialCredito: sumValor(rows),
  }
}

export function calcularMetricasReestruturacao(parsed: Record<string, unknown> | null): MetricasReestruturacao | null {
  const rows = getRows(parsed)
  if (rows.length === 0) return null
  return {
    totalProcessos: rows.length,
    porFase: groupCount(rows, 'fase'),
    porTipoAcao: groupCount(rows, 'tipo_acao'),
    valorTotal: sumValor(rows),
  }
}

export interface MetricasConsolidadas {
  processosPorArea: { area: string; count: number }[]
  totalProcessos: number
  valorEnvolvido: number
  valorConcursal: number
  processosPorAno: { label: string; value: number }[]
}

export function calcularMetricasConsolidadas(
  areas: Map<DueDiligenceAreaId, Record<string, unknown> | null>
): MetricasConsolidadas {
  const areaConfig: { id: DueDiligenceAreaId; label: string }[] = [
    { id: 'civel', label: 'Cível' },
    { id: 'trabalhista', label: 'Trabalhista' },
    { id: 'tributario', label: 'Tributário' },
    { id: 'recuperacao_creditos', label: 'Recuperação' },
    { id: 'reestruturacao', label: 'Reestruturação' },
  ]
  const processosPorArea = areaConfig.map(({ id, label }) => {
    const rows = getRows(areas.get(id) ?? null)
    return { area: label, count: rows.length }
  })
  const totalProcessos = processosPorArea.reduce((acc, p) => acc + p.count, 0)

  let valorEnvolvido = 0
  let valorConcursal = 0
  const anoMap = new Map<string, number>()
  for (const { id } of areaConfig) {
    const rows = getRows(areas.get(id) ?? null)
    if (id === 'trabalhista') {
      const vEnvolvido = sumCol(rows, 'valor_envolvido')
      valorEnvolvido += vEnvolvido > 0 ? vEnvolvido : sumValor(rows)
    } else {
      valorEnvolvido += sumValor(rows)
    }
    valorConcursal += sumCol(rows, 'valor_concursal')
    for (const r of rows) {
      const ano =
        (id === 'trabalhista'
          ? extrairAnoDeData(r.data_distribuicao ?? r.data_da_distribuicao)
          : null) ?? (String(r.ano ?? '').trim() || null)
      const label = ano ?? '—'
      anoMap.set(label, (anoMap.get(label) ?? 0) + 1)
    }
  }
  const processosPorAno = Array.from(anoMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const na = parseInt(a.label, 10)
      const nb = parseInt(b.label, 10)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
      if (!Number.isNaN(na)) return -1
      if (!Number.isNaN(nb)) return 1
      return a.label.localeCompare(b.label)
    })

  return {
    processosPorArea,
    totalProcessos,
    valorEnvolvido,
    valorConcursal,
    processosPorAno,
  }
}

export function calcularTodasMetricas(areas: Map<DueDiligenceAreaId, Record<string, unknown> | null>): TodasMetricas {
  const resumo = calcularResumoExecutivo(areas)
  return {
    resumo,
    civel: calcularMetricasCivel(areas.get('civel') ?? null),
    trabalhista: calcularMetricasTrabalhista(areas.get('trabalhista') ?? null),
    tributario: calcularMetricasTributario(areas.get('tributario') ?? null),
    recuperacao: calcularMetricasRecuperacao(areas.get('recuperacao_creditos') ?? null),
    reestruturacao: calcularMetricasReestruturacao(areas.get('reestruturacao') ?? null),
  }
}
