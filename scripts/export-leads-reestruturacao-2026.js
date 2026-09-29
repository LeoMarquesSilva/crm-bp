/* eslint-disable no-console */
/**
 * Exporta Excel (formatado) de TODOS os leads de 2026 cujo campo "Áreas que
 * serão objeto de análise" (coluna areas_analise, multi-select do formulário
 * de cadastro) contenha "Reestruturação" — independente de quem é o
 * responsável/solicitante pela negociação.
 *
 * Isso é diferente de filtrar por "área do responsável" (como os outros
 * scripts export-leads-civel-*.js fazem): aqui o filtro é pelo campo do
 * PRÓPRIO LEAD (quais áreas do escritório vão analisar o caso), que pode ter
 * múltiplas áreas marcadas ao mesmo tempo (ex.: ["Cível","Reestruturação"]).
 *
 * Uso:
 *   node scripts/export-leads-reestruturacao-2026.js
 *   node scripts/export-leads-reestruturacao-2026.js --area="Reestruturação" --ano=2026
 *
 * Saída: exports/leads-reestruturacao-2026.xlsx
 */
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { loadEnvFromRoot } from './dev-api-app.js'
import { refreshSharedGoogleAccessToken } from '../api/_google-auth.js'
import { canonicalStatus } from '../api/sync-status-rd-sheets.js'

loadEnvFromRoot()

const OUT_DIR = 'exports'
const BRASILIA_OFFSET = '-03:00'

function parseArgs() {
  const args = {}
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/)
    if (m) args[m[1]] = m[2]
  }
  return args
}

const argv = parseArgs()
// area vazia/"todas" => sem filtro de área de análise (relatório do escritório todo)
const AREA_ALVO = argv.area === undefined ? 'Reestruturação' : argv.area
const SEM_FILTRO_AREA = AREA_ALVO === '' || normStageText(AREA_ALVO) === 'todas'
const ANO = Number(argv.ano || 2026)
const INICIO_STR = argv.inicio || `${ANO}-01-01`
const FIM_STR = argv.fim || `${ANO}-12-31`
const LABEL = argv.label || null
// --andamento-tudo=1 => leads em andamento entram independente da data de criação (pipeline atual);
// ganhos/perdidos continuam restritos ao período.
const ANDAMENTO_TUDO = ['1', 'true', 'sim'].includes(String(argv['andamento-tudo'] || '').toLowerCase())

/** Início/fim do dia (YYYY-MM-DD) em horário de Brasília, como instante absoluto — mesmo critério do Dashboard. */
function brasiliaDayBoundary(ymd, endOfDay) {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  return new Date(`${ymd}T${time}${BRASILIA_OFFSET}`)
}

/** Mesma lista de api/validar-sheets.js DISREGARD_STAGE_NAMES */
const DISREGARD_STAGE_NAMES = [
  'Contato Inicial',
  'Contato feito',
  'Contato Trimestral',
  'Descartados',
  'Mensagem Enviada',
  'Suspenso',
  'Lead Quente',
  'Contato Mensal',
  'Lead Capturado',
  'Reunião Realizada',
  'Contatos',
  'Novos Contatos',
  'Execução do Serviço',
  'Clientes',
].map((s) => normStageText(s))

