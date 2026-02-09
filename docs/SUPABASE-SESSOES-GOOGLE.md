# Tabela de sessões Google (Supabase)

Quando o usuário **conecta com o Google** na tela de Validação, o app grava o token no **localStorage** e também no **Supabase** (se configurado). Assim, se o localStorage for limpo ou o usuário abrir outra aba, o app tenta **restaurar** a sessão a partir do Supabase usando um `session_id` fixo por navegador.

## 1. Criar a tabela

Execute no **Supabase → SQL Editor**:

```sql
create table if not exists public.sessoes_google (
  session_id text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  refresh_token text
);

comment on table public.sessoes_google is
  'Backup/restore da sessão Google OAuth. Com refresh_token, a autenticação é renovada automaticamente sem reconectar.';
```

Se a tabela já existir sem `refresh_token`, adicione a coluna:

```sql
alter table public.sessoes_google add column if not exists refresh_token text;
```

## 2. Políticas RLS

Para o frontend (chave anônima) inserir, ler, atualizar e apagar a própria linha (identificada por `session_id`):

```sql
alter table public.sessoes_google enable row level security;

create policy "Permitir insert sessoes_google"
  on public.sessoes_google for insert with check (true);

create policy "Permitir select sessoes_google"
  on public.sessoes_google for select using (true);

create policy "Permitir update sessoes_google"
  on public.sessoes_google for update using (true) with check (true);

create policy "Permitir delete sessoes_google"
  on public.sessoes_google for delete using (true);
```

O app só lê e escreve a linha do próprio `session_id` (gerado e guardado no localStorage). As políticas acima deixam o uso anônimo aberto; para produção com Supabase Auth você pode restringir por `auth.uid()`.

## 3. Comportamento no app

- **Ao conectar com o Google:** o app usa o fluxo **authorization code** e troca o código por tokens no backend (`/api/google-oauth`). O access_token e refresh_token são salvos no Supabase (`session_id = 'shared'`).
- **Ao carregar a página:** se não houver token no localStorage, o app busca em `sessoes_google` por `session_id = 'shared'`. Se o token estiver expirado, chama `/api/google-oauth-refresh` para renovar usando o refresh_token — a autenticação continua indefinidamente sem reconectar.
- **Ao desconectar:** o token é apagado apenas do localStorage (o token compartilhado no Supabase permanece).

Para funcionar, uma pessoa com acesso ao Google da organização precisa conectar ao menos uma vez. Depois, todos os usuários entram já conectados e o token é renovado automaticamente quando expira.

### Variáveis de ambiente

- **Frontend:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID` (veja [INTEGRACAO-SUPABASE.md](./INTEGRACAO-SUPABASE.md)).
- **Backend (API):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_URL` (ou `VITE_SUPABASE_URL`), `SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_ANON_KEY`).

O **Client Secret** do Google deve ficar apenas no backend (`.env` ou variáveis do Vercel) e **nunca** com prefixo `VITE_`.
