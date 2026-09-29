import type { Worksheet, Row } from 'exceljs'

export type StatusRelatorio = 'Ganho (Vendido)' | 'Perdido' | 'Em andamento'

export type RelatorioCompletoLinha = {
  data_criacao_ms: number | null
  data_criacao: string
  mes_criacao: string
  ultima_atualizacao: string
  nome_lead: string
  razao_social: string
  responsavel: string
  area_responsavel: string
  areas_analise: string
  status: StatusRelatorio
  etapa: string
  funil: string
  tipo_lead: string
  indicacao: string
  nome_indicacao: string
  motivo_perda: string
  motivo_perda_anotacao: string
  email_solicitante: string
  deal_id: string
  link_crm: string
}

export type RelatorioCompletoOpcoes = {
  titulo: string
  criterios: [string, string][]
  nomeArquivo: string
}

const COR_MARCA = 'FF1E3A5F'
const COR_HEADER_TXT = 'FFFFFFFF'
const COR_GANHO = 'FFDCFCE7'
const COR_GANHO_TXT = 'FF15803D'
const COR_PERDIDO = 'FFFEE2E2'
const COR_PERDIDO_TXT = 'FFB91C1C'
const COR_ANDAMENTO = 'FFFEF3C7'
const COR_ANDAMENTO_TXT = 'FF92400E'
const COR_FAIXA = 'FFF3F4F6'
const COR_BORDA = 'FFE5E7EB'

type Coluna = { key: string; header: string; width: number; numeric?: boolean; link?: boolean }

const COLUNAS_DETALHE: Coluna[] = [
  { key: 'data_criacao', header: 'Data criação', width: 13 },
  { key: 'mes_criacao', header: 'Mês', width: 10 },
  { key: 'nome_lead', header: 'Lead', width: 38 },
  { key: 'razao_social', header: 'Razão social', width: 30 },
  { key: 'responsavel', header: 'Responsável', width: 26 },
  { key: 'area_responsavel', header: 'Área do responsável', width: 20 },
  { key: 'areas_analise', header: 'Áreas de análise (lead)', width: 28 },
  { key: 'status', header: 'Status', width: 16 },
  { key: 'etapa', header: 'Etapa', width: 22 },
  { key: 'funil', header: 'Funil', width: 16 },
  { key: 'ultima_atualizacao', header: 'Última atualização', width: 16 },
  { key: 'tipo_lead', header: 'Tipo de lead', width: 16 },
  { key: 'indicacao', header: 'Indicação', width: 14 },
  { key: 'nome_indicacao', header: 'Nome da indicação', width: 22 },
  { key: 'motivo_perda', header: 'Motivo da perda', width: 28 },
  { key: 'motivo_perda_anotacao', header: 'Anotação da perda', width: 36 },
  { key: 'email_solicitante', header: 'E-mail solicitante', width: 28 },
  { key: 'link_crm', header: 'Link CRM', width: 18, link: true },
]

const COLUNAS_CONTAGEM = (primeira: Coluna): Coluna[] => [
  primeira,
  { key: 'total', header: 'Total', width: 10, numeric: true },
  { key: 'ganhos', header: 'Ganhos', width: 10, numeric: true },
  { key: 'perdidos', header: 'Perdidos', width: 10, numeric: true },
  { key: 'andamento', header: 'Em andamento', width: 14, numeric: true },
]

function corPorStatus(status: unknown): { fill: string; txt: string } | null {
  if (status === 'Ganho (Vendido)') return { fill: COR_GANHO, txt: COR_GANHO_TXT }
  if (status === 'Perdido') return { fill: COR_PERDIDO, txt: COR_PERDIDO_TXT }
  if (status === 'Em andamento') return { fill: COR_ANDAMENTO, txt: COR_ANDAMENTO_TXT }
  return null
}

function estilizarHeader(row: Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR_HEADER_TXT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARCA } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  row.height = 22
}

