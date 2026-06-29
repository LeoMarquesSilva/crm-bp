/* eslint-disable no-console */
/**
 * Exporta Excel: leads do funil Due Dilligence Prospect (vendas), criadas em 2026 jan–mai.
 *
 * Uso: node scripts/export-leads-2026-jan-maio.js
 * Saída: exports/leads-2026-jan-maio-quem-trouxe.xlsx
 */
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { loadEnvFromRoot } from './dev-api-app.js'
import { refreshSharedGoogleAccessToken } from '../api/_google-auth.js'
import { canonicalStatus } from '../api/sync-status-rd-sheets.js'

loadEnvFromRoot()

const YEAR = 2026
const MONTH_START = 1
const MONTH_END = 5 // inclusive; junho excluído
const OUT_DIR = 'exports'
const OUT_FILE = `leads-${YEAR}-jan-maio-funil-vendas-v3.xlsx`
const SALES_FUNNEL_LABEL = 'Funil de vendas'

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

/** Nomes e áreas (tags) por e-mail — espelha src/data/teamAvatars.ts */
const TEAM_BY_EMAIL = {
  'gustavo@bpplaw.com.br': { name: 'Gustavo Bismarchi', tag: 'Sócio' },
  'ricardo@bpplaw.com.br': { name: 'Ricardo Viscardi Pires', tag: 'Sócio' },
  'gabriela.consul@bpplaw.com.br': { name: 'Gabriela Consul', tag: 'Cível' },
  'giancarlo@bpplaw.com.br': { name: 'Giancarlo Zotini', tag: 'Cível' },
  'daniel@bpplaw.com.br': { name: 'Daniel Pressatto Fernandes', tag: 'Trabalhista' },
  'renato@bpplaw.com.br': { name: 'Renato Vallim', tag: 'Trabalhista' },
  'michel.malaquias@bpplaw.com.br': { name: 'Michel Malaquias', tag: 'Distressed Deals' },
  'emanueli.lourenco@bpplaw.com.br': { name: 'Emanueli Lourenço', tag: 'Distressed Deals' },
  'ariany.bispo@bpplaw.com.br': { name: 'Ariany Bispo', tag: 'Distressed Deals' },
  'jorge@bpplaw.com.br': { name: 'Jorge Pecht Souza', tag: 'Reestruturação' },
  'leonardo@bpplaw.com.br': { name: 'Leonardo Loureiro Basso', tag: 'Reestruturação' },
  'ligia@bpplaw.com.br': { name: 'Ligia Lopes', tag: 'Reestruturação' },
  'wagner.armani@bpplaw.com.br': { name: 'Wagner Armani', tag: 'Societário e Contratos' },
  'jansonn@bpplaw.com.br': { name: 'Jansonn Mendonça Batista', tag: 'Societário e Contratos' },
  'henrique.nascimento@bpplaw.com.br': { name: 'Henrique Franco Nascimento', tag: 'Societário e Contratos' },
  'felipe@bpplaw.com.br': { name: 'Felipe Camargo', tag: 'Operações Legais' },
  'lavinia.ferraz@bpplaw.com.br': { name: 'Lavínia Ferraz Crispim', tag: 'Operações Legais' },
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

function solicitanteDashboard(emailSolicitante, emailNotificar) {
  return resolveTeamMember(emailSolicitante, emailNotificar).name
}

function areaDashboard(emailSolicitante, emailNotificar) {
  return resolveTeamMember(emailSolicitante, emailNotificar).tag ?? '(sem área)'
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

function inferFunilLabel(stageName, funilRaw) {
  const explicit = toText(funilRaw)
  if (explicit) return explicit
  return passesFunilVendasDashboard(stageName, funilRaw) ? SALES_FUNNEL_LABEL : ''
}

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
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

function inRange2026JanMay(d) {
  if (!d) return false
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return y === YEAR && m >= MONTH_START && m <= MONTH_END
}

function formatDateBr(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function monthLabel(d) {
  if (!d) return ''
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[d.getMonth()]}/${d.getFullYear()}`
}

function statusLabel(raw) {
  const c = canonicalStatus(raw)
  if (c === 'win') return 'Ganho (Vendido)'
  if (c === 'lost') return 'Perdido'
  if (c === 'ongoing') return 'Em andamento'
  return toText(raw) || '—'
}

function quemTrouxe(row) {
  const solicitante = toText(row.solicitante)
  const tipo = toText(row.tipo_de_lead || row.tipo_lead || row.tipo_do_lead)
  const indicacao = toText(row.indicacao)
  const nomeInd = toText(row.nome_indicacao || row.nome_da_indicacao)
  const parts = []
  if (solicitante) parts.push(solicitante)
  if (tipo) parts.push(`Tipo: ${tipo}`)
  if (indicacao || nomeInd) {
    parts.push([indicacao, nomeInd].filter(Boolean).join(' — '))
  }
  return parts.join(' | ') || '—'
}

function readByAliases(obj, aliases) {
  for (const a of aliases) {
    const v = toText(obj[a])
    if (v) return v
  }
  return ''
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

function buildResumoPorSolicitanteDashboard(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = r.solicitante_dashboard
    const cur = map.get(key) || { solicitante: key, total: 0, ganhos: 0, perdidos: 0, em_andamento: 0 }
    cur.total++
    const st = canonicalStatus(r.estado || r.status)
    if (st === 'win') cur.ganhos++
    else if (st === 'lost') cur.perdidos++
    else cur.em_andamento++
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function buildResumoPorMes(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = r.mes_criacao || '—'
    const cur = map.get(key) || { mes: key, total: 0, ganhos: 0, perdidos: 0, em_andamento: 0 }
    cur.total++
    const st = canonicalStatus(r.estado || r.status)
    if (st === 'win') cur.ganhos++
    else if (st === 'lost') cur.perdidos++
    else cur.em_andamento++
    map.set(key, cur)
  }
  const order = ['Jan/2026', 'Fev/2026', 'Mar/2026', 'Abr/2026', 'Mai/2026']
  return order.filter((k) => map.has(k)).map((k) => map.get(k))
}

function bumpStats(map, key, estado, labelField = 'label') {
  const cur = map.get(key) || { [labelField]: key, total: 0, ganhos: 0, perdidos: 0, em_andamento: 0 }
  cur.total++
  const st = canonicalStatus(estado)
  if (st === 'win') cur.ganhos++
  else if (st === 'lost') cur.perdidos++
  else cur.em_andamento++
  map.set(key, cur)
}

function buildResumoPorAreaTag(rows) {
  const map = new Map()
  for (const r of rows) bumpStats(map, r.area_tag, r.estado, 'area')
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function buildResumoSolicitanteComArea(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = `${r.area_tag}\0${r.solicitante_dashboard}`
    const cur = map.get(key) || {
      area: r.area_tag,
      solicitante: r.solicitante_dashboard,
      total: 0,
      ganhos: 0,
      perdidos: 0,
      em_andamento: 0,
    }
    cur.total++
    const st = canonicalStatus(r.estado)
    if (st === 'win') cur.ganhos++
    else if (st === 'lost') cur.perdidos++
    else cur.em_andamento++
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, 'pt-BR'))
}

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

function buildResumoAreasAnaliseLead(rows) {
  const map = new Map()
  for (const r of rows) {
    const parts = parseAreasAnalise(r.areas_analise)
    if (parts.length === 0) {
      bumpStats(map, '(não informado)', r.estado, 'area_analise')
      continue
    }
    for (const area of parts) bumpStats(map, area, r.estado, 'area_analise')
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function buildCatalogoEquipe() {
  return Object.entries(TEAM_BY_EMAIL)
    .map(([email, m]) => ({
      area_tag: m.tag,
      solicitante: m.name,
      email,
    }))
    .sort((a, b) => a.area_tag.localeCompare(b.area_tag, 'pt-BR') || a.solicitante.localeCompare(b.solicitante, 'pt-BR'))
}

async function main() {
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
    if (!inRange2026JanMay(created)) {
      skippedOutOfRange++
      continue
    }

    const etapa = readByAliases(obj, ['stage_name', 'stage', 'etapa', 'nome_etapa'])
    const funilRaw = readByAliases(obj, ['funil'])
    if (!passesFunilVendasDashboard(etapa, funilRaw)) {
      skippedNotSalesFunnel++
      continue
    }

    const emailSolicitante = readByAliases(obj, ['email', 'email_solicitante', 'email_do_solicitante'])
    const emailNotificar = readByAliases(obj, ['email_notificar', 'cadastrado_por', 'cadastro_realizado_por'])
    const solicitanteColuna = readByAliases(obj, ['solicitante'])
    const solicitanteDash = solicitanteDashboard(emailSolicitante, emailNotificar)
    const areaTag = areaDashboard(emailSolicitante, emailNotificar)

    const nome =
      readByAliases(obj, ['nome', 'nome_lead', 'razao_social', 'razao_social_completa']) || `Linha ${obj.__rowIndex}`
    const estado = readByAliases(obj, ['status', 'estado', 'situacao'])
    const row = {
      data_criacao: formatDateBr(created),
      mes_criacao: monthLabel(created),
      nome_lead: nome,
      solicitante: solicitanteColuna,
      solicitante_dashboard: solicitanteDash,
      area_tag: areaTag,
      email_solicitante: emailSolicitante,
      email_notificar: emailNotificar,
      quem_trouxe_resumo: '',
      tipo_de_lead: readByAliases(obj, ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead']),
      indicacao: readByAliases(obj, ['indicacao']),
      nome_indicacao: readByAliases(obj, ['nome_indicacao', 'nome_da_indicacao']),
      areas_analise: readByAliases(obj, ['areas_analise', 'areas_de_analise']),
      estado: estado,
      status_resumo: statusLabel(estado),
      etapa,
      funil: inferFunilLabel(etapa, funilRaw),
      deal_id: readByAliases(obj, ['deal_id']),
      cadastrado_por: readByAliases(obj, ['cadastrado_por', 'cadastro_realizado_por']),
    }
    row.quem_trouxe_resumo = quemTrouxe(row)
    filtered.push(row)
  }

  filtered.sort((a, b) => {
    const da = parseDate(a.data_criacao)
    const db = parseDate(b.data_criacao)
    return (da?.getTime() ?? 0) - (db?.getTime() ?? 0)
  })

  const detalhe = filtered.map((r) => ({
    'Data criação': r.data_criacao,
    Mês: r.mes_criacao,
    'Nome / Lead': r.nome_lead,
    'Solicitante (sistema/e-mail)': r.solicitante_dashboard,
    'Área (tag solicitante)': r.area_tag,
    'Solicitante (coluna planilha)': r.solicitante,
    'Quem trouxe (resumo)': r.quem_trouxe_resumo,
    'Tipo de Lead': r.tipo_de_lead,
    'Áreas de análise (lead)': r.areas_analise,
    Indicação: r.indicacao,
    'Nome da Indicação': r.nome_indicacao,
    Status: r.status_resumo,
    Etapa: r.etapa,
    Funil: r.funil,
    'E-mail solicitante': r.email_solicitante,
    'E-mail notificar': r.email_notificar,
    'Cadastrado por': r.cadastrado_por,
    'Deal ID': r.deal_id,
  }))

  const mapResumo = (rows) =>
    rows.map((r) => ({
      Solicitante: r.solicitante,
      Total: r.total,
      Ganhos: r.ganhos,
      Perdidos: r.perdidos,
      'Em andamento': r.em_andamento,
      'Taxa conversão (%)': r.total > 0 ? Math.round((r.ganhos / r.total) * 100) : 0,
    }))

  const porSolicitanteDashboard = mapResumo(buildResumoPorSolicitanteDashboard(filtered))
  const porSolicitanteColuna = mapResumo(
    (() => {
      const map = new Map()
      for (const r of filtered) {
        const key = toText(r.solicitante) || '(sem solicitante)'
        const cur = map.get(key) || { solicitante: key, total: 0, ganhos: 0, perdidos: 0, em_andamento: 0 }
        cur.total++
        const st = canonicalStatus(r.estado)
        if (st === 'win') cur.ganhos++
        else if (st === 'lost') cur.perdidos++
        else cur.em_andamento++
        map.set(key, cur)
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total)
    })(),
  )

  const porMes = buildResumoPorMes(filtered).map((r) => ({
    Mês: r.mes,
    Total: r.total,
    Ganhos: r.ganhos,
    Perdidos: r.perdidos,
    'Em andamento': r.em_andamento,
  }))

  const totalLeads = filtered.length
  const mapResumoArea = (rows, labelKey) =>
    rows.map((r) => ({
      [labelKey === 'area' ? 'Área (tag)' : 'Área de análise']: r[labelKey] ?? r.area_analise ?? r.area,
      Total: r.total,
      Ganhos: r.ganhos,
      Perdidos: r.perdidos,
      'Em andamento': r.em_andamento,
      'Taxa conversão (%)': r.total > 0 ? Math.round((r.ganhos / r.total) * 100) : 0,
      'Participação (%)': totalLeads > 0 ? Math.round((r.total / totalLeads) * 100) : 0,
    }))

  const porAreaTag = mapResumoArea(buildResumoPorAreaTag(filtered), 'area')
  const porAreasAnaliseLead = mapResumoArea(buildResumoAreasAnaliseLead(filtered), 'area_analise')

  const solicitantePorArea = buildResumoSolicitanteComArea(filtered).map((r) => ({
    'Área (tag)': r.area,
    Solicitante: r.solicitante,
    Total: r.total,
    Ganhos: r.ganhos,
    Perdidos: r.perdidos,
    'Em andamento': r.em_andamento,
    'Taxa conversão (%)': r.total > 0 ? Math.round((r.ganhos / r.total) * 100) : 0,
  }))

  const catalogoEquipe = buildCatalogoEquipe().map((r) => ({
    'Área (tag)': r.area_tag,
    Solicitante: r.solicitante,
    'E-mail': r.email,
  }))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, OUT_FILE)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Funil Vendas Jan-Mai 26')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porSolicitanteDashboard), 'Resumo Dashboard (e-mail)')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porAreaTag), 'Resumo por Área (tag)')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitantePorArea), 'Solicitante por Área')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porAreasAnaliseLead), 'Áreas Análise (lead)')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalogoEquipe), 'Catálogo Equipe x Área')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porSolicitanteColuna), 'Resumo Coluna Planilha')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porMes), 'Resumo por Mês')
  XLSX.writeFile(wb, outPath)

  console.log(
    JSON.stringify(
      {
        ok: true,
        arquivo: outPath,
        periodo: `${YEAR}-01-01 a ${YEAR}-05-31 (junho excluído)`,
        funil: SALES_FUNNEL_LABEL,
        totalLeads: filtered.length,
        skippedNoDate,
        skippedOutOfRange,
        skippedNotSalesFunnel,
        abas: [
          'Funil Vendas Jan-Mai 26',
          'Resumo Dashboard (e-mail)',
          'Resumo por Área (tag)',
          'Solicitante por Área',
          'Áreas Análise (lead)',
          'Catálogo Equipe x Área',
          'Resumo Coluna Planilha',
          'Resumo por Mês',
        ],
        areasTag: porAreaTag.length,
        areasAnaliseLead: porAreasAnaliseLead.length,
        solicitantesDashboard: porSolicitanteDashboard.length,
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
