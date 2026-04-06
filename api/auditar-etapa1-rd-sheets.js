/**
 * API – Auditoria da 1a etapa do funil de vendas (RD x Google Sheets)
 * POST body: { accessToken, spreadsheetId, sheetName?, onlySalesFunnel?, firstStageOnly? }
 *
 * Retorna divergencias por deal_id entre os campos solicitados na etapa inicial.
 */
import { isGoogleAuthError, refreshSharedGoogleAccessToken } from './_google-auth.js'

function toText(v) {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join(', ')
  return String(v).trim()
}

function normalizeHeader(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function normalizeLabel(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[–—―]/g, '-')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9[\]%()/+-]/g, '')
    .trim()
}

function normalizeGeneric(v) {
  return toText(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForCompare(fieldKey, value) {
  const txt = toText(value)
  if (!txt) return ''

  if (fieldKey === 'cnpj') return txt.replace(/\D/g, '')
  if (fieldKey === 'email' || fieldKey === 'cadastrado_por') return txt.toLowerCase().trim()

  return normalizeGeneric(txt)
}

function isYes(value) {
  const n = normalizeGeneric(value)
  return n === 'sim' || n === 'yes' || n === 'true'
}

function isIndicacao(value) {
  const n = normalizeGeneric(value)
  return n === 'indicacao' || n === 'indicacao'
}

function readByAliases(obj, aliases) {
  for (const alias of aliases) {
    const v = toText(obj[alias])
    if (v) return v
  }
  return ''
}

function getRdValueByLabels(deal, labels) {
  const customFields = Array.isArray(deal?.deal_custom_fields) ? deal.deal_custom_fields : []
  const index = new Map()
  for (const field of customFields) {
    const key = normalizeLabel(field?.custom_field?.label ?? '')
    if (!key) continue
    const value = toText(field?.value ?? '')
    if (!index.has(key) || (!toText(index.get(key)) && value)) {
      index.set(key, value)
    }
  }
  for (const label of labels) {
    const value = index.get(normalizeLabel(label))
    if (value != null) return toText(value)
  }
  return ''
}

const FIRST_STAGE_FIELD_DEFS = [
  {
    key: 'solicitante',
    label: 'Solicitante',
    sheetAliases: ['solicitante'],
    rdLabels: ['Solicitante'],
    required: true,
  },
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
  {
    key: 'due_diligence',
    label: 'Havera Due Diligence?',
    sheetAliases: ['due_diligence', 'havera_due_diligence'],
    rdLabels: ['Haverá Due Diligence?'],
    required: true,
  },
  {
    key: 'local_reuniao',
    label: 'Local da Reuniao',
    sheetAliases: ['local_reuniao', 'local_da_reuniao'],
    rdLabels: ['Local da Reunião'],
    required: true,
  },
  {
    key: 'tipo_de_lead',
    label: 'Tipo de Lead',
    sheetAliases: ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead'],
    rdLabels: ['Tipo de Lead'],
    required: true,
  },
  {
    key: 'razao_social',
    label: 'Razao Social',
    sheetAliases: ['razao_social', 'razao_social_completa', 'razao_social_nome_completo'],
    rdLabels: ['Razão Social [CP]', 'Razão Social'],
    required: true,
  },
  {
    key: 'cnpj',
    label: 'CNPJ/CPF',
    sheetAliases: ['cnpj', 'cnpj_cpf', 'cpf_cnpj'],
    rdLabels: ['CNPJ [CP]', 'CNPJ/CPF'],
    required: true,
  },
  {
    key: 'prazo_reuniao_due',
    label: 'Prazo de Entrega da Due',
    sheetAliases: ['prazo_reuniao_due', 'prazo_de_entrega_da_due', 'prazo_entrega_data'],
    rdLabels: ['Prazo de Entrega Due [DATA]'],
    requiredWhen: ({ dueDiligence }) => isYes(dueDiligence),
  },
  {
    key: 'horario_due',
    label: 'Horario de Entrega da Due',
    sheetAliases: ['horario_due', 'horario_de_entrega_da_due', 'prazo_entrega_hora'],
    rdLabels: ['Prazo de Entrega Due [HORÁRIO]'],
    requiredWhen: ({ dueDiligence }) => isYes(dueDiligence),
  },
  {
    key: 'indicacao',
    label: 'Indicacao',
    sheetAliases: ['indicacao'],
    rdLabels: ['Indicação'],
    requiredWhen: ({ tipoLead }) => isIndicacao(tipoLead),
  },
  {
    key: 'nome_indicacao',
    label: 'Nome da Indicacao',
    sheetAliases: ['nome_indicacao', 'nome_da_indicacao'],
    rdLabels: ['Nome da Indicação'],
    requiredWhen: ({ tipoLead }) => isIndicacao(tipoLead),
  },
]

function classifyDivergence(sheetNorm, rdNorm) {
  if (!sheetNorm && !rdNorm) return 'missing_both'
  if (!sheetNorm && rdNorm) return 'missing_in_sheet'
  if (sheetNorm && !rdNorm) return 'missing_in_rd'
  return 'mismatch'
}

function isSalesFunnel(value) {
  const n = normalizeGeneric(value)
  return n.includes('funil de vendas') || n === 'vendas' || n.includes('vendas')
}

function isFirstStageName(value) {
  const n = normalizeGeneric(value)
  if (!n) return false
  return n.includes('cadastro') || n.includes('lead capturado') || n.includes('lead captado')
}

async function readSheetRows({ spreadsheetId, sheetName, accessToken }) {
  const rangeStr = sheetName ? `'${String(sheetName).trim().replace(/'/g, "''")}'!A:ZZ` : 'A:ZZ'
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeStr)}`

  let googleAccessToken = accessToken
  let sheetRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${googleAccessToken}` } })
  let sheetData = await sheetRes.json()
  if (isGoogleAuthError(sheetRes.status, sheetData)) {
    const refreshed = await refreshSharedGoogleAccessToken()
    googleAccessToken = refreshed.accessToken
    sheetRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${googleAccessToken}` } })
    sheetData = await sheetRes.json()
  }
  if (sheetData.error) throw new Error(sheetData.error.message || 'Erro ao ler planilha')

  return { rows: sheetData.values || [], googleAccessToken }
}

async function fetchAllRdDeals(rdToken) {
  const byDealId = new Map()
  let page = 1
  let hasMore = true
  while (hasMore) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(rdToken)}&page=${page}&limit=200`
    const rdRes = await fetch(url, { headers: { Accept: 'application/json' } })
    const rdJson = await rdRes.json()
    if (!rdRes.ok) throw new Error(rdJson.message || rdJson.error || `Erro RD ${rdRes.status}`)

    const deals = Array.isArray(rdJson.deals) ? rdJson.deals : []
    for (const deal of deals) {
      const id = toText(deal?.id || deal?._id)
      if (id) byDealId.set(id, deal)
    }
    hasMore = rdJson.has_more === true && deals.length > 0
    if (hasMore) page++
  }
  return byDealId
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const rdToken = process.env.RD_CRM_TOKEN
  if (!rdToken) {
    return res.status(500).json({
      error: 'Configuração incompleta',
      message: 'RD_CRM_TOKEN não configurado no .env/.env.local',
    })
  }

  try {
    const {
      accessToken,
      spreadsheetId,
      sheetName,
      onlySalesFunnel = true,
      firstStageOnly = false,
      maxDivergences = 2000,
    } = req.body || {}

    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({
        error: 'Parâmetros faltando',
        message: 'Envie accessToken e spreadsheetId no body (JSON).',
      })
    }

    const [rdByDealId, sheetPayload] = await Promise.all([
      fetchAllRdDeals(rdToken),
      readSheetRows({ spreadsheetId, sheetName, accessToken }),
    ])
    const rawRows = sheetPayload.rows
    if (rawRows.length < 2) {
      return res.status(200).json({
        ok: true,
        message: 'Planilha sem dados para auditoria.',
        stats: { rowsRead: 0, dealsRd: rdByDealId.size },
        divergences: [],
      })
    }

    const headers = rawRows[0].map((h) => normalizeHeader(toText(h)))
    const sheetRows = rawRows.slice(1).map((row, idx) => {
      const obj = { __rowIndex: idx + 2 }
      for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) continue
        obj[headers[i]] = toText(row?.[i] ?? '')
      }
      return obj
    })

    const divergences = []
    let rowsEvaluated = 0
    let rowsWithDealId = 0
    let rowsWithoutRdMatch = 0

    for (const row of sheetRows) {
      const dealId = toText(row.deal_id)
      if (!dealId) continue
      rowsWithDealId++

      if (onlySalesFunnel && !isSalesFunnel(row.funil || row.funnel)) continue
      if (firstStageOnly && !isFirstStageName(row.stage_name || row.stage || row.nome_etapa)) continue

      rowsEvaluated++
      const rdDeal = rdByDealId.get(dealId)
      if (!rdDeal) {
        rowsWithoutRdMatch++
        if (divergences.length < maxDivergences) {
          divergences.push({
            rowIndex: row.__rowIndex,
            dealId,
            stageName: row.stage_name || null,
            fieldKey: 'deal_id',
            fieldLabel: 'Deal ID',
            type: 'deal_not_found_in_rd',
            sheetValue: dealId,
            rdValue: '',
          })
        }
        continue
      }

      const dueDiligenceSheet = readByAliases(row, ['due_diligence', 'havera_due_diligence'])
      const dueDiligenceRd = getRdValueByLabels(rdDeal, ['Haverá Due Diligence?'])
      const tipoLeadSheet = readByAliases(row, ['tipo_de_lead', 'tipo_lead', 'tipo_do_lead'])
      const tipoLeadRd = getRdValueByLabels(rdDeal, ['Tipo de Lead'])
      const context = {
        dueDiligence: dueDiligenceSheet || dueDiligenceRd,
        tipoLead: tipoLeadSheet || tipoLeadRd,
      }

      for (const def of FIRST_STAGE_FIELD_DEFS) {
        const requiredNow = def.required === true || (typeof def.requiredWhen === 'function' && def.requiredWhen(context))
        if (!requiredNow) continue

        const sheetValue = readByAliases(row, def.sheetAliases)
        const rdValue = getRdValueByLabels(rdDeal, def.rdLabels)
        const sheetNorm = normalizeForCompare(def.key, sheetValue)
        const rdNorm = normalizeForCompare(def.key, rdValue)

        if (sheetNorm === rdNorm) continue
        if (divergences.length >= maxDivergences) continue

        divergences.push({
          rowIndex: row.__rowIndex,
          dealId,
          stageName: row.stage_name || row.stage || null,
          fieldKey: def.key,
          fieldLabel: def.label,
          type: classifyDivergence(sheetNorm, rdNorm),
          sheetValue,
          rdValue,
        })
      }
    }

    const dealsWithDivergenceSet = new Set(divergences.map((d) => d.dealId))
    return res.status(200).json({
      ok: true,
      message: 'Auditoria de etapa inicial concluída.',
      stats: {
        rowsRead: rawRows.length - 1,
        rowsWithDealId,
        rowsEvaluated,
        rowsWithoutRdMatch,
        rdDealsFetched: rdByDealId.size,
        divergenceCount: divergences.length,
        dealsWithDivergence: dealsWithDivergenceSet.size,
      },
      configUsed: {
        onlySalesFunnel: !!onlySalesFunnel,
        firstStageOnly: !!firstStageOnly,
        requiredFieldKeys: FIRST_STAGE_FIELD_DEFS.map((f) => f.key),
      },
      divergences,
    })
  } catch (err) {
    console.error('auditar-etapa1-rd-sheets error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Falha ao auditar etapa inicial (RD x Sheets).',
    })
  }
}
