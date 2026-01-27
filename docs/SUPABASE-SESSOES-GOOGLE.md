# Tabela de sessões Google (Supabase)

Quando o usuário **conecta com o Google** na tela de Validação, o app grava o token no **localStorage** e também no **Supabase** (se configurado). Assim, se o localStorage for limpo ou o usuário abrir outra aba, o app tenta **restaurar** a sessão a partir do Supabase usando um `session_id` fixo por navegador.

## 1. Criar a tabela

Execute no **Supabase → SQL Editor**:

```sql
create table if not exists public.sessoes_google (
  session_id text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.sessoes_google is
  'Backup/restore da sessão Google OAuth (Validação Sheets). Chave session_id é um uuid por navegador.';
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

- **Ao conectar com o Google:** o token é salvo no localStorage e em `sessoes_google` (upsert por `session_id`).
- **Ao carregar a página:** se não houver token no localStorage, o app busca em `sessoes_google` pelo `session_id`; se encontrar token ainda válido, restaura no localStorage e segue conectado.
- **Ao desconectar:** o token é apagado do localStorage e a linha correspondente é removida do Supabase.

O `session_id` é um uuid gerado na primeira visita e guardado no localStorage em `crm-bp-google-session-id`. Ele é reaproveitado entre abas do mesmo navegador.

Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam estar em `.env.local` (veja [INTEGRACAO-SUPABASE.md](./INTEGRACAO-SUPABASE.md)).
