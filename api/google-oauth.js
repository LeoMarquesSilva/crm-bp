/**
 * API – Troca o authorization code do Google por access_token e refresh_token.
 * POST body: { code, redirect_uri }
 * Resposta: { access_token, expires_in }
 * Salva access_token, refresh_token e expires_at no Supabase (session_id = 'shared').
 *
 * Requer GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY em .env/.env.local
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { code, redirect_uri } = body
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code é obrigatório' })
  }
  const redirectUri = redirect_uri || req.headers.origin || 'http://localhost:5173'

  try {
    const params = new URLSearchParams({
      code: code.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('Google token exchange error:', data)
      return res.status(400).json({ error: data.error_description || data.error || 'Falha ao trocar código' })
    }

    const access_token = data.access_token
    const refresh_token = data.refresh_token || null
    const expires_in = typeof data.expires_in === 'number' ? data.expires_in : 3600

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()
    const row = {
      session_id: 'shared',
      access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    if (refresh_token) {
      row.refresh_token = refresh_token
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error } = await supabase
      .from('sessoes_google')
      .upsert(row, { onConflict: 'session_id' })
    if (error) {
      console.error('Supabase upsert error:', error)
      return res.status(500).json({ error: 'Erro ao salvar token no Supabase' })
    }

    return res.status(200).json({ access_token, expires_in })
  } catch (err) {
    console.error('google-oauth error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
