# Cadastro de Lead - formulario completo (estado atual)

## 1) Objetivo

Consolidar todas as informacoes do formulario de **Cadastro de Lead** atualmente usado no projeto, incluindo:

- campos de tela;
- obrigatoriedade;
- regras condicionais;
- opcoes permitidas;
- formato/mascara;
- validacoes de backend;
- payload enviado ao webhook.

Fontes:
- `src/components/funnel/LeadForm.tsx`
- `src/data/salesFunnel.ts`
- `api/validar-sheets.js`

---

## 2) Estrutura do formulario (UI)

## 2.1 Secao: Informacoes do Solicitante

1. **Solicitante** (obrigatorio)
   - Tipo: seletor com avatar (dropdown).
   - Origem das opcoes: `getSolicitanteOptions()` (`src/data/teamAvatars.ts`).
   - Ao selecionar, preenche automaticamente:
     - `solicitante` (nome)
     - `email` (email corporativo no dominio bismarchipires).

2. **E-mail do Solicitante** (obrigatorio)
   - Tipo: `email`
   - Comportamento atual: somente leitura no formulario (vem do solicitante selecionado).

3. **Cadastro realizado por (e-mail)** (obrigatorio)
   - Tipo: seletor com avatar (dropdown).
   - Salva email do colaborador que esta cadastrando.

---

## 2.2 Secao: Due Diligence

4. **Havera Due Diligence?** (obrigatorio)
   - Tipo: radio (`Sim` / `Nao`).

Campos condicionais quando `Sim`:

5. **Prazo de Entrega da Due Diligence**
   - Tipo: `date`
   - Regra funcional: obrigatorio quando due = Sim.

6. **Horario de Entrega da Due Diligence**
   - Tipo: `time`
   - Regra funcional: obrigatorio quando due = Sim.

---

## 2.3 Secao: Dados da Empresa/Pessoa

Grupo repetivel (1..N):

7. **Razao Social / Nome Completo** (obrigatorio em cada item)
   - Tipo: texto.
   - Comportamento atual: convertido para MAIUSCULO.

8. **CPF ou CNPJ** (obrigatorio em cada item)
   - Tipo: texto com mascara.
   - Usuario escolhe tipo de documento por item:
     - `CPF`
     - `CNPJ`
   - Mascara aplicada dinamicamente:
     - CPF: `000.000.000-00`
     - CNPJ: `00.000.000/0000-00`

Comandos de interface:
- `+ Adicionar Empresa/Pessoa` (adiciona novo bloco).
- `Remover` (disponivel quando houver mais de um bloco).

---

## 2.4 Secao: Areas de analise

9. **Areas de analise** (obrigatorio: pelo menos 1 selecionada)
   - Tipo: checkbox multipla escolha.
   - Opcoes atuais:
     - Civel
     - Reestruturacao
     - Tributario
     - Trabalhista
     - Distressed Deals
     - Societario e Contratos

---

## 2.5 Secao: Reuniao

10. **Local da Reuniao** (obrigatorio)
    - Tipo: texto.

11. **Data da Reuniao** (opcional)
    - Tipo: `date`.

12. **Horario da Reuniao** (opcional)
    - Tipo: `time`.

---

## 2.6 Secao: Tipo de Lead

13. **Tipo de Lead** (obrigatorio)
    - Tipo: `select`.
    - Opcoes atuais:
      - Indicacao
      - Lead Ativa
      - Lead Digital
      - Lead Passiva

Campos condicionais quando `Tipo de Lead = Indicacao`:

14. **Tipo de Indicacao** (obrigatorio no caso de indicacao)
    - Tipo: `select`.
    - Opcoes:
      - Fundo
      - Consultor
      - Cliente
      - Contador
      - Sindicatos
      - Conselhos profissionais
      - Colaborador
      - Outros parceiros

15. **Nome da Indicacao** (obrigatorio no caso de indicacao)
    - Tipo: texto.

---

## 3) Regras de envio e comportamento do submit

## 3.1 Regras de bloqueio na UI

