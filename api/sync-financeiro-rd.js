/**
 * API – Backfill único de campos financeiros: RD CRM -> Google Sheets
 * POST body: { accessToken, spreadsheetId, sheetName?, dryRun? }
 *
 * - Lê negócios paginados no RD (v1 deals)
 * - Compara por deal_id com a planilha
 * - Atualiza somente diferenças (USER_ENTERED)
 * - dryRun (default: true) gera relatório sem escrever
 */
import { isGoogleAuthError, refreshSharedGoogleAccessToken } from './_google-auth.js'

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

function colIndexToLetter(idx) {
  if (idx < 1) return 'A'
  let s = ''
  let n = idx
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s || 'A'
}

function toText(v) {
  if (v == null) return ''
  return String(v).trim()
}

function isNA(v) {
  return /^n\s*\/?\s*a$/i.test(toText(v))
}

function normalizeComparable(v) {
  const s = toText(v)
  if (!s) return ''
  if (isNA(s)) return 'N/A'
  return s.replace(/\s+/g, ' ').trim()
}

function normalizeForWrite(fieldKey, value) {
  let s = toText(value)
  if (!s) return ''
  if (isNA(s)) return 'N/A'

  if (fieldKey === 'primeiro_faturamento_financeiro') {
    const date = parseDateValue(s)
    if (date) return date
  }

  if (fieldKey.includes('rateio_porcentagem_')) {
    if (/^\d+([.,]\d+)?$/.test(s)) return `${s}%`
    return s
  }

  return s
}

function parseDateValue(raw) {
  const s = toText(raw)
  if (!s) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s)
    if (!Number.isFinite(serial)) return ''
    const ms = Math.round((serial - 25569) * 86400 * 1000)
    const dt = new Date(ms)
    if (Number.isNaN(dt.getTime())) return ''
    const dd = String(dt.getUTCDate()).padStart(2, '0')
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = String(dt.getUTCFullYear())
    return `${dd}/${mm}/${yyyy}`
  }
  return ''
}

function shouldWrite(localValue, rdValue) {
  const localNorm = normalizeComparable(localValue)
  const rdNorm = normalizeComparable(rdValue)
  if (!rdNorm) return false // evita limpar planilha quando RD vem vazio
  if (localNorm === rdNorm) return false
  if (localNorm === '#ERROR!') return true
  return true
}

