/**
 * API – Renova o access_token usando o refresh_token salvo no Supabase.
 * POST (sem body)
 * Resposta: { access_token, expires_in }
 */
import { refreshSharedGoogleAccessToken } from './_google-auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { accessToken, expiresIn } = await refreshSharedGoogleAccessToken()
    return res.status(200).json({ access_token: accessToken, expires_in: expiresIn })
  } catch (err) {
    console.error('google-oauth-refresh error:', err)
    return res.status(400).json({ error: err.message || 'Erro interno' })
  }
}