/** Nomes e áreas (tags) por e-mail do responsável — espelha src/data/teamAvatars.ts */
const TEAM_BY_EMAIL = {
  'gustavo@bpplaw.com.br': { name: 'Gustavo Bismarchi', tag: 'Sócio' },
  'ricardo@bpplaw.com.br': { name: 'Ricardo Viscardi Pires', tag: 'Sócio' },
  'gabriela.consul@bpplaw.com.br': { name: 'Gabriela Consul', tag: 'Cível' },
  'giancarlo@bpplaw.com.br': { name: 'Giancarlo Zotini', tag: 'Cível' },
  'caroline.thome@bpplaw.com.br': { name: 'Maria Caroline da Cunha Thomé', tag: 'Cível' },
  'giovani.pina@bpplaw.com.br': { name: 'Giovani Pina de Freitas', tag: 'Cível' },
  'daniel@bpplaw.com.br': { name: 'Daniel Pressatto Fernandes', tag: 'Trabalhista' },
  'renato@bpplaw.com.br': { name: 'Renato Vallim', tag: 'Trabalhista' },
  'carolineabdalla@bpplaw.com.br': { name: 'Caroline Simel Abdalla', tag: 'Trabalhista' },
  'michel.malaquias@bpplaw.com.br': { name: 'Michel Malaquias', tag: 'Recuperação de Créditos' },
  'emanueli.lourenco@bpplaw.com.br': { name: 'Emanueli Lourenço', tag: 'Recuperação de Créditos' },
  'ariany.bispo@bpplaw.com.br': { name: 'Ariany Bispo', tag: 'Recuperação de Créditos' },
  'jorge@bpplaw.com.br': { name: 'Jorge Pecht Souza', tag: 'Reestruturação' },
  'leonardo@bpplaw.com.br': { name: 'Leonardo Loureiro Basso', tag: 'Reestruturação' },
  'ligia@bpplaw.com.br': { name: 'Ligia Lopes', tag: 'Reestruturação' },
  'lavinia.ferraz@bpplaw.com.br': { name: 'Lavínia Ferraz Crispim', tag: 'Reestruturação' },
  'wagner.armani@bpplaw.com.br': { name: 'Wagner Armani', tag: 'Societário e Contratos' },
  'jansonn@bpplaw.com.br': { name: 'Jansonn Mendonça Batista', tag: 'Societário e Contratos' },
  'henrique.nascimento@bpplaw.com.br': { name: 'Henrique Franco Nascimento', tag: 'Societário e Contratos' },
  'felipe@bpplaw.com.br': { name: 'Felipe Camargo', tag: 'Operações Legais' },
  'francisco.zanin@bpplaw.com.br': { name: 'Francisco Zanin', tag: 'Tributário' },
}

function normalizeEmailKey(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace('@bismarchipires.com.br', '@bpplaw.com.br')
    .replace('@bismarchipires.com', '@bpplaw.com')
}

function resolveTeamMember(emailSolicitante, emailNotificar) {
  const e = toText(emailSolicitante) || toText(emailNotificar)
  if (!e) return { name: '(sem e-mail)', tag: null, email: '' }
  const key = normalizeEmailKey(e)
  const m = TEAM_BY_EMAIL[key]
  if (m) return { name: m.name, tag: m.tag, email: e }
  return { name: e, tag: null, email: e }
}

function normStageText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pós-venda: Inclusão no fluxo, Boas-vindas, Cadastro VIOS, Kick-off etc. */
function isPostSalesFunnel(stageName, funilRaw) {
  const fn = normStageText(funilRaw)
  if (
    /pos.venda|pos venda|inclusao no fluxo|faturamento|boas.vindas|cadastro de novo cliente|aguardando cadastro|kick.off|kickoff/i.test(
      fn,
    )
  ) {
    return true
  }
  const sn = normStageText(stageName)
  return /cadastro de novo cliente|inclusao no fluxo|inclusao no fluxo de faturamento|boas.vindas|aguardando cadastro|kick.off|kickoff/i.test(
    sn,
  )
}

/** Mesma regra do dashboard: validar-sheets DISREGARD + funil inferido "Funil de vendas" */
function passesFunilVendasDashboard(stageName, funilRaw) {
  const sn = normStageText(stageName)
  if (sn && DISREGARD_STAGE_NAMES.includes(sn)) return false
  const funilExplicit = toText(funilRaw)
  if (funilExplicit) {
    const fn = normStageText(funilExplicit)
    return fn.includes('funil de vendas') || fn === 'vendas'
  }
  if (!sn) return false
  return !isPostSalesFunnel(stageName, funilRaw)
}

/** Campo "areas_analise" (multi-select) pode vir como JSON array string ou lista separada por , ; | */
function parseAreasAnalise(raw) {
  const s = toText(raw)
  if (!s || s === '[]') return []
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return arr.map((x) => toText(x)).filter(Boolean)
    } catch {
      /* fall through */
    }
  }
  return s
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function leadTemAreaAnalise(areasRaw, alvo) {
  const alvoNorm = normStageText(alvo)
  return parseAreasAnalise(areasRaw).some((a) => normStageText(a) === alvoNorm)
}

