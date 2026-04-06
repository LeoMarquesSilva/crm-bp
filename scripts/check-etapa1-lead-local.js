/* eslint-disable no-console */
import fs from 'fs'
import https from 'https'
import XLSX from 'xlsx'

const LEAD_QUERY = process.argv.slice(2).join(' ').trim() || 'ALUCEL SUPRIMENTOS INDUSTRIAIS'

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

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function normalizeLabel(s) {
  return String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—―]/g, '-')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9[\]%()/+-]/g, '')
    .trim()
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toText(v) {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join(', ')
  return String(v).trim()
}

function readByAliases(obj, aliases) {
  for (const a of aliases) {
    const v = toText(obj[a])
    if (v) return v
  }
  return ''
}

function getRdValueByLabels(deal, labels) {
  const fields = Array.isArray(deal?.deal_custom_fields) ? deal.deal_custom_fields : []
  const idx = new Map()
  for (const field of fields) {
    const key = normalizeLabel(field?.custom_field?.label ?? '')
    if (!key) continue
    const value = toText(field?.value ?? '')
    if (!idx.has(key) || (!toText(idx.get(key)) && value)) idx.set(key, value)
  }
  for (const label of labels) {
    const v = idx.get(normalizeLabel(label))
    if (v != null) return toText(v)
  }
  return ''
}

function normalizeCompare(key, value) {
  const s = toText(value)
  if (!s) return ''
  if (key === 'cnpj') return s.replace(/\D/g, '')
  if (key === 'email' || key === 'cadastrado_por') return s.toLowerCase().trim()
  return normalizeText(s)
}

function isYes(v) {
  const n = normalizeText(v)
  return n === 'sim' || n === 'yes' || n === 'true'
}

function isIndicacao(v) {
  return normalizeText(v) === 'indicacao'
}

