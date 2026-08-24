/* eslint-disable no-console */
/**
 * Exporta Excel: leads perdidos (estado=lost) criados a partir de 2025,
 * com o dono do lead (solicitante) e o motivo da perda.
 *
 * Uso: node scripts/export-leads-perdidos-2025.js
 * Saída: exports/leads-perdidos-2025.xlsx
 */
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { loadEnvFromRoot } from './dev-api-app.js'
import { refreshSharedGoogleAccessToken } from '../api/_google-auth.js'

loadEnvFromRoot()

const OUT_DIR = 'exports'
const OUT_FILE = 'leads-perdidos-2025.xlsx'
const ANO_MINIMO = 2025

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
  'lavinia.ferraz@bpplaw.com.br': { name: 'Lavínia Ferraz Crispim', tag: 'Reestruturação' },
  'francisco.zanin@bpplaw.com.br': { name: 'Francisco Zanin', tag: 'Tributário' },
}

function normalizeEmailKey(email) {
  return String(email || '').trim().toLowerCase()
    .replace('@bismarchipires.com.br', '@bpplaw.com.br')
    .replace('@bismarchipires.com', '@bpplaw.com')
}

function areaDashboard(emailSolicitante, emailNotificar) {
  const e = toText(emailSolicitante) || toText(emailNotificar)
  if (!e) return '(sem área)'
  return TEAM_BY_EMAIL[normalizeEmailKey(e)]?.tag ?? '(sem área)'
}

function toText(v) {
  if (v == null) return ''
  return String(v).trim()
}

