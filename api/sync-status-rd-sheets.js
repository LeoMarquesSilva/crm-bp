/**
 * API – Sincroniza status, etapa e updated_at: RD CRM -> Google Sheets
 * POST body: { accessToken?, spreadsheetId, sheetName?, dryRun? }
 *
 * Se accessToken omitido, tenta refreshSharedGoogleAccessToken().
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

function normalizeStage(value) {
  return toText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Valor canônico para comparação: win | lost | ongoing | null */
export function canonicalStatus(raw) {
  const s = toText(raw).toLowerCase()
  if (!s) return null
  if (s === 'won' || s === 'win' || s === 'ganho') return 'win'
  if (s.includes('loss') || s.includes('perd') || s === 'lost' || s === 'perda') return 'lost'
  if (s.includes('ganh') || s.includes('vend')) return 'win'
  if (s.includes('ongoing') || s.includes('andamento') || s.includes('abert') || s === 'aberto') return 'ongoing'
  return s
}

/** Normaliza status da planilha para win | lost | ongoing | null (alias de canonicalStatus) */
export function normalizeSheetStatus(raw) {
  return canonicalStatus(raw)
}

/** Status esperado na planilha a partir do deal RD (valores escritos: won | lost | ongoing) */
export function rdStatusToSheet(deal) {
  if (deal?.win === true) return 'won'
  if (deal?.win === false) return 'lost'
  return 'ongoing'
}

function statusValuesMatch(sheetRaw, deal) {
  return canonicalStatus(sheetRaw) === canonicalStatus(rdStatusToSheet(deal))
}

function findHeaderCol(headerIndex, aliases) {
  for (const alias of aliases) {
    const idx = headerIndex.get(normalizeHeader(alias))
    if (idx != null) return idx
  }
  return null
}

async function readSheetRows({ spreadsheetId, sheetName, accessToken }) {
  const rangeStr =
    sheetName && String(sheetName).trim()
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
      if (id) byDealId.set(id, d)
    }

    hasMore = rdJson.has_more === true && deals.length > 0
    if (hasMore) page++
  }

  return { byDealId, totalFetched, pages: page }
}

async function writeSheetUpdates({ spreadsheetId, googleAccessToken, updates }) {
  if (updates.length === 0) return { totalUpdatedCells: 0, totalUpdatedRows: 0 }

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
    throw new Error(batchJson.error.message || 'Falha no batchUpdate da planilha')
  }

  return {
    totalUpdatedCells: batchJson.totalUpdatedCells ?? 0,
    totalUpdatedRows: batchJson.totalUpdatedRows ?? 0,
  }
}

/**
 * @param {{ accessToken?: string, spreadsheetId: string, sheetName?: string, dryRun?: boolean, maxSample?: number }} opts
 */
