# Análise: Payload do CRM x Fluxo N8N (Cadastro de Lead)

## Payload enviado pelo CRM (LeadForm)

O formulário envia **POST** para o webhook com o seguinte JSON:

| Campo | Enviado pelo CRM | Exemplo / Observação |
|-------|------------------|----------------------|
| `id` | ✅ | timestamp string |
| `solicitante` | ✅ | Nome (ex: "Lavínia Ferraz Crispim") |
| `email` | ✅ | E-mail do solicitante (@bismarchipires.com.br) |
| `cadastrado_por` | ✅ | E-mail de quem realizou o cadastro |
| `razao_social_cnpj` | ✅ | Array: `[{ razao_social, cnpj }, ...]` |
| `prazo_reuniao_due` | ✅ | Data DD/MM/AAAA ou "A definir" |
| `horario_due` | ✅ | Horário ou "A definir" |
| `data_reuniao` | ✅ | Data DD/MM/AAAA ou "A definir" |
| `horario_reuniao` | ✅ | Horário ou "A definir" |
| `data_horario_reuniao` | ✅ | "DD/MM/AAAA HH:mm" ou "A definir" |
| `local_reuniao` | ✅ | Texto |
| `indicacao` | ✅ | Ex: "Fundo", "Consultor", etc. |
| `nome_indicacao` | ✅ | Texto |
| `tipo_de_lead` | ✅ | Ex: "Indicação", "Lead Ativa", etc. |
| `due_diligence` | ✅ | "Sim" ou "Não" |
| `timestamp` | ✅ | Data/hora pt-BR |
| `origem` | ✅ | "Bismarchi | Pires - Manual CRM" |

O CRM **não envia**:

- `razao_social_principal` / `demais_razao_social` (o n8n gera no nó "Limitar até 255 Caracteres")
- `cnpj` / `demais_cnpj` (idem, gerados a partir de `razao_social_cnpj`)

**Áreas de análise:** não são mais usadas. Todos os leads são enviados para **todas as áreas** (lista fixa de gestores + solicitante).

---

## O que você deve mudar no fluxo N8N

### 1. Corrigir typo no Webhook (CORS)

No nó **Webhook1**, em `responseHeaders`:

- **Atual:** `"value": "OST, GET, OPTIONS"`
- **Correto:** `"value": "POST, GET, OPTIONS"`

---

### 2. Remover `areas_analise` do fluxo

- Nos nós **Negociação com Due** e **Negociação sem Due**: no `jsonOutput`, **apague** a linha `"areas_analise": {{ $json.body.areas_analise }}`.
- Nos nós **Cria negociação** e **Cria negociação1** (RD Station): remova o bloco do custom field `675710a3bb27e30023e09b63` (value com `$json.areas_analise`).
- Nos nós **Cria o Template do E-mail - C/Due** e **Cria o Template do E-mail - Sem Due**: remova referências a `areas_analise` e "Áreas de Análise" / "Áreas Envolvidas" no HTML.
- No nó **Code** (mensagem WhatsApp Due): remova a parte da mensagem sobre "Áreas de Análise" e a variável `areas_analiseFormatted`. Código corrigido está em **`docs/N8N-ENVIO-EMAIL-TODAS-AREAS.md`** (seção 3).

---

### 3. Enviar e-mail para todas as áreas (todos os gestores)

Os nós **Verifica as áreas para envio do e-mail** e **Verifica as áreas para envio do e-mail de CP3** passam a usar uma **lista fixa com todos os gestores** (todas as áreas) + e-mail do solicitante. Código pronto está em **`docs/N8N-ENVIO-EMAIL-TODAS-AREAS.md`**.

---

### 4. Conferir conexão do Webhook

No editor do n8n, confira se a saída do Webhook que vai para **Com Due Dilligence?** é a que recebe o payload do POST (geralmente a saída principal, índice 0).

---

### 5. Resumo do mapeamento (após "Limitar até 255 Caracteres")

O nó **Limitar até 255 Caracteres** (e o "Limitar até 255 Caracteres1") lê `body.razao_social_cnpj` e escreve no `body`:

- `razao_social_principal`
- `demais_razao_social`
- `cnpj`
- `demais_cnpj`

Os nós **Negociação com Due** e **Negociação sem Due** leem do `body` e renomeiam para o padrão usado no resto do fluxo:

- `body.prazo_reuniao_due` → `data_entrega_due`
- `body.horario_due` → `horario_entrega_due`

Isso está alinhado com o que o CRM envia; não é necessário mudar nomes no CRM.

---

### 6. RD Station (Cria negociação / Cria negociação1)

Remova o custom field de `areas_analise` (item 2). Os demais campos continuam iguais.

---

## Checklist rápido

| Item | Ação |
|------|------|
| CORS do Webhook | Alterar "OST" para "POST" em Access-Control-Allow-Methods |
| `areas_analise` | Remover de Set, RD Station, templates de e-mail e Code WhatsApp |
| Envio de e-mail | Usar lista fixa “todas as áreas” — ver `docs/N8N-ENVIO-EMAIL-TODAS-AREAS.md` |
| Conexão Webhook | Verificar saída conectada a "Com Due Dilligence?" |