const FIELD_MAPPINGS = [
  { key: 'valor_contrato_anual_financeiro', labels: ['Valor Contrato Anual [FINANCEIRO]', 'Valor do Contrato Anual [FINANCEIRO]'] },
  { key: 'valor_primeiro_faturamento_financeiro', labels: ['Valor Primeiro Faturamento [FINANCEIRO]', 'Valor do Primeiro Faturamento [FINANCEIRO]'] },
  { key: 'primeiro_faturamento_financeiro', labels: ['Primeiro Faturamento [FINANCEIRO]'] },
  { key: 'rateio_valor_insolvencia_financeiro', labels: ['RATEIO - VALOR R$ (Reestruturação e Insolvência) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_insolvencia_financeiro', labels: ['RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC]'] },
  { key: 'rateio_valor_civel_financeiro', labels: ['RATEIO - VALOR R$ (Cível) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_civel_financeiro', labels: ['RATEIO - PORCENTAGEM % (Cível) - [CC]'] },
  { key: 'rateio_valor_trabalhista_financeiro', labels: ['RATEIO - VALOR R$ (Trabalhista) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_trabalhista_financeiro', labels: ['RATEIO - PORCENTAGEM % (Trabalhista) - [CC]'] },
  { key: 'rateio_valor_tributario_financeiro', labels: ['RATEIO - VALOR R$ (Tributário) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_tributario_financeiro', labels: ['RATEIO - PORCENTAGEM % (Tributário) - [CC]'] },
  { key: 'rateio_valor_contratos_financeiro', labels: ['RATEIO - VALOR R$ (Contratos / Societário) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_contratos_financeiro', labels: ['RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC]'] },
  { key: 'rateio_valor_add_financeiro', labels: ['RATEIO - VALOR R$ (ADD) - [FINANCEIRO]'] },
  { key: 'rateio_porcentagem_add_financeiro', labels: ['RATEIO - PORCENTAGEM % (ADD) - [CC]'] },
  { key: 'indice_reajuste_financeiro', labels: ['Índice de Reajuste - [FINANCEIRO]'] },
  { key: 'periodicidade_reajuste_financeiro', labels: ['Periodicidade do Reajuste - [FINANCEIRO]'] },
  { key: 'observacoes_financeiro', labels: ['Observações - [FINANCEIRO]'] },
  { key: 'mensal_preco_fechado_financeiro', labels: ['Mensal - Preço Fechado Parcelado - Valor R$ [CC]'] },
]

function getRdValueByLabels(deal, labels) {
  const customFields = Array.isArray(deal?.deal_custom_fields) ? deal.deal_custom_fields : []
  const labelIndex = new Map()
  for (const field of customFields) {
    const lbl = normalizeLabel(field?.custom_field?.label ?? '')
    if (!lbl) continue
    // mantém primeiro valor não vazio; fallback para primeiro visto
    if (!labelIndex.has(lbl) || (toText(labelIndex.get(lbl)) === '' && toText(field?.value) !== '')) {
      labelIndex.set(lbl, field?.value ?? '')
    }
  }
  for (const label of labels) {
    const v = labelIndex.get(normalizeLabel(label))
    if (v != null) return v
  }
  return ''
}

async function readSheetRows({ spreadsheetId, sheetName, accessToken }) {
  const rangeStr = (sheetName && String(sheetName).trim())
    ? `'${String(sheetName).trim().replace(/'/g, "''")}'!A:ZZ`
    : 'A:ZZ'
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

  if (sheetData.error) {
    throw new Error(sheetData.error.message || 'Erro ao ler planilha')
  }

  return { rows: sheetData.values || [], googleAccessToken }
}

async function fetchAllRdDeals(rdToken) {
  const byDealId = new Map()
  let page = 1
  let hasMore = true
  let totalFetched = 0

  while (hasMore) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(rdToken)}&page=${page}&limit=200`
    const rdRes = await fetch(url, { headers: { Accept: 'application/json' } })
    const rdJson = await rdRes.json()
    if (!rdRes.ok) {
      throw new Error(rdJson.message || rdJson.error || `Erro RD ${rdRes.status}`)
    }

    const deals = Array.isArray(rdJson.deals) ? rdJson.deals : []
    totalFetched += deals.length
    for (const d of deals) {
      const id = toText(d?.id || d?._id)
      if (!id) continue
      byDealId.set(id, d)
    }

    hasMore = rdJson.has_more === true && deals.length > 0
    if (hasMore) page++
  }

  return { byDealId, totalFetched, pages: page }
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
    const { accessToken, spreadsheetId, sheetName, dryRun = true, sampleDealIds = [] } = req.body || {}
    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({
        error: 'Parâmetros faltando',
        message: 'Envie accessToken e spreadsheetId no body (JSON).',
      })
    }

    const { byDealId, totalFetched, pages } = await fetchAllRdDeals(rdToken)
    const { rows: rawRows, googleAccessToken } = await readSheetRows({ spreadsheetId, sheetName, accessToken })

    if (rawRows.length < 2) {
      return res.status(200).json({
        ok: true,
        dryRun: true,
        message: 'Planilha sem linhas suficientes para backfill.',
        stats: { totalFetchedRdDeals: totalFetched, rdPages: pages, rowsRead: rawRows.length },
      })
    }

    const headers = rawRows[0].map((c) => toText(c))
    const headerIndex = new Map()
    headers.forEach((h, idx) => headerIndex.set(normalizeHeader(h), idx))

    const dealIdCol = headerIndex.get('deal_id')
    if (dealIdCol == null) {
      return res.status(400).json({
        error: 'Coluna deal_id não encontrada',
        message: 'A planilha precisa da coluna deal_id para reconciliação.',
      })
    }

    const colByField = new Map()
    const missingColumns = []
    for (const m of FIELD_MAPPINGS) {
      const idx = headerIndex.get(normalizeHeader(m.key))
      if (idx == null) {
        missingColumns.push(m.key)
      } else {
        colByField.set(m.key, idx)
      }
    }

    const updates = []
    const divergences = []
    let rowsWithDealId = 0
    let rowsMatchedRd = 0
    let rowsChanged = 0
    let rowsUnchanged = 0
    let rowsNoRdMatch = 0

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] || []
      const dealId = toText(row[dealIdCol])
      if (!dealId) continue
      rowsWithDealId++

      const deal = byDealId.get(dealId)
      if (!deal) {
        rowsNoRdMatch++
        continue
      }
      rowsMatchedRd++

      const rowNum = i + 1
      const sheetPrefix = (sheetName && String(sheetName).trim())
        ? `'${String(sheetName).trim().replace(/'/g, "''")}'!`
        : ''

      let changedThisRow = false
      for (const mapping of FIELD_MAPPINGS) {
        const colIdx = colByField.get(mapping.key)
        if (colIdx == null) continue
        const localValue = toText(row[colIdx])
        const rdRawValue = getRdValueByLabels(deal, mapping.labels)
        const rdValue = normalizeForWrite(mapping.key, rdRawValue)
        if (!shouldWrite(localValue, rdValue)) continue

        changedThisRow = true
        updates.push({
          range: `${sheetPrefix}${colIndexToLetter(colIdx + 1)}${rowNum}`,
          values: [[rdValue]],
        })
        if (divergences.length < 300) {
          divergences.push({
            rowIndex: rowNum,
            dealId,
            field: mapping.key,
            oldValue: localValue,
            newValue: rdValue,
          })
        }
      }

      if (changedThisRow) rowsChanged++
      else rowsUnchanged++
    }

    const sampleValidation = []
    if (Array.isArray(sampleDealIds) && sampleDealIds.length > 0) {
      const sampleSet = new Set(sampleDealIds.map((id) => toText(id)).filter(Boolean))
      const sheetByDeal = new Map()
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i] || []
        const id = toText(row[dealIdCol])
        if (!id || !sampleSet.has(id)) continue
        sheetByDeal.set(id, row)
      }
      for (const dealId of sampleSet) {
        const rdDeal = byDealId.get(dealId)
        const sheetRow = sheetByDeal.get(dealId)
        const diffs = []
        if (rdDeal && sheetRow) {
          for (const mapping of FIELD_MAPPINGS) {
            const colIdx = colByField.get(mapping.key)
            if (colIdx == null) continue
            const localValue = toText(sheetRow[colIdx])
            const rdValue = normalizeForWrite(mapping.key, getRdValueByLabels(rdDeal, mapping.labels))
            if (normalizeComparable(localValue) !== normalizeComparable(rdValue)) {
              diffs.push({
                field: mapping.key,
                localValue,
                rdValue,
              })
            }
          }
        }
        sampleValidation.push({
          dealId,
          foundInRd: !!rdDeal,
          foundInSheet: !!sheetRow,
          diffCount: diffs.length,
          diffs: diffs.slice(0, 25),
        })
      }
    }

    const report = {
      ok: true,
      dryRun: dryRun !== false,
      message: dryRun !== false
        ? 'Dry-run concluído. Nenhuma célula foi escrita.'
        : `Backfill concluído. ${updates.length} célula(s) atualizada(s).`,
      stats: {
        totalFetchedRdDeals: totalFetched,
        rdPages: pages,
        rowsRead: rawRows.length - 1,
        rowsWithDealId,
        rowsMatchedRd,
        rowsNoRdMatch,
        rowsChanged,
        rowsUnchanged,
        updatesCount: updates.length,
        missingColumns,
      },
      sampleDivergences: divergences,
      criticalDealValidation: sampleValidation,
    }

    if (dryRun !== false || updates.length === 0) {
      return res.status(200).json(report)
    }

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`
    let batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${googleAccessToken}`,
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates,
      }),
    })
    let batchJson = await batchRes.json()

    if (isGoogleAuthError(batchRes.status, batchJson)) {
      const refreshed = await refreshSharedGoogleAccessToken()
      batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshed.accessToken}`,
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updates,
        }),
      })
      batchJson = await batchRes.json()
    }

    if (batchJson.error) {
      return res.status(400).json({
        error: 'Erro ao atualizar planilha',
        message: batchJson.error.message || 'Falha no batchUpdate.',
        partialReport: report,
      })
    }

    return res.status(200).json({
      ...report,
      sheetsResponse: {
        totalUpdatedRows: batchJson.totalUpdatedRows,
        totalUpdatedCells: batchJson.totalUpdatedCells,
      },
    })
  } catch (err) {
    console.error('sync-financeiro-rd error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Falha no backfill financeiro.',
    })
  }
}
