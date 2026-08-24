/* eslint-disable no-console */
/**
 * Exporta Excel: TODOS os leads da área Cível criados num período
 * (Funil de vendas), com status Ganho, Perdido ou Em andamento.
 *
 * "Área Cível" segue a mesma definição usada no Dashboard/AnalisePlanilha:
 * área da equipe do solicitante (e-mail do solicitante → tag), via
 * TEAM_BY_EMAIL / getAreaByEmail (src/data/teamAvatars.ts).
 *
 * Os limites de data (--inicio/--fim) são calculados em horário de Brasília
 * (America/Sao_Paulo, UTC-3), do mesmo jeito que o filtro de período do
 * Dashboard (src/pages/AnalisePlanilha.tsx), para os números baterem.
 *
 * Uso:
 *   node scripts/export-leads-civel-julho-2026.js
 *   node scripts/export-leads-civel-julho-2026.js --inicio=2026-07-01 --fim=2026-08-17 --label=01jul-17ago-2026
 *
 * Saída: exports/leads-civel-<label>.xlsx (label padrão: julho-2026)
 */
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { loadEnvFromRoot } from './dev-api-app.js'
import { refreshSharedGoogleAccessToken } from '../api/_google-auth.js'
import { canonicalStatus } from '../api/sync-status-rd-sheets.js'

loadEnvFromRoot()

const OUT_DIR = 'exports'
const AREA_ALVO = 'Cível'
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
const INICIO_STR = argv.inicio || '2026-07-01'
const FIM_STR = argv.fim || '2026-07-31'
const LABEL = argv.label || 'julho-2026'

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

