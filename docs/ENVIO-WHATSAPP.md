# Envio de notificação no WhatsApp pela tela de validação

O app permite enviar mensagens no WhatsApp direto da tela **Validar planilha**. Você pode usar **N8N (com Evolution API)** ou **Evolution API direto**.

---

## 1. Opção recomendada: N8N + Evolution API

Se você já tem Evolution API configurada no N8N, use um **webhook** no N8N. O app envia os dados para esse webhook e o workflow N8N usa o node Evolution API para enviar a mensagem.

### Passos no N8N

1. Crie um novo workflow.
2. Adicione um node **Webhook**:
   - Método: POST
   - Path: por exemplo `enviar-whatsapp` (a URL final será algo como `https://seu-n8n.com/webhook/enviar-whatsapp`).
   - O body esperado é JSON: `{ "number": "5511999999999", "text": "sua mensagem", "id_registro": "opcional" }`.
3. Conecte um node **Evolution API** (ou **HTTP Request** apontando para sua Evolution API):
   - Se usar node Evolution API do N8N: configure a instância e use “Send Text” com `{{ $json.number }}` e `{{ $json.text }}`.
   - Se usar HTTP Request:  
     `POST https://sua-evolution-api.com/message/sendText/SUA_INSTANCIA`  
     Headers: `apikey: SUA_API_KEY`, `Content-Type: application/json`  
     Body: `{ "number": "{{ $json.number }}", "text": "{{ $json.text }}" }`.
4. Ative o workflow e copie a **URL do webhook**.

### No app (variáveis de ambiente)

Na Vercel (ou no `.env` local) configure:

- **N8N_WEBHOOK_URL** = URL do webhook (ex.: `https://seu-n8n.com/webhook/enviar-whatsapp`)

Ou use o nome alternativo:

- **N8N_WEBHOOK_ENVIAR_WHATSAPP** = mesma URL

Assim todo envio acionado pelo botão “Enviar no WhatsApp” no app será feito via N8N → Evolution API.

---

## 2. Opção alternativa: Evolution API direto

Sem usar N8N, o backend do app pode chamar a Evolution API diretamente. Informe:

- **EVOLUTION_API_URL** – base da API (ex.: `https://sua-evolution-api.com`)
- **EVOLUTION_API_KEY** – API key da Evolution
- **EVOLUTION_INSTANCE** – nome da instância

O backend usa o endpoint `/message/sendText/{instance}` com `number` e `text`.

---

## 3. Número de telefone na planilha

Para pré-preencher o número no modal “Enviar no WhatsApp”, a planilha pode ter uma coluna usada para notificação por WhatsApp. A API de validação já mapeia estes nomes de coluna (normalizados, sem acento, espaços → `_`) para o campo enviado ao front:

- `telefone_notificar`
- `whatsapp`
- `telefone`
- `celular`

Ou use a coluna **Telefone do ponto focal** (já mapeada como `telefone_ponto_focal`): quando existir, ela é oferecida como “telefone para notificar” naquela linha.

O número deve ter DDD (ex.: 11) e o celular (ex.: 999999999). O backend acrescenta `55` (Brasil) quando o número tiver até 11 dígitos.

---

## 4. Uso na tela

1. Na **Validar planilha**, após validar, em cada linha/card aparece o botão **“Enviar no WhatsApp”** (ou **“WPP”** na vista tabela).
2. Ao clicar, abre o modal com:
   - **Lead** (id_registro e etapa)
   - **Número**: pré-preenchido se a planilha tiver `telefone_notificar` / `telefone_ponto_focal`; caso contrário, digite (ex.: 11999999999 ou 5511999999999).
   - **Mensagem**: texto padrão com lead, etapa e erros de validação (quando houver); você pode editar antes de enviar.
3. **Enviar** → o app chama a API `/api/enviar-whatsapp` com `number` e `text`; a API usa o webhook N8N ou a Evolution API conforme a configuração.

Se nada estiver configurado (nem N8N nem Evolution), a API responde com erro explicando que é preciso configurar alguma das opções acima.
