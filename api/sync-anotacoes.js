/**
 * API – Sincronizar anotações do RD Station CRM para coluna follow_up na planilha
 * POST body: { accessToken, spreadsheetId, sheetName? }
 * Busca TODAS as anotações via GET /api/v1/activities (sem deal_id), agrupa por deal_id,
 * pega a data mais recente de cada e atualiza a coluna follow_up na planilha.
 * Requer: RD_CRM_TOKEN no .env
 */

function normalizeHeader(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Corrige mojibake: texto UTF-8 interpretado como Latin-1.
 * Ex: "JurÃ­dica" -> "Jurídica", "AÃ§Ã£o" -> "Ação"
 */
function fixMojibake(str) {
  if (str == null || typeof str !== 'string') return ''
  if (!str.includes('Ã')) return str
  try {
    const bytes = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      bytes[i] = code > 255 ? 0x3f : code
    }
    const decoded = new TextDecoder('utf-8').decode(bytes)
    return decoded.includes('\uFFFD') ? str : decoded
  } catch {
    return str
  }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const token = process.env.RD_CRM_TOKEN
  if (!token) {
    return res.status(500).json({
      error: 'Configuração incompleta',
      message: 'RD_CRM_TOKEN não configurado no .env ou .env.local',
    })
  }

  try {
    const { accessToken, spreadsheetId, sheetName } = req.body || {}

    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({
        error: 'Parâmetros faltando',
        message: 'Envie accessToken e spreadsheetId no body (JSON).',
      })
    }

    // 1. Buscar todas as anotações do RD (sem deal_id)
    const dealToLatest = new Map() // dealId -> { date, text }
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `https://crm.rdstation.com/api/v1/activities?token=${encodeURIComponent(token)}&page=${page}&limit=200`
      const rdRes = await fetch(url, { headers: { Accept: 'application/json' } })
      const rdJson = await rdRes.json()

      if (!rdRes.ok) {
        return res.status(502).json({
          error: 'Erro ao buscar anotações no RD',
          message: rdJson.message || rdJson.error || `Status ${rdRes.status}`,
        })
      }

      const activities = rdJson.activities || []
      for (const a of activities) {
        const dealId = (a.deal_id || '').toString().trim()
        const dateStr = a.date
        const textStr = (a.text || '').toString().trim()
        if (!dealId || !dateStr) continue

        const existing = dealToLatest.get(dealId)
        if (!existing || new Date(dateStr) > new Date(existing.date)) {
          dealToLatest.set(dealId, { date: dateStr, text: textStr })
        }
      }

      hasMore = rdJson.has_more === true && activities.length > 0
      if (hasMore) page++
    }

    // 2. Ler a planilha para obter headers, deal_ids e índice da coluna follow_up
    const rangeStr = (sheetName && String(sheetName).trim())
      ? `'${String(sheetName).trim().replace(/'/g, "''")}'!A:ZZ`
      : 'A:ZZ'
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeStr)}`

    const sheetRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const sheetData = await sheetRes.json()

    if (sheetData.error) {
      return res.status(400).json({
        error: 'Erro ao ler planilha',
        message: sheetData.error.message || 'Verifique o ID e as permissões.',
      })
    }

    const rawRows = sheetData.values || []
    if (rawRows.length < 2) {
      return res.status(200).json({
        ok: true,
        message: 'Planilha vazia ou sem dados',
        dealsAtualizados: 0,
      })
    }

    const headers = rawRows[0].map((c) => (c != null ? String(c).trim() : ''))
    const followUpNorm = normalizeHeader('follow_up')
    const followUpAnotacaoNorm = normalizeHeader('follow_up_anotacao')
    const dealIdNorm = normalizeHeader('deal_id')

    let followUpColIdx = -1
    let followUpAnotacaoColIdx = -1
    let dealIdColIdx = -1

    for (let j = 0; j < headers.length; j++) {
      const n = normalizeHeader(headers[j])
      if (n === followUpNorm) followUpColIdx = j
      if (n === followUpAnotacaoNorm) followUpAnotacaoColIdx = j
      if (n === dealIdNorm) dealIdColIdx = j
    }

    if (followUpColIdx < 0) {
      return res.status(400).json({
        error: 'Coluna follow_up não encontrada',
        message: 'Crie uma coluna "follow_up" na planilha.',
      })
    }

    if (dealIdColIdx < 0) {
      return res.status(400).json({
        error: 'Coluna deal_id não encontrada',
        message: 'A planilha precisa da coluna deal_id para mapear as anotações.',
      })
    }

    // 3. Montar atualizações: range -> valor
    const updates = []
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] || []
      const dealId = (row[dealIdColIdx] ?? '').toString().trim()
      if (!dealId) continue

      const latest = dealToLatest.get(dealId)
      if (!latest) continue

      const rowNum = i + 1
      const sheetPrefix = (sheetName && String(sheetName).trim())
        ? `'${String(sheetName).trim().replace(/'/g, "''")}'!`
        : ''

      updates.push({
        range: `${sheetPrefix}${colIndexToLetter(followUpColIdx + 1)}${rowNum}`,
        values: [[latest.date]],
      })

      if (followUpAnotacaoColIdx >= 0 && latest.text) {
        updates.push({
          range: `${sheetPrefix}${colIndexToLetter(followUpAnotacaoColIdx + 1)}${rowNum}`,
          values: [[fixMojibake(latest.text)]],
        })
      }
    }

    if (updates.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'Nenhuma linha com deal_id correspondente a anotações',
        dealsAtualizados: 0,
      })
    }

    // 4. Escrever na planilha (batch update)
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates,
      }),
    })

    const batchJson = await batchRes.json()
    if (batchJson.error) {
      return res.status(400).json({
        error: 'Erro ao atualizar planilha',
        message: batchJson.error.message || 'Verifique se o token tem permissão de edição (scope spreadsheets).',
      })
    }

    return res.status(200).json({
      ok: true,
      message: `Atualizadas ${updates.length} linhas com última data de anotação`,
      dealsAtualizados: updates.length,
    })
  } catch (err) {
    console.error('sync-anotacoes error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Tente novamente mais tarde.',
    })
  }
}
