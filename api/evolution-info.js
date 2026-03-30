/**
 * API – Consulta Evolution API (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE).
 * GET — chaves só no servidor.
 *
 * Instância: fetchInstances | connectionState | grupos (fetchAllGroups) | contatos (findContacts).
 */

const FETCH_TIMEOUT_MS = 25000

function baseUrl() {
  const u = process.env.EVOLUTION_API_URL
  if (!u || typeof u !== 'string') return ''
  return u.replace(/\/$/, '')
}

function evoHeaders(apikey) {
  return {
    apikey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal })
    const j = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, json: j }
  } finally {
    clearTimeout(t)
  }
}

/** Extrai objetos de instância de vários formatos da Evolution API. */
function collectInstances(payload) {
  const out = []
  const seen = new Set()

  function pushInst(o) {
    if (!o || typeof o !== 'object') return
    const name = o.instanceName ?? o.name
    const key = name || o.instanceId || JSON.stringify(o)
    if (seen.has(key)) return
    seen.add(key)
    out.push(o)
  }

  function walk(x) {
    if (x == null) return
    if (Array.isArray(x)) {
      x.forEach(walk)
      return
    }
    if (typeof x === 'object') {
      if (x.instance && typeof x.instance === 'object') {
        pushInst(x.instance)
        walk(x.instance)
      }
      if (x.instanceName) pushInst(x)
      for (const v of Object.values(x)) {
        if (typeof v === 'object' && v !== null) walk(v)
      }
    }
  }

  walk(payload)
  if (Array.isArray(payload)) payload.forEach(walk)
  return out
}

function sanitizeInstance(o) {
  if (!o || typeof o !== 'object') return null
  return {
    instanceName: o.instanceName != null ? String(o.instanceName) : null,
    instanceId: o.instanceId != null ? String(o.instanceId) : null,
    owner: o.owner != null ? String(o.owner) : null,
    profileName: o.profileName != null ? String(o.profileName) : null,
    profilePictureUrl: o.profilePictureUrl ?? null,
    profileStatus: o.profileStatus != null ? String(o.profileStatus) : null,
    status: o.status != null ? String(o.status) : null,
    serverUrl: o.serverUrl != null ? String(o.serverUrl) : null,
  }
}

function extractGroups(raw) {
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.groups)) return raw.groups
  if (Array.isArray(raw?.data)) return raw.data
  if (Array.isArray(raw?.response)) return raw.response
  return []
}

function normalizeGroups(groups) {
  return groups.map((g) => ({
    id: g?.id != null ? String(g.id) : '',
    subject: g?.subject != null ? String(g.subject) : '',
    size: typeof g?.size === 'number' ? g.size : null,
    pictureUrl: g?.pictureUrl ?? null,
  }))
}

function extractContacts(raw) {
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.contacts)) return raw.contacts
  if (Array.isArray(raw?.data)) return raw.data
  if (Array.isArray(raw?.response)) return raw.response
  return []
}

/** Contatos 1:1 (exclui @g.us). */
function normalizeContacts(rows) {
  const list = []
  for (const c of rows) {
    if (!c || typeof c !== 'object') continue
    const jid = String(c.remoteJid ?? c.id ?? '')
    if (!jid || jid.endsWith('@g.us')) continue
    list.push({
      remoteJid: jid,
      name: String(c.pushName ?? c.name ?? c.notify ?? c.verifiedName ?? '').trim() || jid.split('@')[0],
      profilePicUrl: c.profilePicUrl ?? c.imgUrl ?? null,
    })
  }
  return list
}

