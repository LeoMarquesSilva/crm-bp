/**
 * API Vercel – Enviar mensagem via WhatsApp
 *
 * Duas formas de uso:
 * 1) Via N8N webhook (recomendado se Evolution API já está no N8N):
 *    Configure N8N_WEBHOOK_URL. O app envia POST com { number, text, id_registro?, ... }.
 *    O workflow N8N usa o node Evolution API para enviar.
 *
 * 2) Via Evolution API direto:
 *    Configure EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE.
 *    O backend chama POST .../message/sendText/{instance} com { number, text }.
 *
 * POST body: { number: string (com DDD, ex. 5511999999999), text: string, id_registro?: string }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { number, text, id_registro } = req.body || {}
    const num = typeof number === 'string' ? number.replace(/\D/g, '') : ''
    const msg = typeof text === 'string' ? text.trim() : ''

    if (!num || !msg) {
      return res.status(400).json({
        error: 'Faltam parâmetros',
        message: 'Envie number e text no body (JSON). number = telefone com DDD, ex. 5511999999999.',
      })
    }

    // Número no formato Evolution: só dígitos; se não tiver código do país, assume 55 (BR)
    const numberFormatted = num.length <= 11 ? `55${num}` : num

    const n8nWebhook = process.env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_ENVIAR_WHATSAPP
    const evoUrl = process.env.EVOLUTION_API_URL
    const evoKey = process.env.EVOLUTION_API_KEY
    const evoInstance = process.env.EVOLUTION_INSTANCE

    if (n8nWebhook && n8nWebhook.trim()) {
      // Opção 1: encaminhar para webhook N8N
      const payload = {
        number: numberFormatted,
        text: msg,
        id_registro: id_registro || null,
      }
      const webRes = await fetch(n8nWebhook.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const webData = await webRes.json().catch(() => ({}))
      if (!webRes.ok) {
        return res.status(webRes.status >= 400 ? webRes.status : 502).json({
          error: 'Erro ao chamar webhook N8N',
          message: webData.message || webData.error || webRes.statusText,
        })
      }
      return res.status(200).json({ ok: true, via: 'n8n', data: webData })
    }

    if (evoUrl && evoKey && evoInstance) {
      // Opção 2: Evolution API direto
      const base = evoUrl.replace(/\/$/, '')
      const sendUrl = `${base}/message/sendText/${encodeURIComponent(evoInstance)}`
      const evoRes = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evoKey,
        },
        body: JSON.stringify({ number: numberFormatted, text: msg }),
      })
      const evoData = await evoRes.json().catch(() => ({}))
      if (!evoRes.ok) {
        return res.status(evoRes.status >= 400 ? evoRes.status : 502).json({
          error: 'Erro ao enviar via Evolution API',
          message: evoData.message || evoData.error || evoRes.statusText,
        })
      }
      return res.status(200).json({ ok: true, via: 'evolution', data: evoData })
    }

    return res.status(503).json({
      error: 'WhatsApp não configurado',
      message:
        'Configure N8N_WEBHOOK_URL (ou N8N_WEBHOOK_ENVIAR_WHATSAPP) ou EVOLUTION_API_URL + EVOLUTION_API_KEY + EVOLUTION_INSTANCE nas variáveis de ambiente.',
    })
  } catch (err) {
    console.error('enviar-whatsapp error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Tente novamente mais tarde.',
    })
  }
}
