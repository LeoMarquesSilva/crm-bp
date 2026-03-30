/**
 * Parse de planilhas Excel por área da Due Diligence.
 * Mapeamento de colunas configurável por área (ajustar conforme arquivos reais).
 */
import * as XLSX from 'xlsx'
import type { DueDiligenceAreaId } from './types'

export interface ParseResult<T = Record<string, unknown>> {
  ok: boolean
  data?: T
  error?: string
}

/** Normaliza cabeçalho para chave: minúsculo, sem acentos, espaços → _ */
function norm(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/** Lê a primeira planilha do workbook e devolve array de objetos (primeira linha = cabeçalho) */
function sheetToJson(wb: XLSX.WorkBook): Record<string, unknown>[] {
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return []
  const ws = wb.Sheets[firstSheet]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  if (raw.length < 2) return []
  const firstRow = raw[0] as unknown[]
  const headers = firstRow.map((h, i) => ({ key: norm(h) || `col_${i}`, i }))
  const rows: Record<string, unknown>[] = []
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r] as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach(({ key, i }) => {
      const v = row[i]
      if (v !== undefined && v !== null && v !== '') obj[key] = v
    })
    if (Object.keys(obj).length) rows.push(obj)
  }
  return rows
}

/** Mapeamento alternativo de nomes de coluna → chave normalizada (para planilhas com títulos variados) */
const COL_ALIASES: Record<string, string> = {
  valor_da_causa: 'valor_causa',
  valor_causa: 'valor_causa',
  valor_de_causa: 'valor_causa',
  valor_de_causa_r: 'valor_causa',
  valor_de_acordo_r: 'valor_acordo',
  valor_de_liquidacao_r: 'valor_liquidacao',
  valor: 'valor_causa',
  valor_envolvido: 'valor_envolvido',
  valorenvolvido: 'valor_envolvido',
  valor_concursal: 'valor_concursal',
  valor_de_acordo: 'valor_acordo',
  valor_de_liquidacao: 'valor_liquidacao',
  fase_processual: 'fase',
  fase: 'fase',
  situacao_processual: 'situacao',
  situacao: 'situacao',
  polo_ativo: 'polo_ativo',
  polo_ativo_principal: 'polo_ativo',
  partes_polo_ativo: 'polo_ativo',
  polo_passivo: 'polo_passivo',
  polo_passivo_principal: 'polo_passivo',
  partes_polo_passivo: 'polo_passivo',
  polo_cliente: 'polo_cliente',
  posicao_do_cliente: 'posicao',
  posicao: 'posicao',
  ano: 'ano',
  tipo_acao: 'tipo_acao',
  classe: 'classe_acao',
  foro: 'foro',
  regiao: 'regiao',
  tribunal: 'tribunal',
  socio_polo_passivo: 'socio_polo_passivo',
  tipo_pedido: 'tipo_pedido',
  pedidos: 'tipo_pedido',
  tipo_credito: 'tipo_credito',
  numero_processo: 'numero_processo',
  numero_do_processo: 'numero_processo',
  id_cliente: 'id_cliente',
  advogados_polo_ativo: 'advogados_polo_ativo',
  advogados_polo_passivo: 'advogados_polo_passivo',
  cnpjs: 'cnpjs',
  tipo_cargos: 'tipo_cargos',
  tipo_de_cargos: 'tipo_cargos',
  assuntos: 'assuntos',
  comarca: 'comarca',
  vara: 'vara',
  uf: 'uf',
  data_da_distribuicao: 'data_distribuicao',
  data_distribuicao: 'data_distribuicao',
  origem_valor: 'origem_valor',
}

function applyAliases(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = COL_ALIASES[k] ?? k
    out[key] = v
  }
  return out
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
    if (!Number.isNaN(n)) return n
  }
  return 0
}