function normalizeHeader(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function parseDate(val) {
  if (val == null || val === '') return null
  const s = toText(val)
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return new Date(iso)
  return null
}

function formatDateBr(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

async function readSheetRows(spreadsheetId, sheetName, accessToken) {
  const rangeStr = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A:ZZ` : 'A:ZZ'
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeStr)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'Erro ao ler planilha')
  return json.values || []
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Só o endpoint de detalhe traz deal_pipeline e deal_lost_note (a lista de /deals não traz). */
async function fetchDealDetail(rdToken, dealId, attempt = 1) {
  const url = `https://crm.rdstation.com/api/v1/deals/${dealId}?token=${encodeURIComponent(rdToken)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return { status: 'not_found' }
  if (!res.ok) {
    if (attempt >= 3) return { status: 'rate_limited' }
    await sleep(500 * attempt)
    return fetchDealDetail(rdToken, dealId, attempt + 1)
  }
  return { status: 'ok', deal: await res.json() }
}

const PIPELINES_PERMITIDOS = ['Due Dilligence Prospect', 'Pós-Venda (Onboarding do Cliente)']

async function fetchDealDetailsBatched(rdToken, dealIds, concurrency = 3) {
  const byId = new Map()
  const notFoundIds = new Set()
  const rateLimitedIds = new Set()
  let idx = 0
  let done = 0
  async function worker() {
    while (idx < dealIds.length) {
      const i = idx++
      const id = dealIds[i]
      const result = await fetchDealDetail(rdToken, id)
      if (result.status === 'ok') byId.set(id, result.deal)
      else if (result.status === 'not_found') notFoundIds.add(id)
      else rateLimitedIds.add(id)
      done++
      if (done % 50 === 0) console.log(`  ${done}/${dealIds.length}...`)
      await sleep(150)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  if (rateLimitedIds.size > 0) {
    console.log(`Segunda passada (mais devagar) para ${rateLimitedIds.size} negociações limitadas por rate limit...`)
    await sleep(8000)
    for (const id of rateLimitedIds) {
      const result = await fetchDealDetail(rdToken, id)
      if (result.status === 'ok') {
        byId.set(id, result.deal)
        rateLimitedIds.delete(id)
      } else if (result.status === 'not_found') {
        notFoundIds.add(id)
        rateLimitedIds.delete(id)
      }
      await sleep(1000)
    }
  }

  return { byId, notFoundIds, rateLimitedIds }
}

async function main() {
  const rdToken = process.env.RD_CRM_TOKEN
  const spreadsheetId = (process.env.VITE_PLANILHA_ID || '').trim()
  const sheetName = (process.env.VITE_PLANILHA_ABA || '').trim() || undefined
  const { accessToken } = await refreshSharedGoogleAccessToken()
  const matrix = await readSheetRows(spreadsheetId, sheetName, accessToken)

  const headers = (matrix[0] || []).map((h) => normalizeHeader(h))
  const headerIndex = new Map()
  headers.forEach((h, idx) => { if (h && !headerIndex.has(h)) headerIndex.set(h, idx) })

  const get = (row, key) => toText(row[headerIndex.get(key)])

  const candidatas = []
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] || []
    if (!get(row, 'deal_id')) continue
    if (get(row, 'estado') !== 'lost') continue
    const created = parseDate(get(row, 'date_create'))
    if (!created || created.getFullYear() < ANO_MINIMO) continue

    const emailSolicitante = get(row, 'email_solicitante')
    const emailNotificar = get(row, 'cadastrado_por')
    const solicitanteEmail = emailSolicitante || emailNotificar
    const solicitanteNome = TEAM_BY_EMAIL[normalizeEmailKey(solicitanteEmail)]?.name || get(row, 'solicitante') || '(sem solicitante)'

    candidatas.push({
      lead: get(row, 'nome') || get(row, 'lead') || get(row, 'razao_social') || `Linha ${i + 1}`,
      dono: solicitanteNome,
      area: areaDashboard(emailSolicitante, emailNotificar),
      motivo: get(row, 'motivo_perda') || '(sem motivo registrado)',
      motivo_anotacao_sheet: get(row, 'motivo_perda_anotacao'),
      criado_em: formatDateBr(created),
      perdido_em: formatDateBr(parseDate(get(row, 'date_update'))),
      deal_id: get(row, 'deal_id'),
      link_crm: get(row, 'deal_id') ? `https://crm.rdstation.com/app/deals/${get(row, 'deal_id')}` : '',
    })
  }

  console.log(`Buscando detalhe de ${candidatas.length} negociações no RD (pipeline + anotação da perda)...`)
  const { byId: detailsById, notFoundIds, rateLimitedIds } = await fetchDealDetailsBatched(
    rdToken,
    candidatas.map((c) => c.deal_id),
  )

  let excluidasPorPipeline = 0
  let excluidasPorRateLimit = 0
  let semDetalheNoRd = 0
  const linhas = []
  for (const c of candidatas) {
    if (rateLimitedIds.has(c.deal_id)) {
      excluidasPorRateLimit++
      continue
    }
    const detail = detailsById.get(c.deal_id)
    if (!detail) {
      semDetalheNoRd++
      linhas.push({ ...c, pipeline: '(negociação removida do RD)', anotacao_perda: c.motivo_anotacao_sheet || '' })
      continue
    }
    const pipelineNome = detail?.deal_pipeline?.name || ''
    if (pipelineNome && !PIPELINES_PERMITIDOS.includes(pipelineNome)) {
      excluidasPorPipeline++
      continue
    }
    linhas.push({
      ...c,
      pipeline: pipelineNome || '(sem pipeline)',
      anotacao_perda: toText(detail?.deal_lost_note) || c.motivo_anotacao_sheet || '',
    })
  }

  console.log(`Excluídas por não serem do funil Due Dilligence Prospect / Pós-Venda: ${excluidasPorPipeline}`)
  console.log(`Excluídas por limite de requisições do RD (não deu pra verificar): ${excluidasPorRateLimit}`)
  console.log(`Sem detalhe no RD (negociação removida, mantidas): ${semDetalheNoRd}`)

  linhas.sort((a, b) => {
    const da = parseDate(a.criado_em.split('/').reverse().join('-'))
    const db = parseDate(b.criado_em.split('/').reverse().join('-'))
    return (da?.getTime() ?? 0) - (db?.getTime() ?? 0)
  })

  const detalhe = linhas.map((l) => ({
    'Lead': l.lead,
    'Dono do Lead (Solicitante)': l.dono,
    'Área': l.area,
    'Motivo da Perda': l.motivo,
    'Anotação da Perda': l.anotacao_perda || '',
    'Funil': l.pipeline,
    'Criado em': l.criado_em,
    'Perdido em': l.perdido_em,
    'Link CRM': l.link_crm,
  }))

  const porMotivo = new Map()
  linhas.forEach((l) => porMotivo.set(l.motivo, (porMotivo.get(l.motivo) ?? 0) + 1))
  const resumoMotivo = Array.from(porMotivo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, total]) => ({ 'Motivo da Perda': motivo, Total: total }))

  const porDono = new Map()
  linhas.forEach((l) => porDono.set(l.dono, (porDono.get(l.dono) ?? 0) + 1))
  const resumoDono = Array.from(porDono.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dono, total]) => ({ 'Dono do Lead': dono, Total: total }))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Leads Perdidos 2025+')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoMotivo), 'Resumo por Motivo')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoDono), 'Resumo por Dono')

  let outPath = path.join(OUT_DIR, OUT_FILE)
  try {
    XLSX.writeFile(wb, outPath)
  } catch (err) {
    if (err.code !== 'EBUSY') throw err
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    outPath = path.join(OUT_DIR, OUT_FILE.replace('.xlsx', `-${ts}.xlsx`))
    console.warn(`Arquivo original em uso (provavelmente aberto no Excel). Gravando em: ${outPath}`)
    XLSX.writeFile(wb, outPath)
  }

  console.log(JSON.stringify({
    ok: true,
    arquivo: outPath,
    total: linhas.length,
    excluidasPorPipeline,
    excluidasPorRateLimit,
    semDetalheNoRd,
  }, null, 2))
}

main().catch((err) => { console.error(err.message || err); process.exit(1) })