- Se nenhuma area de analise for marcada, bloqueia envio.
- Campos com `required` HTML sao exigidos na propria tela.
- Exibe modal de confirmacao antes de enviar.

## 3.2 Persistencia local

Antes do webhook, o formulario salva no `localStorage`:
- chave: `leads`.

## 3.3 Webhook

Endpoint principal:
- `https://ia-n8n.a8fvaf.easypanel.host/webhook/cadastro-lead`

Fallbacks de CORS:
- `api.allorigins.win/raw?...`
- `corsproxy.io/?...`

Retorno:
- sucesso: mensagem de envio com sucesso;
- falha: informa que nao enviou, mas dados ficaram salvos localmente.

## 3.4 Integracao com Due Diligence (Supabase)

Quando `due_diligence = Sim`, executa sincronizacao de leads para modulo de due diligence:
- `syncDueDiligenceLeadsFromFunnel(...)`.

---

## 4) Payload enviado (estrutura atual)

Campos enviados em `dadosParaEnvio`:

- `id` (timestamp string)
- `solicitante`
- `email`
- `cadastrado_por`
- `razao_social_cnpj[]` (apenas `razao_social` e `cnpj`)
- `prazo_reuniao_due` (ou `A definir`)
- `horario_due` (ou `A definir`)
- `data_reuniao` (formatada BR ou `A definir`)
- `horario_reuniao` (ou `A definir`)
- `data_horario_reuniao`
- `local_reuniao`
- `indicacao`
- `nome_indicacao`
- `tipo_de_lead`
- `due_diligence`
- `areas_analise[]`
- `timestamp` (locale pt-BR)
- `origem` (`Bismarchi | Pires - Manual CRM`)

---

## 5) Regras de validacao do backend (api/validar-sheets.js)

Validacoes aplicadas ao cadastro do lead (escopo `cadastro_lead`):

- `solicitante`: obrigatorio e validado contra lista de nomes permitidos.
- `email`: obrigatorio + regex email.
- `cadastrado_por`: obrigatorio + regex email.
- `due_diligence`: obrigatorio.
- `local_reuniao`: obrigatorio.
- `tipo_de_lead`: obrigatorio.
- `razao_social`: obrigatorio.
- `cnpj`: obrigatorio.
- `areas_analise`: atualmente desativado na config (`false`).
- `prazo_reuniao_due`: obrigatorio quando due = Sim.
- `horario_due`: obrigatorio quando due = Sim.
- `indicacao`: obrigatorio quando tipo = Indicacao.
- `nome_indicacao`: obrigatorio quando tipo = Indicacao.

Regras adicionais:
- aceitação de aliases de coluna (planilha/webhook) para os mesmos campos;
- dominio de e-mail preferencial `@bismarchipires.com.br` (aponta correcao quando vier `@bpplaw.com.br`).

---

## 6) Mapeamento rapido campo de tela -> chave tecnica

- Solicitante -> `solicitante`
- E-mail do Solicitante -> `email`
- Cadastro realizado por -> `cadastrado_por`
- Havera Due Diligence? -> `due_diligence`
- Prazo de Entrega da Due -> `prazo_reuniao_due`
- Horario de Entrega da Due -> `horario_due`
- Razao Social / Nome Completo -> `razao_social_cnpj[].razao_social` (ou `razao_social` no backend consolidado)
- CPF/CNPJ -> `razao_social_cnpj[].cnpj` (ou `cnpj` no backend consolidado)
- Local da Reuniao -> `local_reuniao`
- Data da Reuniao -> `data_reuniao`
- Horario da Reuniao -> `horario_reuniao`
- Tipo de Lead -> `tipo_de_lead`
- Tipo de Indicacao -> `indicacao`
- Nome da Indicacao -> `nome_indicacao`
- Areas de analise -> `areas_analise`

---

## 7) Observacoes importantes para migracao

- O frontend usa UX rica (dropdown com avatar, blocos condicionais e modal de confirmacao).
- O backend possui regras mais restritivas que parte do HTML do formulario.
- Existe dependencia de webhook externo e fallback por proxy.
- O modelo repetivel de razao social/cnpj ja reduz retrabalho e deve ser preservado no novo CRM.
