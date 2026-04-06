/* eslint-disable no-console */
import fs from 'fs'
import https from 'https'
import XLSX from 'xlsx'

function readRdToken() {
  for (const p of ['.env.local', '.env']) {
    if (!fs.existsSync(p)) continue
    const txt = fs.readFileSync(p, 'utf8')
    const m = txt.match(/^RD_CRM_TOKEN=(.*)$/m)
    if (m && m[1]) return m[1].trim().replace(/^"|"$/g, '')
  }
  return null
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: 'application/json' } }, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) })
          } catch (error) {
            resolve({ status: res.statusCode, json: null, raw: data, error })
          }
        })
      })
      .on('error', reject)
  })
}

function normalizeLabel(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function toText(v) {
  return String(v ?? '').trim()
}

function normalizeComparable(v) {
  const s = toText(v)
  if (!s) return ''
  if (/^n\s*\/?\s*a$/i.test(s)) return 'N/A'
  return s.replace(/\s+/g, ' ').trim()
}

const FIELD_MAPPINGS = [
  ['primeiro_faturamento_financeiro', 'Primeiro Faturamento [FINANCEIRO]'],
  ['rateio_valor_insolvencia_financeiro', 'RATEIO - VALOR R$ (Reestruturação e Insolvência) - [FINANCEIRO]'],
  ['rateio_porcentagem_insolvencia_financeiro', 'RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC]'],
  ['rateio_valor_civel_financeiro', 'RATEIO - VALOR R$ (Cível) - [FINANCEIRO]'],
  ['rateio_porcentagem_civel_financeiro', 'RATEIO - PORCENTAGEM % (Cível) - [CC]'],
  ['rateio_valor_trabalhista_financeiro', 'RATEIO - VALOR R$ (Trabalhista) - [FINANCEIRO]'],
  ['rateio_porcentagem_trabalhista_financeiro', 'RATEIO - PORCENTAGEM % (Trabalhista) - [CC]'],
  ['rateio_valor_tributario_financeiro', 'RATEIO - VALOR R$ (Tributário) - [FINANCEIRO]'],
  ['rateio_porcentagem_tributario_financeiro', 'RATEIO - PORCENTAGEM % (Tributário) - [CC]'],
  ['rateio_valor_contratos_financeiro', 'RATEIO - VALOR R$ (Contratos / Societário) - [FINANCEIRO]'],
  ['rateio_porcentagem_contratos_financeiro', 'RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC]'],
  ['rateio_valor_add_financeiro', 'RATEIO - VALOR R$ (ADD) - [FINANCEIRO]'],
  ['rateio_porcentagem_add_financeiro', 'RATEIO - PORCENTAGEM % (ADD) - [CC]'],
  ['indice_reajuste_financeiro', 'Índice de Reajuste - [FINANCEIRO]'],
  ['periodicidade_reajuste_financeiro', 'Periodicidade do Reajuste - [FINANCEIRO]'],
  ['observacoes_financeiro', 'Observações - [FINANCEIRO]'],
  ['mensal_preco_fechado_financeiro', 'Mensal - Preço Fechado Parcelado - Valor R$ [CC]'],
]

async function fetchAllDeals(rdToken) {
  const byDealId = new Map()
  let page = 1
  let hasMore = true
  while (hasMore) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(rdToken)}&page=${page}&limit=200`
    const resp = await httpGetJson(url)
    if (resp.status !== 200 || !resp.json) {
      throw new Error(`Falha ao buscar RD (page=${page}, status=${resp.status})`)
    }
    const deals = Array.isArray(resp.json.deals) ? resp.json.deals : []
    for (const deal of deals) {
      const id = toText(deal?.id || deal?._id)
      if (id) byDealId.set(id, deal)
    }
    hasMore = resp.json.has_more === true && deals.length > 0
    if (hasMore) page++
  }
  return byDealId
}

function buildCustomFieldIndex(deal) {
  const idx = new Map()
  const fields = Array.isArray(deal?.deal_custom_fields) ? deal.deal_custom_fields : []
  for (const field of fields) {
    const key = normalizeLabel(field?.custom_field?.label || '')
    if (!key) continue
    if (!idx.has(key) || (toText(idx.get(key)) === '' && toText(field?.value) !== '')) {
      idx.set(key, field?.value ?? '')
    }
  }
  return idx
}

async function main() {
  const token = readRdToken()
  if (!token) {
    throw new Error('RD_CRM_TOKEN não encontrado em .env/.env.local')
  }

  const rdDeals = await fetchAllDeals(token)
  const workbook = XLSX.readFile('public/CRM-DADOS.xlsx')
  const firstSheet = workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' })
  const headers = (matrix[0] || []).map((h) => normalizeHeader(h))
  const rows = matrix.slice(1).map((line) => {
    const obj = {}
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue
      obj[headers[i]] = line[i] ?? ''
    }
    return obj
  })

  let rowsWithDeal = 0
  let rowsMatched = 0
  let rowsWithDiff = 0
  const fieldDiffCount = Object.fromEntries(FIELD_MAPPINGS.map(([k]) => [k, 0]))
  const sampleDiffs = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const dealId = toText(row.deal_id)
    if (!dealId) continue
    rowsWithDeal++

    const rd = rdDeals.get(dealId)
    if (!rd) continue
    rowsMatched++
    const rdIndex = buildCustomFieldIndex(rd)

    let changed = false
    for (const [sheetField, rdLabel] of FIELD_MAPPINGS) {
      const localValue = normalizeComparable(row[sheetField])
      const rdValue = normalizeComparable(rdIndex.get(normalizeLabel(rdLabel)) ?? '')
      if (localValue !== rdValue) {
        fieldDiffCount[sheetField]++
        changed = true
        if (sampleDiffs.length < 25) {
          sampleDiffs.push({
            rowIndex: i + 2,
            dealId,
            field: sheetField,
            localValue,
            rdValue,
          })
        }
      }
    }
    if (changed) rowsWithDiff++
  }

  const officer = rows.find((r) => toText(r.deal_id) === '68924d7526c1f50018dc039b')
  const officerRd = rdDeals.get('68924d7526c1f50018dc039b')
  const officerIndex = buildCustomFieldIndex(officerRd || {})

  const officerComparison = FIELD_MAPPINGS.map(([sheetField, rdLabel]) => ({
    field: sheetField,
    localValue: normalizeComparable(officer?.[sheetField] ?? ''),
    rdValue: normalizeComparable(officerIndex.get(normalizeLabel(rdLabel)) ?? ''),
  })).filter((item) => item.localValue !== item.rdValue)

  console.log(
    JSON.stringify(
      {
        summary: {
          rdDeals: rdDeals.size,
          rowsWithDeal,
          rowsMatched,
          rowsWithDiff,
        },
        fieldDiffCount,
        officerDiffs: officerComparison,
        sampleDiffs,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