function tituloDaAba(ws: Worksheet, texto: string, colunas: number) {
  ws.mergeCells(1, 1, 1, colunas)
  const cell = ws.getCell(1, 1)
  cell.value = texto
  cell.font = { bold: true, size: 14, color: { argb: COR_HEADER_TXT } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARCA } }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 28
}

/** Tabela com cabeçalho na linha atual da aba, zebra, status colorido e link clicável. */
function adicionarTabela(ws: Worksheet, colunas: Coluna[], linhas: Record<string, unknown>[]) {
  const headerRow = ws.addRow(colunas.map((c) => c.header))
  estilizarHeader(headerRow)
  const headerRowNumber = headerRow.number
  linhas.forEach((linha, idx) => {
    const row = ws.addRow(colunas.map((c) => (c.link ? '' : (linha[c.key] ?? ''))))
    colunas.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'center' : 'left' }
      cell.border = { bottom: { style: 'hair', color: { argb: COR_BORDA } } }
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_FAIXA } }
      if (c.link) {
        const url = String(linha[c.key] ?? '')
        if (url) {
          cell.value = { text: 'Abrir no RD', hyperlink: url }
          cell.font = { color: { argb: 'FF2563EB' }, underline: true }
        }
      }
      if (c.key === 'status') {
        const cor = corPorStatus(linha.status)
        if (cor) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor.fill } }
          cell.font = { bold: true, color: { argb: cor.txt } }
        }
      }
    })
  })
  return { headerRowNumber, lastRowNumber: headerRowNumber + linhas.length }
}

function abaDeTabela(wb: import('exceljs').Workbook, nome: string, colunas: Coluna[], linhas: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] })
  adicionarTabela(ws, colunas, linhas)
  colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width
  })
  if (linhas.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } }
  }
  return ws
}

type Contagem = { chave: string; ordem?: number; total: number; ganhos: number; perdidos: number; andamento: number }

function contarPor(linhas: RelatorioCompletoLinha[], chaveDe: (l: RelatorioCompletoLinha) => string, ordemDe?: (l: RelatorioCompletoLinha) => number) {
  const map = new Map<string, Contagem>()
  linhas.forEach((l) => {
    const chave = chaveDe(l) || '(vazio)'
    const cur = map.get(chave) ?? { chave, ordem: ordemDe?.(l), total: 0, ganhos: 0, perdidos: 0, andamento: 0 }
    cur.total++
    if (l.status === 'Ganho (Vendido)') cur.ganhos++
    else if (l.status === 'Perdido') cur.perdidos++
    else cur.andamento++
    map.set(chave, cur)
  })
  return Array.from(map.values())
}

function blocoResumo(ws: Worksheet, titulo: string, nomePrimeiraColuna: string, dados: Contagem[]) {
  const tituloRow = ws.addRow([titulo])
  tituloRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1F2937' } }
  adicionarTabela(
    ws,
    COLUNAS_CONTAGEM({ key: 'chave', header: nomePrimeiraColuna, width: 28 }),
    dados.map((d) => ({ ...d })),
  )
  ws.addRow([])
  ws.addRow([])
}