/** Extrai os cabeçalhos da primeira linha da planilha (para o modal de mapeamento) */
export function extractHeadersFromExcel(buffer: ArrayBuffer): ParseResult<{ headers: string[] }> {
  try {
    const wb = XLSX.read(buffer, { type: 'array' })
    const firstSheet = wb.SheetNames[0]
    if (!firstSheet) return { ok: true, data: { headers: [] } }
    const ws = wb.Sheets[firstSheet]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
    if (raw.length < 1) return { ok: true, data: { headers: [] } }
    const firstRow = raw[0] as unknown[]
    const headers = firstRow.map((h) => String(h ?? '').trim()).filter(Boolean)
    return { ok: true, data: { headers } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao ler planilha.' }
  }
}

/** Mapeamento: chave interna → nome da coluna na planilha (como exibido no cabeçalho) */
export type ColumnMapping = Record<string, string>

/** Parse com mapeamento customizado: columnMapping[chave_interna] = nome_coluna_planilha */
function sheetToJsonWithMapping(
  wb: XLSX.WorkBook,
  columnMapping: ColumnMapping
): Record<string, unknown>[] {
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return []
  const ws = wb.Sheets[firstSheet]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  if (raw.length < 2) return []
  const firstRow = raw[0] as unknown[]
  const headerToIndex = new Map<string, number>()
  firstRow.forEach((h, i) => {
    const s = String(h ?? '').trim()
    if (s) headerToIndex.set(s, i)
  })
  const rows: Record<string, unknown>[] = []
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r] as unknown[]
    const obj: Record<string, unknown> = {}
    for (const [internalKey, headerName] of Object.entries(columnMapping)) {
      if (!headerName?.trim()) continue
      const idx = headerToIndex.get(headerName.trim())
      if (idx !== undefined) {
        const v = row[idx]
        if (v !== undefined && v !== null && v !== '') obj[internalKey] = v
      }
    }
    if (Object.keys(obj).length) rows.push(obj)
  }
  return rows
}

/** Parse genérico: devolve linhas com chaves normalizadas para uso nas métricas.
 * Se columnMapping for fornecido, usa o mapeamento em vez do auto-detect. */
