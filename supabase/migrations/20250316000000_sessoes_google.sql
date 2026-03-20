-- Tabela para armazenar tokens do Google OAuth (Drive, Sheets)
-- Usada pela API (api/google-oauth.js) para salvar access_token e refresh_token.
-- session_id = 'shared' permite reconexão automática em todas as páginas.
-- Execute no SQL Editor do Supabase se a tabela ainda não existir.

CREATE TABLE IF NOT EXISTS sessoes_google (
  session_id text PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Permite que o cliente anon do Supabase leia (para auto-reconexão) e a API escreva via service role
-- Se usar RLS, crie política: permitir SELECT para anon (ou authenticated) e INSERT/UPDATE via API.
ALTER TABLE sessoes_google ENABLE ROW LEVEL SECURITY;

-- Política: permitir leitura para todos (a API usa service role para escrita)
CREATE POLICY "sessoes_google_select" ON sessoes_google
  FOR SELECT USING (true);

-- Política: permitir insert/update (a API usa a chave anon ou service - ajuste conforme sua config)
CREATE POLICY "sessoes_google_insert" ON sessoes_google
  FOR INSERT WITH CHECK (true);

CREATE POLICY "sessoes_google_update" ON sessoes_google
  FOR UPDATE USING (true);

COMMENT ON TABLE sessoes_google IS 'Tokens OAuth do Google (Drive/Sheets) para reconexão automática';