export async function downloadRelatorioCompletoXlsx(linhas: RelatorioCompletoLinha[], opcoes: RelatorioCompletoOpcoes): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')

  const ordenadas = [...linhas].sort((a, b) => (a.data_criacao_ms ?? 0) - (b.data_criacao_ms ?? 0))
  const ganhos = ordenadas.filter((l) => l.status === 'Ganho (Vendido)')
  const perdidos = ordenadas.filter((l) => l.status === 'Perdido')
  const andamento = ordenadas.filter((l) => l.status === 'Em andamento')
  const total = ordenadas.length
  const conversao = total > 0 ? Math.round((ganhos.length / total) * 100) : 0
  const decididos = ganhos.length + perdidos.length
  const taxaGanho = decididos > 0 ? Math.round((ganhos.length / decididos) * 100) : 0

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CRM Bismarchi | Pires'
  wb.created = new Date()

  // --- Resumo ---
  const wsResumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  tituloDaAba(wsResumo, opcoes.titulo, 6)
  wsResumo.addRow([])
  const kpiLabels = wsResumo.addRow(['Total', 'Ganhos', 'Perdidos', 'Em andamento', 'Conversão (total)', 'Taxa de ganho (decididos)'])
  kpiLabels.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    cell.alignment = { horizontal: 'center', wrapText: true }
  })
  const kpiValores = wsResumo.addRow([total, ganhos.length, perdidos.length, andamento.length, `${conversao}%`, `${taxaGanho}%`])
  kpiValores.height = 26
  const kpiFill = [COR_MARCA, COR_GANHO, COR_PERDIDO, COR_ANDAMENTO, COR_MARCA, COR_MARCA]
  const kpiTxt = [COR_HEADER_TXT, COR_GANHO_TXT, COR_PERDIDO_TXT, COR_ANDAMENTO_TXT, COR_HEADER_TXT, COR_HEADER_TXT]
  kpiValores.eachCell((cell, col) => {
    cell.font = { bold: true, size: 14, color: { argb: kpiTxt[col - 1] } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiFill[col - 1] } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  wsResumo.addRow([])
  wsResumo.addRow([])

  blocoResumo(
    wsResumo,
    'Por mês de criação',
    'Mês',
    contarPor(ordenadas, (l) => l.mes_criacao, (l) => l.data_criacao_ms ?? 0).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
  )
  blocoResumo(wsResumo, 'Por área do responsável', 'Área', contarPor(ordenadas, (l) => l.area_responsavel).sort((a, b) => b.total - a.total))
  blocoResumo(wsResumo, 'Por responsável', 'Responsável', contarPor(ordenadas, (l) => l.responsavel).sort((a, b) => b.total - a.total))
  ;[28, 10, 10, 10, 14, 24].forEach((w, i) => {
    wsResumo.getColumn(i + 1).width = w
  })

  // --- Abas de detalhe ---
  const detalhe = (arr: RelatorioCompletoLinha[]) => arr as unknown as Record<string, unknown>[]
  abaDeTabela(wb, 'Todos os Leads', COLUNAS_DETALHE, detalhe(ordenadas))
  abaDeTabela(wb, 'Ganhos', COLUNAS_DETALHE, detalhe(ganhos))
  abaDeTabela(wb, 'Perdidos', COLUNAS_DETALHE, detalhe(perdidos))
  abaDeTabela(wb, 'Em Andamento', COLUNAS_DETALHE, detalhe(andamento))

  // --- Resumo por etapa ---
  abaDeTabela(
    wb,
    'Resumo por Etapa',
    COLUNAS_CONTAGEM({ key: 'chave', header: 'Etapa', width: 28 }),
    contarPor(ordenadas, (l) => l.etapa).sort((a, b) => b.total - a.total) as unknown as Record<string, unknown>[],
  )

  // --- Motivos de perda ---
  const motivos = new Map<string, number>()
  perdidos.forEach((l) => {
    const m = l.motivo_perda || '(sem motivo registrado)'
    motivos.set(m, (motivos.get(m) ?? 0) + 1)
  })
  abaDeTabela(
    wb,
    'Motivos de Perda',
    [
      { key: 'motivo', header: 'Motivo da perda', width: 44 },
      { key: 'total', header: 'Total', width: 10, numeric: true },
      { key: 'pct', header: '% das perdas', width: 14, numeric: true },
    ],
    Array.from(motivos.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, qtd]) => ({ motivo, total: qtd, pct: `${Math.round((qtd / Math.max(perdidos.length, 1)) * 100)}%` })),
  )

  // --- Observações ---
  const wsObs = wb.addWorksheet('Observações')
  wsObs.getColumn(1).width = 34
  wsObs.getColumn(2).width = 90
  const obs: [string, string | number][] = [
    ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Total de leads', total],
    ...opcoes.criterios,
  ]
  obs.forEach(([k, v]) => {
    const row = wsObs.addRow([k, v])
    row.getCell(1).font = { bold: true }
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opcoes.nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
