/**
 * Relatório: negociações abertas nas etapas de pós-venda
 * "Inclusão no fluxo de faturamento" e "Boas-vindas ao cliente" (e variações no RD).
 *
 * Campo de prioridade: dias desde a última atualização da negociação no RD (`updated_at`).
 * A API v1 do RD não expõe "data de entrada na etapa"; qualquer edição na negociação atualiza `updated_at`.
 */

function toText(v) {
  if (v == null) return ''
  return String(v).trim()
}

function normalizeFinanceText(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

/** @returns {'inclusao_faturamento' | 'boas_vindas' | null} */
function classifyPostSaleStage(stageName) {
  const norm = normalizeFinanceText(stageName)
  if (!norm) return null
  if (norm.includes('inclusao no fluxo de faturamento') || (norm.includes('inclusao no fluxo') && norm.includes('faturamento'))) {
    return 'inclusao_faturamento'
  }
  if (norm.includes('boas vindas')) {
    return 'boas_vindas'
  }
  return null
}

const STAGE_GROUP_LABEL = {
  inclusao_faturamento: 'Inclusão no fluxo de faturamento',
  boas_vindas: 'Boas-vindas ao cliente',
}

function isOpenDeal(deal) {
  if (deal?.win !== null && deal?.win !== undefined) return false
  if (deal?.closed_at) return false
  return true
}

function firstContactEmail(deal) {
  const contacts = Array.isArray(deal?.contacts) ? deal.contacts : []
  for (const c of contacts) {
    const emails = Array.isArray(c?.emails) ? c.emails : []
    for (const e of emails) {
      const em = toText(e?.email)
      if (em) return em
    }
  }
  return ''
}

function daysSince(isoDate, nowMs) {
  const t = Date.parse(isoDate)
  if (Number.isNaN(t)) return null
  return Math.floor((nowMs - t) / 86400000)
}

function formatBrDate(iso) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

async function fetchAllRdDeals(rdToken) {
  const list = []
  let page = 1
  let hasMore = true
  while (hasMore) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(rdToken)}&page=${page}&limit=200`
    const rdRes = await fetch(url, { headers: { Accept: 'application/json' } })
    const rdJson = await rdRes.json()
    if (!rdRes.ok) {
      throw new Error(rdJson.message || rdJson.error || `Erro RD ${rdRes.status}`)
    }
    const deals = Array.isArray(rdJson.deals) ? rdJson.deals : []
    list.push(...deals)
    hasMore = rdJson.has_more === true && deals.length > 0
    if (hasMore) page++
  }
  return { deals: list, pages: page }
}

/**
 * @param {string} rdToken
 * @param {number} [nowMs]
 */
export async function fetchRelatorioPosvendaEtapas(rdToken, nowMs = Date.now()) {
  const { deals, pages } = await fetchAllRdDeals(rdToken)
  const rows = []

  for (const deal of deals) {
    if (!isOpenDeal(deal)) continue
    const stageName = toText(deal?.deal_stage?.name)
    const group = classifyPostSaleStage(stageName)
    if (!group) continue

    const id = toText(deal?.id || deal?._id)
    const updatedAt = toText(deal?.updated_at)
    const dias = daysSince(updatedAt, nowMs)

    rows.push({
      deal_id: id,
      nome_negociacao: toText(deal?.name),
      nome_empresa: toText(deal?.organization?.name),
      etapa_rd: stageName,
      etapa_grupo: STAGE_GROUP_LABEL[group],
      dias_desde_ultima_atualizacao_rd: dias,
      data_ultima_atualizacao_rd: updatedAt,
      data_ultima_atualizacao_br: formatBrDate(updatedAt),
      criado_em_rd: toText(deal?.created_at),
      criado_em_br: formatBrDate(deal?.created_at),
      responsavel_nome: toText(deal?.user?.name),
      responsavel_email: toText(deal?.user?.email),
      solicitante: getRdValueByLabels(deal, ['Solicitante']),
      contato_email: firstContactEmail(deal),
      pausada: deal?.hold === true,
      link_crm: id ? `https://crm.rdstation.com/app/deals/${id}` : '',
    })
  }

  rows.sort((a, b) => {
    const da = a.dias_desde_ultima_atualizacao_rd ?? -1
    const db = b.dias_desde_ultima_atualizacao_rd ?? -1
    return db - da
  })

  return {
    gerado_em: new Date(nowMs).toISOString(),
    meta: {
      total_negociacoes_rd: deals.length,
      paginas_rd: pages,
      filtradas: rows.length,
      nota_dias:
        'O número de dias usa updated_at da negociação (última alteração no RD). Não é a data exata de entrada na etapa; edições em qualquer campo atualizam esse valor.',
    },
    linhas: rows,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const rdToken = process.env.RD_CRM_TOKEN
  if (!rdToken) {
    return res.status(500).json({
      error: 'Configuração incompleta',
      message: 'RD_CRM_TOKEN não configurado no .env/.env.local',
    })
  }

  try {
    const data = await fetchRelatorioPosvendaEtapas(rdToken)
    return res.status(200).json({ ok: true, ...data })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    })
  }
}