function toText(v) {
  if (v == null) return ''
  return String(v).trim()
}

function parseDate(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && !Number.isNaN(val) && val >= 1 && val < 300000) {
    const ms = (val - 25569) * 86400 * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = toText(val)
  if (!s) return null
  const asNum = Number(s)
  if (!Number.isNaN(asNum) && asNum >= 1 && asNum < 300000) {
    const ms = (asNum - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d
  }
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return new Date(iso)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:](\d{2})(?::(\d{2}))?)?/)
  if (m) {
    let d = Number(m[1])
    let mo = Number(m[2])
    const y = Number(m[3])
    if (mo > 12 && d <= 12) {
      ;[d, mo] = [mo, d]
    }
    const dt = new Date(y, mo - 1, d, Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0))
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function formatDateBr(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function monthLabel(d) {
  if (!d) return ''
  return `${MESES_LABEL[d.getMonth()]}/${d.getFullYear()}`
}

function statusLabel(raw) {
  const c = canonicalStatus(raw)
  if (c === 'win') return 'Ganho (Vendido)'
  if (c === 'lost') return 'Perdido'
  if (c === 'ongoing') return 'Em andamento'
  return toText(raw) || '—'
}

function readByAliases(obj, aliases) {
  for (const a of aliases) {
    const v = toText(obj[a])
    if (v) return v
  }
  return ''
}

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

async function readSheetRows(spreadsheetId, sheetName, accessToken) {
  const rangeStr =
    sheetName && String(sheetName).trim()
      ? `'${String(sheetName).trim().replace(/'/g, "''")}'!A:ZZ`
      : 'A:ZZ'
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeStr)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'Erro ao ler planilha')
  return json.values || []
}

// ---------- Estilo ----------
const COR_MARCA = 'FF1E3A5F' // azul escuro
const COR_HEADER_TXT = 'FFFFFFFF'
const COR_GANHO = 'FFDCFCE7' // verde claro
const COR_GANHO_TXT = 'FF15803D'
const COR_PERDIDO = 'FFFEE2E2' // vermelho claro
const COR_PERDIDO_TXT = 'FFB91C1C'
const COR_ANDAMENTO = 'FFFEF3C7' // âmbar claro
const COR_ANDAMENTO_TXT = 'FF92400E'
const COR_FAIXA = 'FFF3F4F6' // cinza bem claro (linhas alternadas)

function estilizarHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR_HEADER_TXT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARCA } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
  })
  row.height = 22
}

function corPorStatus(status) {
  if (status === 'Ganho (Vendido)') return { fill: COR_GANHO, txt: COR_GANHO_TXT }
  if (status === 'Perdido') return { fill: COR_PERDIDO, txt: COR_PERDIDO_TXT }
  if (status === 'Em andamento') return { fill: COR_ANDAMENTO, txt: COR_ANDAMENTO_TXT }
  return null
}

function autoFiltroELargura(ws, colunas, totalLinhas) {
  ws.columns = colunas.map((c) => ({ width: c.width ?? 18 }))
  if (totalLinhas > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function preencherTabela(ws, colunas, linhas, opts = {}) {
  const headerRow = ws.addRow(colunas.map((c) => c.header))
  estilizarHeader(headerRow)
  linhas.forEach((linha, idx) => {
    const row = ws.addRow(colunas.map((c) => linha[c.key] ?? ''))
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: colunas[colNumber - 1].numeric ? 'center' : 'left', wrapText: false }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill || cell.fill.fgColor?.argb !== undefined) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_FAIXA } }
        }
      })
    }
    if (opts.statusKey) {
      const statusColIdx = colunas.findIndex((c) => c.key === opts.statusKey) + 1
      if (statusColIdx > 0) {
        const cor = corPorStatus(linha[opts.statusKey])
        if (cor) {
          const cell = row.getCell(statusColIdx)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor.fill } }
          cell.font = { bold: true, color: { argb: cor.txt } }
        }
      }
    }
  })
  autoFiltroELargura(ws, colunas, linhas.length)
}

