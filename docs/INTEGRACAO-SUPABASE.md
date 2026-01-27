# Integração Supabase

O projeto usa **Vite**, então as variáveis expostas ao frontend precisam do prefixo **`VITE_`** (não `NEXT_PUBLIC_`).

## Variáveis de ambiente

Em `.env` ou `.env.local`:

```env
VITE_SUPABASE_URL=https://jqcdyobmysgfhcbyavrd.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

- **VITE_SUPABASE_URL** – URL do projeto no Supabase (ex.: `https://xxxx.supabase.co`).
- **VITE_SUPABASE_ANON_KEY** – Chave anônima (ou “publishable”) para uso no navegador. Em: Supabase → Project Settings → API → `anon` / `public`.

## Uso no código

O cliente Supabase está em `src/lib/supabase.ts`:

```ts
import { supabase } from '@/lib/supabase'

if (supabase) {
  const { data, error } = await supabase.from('sua_tabela').select('*')
  // ...
}
```

Se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estiverem vazios, `supabase` será `null` e as chamadas não devem ser feitas.

## Tabelas em uso

- **Histórico de envios WhatsApp** – ver [SUPABASE-HISTORICO-WHATSAPP.md](./SUPABASE-HISTORICO-WHATSAPP.md): SQL da tabela `historico_envio_whatsapp` e políticas RLS. Cada notificação enviada na tela de Validação Sheets é gravada automaticamente.
- **Sessões Google** – ver [SUPABASE-SESSOES-GOOGLE.md](./SUPABASE-SESSOES-GOOGLE.md): tabela `sessoes_google` para backup/restore do token OAuth. Ao conectar com o Google na Validação, o token é salvo no Supabase; ao abrir a página sem token local, o app tenta restaurar do Supabase.

## Outros usos possíveis no CRM-BP

- **Filtros salvos** – salvar preferências de filtro por usuário.
- **Log de validações** – snapshots de resultado (total, com erro, por etapa) para dashboard.
- **Cadastro de leads** – persistir leads pelo app antes de enviar ao RD/N8N.

Crie as tabelas e políticas (RLS) no Supabase conforme o que for usar.
