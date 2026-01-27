# Tabela de histórico de envio WhatsApp (Supabase)

Crie a tabela e as políticas no **Supabase** (SQL Editor) para guardar cada notificação enviada pelo app.

## 1. Criar a tabela

Execute no **Supabase → SQL Editor**:

```sql
-- Tabela: histórico de envios ao WhatsApp
create table if not exists public.historico_envio_whatsapp (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Envio
  telefone text not null,
  mensagem text not null,

  -- Contexto do lead/registro (planilha + validação)
  id_registro text,
  email_notificar text,
  email_solicitante text,
  stage_name text,
  funil text,
  deal_id text,
  planilha_id text,
  nome_aba text
);

-- Índices para consultas comuns
create index if not exists idx_historico_wpp_created_at
  on public.historico_envio_whatsapp (created_at desc);
create index if not exists idx_historico_wpp_telefone
  on public.historico_envio_whatsapp (telefone);
create index if not exists idx_historico_wpp_id_registro
  on public.historico_envio_whatsapp (id_registro);

-- Comentário para documentação
comment on table public.historico_envio_whatsapp is
  'Registro de cada notificação enviada pelo app via WhatsApp (Evolution/N8N).';
```

### 1.1. Coluna `row_index` (recomendado para “corrigido”)

Para o app conseguir marcar “corrigido” **mesmo quando o `id_registro` muda** (ex.: a pessoa preenche “nome” e o identificador deixa de ser “Linha 5” e vira “Acme Corp”), é preciso gravar o número da **linha** da planilha:

```sql
alter table public.historico_envio_whatsapp
  add column if not exists row_index integer;

comment on column public.historico_envio_whatsapp.row_index is
  'Número da linha na planilha (1-based). Usado para marcar “corrigido” mesmo quando id_registro muda.';
```

O app passa a buscar envios por `(planilha_id, nome_aba, row_index)` ao marcar como corrigido; se não achar, tenta por `id_registro`. Novos envios já gravam `row_index`. Registros antigos sem `row_index` continuam sendo encontrados só por `id_registro`.

### 1.2. Colunas “Corrigido” e tempo para corrigir (opcional)

Para registrar **quando** o lead corrigiu o problema e **em quanto tempo** (após o envio), execute no SQL Editor (após já ter criado a tabela):

```sql
-- Adiciona colunas de resolução
alter table public.historico_envio_whatsapp
  add column if not exists corrigido_em timestamptz,
  add column if not exists tempo_minutos numeric;

comment on column public.historico_envio_whatsapp.corrigido_em is
  'Momento em que a validação detectou que o lead passou a estar OK (problema corrigido).';
comment on column public.historico_envio_whatsapp.tempo_minutos is
  'Minutos entre o envio (created_at) e a correção (corrigido_em).';
```

Quando o usuário **valida de novo** a planilha e um lead que tinha recebido WhatsApp aparece **válido**, o app atualiza o envio correspondente com `corrigido_em` e `tempo_minutos`. Assim dá para ver na aba **Histórico WhatsApp** quem já corrigiu e em quanto tempo.

**Se “corrigido” não aparecer** após você validar de novo:
1. Adicione a coluna **`row_index`** (ver § 1.1) e a política de **update** em “Políticas de acesso”. Novos envios já gravam a linha; assim o app encontra o envio por planilha + aba + linha mesmo quando o `id_registro` muda (ex.: de “Linha 5” para “Acme Corp”).
2. Confirme que rodou o `alter table` de `corrigido_em` e `tempo_minutos` (§ 1.2).
3. No navegador, abra o **DevTools** (F12) → aba **Console**. Ao validar, deve aparecer `[Histórico WhatsApp] Marcando correções para N linha(s)...` e, em caso de problema, `Nenhum envio pendente para linha X` ou `Erro ao marcar como corrigido:`. Use essas mensagens para entender o motivo.

## 2. Políticas de acesso (RLS)

Para o frontend (chave anônima) poder **inserir**, **ler** e **atualizar** o histórico (atualizar é usado para preencher “corrigido em” e “tempo em minutos”):

```sql
alter table public.historico_envio_whatsapp enable row level security;

-- Permite inserir para qualquer cliente que use a chave anônima
create policy "Permitir insert historico_wpp"
  on public.historico_envio_whatsapp for insert
  with check (true);

-- Permite leitura para qualquer cliente que use a chave anônima
create policy "Permitir select historico_wpp"
  on public.historico_envio_whatsapp for select
  using (true);

-- Permite atualizar (usado para marcar corrigido_em e tempo_minutos quando o lead é validado como OK)
create policy "Permitir update historico_wpp"
  on public.historico_envio_whatsapp for update
  using (true)
  with check (true);
```

Se a tabela já existia e você criou só `insert` e `select`, rode apenas o bloco da política `update` acima.

**Se o console mostra “Marcado como corrigido” mas a tabela no Supabase não atualiza:**  
O update pode estar retornando 0 linhas (RLS bloqueando). O app agora avisa no console: `Update retornou 0 linhas ... política de UPDATE faltando`. Confira:

1. No Supabase → **Table Editor** → `historico_envio_whatsapp` → aba **Policies** (ou **Authentication** → **Policies**), veja se existe uma policy de **UPDATE** para essa tabela.
2. Se não existir ou não estiver habilitada, crie/recrie a policy de update (bloco acima).
3. Para recriar do zero:
   ```sql
   drop policy if exists "Permitir update historico_wpp" on public.historico_envio_whatsapp;
   create policy "Permitir update historico_wpp"
     on public.historico_envio_whatsapp for update
     using (true)
     with check (true);
   ```
4. Atualize a página do Table Editor (F5) e valide de novo no app.

Se mais tarde você usar **Supabase Auth**, pode trocar essas políticas por regras que exijam `auth.role() = 'authenticated'` ou filtrem por `auth.uid()`.

## 3. Conferir

Depois de rodar o SQL:

- **Table Editor** → deve existir `historico_envio_whatsapp`.
- Ao enviar uma notificação pelo app (Validação Sheets → Enviar no WhatsApp), deve aparecer uma linha nova nessa tabela.

Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam estar corretas em `.env.local` (veja `docs/INTEGRACAO-SUPABASE.md`).