/** Nomes e áreas (tags) por e-mail — espelha src/data/teamAvatars.ts */
const TEAM_BY_EMAIL = {
  'gustavo@bpplaw.com.br': { name: 'Gustavo Bismarchi', tag: 'Sócio' },
  'ricardo@bpplaw.com.br': { name: 'Ricardo Viscardi Pires', tag: 'Sócio' },
  'gabriela.consul@bpplaw.com.br': { name: 'Gabriela Consul', tag: 'Cível' },
  'giancarlo@bpplaw.com.br': { name: 'Giancarlo Zotini', tag: 'Cível' },
  'caroline.thome@bpplaw.com.br': { name: 'Maria Caroline da Cunha Thomé', tag: 'Cível' },
  'giovani.pina@bpplaw.com.br': { name: 'Giovani Pina de Freitas', tag: 'Cível' },
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
  let skippedNotArea = 0

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
    if (created < dataInicio || created > dataFim) {
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
    const areaTag = areaDashboard(emailSolicitante, emailNotificar)
    if (areaTag !== AREA_ALVO) {
      skippedNotArea++
      continue
    }

    const solicitanteColuna = readByAliases(obj, ['solicitante'])
    const solicitanteDash = solicitanteDashboard(emailSolicitante, emailNotificar)
    const nome =
      readByAliases(obj, ['nome', 'nome_lead', 'razao_social', 'razao_social_completa']) || `Linha ${obj.__rowIndex}`
    const estado = readByAliases(obj, ['status', 'estado', 'situacao'])
    const telefone = readByAliases(obj, ['telefone', 'telefone_notificar', 'celular'])
    const row = {
      data_criacao: formatDateBr(created),
      mes_criacao: monthLabel(created),
      nome_lead: nome,
      razao_social: readByAliases(obj, ['razao_social', 'razao_social_completa']),
      solicitante: solicitanteColuna,
      solicitante_dashboard: solicitanteDash,
      area_tag: areaTag,
      email_solicitante: emailSolicitante,
      email_notificar: emailNotificar,
      telefone,
      quem_trouxe_resumo: '',
      tipo_de_lead: readByAliases(obj, ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead']),
      indicacao: readByAliases(obj, ['indicacao']),
      nome_indicacao: readByAliases(obj, ['nome_indicacao', 'nome_da_indicacao']),
      areas_analise: readByAliases(obj, ['areas_analise', 'areas_de_analise']),
      estado: estado,
      status_resumo: statusLabel(estado),
      etapa,
      funil: funilRaw || 'Funil de vendas',
      deal_id: readByAliases(obj, ['deal_id']),
      motivo_perda: readByAliases(obj, ['motivo_perda']),
      motivo_perda_anotacao: readByAliases(obj, ['motivo_perda_anotacao']),
      cadastrado_por: readByAliases(obj, ['cadastrado_por', 'cadastro_realizado_por']),
      link_proposta: readByAliases(obj, ['link_da_proposta', 'link_proposta']),
      link_contrato: readByAliases(obj, ['link_do_contrato', 'link_contrato']),
      deal_link: readByAliases(obj, ['deal_id'])
        ? `https://crm.rdstation.com/app/deals/${readByAliases(obj, ['deal_id'])}`
        : '',
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
    'Razão social': r.razao_social,
    'Responsável (dashboard)': r.solicitante_dashboard,
    'Área': r.area_tag,
    'Solicitante (coluna planilha)': r.solicitante,
    'Quem trouxe (resumo)': r.quem_trouxe_resumo,
    'Tipo de Lead': r.tipo_de_lead,
    'Áreas de análise (lead)': r.areas_analise,
    Indicação: r.indicacao,
    'Nome da Indicação': r.nome_indicacao,
    Status: r.status_resumo,
    Etapa: r.etapa,
    Funil: r.funil,
    'Motivo perda': r.motivo_perda,
    'Anotação motivo perda': r.motivo_perda_anotacao,
    'Link Proposta': r.link_proposta,
    'Link Contrato': r.link_contrato,
    'Telefone': r.telefone,
    'E-mail solicitante': r.email_solicitante,
    'E-mail notificar': r.email_notificar,
    'Cadastrado por': r.cadastrado_por,
    'Deal ID': r.deal_id,
    'Link CRM': r.deal_link,
  }))

  const bumpStats = (map, key, estado) => {
    const cur = map.get(key) || { label: key, total: 0, ganhos: 0, perdidos: 0, em_andamento: 0 }
    cur.total++
    const st = canonicalStatus(estado)
    if (st === 'win') cur.ganhos++
    else if (st === 'lost') cur.perdidos++
    else cur.em_andamento++
    map.set(key, cur)
  }

  const resumoGeralMap = new Map()
  for (const r of filtered) bumpStats(resumoGeralMap, `Cível — ${INICIO_STR} a ${FIM_STR}`, r.estado)
  const resumoGeral = Array.from(resumoGeralMap.values()).map((r) => ({
    Período: r.label,
    Total: r.total,
    Ganhos: r.ganhos,
    Perdidos: r.perdidos,
    'Em andamento': r.em_andamento,
    'Taxa conversão (%)': r.total > 0 ? Math.round((r.ganhos / r.total) * 100) : 0,
  }))

  const resumoPorEtapaMap = new Map()
  for (const r of filtered) bumpStats(resumoPorEtapaMap, r.etapa, r.estado)
  const resumoPorEtapa = Array.from(resumoPorEtapaMap.values())
    .sort((a, b) => b.total - a.total)
    .map((r) => ({
      Etapa: r.label,
      Total: r.total,
      Ganhos: r.ganhos,
      Perdidos: r.perdidos,
      'Em andamento': r.em_andamento,
    }))

  const resumoPorSolicitanteMap = new Map()
  for (const r of filtered) bumpStats(resumoPorSolicitanteMap, r.solicitante_dashboard, r.estado)
  const resumoPorSolicitante = Array.from(resumoPorSolicitanteMap.values())
    .sort((a, b) => b.total - a.total)
    .map((r) => ({
      Solicitante: r.label,
      Total: r.total,
      Ganhos: r.ganhos,
      Perdidos: r.perdidos,
      'Em andamento': r.em_andamento,
      'Taxa conversão (%)': r.total > 0 ? Math.round((r.ganhos / r.total) * 100) : 0,
    }))

  const ganhos = detalhe.filter((r) => r.Status === 'Ganho (Vendido)')
  const perdidos = detalhe.filter((r) => r.Status === 'Perdido')
  const emAndamento = detalhe.filter((r) => r.Status === 'Em andamento')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outFile = `leads-civel-${LABEL}.xlsx`
  const outPath = path.join(OUT_DIR, outFile)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoGeral), 'Resumo Geral')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Todos os Leads')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ganhos), 'Ganhos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perdidos), 'Perdidos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emAndamento), 'Em Andamento')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPorEtapa), 'Resumo por Etapa')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPorSolicitante), 'Resumo por Responsável')
  XLSX.writeFile(wb, outPath)

  console.log(
    JSON.stringify(
      {
        ok: true,
        arquivo: outPath,
        area: AREA_ALVO,
        periodo: `${INICIO_STR} a ${FIM_STR}`,
        totalLeads: filtered.length,
        ganhos: ganhos.length,
        perdidos: perdidos.length,
        emAndamento: emAndamento.length,
        skippedNoDate,
        skippedOutOfRange,
        skippedNotSalesFunnel,
        skippedNotArea,
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
