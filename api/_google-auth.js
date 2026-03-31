import { createClient } from '@supabase/supabase-js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function hasInvalidAuthMessage(message) {
  if (!message || typeof message !== 'string') return false
  const msg = message.toLowerCase()
  return (
    msg.includes('invalid authentication credentials') ||
    msg.includes('request had invalid authentication credentials') ||
    msg.includes('login required') ||
    msg.includes('invalid credentials')
  )
}

export function isGoogleAuthError(status, payload) {
  if (status === 401) return true
  const err = payload && typeof payload === 'object' ? payload.error : null
  const message =
    (typeof err === 'object' ? err?.message : null) ||
    (typeof payload?.error_description === 'string' ? payload.error_description : null) ||
    (typeof payload?.message === 'string' ? payload.message : null) ||
    (typeof payload?.error === 'string' ? payload.error : null)
  return hasInvalidAuthMessage(message)
}

export async function refreshSharedGoogleAccessToken() {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios')
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase não configurado')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: row, error: fetchError } = await supabase
    .from('sessoes_google')
    .select('refresh_token')
    .eq('session_id', 'shared')
    .maybeSingle()

  if (fetchError || !row?.refresh_token) {
    throw new Error('Nenhum refresh_token encontrado. Conecte com o Google novamente.')
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
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData?.access_token) {
    const msg = tokenData?.error_description || tokenData?.error || 'Falha ao renovar token'
    throw new Error(msg)
  }

  const accessToken = tokenData.access_token
  const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('sessoes_google')
    .update({
      access_token: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', 'shared')

  if (updateError) {
    console.error('Supabase update error:', updateError)
  }

  return { accessToken, expiresIn }
}