export function parseExcelFile(
  buffer: ArrayBuffer,
  area: DueDiligenceAreaId,
  options?: { columnMapping?: ColumnMapping }
): ParseResult<{ rows: Record<string, unknown>[]; columnMapping?: ColumnMapping }> {
  try {
    const wb = XLSX.read(buffer, { type: 'array' })
    let rows: Record<string, unknown>[]
    const columnMapping = options?.columnMapping
    if (columnMapping && Object.keys(columnMapping).length > 0) {
      rows = sheetToJsonWithMapping(wb, columnMapping)
    } else {
      rows = sheetToJson(wb).map(applyAliases)
    }
    if (rows.length === 0) {
      return { ok: true, data: { rows: [], columnMapping } }
    }
    return { ok: true, data: { rows, columnMapping } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao ler planilha.' }
  }
}

/** Validação mínima por área: exige ao menos uma coluna reconhecida */
const MIN_COLUMNS_BY_AREA: Partial<Record<DueDiligenceAreaId, string[]>> = {
  civel: ['numero_processo', 'valor_causa', 'fase', 'situacao', 'polo_ativo', 'polo_passivo', 'ano', 'classe_acao', 'foro', 'posicao'],
  trabalhista: ['numero_processo', 'valor_causa', 'valor_envolvido', 'fase', 'situacao', 'tipo_pedido', 'polo_ativo', 'polo_passivo'],
  tributario: ['valor', 'valor_causa', 'ano', 'tipo_acao'],
  recuperacao_creditos: ['valor', 'valor_causa', 'fase', 'tipo_acao', 'tipo_credito'],
  reestruturacao: ['valor', 'valor_causa', 'fase', 'tipo_acao'],
}

/** Campos configuráveis por área para o modal de mapeamento */
export const COLUMN_MAPPING_FIELDS: Record<DueDiligenceAreaId, { key: string; label: string }[]> = {
  civel: [
    { key: 'numero_processo', label: 'NÚMERO PROCESSO' },
    { key: 'classe_acao', label: 'CLASSE' },
    { key: 'foro', label: 'FORO' },
    { key: 'ano', label: 'ANO' },
    { key: 'valor_causa', label: 'VALOR DA CAUSA' },
    { key: 'polo_ativo', label: 'POLO ATIVO PRINCIPAL' },
    { key: 'polo_passivo', label: 'POLO PASSIVO PRINCIPAL' },
    { key: 'polo_cliente', label: 'POLO CLIENTE' },
    { key: 'posicao', label: 'POSIÇÃO DO CLIENTE' },
    { key: 'id_cliente', label: 'ID CLIENTE' },
    { key: 'socio_polo_passivo', label: 'SÓCIO POLO PASSIVO' },
    { key: 'situacao', label: 'SITUAÇÃO PROCESSUAL' },
    { key: 'fase', label: 'FASE' },
  ],
  trabalhista: [
    { key: 'numero_processo', label: 'Número do processo' },
    { key: 'polo_ativo', label: 'Partes polo ativo' },
    { key: 'advogados_polo_ativo', label: 'Advogados polo ativo' },
    { key: 'polo_passivo', label: 'Partes polo passivo' },
    { key: 'cnpjs', label: 'CNPJs' },
    { key: 'advogados_polo_passivo', label: 'Advogados polo passivo' },
    { key: 'tipo_pedido', label: 'Pedidos' },
    { key: 'tipo_cargos', label: 'Tipo de cargos' },
    { key: 'situacao', label: 'Situação' },
    { key: 'fase', label: 'Fase' },
    { key: 'assuntos', label: 'Assuntos' },
    { key: 'classe_acao', label: 'Classe' },
    { key: 'comarca', label: 'Comarca' },
    { key: 'vara', label: 'Vara' },
    { key: 'uf', label: 'UF' },
    { key: 'tribunal', label: 'Tribunal' },
    { key: 'data_distribuicao', label: 'Data da distribuição' },
    { key: 'valor_causa', label: 'Valor de causa (R$)' },
    { key: 'valor_acordo', label: 'Valor de acordo (R$)' },
    { key: 'valor_liquidacao', label: 'Valor de liquidação (R$)' },
    { key: 'origem_valor', label: 'Origem valor' },
    { key: 'valor_envolvido', label: 'Valor envolvido' },
  ],
  tributario: [
    { key: 'valor_causa', label: 'Valor da causa' },
    { key: 'valor', label: 'Valor' },
    { key: 'ano', label: 'Ano' },
    { key: 'tipo_acao', label: 'Tipo de ação' },
  ],
  recuperacao_creditos: [
    { key: 'valor_causa', label: 'Valor da causa' },
    { key: 'valor', label: 'Valor' },
    { key: 'fase', label: 'Fase processual' },
    { key: 'tipo_acao', label: 'Tipo de ação' },
    { key: 'tipo_credito', label: 'Tipo de crédito' },
  ],
  reestruturacao: [
    { key: 'valor_causa', label: 'Valor da causa' },
    { key: 'valor', label: 'Valor' },
    { key: 'fase', label: 'Fase processual' },
    { key: 'tipo_acao', label: 'Tipo de ação' },
  ],
}

/** Sugere mapeamento automático com base nos cabeçalhos da planilha */
export function suggestColumnMapping(headers: string[], area: DueDiligenceAreaId): ColumnMapping {
  const fields = COLUMN_MAPPING_FIELDS[area]
  const mapping: ColumnMapping = {}
  for (const { key } of fields) {
    for (const h of headers) {
      const n = norm(h)
      if (!n) continue
      const internalFromAlias = COL_ALIASES[n] ?? n
      if (internalFromAlias === key || n === key) {
        mapping[key] = h
        break
      }
    }
  }
  return mapping
}

export function validateParsedRows(area: DueDiligenceAreaId, rows: Record<string, unknown>[]): { valid: boolean; message?: string } {
  const minCols = MIN_COLUMNS_BY_AREA[area]
  if (!minCols || minCols.length === 0) return { valid: true }
  if (rows.length === 0) return { valid: true }
  const first = rows[0]
  const hasAny = minCols.some((c) => first[c] !== undefined && first[c] !== null && first[c] !== '')
  if (!hasAny) {
    return {
      valid: false,
      message: `A planilha deve conter ao menos uma das colunas: ${minCols.join(', ')} (ou equivalentes).`,
    }
  }
  return { valid: true }
}