const FIELD_DEFS = [
  { key: 'solicitante', label: 'Solicitante', sheetAliases: ['solicitante'], rdLabels: ['Solicitante'], required: true },
  {
    key: 'email',
    label: 'E-mail do Solicitante',
    sheetAliases: ['email', 'email_solicitante', 'email_do_solicitante', 'e_mail_do_solicitante'],
    rdLabels: ['E-mail do Solicitante', 'Email Solicitante'],
    required: true,
  },
  {
    key: 'cadastrado_por',
    label: 'Cadastro realizado por',
    sheetAliases: ['cadastrado_por', 'cadastro_realizado_por_email', 'cadastro_realizado_por'],
    rdLabels: ['Cadastro realizado por'],
    required: true,
  },
  { key: 'due_diligence', label: 'Haverá Due Diligence?', sheetAliases: ['due_diligence', 'havera_due_diligence'], rdLabels: ['Haverá Due Diligence?'], required: true },
  { key: 'local_reuniao', label: 'Local da Reunião', sheetAliases: ['local_reuniao', 'local_da_reuniao'], rdLabels: ['Local da Reunião'], required: true },
  { key: 'tipo_de_lead', label: 'Tipo de Lead', sheetAliases: ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead'], rdLabels: ['Tipo de Lead'], required: true },
  { key: 'razao_social', label: 'Razão Social', sheetAliases: ['razao_social', 'razao_social_completa', 'razao_social_nome_completo'], rdLabels: ['Razão Social [CP]', 'Razão Social'], required: true },
  { key: 'cnpj', label: 'CNPJ/CPF', sheetAliases: ['cnpj', 'cnpj_cpf', 'cpf_cnpj'], rdLabels: ['CNPJ [CP]', 'CNPJ/CPF'], required: true },
  {
    key: 'prazo_reuniao_due',
    label: 'Prazo de Entrega Due [DATA]',
    sheetAliases: ['prazo_reuniao_due', 'prazo_de_entrega_da_due', 'prazo_entrega_data'],
    rdLabels: ['Prazo de Entrega Due [DATA]'],
    requiredWhen: ({ due }) => isYes(due),
  },
  {
    key: 'horario_due',
    label: 'Prazo de Entrega Due [HORÁRIO]',
    sheetAliases: ['horario_due', 'horario_de_entrega_da_due', 'prazo_entrega_hora'],
    rdLabels: ['Prazo de Entrega Due [HORÁRIO]'],
    requiredWhen: ({ due }) => isYes(due),
  },
  {
    key: 'indicacao',
    label: 'Indicação',
    sheetAliases: ['indicacao'],
    rdLabels: ['Indicação'],
    requiredWhen: ({ tipo }) => isIndicacao(tipo),
  },
  {
    key: 'nome_indicacao',
    label: 'Nome da Indicação',
    sheetAliases: ['nome_indicacao', 'nome_da_indicacao'],
    rdLabels: ['Nome da Indicação'],
    requiredWhen: ({ tipo }) => isIndicacao(tipo),
  },
]

async function fetchAllDeals(token) {
  const all = []
  let page = 1
  let hasMore = true
  while (hasMore) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(token)}&page=${page}&limit=200`
    const resp = await httpGetJson(url)
    if (resp.status !== 200 || !resp.json) throw new Error(`Falha RD (status=${resp.status}, page=${page})`)
    const deals = Array.isArray(resp.json.deals) ? resp.json.deals : []
    all.push(...deals)
    hasMore = resp.json.has_more === true && deals.length > 0
    if (hasMore) page++
  }
  return all
}

function loadSheetRows() {
  const workbook = XLSX.readFile('public/CRM-DADOS.xlsx')
  const firstSheet = workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' })
  const headers = (matrix[0] || []).map((h) => normalizeHeader(h))
  return matrix.slice(1).map((line, idx) => {
    const obj = { __rowIndex: idx + 2 }
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue
      obj[headers[i]] = toText(line[i] ?? '')
    }
    return obj
  })
}

function pickDealByName(deals, query) {
  const q = normalizeText(query)
  return deals.find((d) => {
    const name = normalizeText(d?.name || '')
    const org = normalizeText(d?.organization?.name || '')
    return name.includes(q) || org.includes(q)
  })
}

function pickSheetRowByDealOrName(rows, deal, query) {
  const dealId = toText(deal?.id || deal?._id)
  if (dealId) {
    const byId = rows.find((r) => toText(r.deal_id) === dealId)
    if (byId) return byId
  }
  const q = normalizeText(query)
  return rows.find((r) => {
    const values = [
      r.nome,
      r.nome_lead,
      r.razao_social,
      r.razao_social_completa,
      r.razao_social_nome_completo,
    ]
      .map((v) => normalizeText(v))
      .filter(Boolean)
    return values.some((v) => v.includes(q))
  })
}

async function main() {
  const token = readRdToken()
  if (!token) throw new Error('RD_CRM_TOKEN não encontrado em .env/.env.local')

  const [deals, rows] = await Promise.all([fetchAllDeals(token), Promise.resolve(loadSheetRows())])
  const deal = pickDealByName(deals, LEAD_QUERY)
  if (!deal) {
    console.log(JSON.stringify({ ok: false, message: `Lead não encontrado no RD: ${LEAD_QUERY}` }, null, 2))
    return
  }

  const row = pickSheetRowByDealOrName(rows, deal, LEAD_QUERY)
  if (!row) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message: 'Lead encontrado no RD, mas não localizado na planilha.',
          rd: { id: deal.id || deal._id, name: deal.name, organization: deal.organization?.name || '' },
        },
        null,
        2,
      ),
    )
    return
  }

  const due = readByAliases(row, ['due_diligence', 'havera_due_diligence']) || getRdValueByLabels(deal, ['Haverá Due Diligence?'])
  const tipo = readByAliases(row, ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead']) || getRdValueByLabels(deal, ['Tipo de Lead'])
  const context = { due, tipo }

  const diffs = []
  for (const f of FIELD_DEFS) {
    const requiredNow = f.required === true || (typeof f.requiredWhen === 'function' && f.requiredWhen(context))
    if (!requiredNow) continue

    const sheetValue = readByAliases(row, f.sheetAliases)
    const rdValue = getRdValueByLabels(deal, f.rdLabels)
    const a = normalizeCompare(f.key, sheetValue)
    const b = normalizeCompare(f.key, rdValue)
    if (a !== b) {
      diffs.push({
        field: f.key,
        label: f.label,
        sheetValue,
        rdValue,
        type: !a && !b ? 'missing_both' : !a ? 'missing_in_sheet' : !b ? 'missing_in_rd' : 'mismatch',
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        leadQuery: LEAD_QUERY,
        rd: {
          id: deal.id || deal._id,
          name: deal.name || '',
          organization: deal.organization?.name || '',
          stage: deal.deal_stage?.name || '',
        },
        sheet: {
          rowIndex: row.__rowIndex,
          deal_id: row.deal_id || '',
          nome: row.nome || row.nome_lead || '',
          razao_social: row.razao_social || '',
          stage_name: row.stage_name || '',
        },
        divergenceCount: diffs.length,
        divergences: diffs,
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