async function postFindContacts(base, inst, apikey) {
  const url = `${base}/chat/findContacts/${encodeURIComponent(inst)}`
  const bodies = [{ where: {} }, {}, { where: { id: null } }]
  let lastErr = 'Falha ao listar contatos'

  for (const body of bodies) {
    const { ok, status, json } = await fetchJson(url, {
      method: 'POST',
      headers: evoHeaders(apikey),
      body: JSON.stringify(body),
    })
    if (ok) {
      const contacts = normalizeContacts(extractContacts(json))
      return { ok: true, contacts, raw: json }
    }
    const msg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.response?.message) ? json.response.message.join(' ') : json?.response?.message) ||
      `HTTP ${status}`
    lastErr = typeof msg === 'string' ? msg : String(msg)
  }

  return { ok: false, contacts: [], error: lastErr }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const evoKey = process.env.EVOLUTION_API_KEY
  const evoInstance = process.env.EVOLUTION_INSTANCE
  const base = baseUrl()

  if (!base || !evoKey || !evoInstance) {
    return res.status(503).json({
      error: 'Evolution não configurado',
      message:
        'Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no servidor (ou .env local com npm run dev + API).',
    })
  }

  const instanceName = String(evoInstance).trim()
  const instEnc = encodeURIComponent(instanceName)
  const headers = { apikey: evoKey }
  const partialErrors = {}

  try {
    const fetchUrl = `${base}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
    const fetchAllUrl = `${base}/instance/fetchInstances`

    let instanceFromApi = null
    let instanceValid = true
    let availableInstances = null
    let fetchInstancesListFailed = false

    const namedRes = await fetchJson(fetchUrl, { headers: evoHeaders(evoKey) })
    let instances = collectInstances(namedRes.json)
    if (!namedRes.ok) fetchInstancesListFailed = true

    const findMatch = (list) =>
      list.find((i) => String(i.instanceName ?? i.name ?? '').toLowerCase() === instanceName.toLowerCase())

    let match = findMatch(instances)

    if (!match) {
      const allRes = await fetchJson(fetchAllUrl, { headers: evoHeaders(evoKey) })
      instances = collectInstances(allRes.json)
      if (!allRes.ok) fetchInstancesListFailed = true
      match = findMatch(instances)
    }

    if (match) {
      instanceFromApi = sanitizeInstance(match)
    } else {
      instanceValid = false
      availableInstances = instances
        .map((i) => String(i.instanceName ?? i.name ?? '').trim())
        .filter(Boolean)
      if (availableInstances.length === 0 && fetchInstancesListFailed) {
        partialErrors.fetchInstances =
          'Não foi possível obter a lista de instâncias. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.'
      } else if (availableInstances.length === 0) {
        partialErrors.fetchInstances =
          'Lista de instâncias vazia ou em formato não reconhecido; tentaremos validar por conexão e grupos.'
      }
    }

    const stateUrl = `${base}/instance/connectionState/${instEnc}`
    const groupsUrl = `${base}/group/fetchAllGroups/${instEnc}?getParticipants=false`

    const [stateRes, groupsRes, contactsResult] = await Promise.allSettled([
      fetchJson(stateUrl, { headers: evoHeaders(evoKey) }),
      fetchJson(groupsUrl, { headers: evoHeaders(evoKey) }),
      postFindContacts(base, instanceName, evoKey),
    ])

    const connectionOk = stateRes.status === 'fulfilled' && stateRes.value.ok
    const groupsOk = groupsRes.status === 'fulfilled' && groupsRes.value.ok

    if (
      !instanceValid &&
      !(availableInstances && availableInstances.length > 0) &&
      (connectionOk || groupsOk)
    ) {
      instanceValid = true
      if (partialErrors.fetchInstances) {
        partialErrors.fetchInstances =
          'Listagem de instâncias indisponível ou em formato não suportado; a instância foi confirmada pela conexão e/ou pelos grupos.'
      }
    }

    if (
      instanceValid &&
      !instanceFromApi &&
      Array.isArray(availableInstances) &&
      availableInstances.length === 0
    ) {
      availableInstances = null
    }

    let connection = null
    if (stateRes.status === 'fulfilled' && stateRes.value.ok) {
      const stateJson = stateRes.value.json
      connection =
        stateJson?.instance ??
        stateJson?.data?.instance ??
        (typeof stateJson === 'object' ? stateJson : null)
    } else if (stateRes.status === 'fulfilled' && !stateRes.value.ok) {
      partialErrors.connectionState =
        stateRes.value.json?.message ||
        stateRes.value.json?.error ||
        `connectionState HTTP ${stateRes.value.status}`
    } else if (stateRes.status === 'rejected') {
      partialErrors.connectionState = stateRes.reason?.message || 'connectionState falhou'
    }

    let groupsNormalized = []
    if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
      const raw = extractGroups(groupsRes.value.json)
      groupsNormalized = normalizeGroups(raw)
    } else if (groupsRes.status === 'fulfilled' && !groupsRes.value.ok) {
      const gj = groupsRes.value.json
      partialErrors.fetchAllGroups =
        gj?.message ||
        gj?.error ||
        (Array.isArray(gj?.response?.message) ? gj.response.message.join(' ') : gj?.response?.message) ||
        `HTTP ${groupsRes.value.status}`
    } else if (groupsRes.status === 'rejected') {
      partialErrors.fetchAllGroups = groupsRes.reason?.message || 'fetchAllGroups falhou'
    }

    let contactsNormalized = []
    if (contactsResult.status === 'fulfilled' && contactsResult.value.ok) {
      contactsNormalized = contactsResult.value.contacts
    } else if (contactsResult.status === 'fulfilled' && !contactsResult.value.ok) {
      partialErrors.findContacts = contactsResult.value.error || 'findContacts falhou'
    } else if (contactsResult.status === 'rejected') {
      partialErrors.findContacts = contactsResult.reason?.message || 'findContacts falhou'
    }

    const payload = {
      ok: true,
      instance: instanceName,
      instanceValid,
      instanceFromApi,
      availableInstances: availableInstances ?? undefined,
      connection,
      groups: groupsNormalized,
      contacts: contactsNormalized,
      partialErrors: Object.keys(partialErrors).length ? partialErrors : undefined,
      fetchedAt: new Date().toISOString(),
    }

    if (!instanceValid) {
      payload.ok = false
      payload.message =
        availableInstances?.length
          ? `Instância "${instanceName}" não encontrada na Evolution. Ajuste EVOLUTION_INSTANCE. Instâncias disponíveis: ${availableInstances.join(', ')}.`
          : `Instância "${instanceName}" não encontrada ou lista de instâncias não disponível. Confira o nome no painel da Evolution.`
    }

    return res.status(200).json(payload)
  } catch (err) {
    console.error('evolution-info error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err?.message || 'Falha ao contatar Evolution API.',
    })
  }
}