function tituloSheet(ws, texto, larguraColunas) {
  ws.mergeCells(1, 1, 1, larguraColunas)
  const cell = ws.getCell(1, 1)
  cell.value = texto
  cell.font = { bold: true, size: 14, color: { argb: COR_HEADER_TXT } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARCA } }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 28
}

async function main() {
  const dataInicio = brasiliaDayBoundary(INICIO_STR, false)
  const dataFim = brasiliaDayBoundary(FIM_STR, true)

  const spreadsheetId = (process.env.VITE_PLANILHA_ID || '').trim()
  const sheetName = (process.env.VITE_PLANILHA_ABA || '').trim() || undefined
  if (!spreadsheetId) throw new Error('VITE_PLANILHA_ID não configurado')

  const { accessToken } = await refreshSharedGoogleAccessToken()
  const matrix = await readSheetRows(spreadsheetId, sheetName, accessToken)
  if (matrix.length < 2) throw new Error('Planilha vazia')

  const headers = (matrix[0] || []).map((h) => normalizeHeader(h))
  const objects = matrix.slice(1).map((line, idx) => {
    const obj = { __rowIndex: idx + 2 }
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue
      obj[headers[i]] = line[i] ?? ''
    }
    return obj
  })

  const filtered = []
  let skippedNoDate = 0
  let skippedOutOfRange = 0
  let skippedNotSalesFunnel = 0
  let skippedNotAreaAnalise = 0

  for (const obj of objects) {
    const createdRaw = readByAliases(obj, [
      'created_at',
      'date_create',
      'data_criacao',
      'data_de_criacao',
      'datacriacao',
      'data_criacao_do_registro',
    ])
    const created = parseDate(createdRaw)
    if (!created) {
      skippedNoDate++
      continue
    }
    const foraDoPeriodo = created < dataInicio || created > dataFim
    const emAndamento = canonicalStatus(readByAliases(obj, ['status', 'estado', 'situacao'])) === 'ongoing'
    if (foraDoPeriodo && !(ANDAMENTO_TUDO && emAndamento)) {
      skippedOutOfRange++
      continue
    }

    const etapa = readByAliases(obj, ['stage_name', 'stage', 'etapa', 'nome_etapa'])
    const funilRaw = readByAliases(obj, ['funil'])
    if (!passesFunilVendasDashboard(etapa, funilRaw)) {
      skippedNotSalesFunnel++
      continue
    }

    const areasAnaliseRaw = readByAliases(obj, ['areas_analise', 'areas_de_analise'])
    if (!SEM_FILTRO_AREA && !leadTemAreaAnalise(areasAnaliseRaw, AREA_ALVO)) {
      skippedNotAreaAnalise++
      continue
    }

    const emailSolicitante = readByAliases(obj, ['email', 'email_solicitante', 'email_do_solicitante'])
    const emailNotificar = readByAliases(obj, ['email_notificar', 'cadastrado_por', 'cadastro_realizado_por'])
    const responsavel = resolveTeamMember(emailSolicitante, emailNotificar)
    const solicitanteColuna = readByAliases(obj, ['solicitante'])
    const nome =
      readByAliases(obj, ['nome', 'nome_lead', 'razao_social', 'razao_social_completa']) || `Linha ${obj.__rowIndex}`
    const estado = readByAliases(obj, ['status', 'estado', 'situacao'])
    const areasLead = parseAreasAnalise(areasAnaliseRaw).join(', ')

    filtered.push({
      data_criacao_dt: created,
      data_criacao: formatDateBr(created),
      mes_criacao: monthLabel(created),
      nome_lead: nome,
      razao_social: readByAliases(obj, ['razao_social', 'razao_social_completa']),
      responsavel_nome: responsavel.name,
      responsavel_tag: responsavel.tag || '(sem área)',
      email_responsavel: responsavel.email,
      solicitante_coluna: solicitanteColuna,
      areas_analise_lead: areasLead,
      tipo_de_lead: readByAliases(obj, ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead']),
      indicacao: readByAliases(obj, ['indicacao']),
      nome_indicacao: readByAliases(obj, ['nome_indicacao', 'nome_da_indicacao']),
      estado,
      status: statusLabel(estado),
      etapa,
      funil: funilRaw || 'Funil de vendas',
      motivo_perda: readByAliases(obj, ['motivo_perda']),
      motivo_perda_anotacao: readByAliases(obj, ['motivo_perda_anotacao']),
      telefone: readByAliases(obj, ['telefone', 'telefone_notificar', 'celular']),
      email_solicitante: emailSolicitante,
      deal_id: readByAliases(obj, ['deal_id']),
      link_crm: readByAliases(obj, ['deal_id'])
        ? `https://crm.rdstation.com/app/deals/${readByAliases(obj, ['deal_id'])}`
        : '',
    })
  }

  filtered.sort((a, b) => a.data_criacao_dt.getTime() - b.data_criacao_dt.getTime())

  const totalLeads = filtered.length
  const ganhos = filtered.filter((r) => r.status === 'Ganho (Vendido)')
  const perdidos = filtered.filter((r) => r.status === 'Perdido')
  const andamento = filtered.filter((r) => r.status === 'Em andamento')
  const taxaConversao = totalLeads > 0 ? Math.round((ganhos.length / totalLeads) * 100) : 0
  const taxaGanhoDecididos =
    ganhos.length + perdidos.length > 0 ? Math.round((ganhos.length / (ganhos.length + perdidos.length)) * 100) : 0

  // ---------- Workbook ----------
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CRM Bismarchi | Pires'
  wb.created = new Date()

  const COLUNAS_DETALHE = [
    { key: 'data_criacao', header: 'Data criação', width: 13 },
    { key: 'mes_criacao', header: 'Mês', width: 10 },
    { key: 'nome_lead', header: 'Lead', width: 38 },
    { key: 'razao_social', header: 'Razão social', width: 30 },
    { key: 'responsavel_nome', header: 'Responsável', width: 24 },
    { key: 'responsavel_tag', header: 'Área do responsável', width: 20 },
    { key: 'areas_analise_lead', header: 'Áreas de análise (lead)', width: 26 },
    { key: 'status', header: 'Status', width: 16 },
    { key: 'etapa', header: 'Etapa', width: 22 },
    { key: 'funil', header: 'Funil', width: 16 },
    { key: 'tipo_de_lead', header: 'Tipo de lead', width: 16 },
    { key: 'indicacao', header: 'Indicação', width: 14 },
    { key: 'nome_indicacao', header: 'Nome da indicação', width: 20 },
    { key: 'motivo_perda', header: 'Motivo perda', width: 26 },
    { key: 'motivo_perda_anotacao', header: 'Anotação motivo perda', width: 30 },
    { key: 'telefone', header: 'Telefone', width: 16 },
    { key: 'email_solicitante', header: 'E-mail solicitante', width: 28 },
    { key: 'deal_id', header: 'Deal ID', width: 22 },
    { key: 'link_crm', header: 'Link CRM', width: 40 },
  ]

  // --- Sheet Resumo ---
  const tituloArea = SEM_FILTRO_AREA ? 'Todas as áreas (escritório)' : `Área de análise: ${AREA_ALVO}`
  const wsResumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  tituloSheet(wsResumo, `Leads ${formatDateBr(dataInicio)} a ${formatDateBr(dataFim)} · ${tituloArea}`, 6)
  wsResumo.addRow([])

  const kpiRow = wsResumo.addRow(['Total', 'Ganhos', 'Perdidos', 'Em andamento', 'Conversão (total)', 'Taxa de ganho (decididos)'])
  kpiRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    cell.alignment = { horizontal: 'center' }
  })
  const kpiValoresRow = wsResumo.addRow([
    totalLeads,
    ganhos.length,
    perdidos.length,
    andamento.length,
    `${taxaConversao}%`,
    `${taxaGanhoDecididos}%`,
  ])
  kpiValoresRow.height = 26
  const kpiCores = [COR_MARCA, COR_GANHO, COR_PERDIDO, COR_ANDAMENTO, COR_MARCA, COR_MARCA]
  const kpiTxtCores = [COR_HEADER_TXT, COR_GANHO_TXT, COR_PERDIDO_TXT, COR_ANDAMENTO_TXT, COR_HEADER_TXT, COR_HEADER_TXT]
  kpiValoresRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 14, color: { argb: kpiTxtCores[colNumber - 1] } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiCores[colNumber - 1] } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  wsResumo.getColumn(1).width = 12
  wsResumo.getColumn(2).width = 12
  wsResumo.getColumn(3).width = 12
  wsResumo.getColumn(4).width = 14
  wsResumo.getColumn(5).width = 18
  wsResumo.getColumn(6).width = 24
  wsResumo.addRow([])
  wsResumo.addRow([])

  // Resumo por mês
  const porMesMap = new Map()
  filtered.forEach((r) => {
    const key = r.mes_criacao
    const cur = porMesMap.get(key) || { mes: key, ord: r.data_criacao_dt.getMonth() + r.data_criacao_dt.getFullYear() * 12, total: 0, ganhos: 0, perdidos: 0, andamento: 0 }
    cur.total++
    if (r.status === 'Ganho (Vendido)') cur.ganhos++
    else if (r.status === 'Perdido') cur.perdidos++
    else cur.andamento++
    porMesMap.set(key, cur)
  })
  const porMes = Array.from(porMesMap.values()).sort((a, b) => a.ord - b.ord)

  const tituloMesRow = wsResumo.addRow(['Resumo por mês'])
  tituloMesRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1F2937' } }
  const colunasMes = [
    { key: 'mes', header: 'Mês', width: 12 },
    { key: 'total', header: 'Total', width: 10, numeric: true },
    { key: 'ganhos', header: 'Ganhos', width: 10, numeric: true },
    { key: 'perdidos', header: 'Perdidos', width: 10, numeric: true },
    { key: 'andamento', header: 'Em andamento', width: 14, numeric: true },
  ]
  const headerMesRow = wsResumo.addRow(colunasMes.map((c) => c.header))
  estilizarHeader(headerMesRow)
  porMes.forEach((r) => {
    const row = wsResumo.addRow(colunasMes.map((c) => r[c.key]))
    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'center' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })
  })
  wsResumo.addRow([])
  wsResumo.addRow([])

  // Resumo por responsável
  const porRespMap = new Map()
  filtered.forEach((r) => {
    const key = r.responsavel_nome
    const cur = porRespMap.get(key) || { nome: key, total: 0, ganhos: 0, perdidos: 0, andamento: 0 }
    cur.total++
    if (r.status === 'Ganho (Vendido)') cur.ganhos++
    else if (r.status === 'Perdido') cur.perdidos++
    else cur.andamento++
    porRespMap.set(key, cur)
  })
  const porResp = Array.from(porRespMap.values()).sort((a, b) => b.total - a.total)

  const tituloRespRow = wsResumo.addRow(['Resumo por responsável'])
  tituloRespRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1F2937' } }
  const colunasResp = [
    { key: 'nome', header: 'Responsável', width: 26 },
    { key: 'total', header: 'Total', width: 10, numeric: true },
    { key: 'ganhos', header: 'Ganhos', width: 10, numeric: true },
    { key: 'perdidos', header: 'Perdidos', width: 10, numeric: true },
    { key: 'andamento', header: 'Em andamento', width: 14, numeric: true },
  ]
  const headerRespRow = wsResumo.addRow(colunasResp.map((c) => c.header))
  estilizarHeader(headerRespRow)
  porResp.forEach((r) => {
    const row = wsResumo.addRow(colunasResp.map((c) => r[c.key]))
    row.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })
  })

  // --- Sheet Todos os Leads ---
  const wsTodos = wb.addWorksheet('Todos os Leads')
  preencherTabela(wsTodos, COLUNAS_DETALHE, filtered, { statusKey: 'status' })

  // --- Sheet Ganhos ---
  const wsGanhos = wb.addWorksheet('Ganhos')
  preencherTabela(wsGanhos, COLUNAS_DETALHE, ganhos, { statusKey: 'status' })

  // --- Sheet Perdidos ---
  const wsPerdidos = wb.addWorksheet('Perdidos')
  preencherTabela(wsPerdidos, COLUNAS_DETALHE, perdidos, { statusKey: 'status' })

  // --- Sheet Em Andamento ---
  const wsAndamento = wb.addWorksheet('Em Andamento')
  preencherTabela(wsAndamento, COLUNAS_DETALHE, andamento, { statusKey: 'status' })

  // --- Sheet Resumo por Etapa ---
  const porEtapaMap = new Map()
  filtered.forEach((r) => {
    const key = r.etapa || '(sem etapa)'
    const cur = porEtapaMap.get(key) || { etapa: key, total: 0, ganhos: 0, perdidos: 0, andamento: 0 }
    cur.total++
    if (r.status === 'Ganho (Vendido)') cur.ganhos++
    else if (r.status === 'Perdido') cur.perdidos++
    else cur.andamento++
    porEtapaMap.set(key, cur)
  })
  const porEtapa = Array.from(porEtapaMap.values()).sort((a, b) => b.total - a.total)
  const wsEtapa = wb.addWorksheet('Resumo por Etapa')
  preencherTabela(
    wsEtapa,
    [
      { key: 'etapa', header: 'Etapa', width: 26 },
      { key: 'total', header: 'Total', width: 10, numeric: true },
      { key: 'ganhos', header: 'Ganhos', width: 10, numeric: true },
      { key: 'perdidos', header: 'Perdidos', width: 10, numeric: true },
      { key: 'andamento', header: 'Em andamento', width: 14, numeric: true },
    ],
    porEtapa,
  )

  // --- Sheet Observações ---
  const wsObs = wb.addWorksheet('Observações')
  wsObs.getColumn(1).width = 28
  wsObs.getColumn(2).width = 60
  const obsLinhas = [
    ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Área de análise filtrada', SEM_FILTRO_AREA ? 'Todas (escritório todo)' : AREA_ALVO],
    [
      'Período',
      ANDAMENTO_TUDO
        ? `${INICIO_STR} a ${FIM_STR} (por data de criação) para ganhos/perdidos; em andamento = todos em aberto, de qualquer data`
        : `${INICIO_STR} a ${FIM_STR} (horário de Brasília, por data de criação)`,
    ],
    ['Total de leads', totalLeads],
    [
      'Critério',
      SEM_FILTRO_AREA
        ? 'Todos os leads do Funil de vendas no período, de qualquer área e qualquer responsável.'
        : 'Leads do Funil de vendas cujo campo "Áreas que serão objeto de análise" contém a área acima (independente de quem é o responsável pela negociação).',
    ],
    ['Leads ignorados — sem data de criação', skippedNoDate],
    ['Leads ignorados — fora do período', skippedOutOfRange],
    ['Leads ignorados — fora do Funil de vendas', skippedNotSalesFunnel],
    ...(SEM_FILTRO_AREA ? [] : [['Leads ignorados — sem a área de análise no campo', skippedNotAreaAnalise]]),
  ]
  obsLinhas.forEach((linha, idx) => {
    const row = wsObs.addRow(linha)
    row.getCell(1).font = { bold: true }
    if (idx === 0) row.getCell(1).font = { bold: true }
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const areaSlug = SEM_FILTRO_AREA
    ? 'todas-as-areas'
    : AREA_ALVO.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-')
  const outFile = LABEL ? `leads-${areaSlug}-${LABEL}.xlsx` : `leads-${areaSlug}-${ANO}.xlsx`
  const outPath = path.join(OUT_DIR, outFile)
  await wb.xlsx.writeFile(outPath)

  console.log(
    JSON.stringify(
      {
        ok: true,
        arquivo: outPath,
        areaAnalise: SEM_FILTRO_AREA ? 'Todas (escritório todo)' : AREA_ALVO,
        periodo: `${INICIO_STR} a ${FIM_STR}`,
        totalLeads,
        ganhos: ganhos.length,
        perdidos: perdidos.length,
        emAndamento: andamento.length,
        taxaConversao: `${taxaConversao}%`,
        skippedNoDate,
        skippedOutOfRange,
        skippedNotSalesFunnel,
        skippedNotAreaAnalise,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
