/**
 * API – Renova o access_token usando o refresh_token salvo no Supabase.
 * POST (sem body)
 * Resposta: { access_token, expires_in }
 * Atualiza access_token e expires_at no Supabase (session_id = 'shared').
 *
 * Requer GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios' })
  }
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase não configurado' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: row, error: fetchError } = await supabase
      .from('sessoes_google')
      .select('refresh_token')
      .eq('session_id', 'shared')
      .maybeSingle()

    if (fetchError || !row?.refresh_token) {
      return res.status(400).json({ error: 'Nenhum refresh_token encontrado. Conecte com o Google novamente.' })
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    })
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('Google refresh error:', data)
      return res.status(400).json({ error: data.error_description || data.error || 'Falha ao renovar token' })
    }

    const access_token = data.access_token
    const expires_in = typeof data.expires_in === 'number' ? data.expires_in : 3600
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('sessoes_google')
      .update({
        access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', 'shared')
    if (updateError) {
      console.error('Supabase update error:', updateError)
    }

    return res.status(200).json({ access_token, expires_in })
  } catch (err) {
    console.error('google-oauth-refresh error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