export async function runStatusSync(opts) {
  const rdToken = process.env.RD_CRM_TOKEN
  if (!rdToken) {
    throw new Error('RD_CRM_TOKEN não configurado no .env/.env.local')
  }

  const { spreadsheetId, sheetName, dryRun = true, maxSample = 50 } = opts
  let accessToken = opts.accessToken

  if (!spreadsheetId) {
    throw new Error('spreadsheetId é obrigatório')
  }

  if (!accessToken) {
    const refreshed = await refreshSharedGoogleAccessToken()
    accessToken = refreshed.accessToken
  }

  const { byDealId, totalFetched, pages } = await fetchAllRdDeals(rdToken)
  const { rows: rawRows, googleAccessToken } = await readSheetRows({ spreadsheetId, sheetName, accessToken })

  if (rawRows.length < 2) {
    return {
      ok: true,
      dryRun: dryRun !== false,
      message: 'Planilha sem linhas suficientes.',
      stats: { totalFetchedRdDeals: totalFetched, rowsRead: 0 },
      divergences: [],
    }
  }

  const headers = rawRows[0].map((c) => toText(c))
  const headerIndex = new Map()
  headers.forEach((h, idx) => headerIndex.set(normalizeHeader(h), idx))

  const dealIdCol = headerIndex.get('deal_id')
  if (dealIdCol == null) {
    throw new Error('Coluna deal_id não encontrada na planilha')
  }

  const statusCol = findHeaderCol(headerIndex, ['status', 'estado', 'situacao', 'status_da_negociacao'])
  const stageCol = findHeaderCol(headerIndex, ['stage_name', 'stage', 'etapa', 'nome_etapa', 'nome_da_etapa'])
  const updatedCol = findHeaderCol(headerIndex, ['updated_at', 'date_update'])

  const sheetPrefix =
    sheetName && String(sheetName).trim() ? `'${String(sheetName).trim().replace(/'/g, "''")}'!` : ''

  const updates = []
  const divergences = []
  let rowsWithDealId = 0
  let rowsMatchedRd = 0
  let rowsNoRdMatch = 0
  let rowsChanged = 0
  let rowsUnchanged = 0
  let statusFixes = 0
  let stageFixes = 0
  let updatedFixes = 0

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
    const expectedStage = toText(deal?.deal_stage?.name)
    const expectedUpdated = toText(deal?.updated_at || deal?.closed_at || '')

    const currentStatusRaw = statusCol != null ? toText(row[statusCol]) : ''
    const currentStage = stageCol != null ? toText(row[stageCol]) : ''
    const currentUpdated = updatedCol != null ? toText(row[updatedCol]) : ''

    const expectedStatus = rdStatusToSheet(deal)
    const statusMismatch = statusCol != null && !statusValuesMatch(currentStatusRaw, deal)
    const stageMismatch = stageCol != null && expectedStage && normalizeStage(currentStage) !== normalizeStage(expectedStage)

    const expectedUpdatedMs = expectedUpdated ? Date.parse(expectedUpdated) : NaN
    const currentUpdatedMs = currentUpdated ? Date.parse(currentUpdated) : NaN
    const updatedMismatch =
      updatedCol != null &&
      !Number.isNaN(expectedUpdatedMs) &&
      (Number.isNaN(currentUpdatedMs) || Math.abs(expectedUpdatedMs - currentUpdatedMs) > 60_000)

    if (!statusMismatch && !stageMismatch && !updatedMismatch) {
      rowsUnchanged++
      continue
    }

    rowsChanged++
    const changes = []

    if (statusMismatch && statusCol != null) {
      statusFixes++
      updates.push({
        range: `${sheetPrefix}${colIndexToLetter(statusCol + 1)}${rowNum}`,
        values: [[expectedStatus]],
      })
      changes.push({ field: 'status', oldValue: currentStatusRaw || '(vazio)', newValue: expectedStatus })
    }

    if (stageMismatch && stageCol != null && expectedStage) {
      stageFixes++
      updates.push({
        range: `${sheetPrefix}${colIndexToLetter(stageCol + 1)}${rowNum}`,
        values: [[expectedStage]],
      })
      changes.push({ field: 'stage_name', oldValue: currentStage || '(vazio)', newValue: expectedStage })
    }

    if (updatedMismatch && updatedCol != null) {
      updatedFixes++
      updates.push({
        range: `${sheetPrefix}${colIndexToLetter(updatedCol + 1)}${rowNum}`,
        values: [[expectedUpdated]],
      })
      changes.push({ field: 'updated_at', oldValue: currentUpdated || '(vazio)', newValue: expectedUpdated })
    }

    if (divergences.length < maxSample) {
      divergences.push({
        rowIndex: rowNum,
        dealId,
        leadName: toText(deal?.name) || toText(row[headerIndex.get('nome')] ?? row[headerIndex.get('nome_lead')] ?? ''),
        changes,
      })
    }
  }

  const report = {
    ok: true,
    dryRun: dryRun !== false,
    message:
      dryRun !== false
        ? 'Dry-run concluído. Nenhuma célula foi escrita.'
        : `Sincronização concluída. ${updates.length} célula(s) atualizada(s).`,
    stats: {
      totalFetchedRdDeals: totalFetched,
      rdPages: pages,
      rowsRead: rawRows.length - 1,
      rowsWithDealId,
      rowsMatchedRd,
      rowsNoRdMatch,
      rowsChanged,
      rowsUnchanged,
      statusFixes,
      stageFixes,
      updatedFixes,
      updatesCount: updates.length,
      columnsUsed: {
        status: statusCol != null ? headers[statusCol] : null,
        stage: stageCol != null ? headers[stageCol] : null,
        updated_at: updatedCol != null ? headers[updatedCol] : null,
      },
    },
    sampleDivergences: divergences,
  }

  if (dryRun !== false || updates.length === 0) {
    return report
  }

  const sheetsResponse = await writeSheetUpdates({ spreadsheetId, googleAccessToken, updates })
  return { ...report, sheetsResponse }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { accessToken, spreadsheetId, sheetName, dryRun = true } = req.body || {}
    if (!spreadsheetId) {
      return res.status(400).json({
        error: 'Parâmetros faltando',
        message: 'Envie spreadsheetId no body (JSON). accessToken é opcional (usa refresh compartilhado).',
      })
    }

    const report = await runStatusSync({ accessToken, spreadsheetId, sheetName, dryRun })
    return res.status(200).json(report)
  } catch (err) {
    console.error('sync-status-rd-sheets error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Falha ao sincronizar status RD x Sheets.',
    })
  }
}
