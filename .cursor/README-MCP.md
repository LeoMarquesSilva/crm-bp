# MCP – CRM SUPABASE

O arquivo `mcp.json` configura o servidor MCP **"CRM SUPABASE"** apontando para o projeto Supabase do CRM:

- **Project ref:** `jqcdyobmysgfhcbyavrd`
- **URL:** https://jqcdyobmysgfhcbyavrd.supabase.co

## O que fazer

1. **Reiniciar o Cursor** para carregar o MCP (feche e abra o Cursor ou recarregue a janela).
2. Em **Settings > Tools & MCP**, confira se o servidor **"CRM SUPABASE"** aparece e está ativo.
3. Se o projeto ainda usar outro MCP de Supabase (ex.: "supabase-marketing-system"), você pode desativá-lo ou removê-lo das configurações globais para usar só o "CRM SUPABASE" neste projeto.

## Token

O token de acesso ao Supabase MCP está em `mcp.json`. Para não versionar o token, você pode:

- Usar variável de ambiente: em `mcp.json`, trocar o valor de `SUPABASE_ACCESS_TOKEN` por `"${SUPABASE_ACCESS_TOKEN}"` (se o Cursor suportar) ou definir a variável no sistema e referenciá-la conforme a documentação do Cursor.
- Manter `mcp.json` no `.gitignore` se não quiser commitar credenciais.
