# Automação de validação e notificação – Etapas de vendas

Guia para montar uma automação que **valida** os dados do CRM/planilha segundo o [manual de etapas](ETAPAS-DE-VENDAS-REFERENCIA.md) e **envia notificação** para quem preencheu errado (ou para você), pedindo correção.

---

## 1. Recomendação: N8N como núcleo

**Use N8N** como orquestrador da automação, porque:

1. Você já usa N8N (o cadastro de lead envia para um webhook N8N).
2. Conecta bem com **Google Sheets** (ler/gravar) e com **RD Station CRM** (se houver integração oficial ou API).
3. Permite **validação em código** (Code node) usando as regras do manual.
4. Permite **notificar** por e-mail (Gmail, SMTP), Slack, WhatsApp (via API), etc.
5. Tudo em um único workflow, sem precisar subir outro servidor.

**Alternativa:** se no futuro a lógica ficar grande (muitas etapas, muitas regras), dá para extrair a validação para um servidor/API sua e o N8N só chamar essa API. Para começar, N8N + Code node resolve.

---

## 2. De onde vêm os dados?

Você comentou que tem **uma tabela no Google Sheets com todas as infos** e que o CRM é **RD Station CRM**. Há três formas típicas de encaixar isso:

| Cenário | Fonte da verdade | Trigger da automação | Observação |
|--------|--------------------|----------------------|------------|
| **A) Planilha é espelho do CRM** | Google Sheets | Schedule no N8N (ex.: 2x/dia) ou quando a planilha é editada | RD Station → Sheets via integração (Zapier, Make, AppScript) ou export manual. N8N lê a planilha e valida. |
| **B) Planilha é alimentada por webhook** | Google Sheets | Webhook quando um lead/deal é criado/alterado no RD (ou quando algo grava na planilha) | Requer algo que “empurre” os dados para a planilha ou para o N8N. |
| **C) N8N lê direto do RD** | RD Station (API) | Schedule ou webhook do RD (se existir) | N8N usa credenciais RD Station, busca deals/leads, valida e notifica. |

**Recomendação prática:** comece pelo **Cenário A**: N8N lê o Google Sheets em um **agendamento** (ex.: a cada 6 h ou 1x por dia), valida cada linha conforme a etapa e, se houver erro, envia a notificação. Não precisa integrar RD → Sheets no primeiro momento; basta que a planilha tenha as mesmas infos que você usa no CRM (por exemplo, export ou integração que você já tenha).

---

## 3. O que sua planilha precisa ter

Para a validação e a notificação fazerem sentido, a planilha deve ter pelo menos:

### Colunas obrigatórias (mínimo)

| Coluna (sugestão de nome) | Uso |
|---------------------------|-----|
| `etapa` ou `etapa_id` | Identificador da etapa: `cadastro-lead`, `reuniao`, `conf-proposta`, etc. (ver lista no [manual](ETAPAS-DE-VENDAS-REFERENCIA.md#2-lista-de-etapas-do-funil-de-vendas-ids-e-ordem)). |
| `email_notificar` | E-mail para onde enviar a notificação quando houver erro. Pode ser o “Solicitante” ou “Cadastro realizado por” – quem preenheu ou é dono do processo. |
| `id_registro` ou `nome_lead` | Algo que identifique o lead/deal na notificação (ex.: nome da empresa, nome do lead, ID do deal). |

### Colunas dos campos (por etapa)

Os nomes podem seguir o que você já usa no CRM ou na planilha. O importante é que o **script de validação** no N8N use os **mesmos nomes** ao ler cada linha.

Para a **Etapa 1 – Cadastro do Lead**, o manual e o webhook usam nomes como:

- `solicitante`, `email`, `cadastrado_por`, `due_diligence`, `prazo_reuniao_due`, `horario_due`
- `razao_social_cnpj` (ou colunas separadas, ex.: `razao_social`, `cnpj`)
- `areas_analise` (ou uma coluna com áreas separadas por `;`)
- `local_reuniao`, `data_reuniao`, `horario_reuniao`
- `tipo_de_lead`, `indicacao`, `nome_indicacao`

Sugestão: na planilha, use os **mesmos nomes** das chaves do manual/webhook, ou crie um mapeamento “nome_coluna_planilha → nome_campo_validação” no Code node.

---

## 4. Arquitetura do workflow no N8N

Fluxo geral:

```
[Trigger] → [Ler Google Sheets] → [Para cada linha / Loop] → [Validar (Code)] → [Se há erros?]
                                                                                    │
                                    ┌───────────────────────────────────────────────┘
                                    ▼
                           [Montar mensagem de erro]
                                    │
                                    ▼
                    [Enviar notificação (Email / Slack / etc.)]
```

### Passo a passo

1. **Trigger**
   - **Schedule:** “A cada X horas” ou “Todo dia às 8h e 18h”.
   - Ou **Webhook:** se você tiver outro processo que chama o N8N quando a planilha é atualizada ou quando um deal muda no RD.

2. **Google Sheets – “Read”**
   - Escolha a planilha e a aba.
   - Defina intervalo (ex.: colunas A até N, a partir da linha 2).
   - Saída: um item por linha (ou um array de linhas).

3. **Loop** (opcional)
   - Se o “Read” devolver várias linhas de uma vez, use um **Split Out** ou **Loop Over Items** para processar um registro por vez.

4. **Code (validação)**
   - Entrada: um item com os campos da linha (etapa, email_notificar, id_registro, + todos os campos da etapa).
   - Lógica: conforme `etapa`, aplicar as regras do manual (obrigatórios, condicionais, formato de e-mail, CNPJ/CPF, etc.).
   - Saída: no mesmo item (ou em novo campo), colocar algo como:
     - `valid`: true/false
     - `errors`: `[{ field, message, comoCorrigir }]`
   - Use o script pronto em `../scripts/n8n-validacao-etapas.js` (ou o trecho que estiver neste doc) dentro do Code node.

5. **IF – “valid === false”**
   - Só segue para notificação quando houver erro.

6. **Montar texto da notificação**
   - Use um **Code** ou **Set** para montar:
     - assunto do e-mail
     - corpo do e-mail (ou bloco do Slack) com: nome do lead/deal, etapa, lista de campos com erro e “como corrigir” (copiando do manual ou do array `errors`).

7. **Enviar notificação**
   - **Gmail** ou **SMTP:** envie para `email_notificar` (da linha) e, se quiser, em cópia para você.
   - **Slack:** canal de “qualidade de dados” ou DM para o responsável (se tiver o user_id pelo e-mail).
   - **WhatsApp:** se você já tiver integração (API oficial ou intermediário) no N8N. Para enviar **direto da tela de validação** (app) via N8N + Evolution API, veja [ENVIO-WHATSAPP.md](ENVIO-WHATSAPP.md).

---

## 5. Para quem enviar a notificação

- **Opção 1 – Quem preencheu:** use o e-mail do “Solicitante” ou “Cadastro realizado por” como `email_notificar`. Assim a pessoa que preenheu recebe o que corrigir.
- **Opção 2 – Só você:** use um e-mail fixo (ex.: o seu) em todas as notificações; você repassa manualmente ou por processo interno.
- **Opção 3 – Híbrido:** notificar o responsável (solicitante/cadastro realizado por) e colocar você em cópia.

O campo `email_notificar` na planilha pode ser exatamente a coluna “E-mail do Solicitante” ou “Cadastro realizado por (e-mail)”, ou uma coluna que você monta com essa regra.

---

## 6. Modelo de mensagem (e-mail / Slack)

**Assunto (ex.):**  
`[CRM] Ajuste necessário – {nome_lead ou id_registro} – Etapa {nome_etapa}`

**Corpo (ex.):**

```
Olá,

Na oportunidade/lead "{nome_lead ou id_registro}", na etapa "{nome_etapa}", 
alguns campos precisam ser ajustados conforme o manual de preenchimento:

{para cada erro:}
• Campo: {field}
  Problema: {message}
  Como corrigir: {comoCorrigir}

Por favor, corrija no CRM/planilha e verifique novamente.

Consulta o manual completo em: [link para ETAPAS-DE-VENDAS-REFERENCIA ou página interna]
```

No Slack você pode usar o mesmo texto em um bloco de mensagem e, se quiser, um botão “Abrir deal no RD” (link direto para o deal, se a API do RD der essa URL).

---

## 7. Script de validação (Code node no N8N)

O arquivo **`scripts/n8n-validacao-etapas.js`** contém um script em JavaScript para colar no **Code** node do N8N.

### O que o script faz

- Recebe os itens (linhas da planilha ou do CRM) com os campos da linha e o `etapa` (ou `etapa_id`).
- Aplica regras da **Etapa 1 (Cadastro do Lead)** conforme o manual:
  - obrigatórios: Solicitante, E-mail do Solicitante, Cadastro realizado por, Haverá Due Diligence?, Local da Reunião, Tipo de Lead, Razão Social/CNPJ, Áreas Envolvidas;
  - condicionais: se Due = Sim → Prazo e Horário da Due obrigatórios; se Tipo de Lead = Indicação → Indicação e Nome da Indicação obrigatórios;
  - formato: e-mail válido, CNPJ/CPF no padrão da Receita.
- Devolve em cada item: `valid` (true/false) e `errors` (array de `{ field, message, comoCorrigir }`).

### Como usar no N8N

1. Adicione um **Code** node após o node que lê o Google Sheets (ou que recebe os dados).
2. Em "Mode", escolha **Run Once for All Items**.
3. Cole todo o conteúdo de `scripts/n8n-validacao-etapas.js` no editor do Code.
4. Garanta que o node anterior entregue um item por linha, com propriedades como: `etapa`, `solicitante`, `email`, `cadastrado_por`, `due_diligence`, etc. Se a planilha tiver outras colunas, use um **Set** ou **Code** antes para mapear (ex.: coluna "E-mail Solicitante" → `email`).
5. Para notificação, use o e-mail do responsável: no item há `email` ou `cadastrado_por`; se quiser um destinatário fixo, crie na planilha a coluna `email_notificar` e use esse campo no node de envio de e-mail.
6. Conecte um **IF** depois: `{{ $json.valid }}` igual a `false` → segue para montar a mensagem e enviar a notificação.
7. No node de e-mail/Slack, use a lista `{{ $json.errors }}` para montar o texto “quais campos corrigir e como”.

Para outras etapas (7, 9, 10, 12), você pode editar o script e adicionar blocos `if (etapa === 'conf-proposta') { return validarConfProposta(data) }` usando as regras do [manual](ETAPAS-DE-VENDAS-REFERENCIA.md).

---

## 8. Resumo de decisões

| O que | Sugestão |
|-------|----------|
| Ferramenta | N8N |
| Fonte dos dados (inicial) | Google Sheets (ler por schedule) |
| Trigger | Schedule 1–2x por dia (ou webhook se já tiver algo disparando) |
| Validação | Code node com o script em `scripts/n8n-validacao-etapas.js` |
| Notificação | E-mail (Gmail/SMTP) para `email_notificar` + você em cópia (opcional) |
| Conteúdo da mensagem | Lista de campos com erro + “como corrigir” baseado no manual |

Assim você consegue enviar uma notificação objetiva para quem preencheu errado (ou para você), sempre alinhada ao manual de etapas que vocês criaram.
