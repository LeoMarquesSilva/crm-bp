# Levantamento completo - CRM atual + RD Station (base para novo projeto)

## 1) Objetivo deste documento

Concentrar a maior quantidade de informacoes atuais sobre:

- fluxo operacional do CRM hoje;
- dependencia de RD Station;
- campos (labels RD, aliases de planilha e validacoes);
- regras de negocio e automacoes existentes;
- pontos de dor e requisitos novos ja levantados.

Uso recomendado: servir como base funcional e tecnica para construir o novo CRM em outro projeto, sem dependencia de RD.

---

## 1.1 Resumo executivo do projeto

### Objetivo do projeto

Criar um CRM baseado no processo atual do RD Station para acompanhamento dos leads do escritorio, integrado com as ferramentas necessarias e com alta usabilidade operacional.

### Problema a resolver / justificativa

- controle de leads ainda fragmentado ate cadastro e faturamento;
- falta de padronizacao de preenchimento;
- engessamento do RD frente as necessidades de Comercial, Cadastro e Financeiro.

### Beneficios esperados (base informada)

- economia anual estimada de **R$ 23.580,00** (referencia: R$ 131,00 por usuario);
- reducao de atividades manuais e retrabalho;
- padronizacao do processo de CRM, Cadastro e Faturamento;
- ganho de escala, previsibilidade operacional e transparencia (leads criados x convertidos);
- informacoes confiaveis, atualizadas e auditaveis;
- melhor suporte a dashboards, analises e tomada de decisao da diretoria;
- reducao de riscos operacionais e de compliance.

### Alinhamento estrategico

- economia recorrente de custo fixo;
- fortalecimento da area comercial;
- suporte ao crescimento sustentavel da operacao;
- profissionalizacao da estrutura administrativa e financeira;
- operacao orientada por dados e com melhor governanca.

---

## 1.2 Escopo formal informado

### Dentro do escopo

1. Plataforma CRM amigavel substituindo o RD atual.
2. Padronizacao de campos e regras de preenchimento.
3. Painel gerencial de cadastro (Controladoria) e faturamento (Financeiro).
4. Gestao de leads e SLA de preenchimento.
5. Espaco de follow-up dos leads.
6. Integracao com painel de contratos (redefinicao da fonte de dados).
7. Inclusao dos leads cadastrados no RD desde jan/2026.
8. Inclusao de leads em andamento, mesmo cadastrados antes de jan/2026.
9. Integracao da geracao da due pelo CRM.
10. Integracao da geracao do contrato pelo CRM.
11. Integracao da API D4sign para assinatura no CRM.
12. Deixar caminho aberto para evolucoes em onboarding e pos-venda.
13. Operacionalizar leads de aditivo e leads simples (ex.: consulta advocaticia).

### Fora do escopo (exclusoes)

1. Inclusao de leads concluidos anteriores a 2026.

### Entregaveis principais

1. Lista de campos necessarios com regras de preenchimento.
2. MVP do novo CRM.
3. Upload dos leads cadastrados em 2026.
4. Painel de gerenciamento da Controladoria.
5. Painel de gerenciamento do Financeiro.
6. Integracao com painel de contratos.
7. Geracao da due via CRM.
8. Integracao D4sign para assinatura de contrato.
9. Treinamento dos coordenadores e envolvidos.
10. Relatorio final e licoes aprendidas.

### Premissas

1. O sistema deve capturar a economia atual do RD.
2. Deve mitigar ao maximo campos repetidos e bloquear preenchimento incorreto.
3. Disponibilidade das equipes para alimentacao/operacao (Comercial, Controladoria, Financeiro).
4. Uso do Supabase contratado (estimativa: US$ 10/mes).

### Restricoes

1. Conclusao ate o inicio/final de maio de 2026.
2. Sem aumento de headcount.
3. Uso da infraestrutura/sistemas ja contratados pelo escritorio.

---

## 2) Estado atual (resumo executivo)

- O projeto atual ja tem interface e regras de funil, mas ainda depende de RD + Sheets em pontos criticos.
- Regras de validacao estao fortes no endpoint `api/validar-sheets.js` (com mapeamento de muitas variacoes de colunas).
- O modelo de dados atual no Supabase nao representa CRM completo (nao ha entidades nativas de cliente/contrato/aditivo como dominio principal do CRM).
- Existem automacoes/processos de cadastro e financeiro com `STATUS [CADASTRO]` e `STATUS [FINANCEIRO]`.
- A transicao de Vendas para Pos-Venda ainda depende de acao manual no RD (`Marcar Venda`).

---

## 3) Fluxo atual de negocio (as-is)

## 3.1 Funil de Vendas (ordem atual)

1. Cadastro do Lead  
2. Levantamento de Dados (ADD)  
3. Compilacao (MKT/COM.)  
4. Revisao (ADD)  
5. Due Diligence Finalizada (SOLICITANTE)  
6. Reuniao (SOLICITANTE)  
7. Confeccao de Proposta (SOLICITANTE)  
8. Proposta Enviada (AGUARDA CLIENTE)  
9. Confeccao de Contrato (CONTRATOS)  
10. Contrato Elaborado (SOLICITANTE)  
11. Contrato Enviado (SOLICITANTE)  
12. Contrato Assinado (SOLICITANTE)

## 3.2 Funil de Pos-Venda (ordem atual)

1. Aguardando Cadastro (SOLICITANTE)  
2. Cadastro de Novo Cliente (SOLICITANTE)  
3. Inclusao no Fluxo de Faturamento (FINANCEIRO)  
4. Boas-vindas (RECEP.)  
5. Reuniao Kick-off (ALINH.)

## 3.3 Regras criticas hoje

- Nao pular etapas.
- `STATUS [CADASTRO]` e `STATUS [FINANCEIRO]` sao status de automacao (nao devem ser alterados manualmente fora do fluxo).
- Financeiro depende de cadastro concluido.
- Link de proposta/contrato deve ser de diretorio oficial (SharePoint/VIOS).
- Acao obrigatoria no fim de Vendas: clicar em `Marcar Venda` no RD para duplicar no funil de Pos-Venda.

---

## 4) Requisitos novos informados (to-be)

## 4.1 Indicadores/consultores com pre-aprovacao de admin

Problema atual:
- campo aberto para "quem indicou" gera grafias erradas, incompletas e duplicadas.

Requisito novo:
- solicitante pode digitar o nome livremente sem travar cadastro;
- nome digitado entra em estado "pre-aprovado/pendente";
- admin valida, corrige padrao e aprova;
- apos aprovacao, passa a ser opcao padronizada para proximos cadastros;
- fluxo nao pode bloquear operacao do solicitante.

## 4.2 Cadastro do lead com tipo de abertura

Requisito novo:
- no inicio do cadastro, escolher tipo:
  - novo lead
  - novo contrato
  - aditivo
- se for novo contrato/aditivo, permitir selecionar cliente ja cadastrado.

## 4.3 Base de clientes VIOS

Requisito novo:
- utilizar base de clientes do VIOS como fonte de cadastro para evitar repreenchimento.

## 4.4 Fluxo condicional de etapas

Com due diligence:
- Levantamento de dados
- Compilacao
- Revisao
- Due diligence finalizada

Sem due diligence:
- Reuniao
- Confeccao de proposta
- Proposta enviada
- Confeccao do contrato
- Contrato elaborado
- Contrato enviado
- Contrato assinado

Observacao:
- esses blocos devem ser modelados como caminhos condicionais no motor de workflow do novo CRM (sem depender de operacao manual no RD).

---

## 5) Dependencias atuais de RD Station

## 5.1 Endpoints RD usados

- `https://crm.rdstation.com/api/v1/deals` (paginacao de negocios)
- `https://crm.rdstation.com/api/v1/activities` (sincronizacao de anotacoes)

Token atual:
- `RD_CRM_TOKEN` em ambiente.

## 5.2 Pontos do codigo com acoplamento RD

- `api/sync-financeiro-rd.js`
- `api/auditar-etapa1-rd-sheets.js`
- `api/relatorio-posvenda-etapas.js`
- `api/sync-anotacoes.js`
- `scripts/audit-financeiro-rd-local.js`
- `scripts/check-etapa1-lead-local.js`
- telas com link para deal RD (ex.: paginas de analise/validacao/SLA)

## 5.3 Limites operacionais herdados do RD

- data de entrada em etapa nao esta nativa na API v1 (usa `updated_at` como proxy).
- transicao Vendas -> Pos-Venda depende de click manual no RD.
- estrutura de campos customizados depende de labels (sujeita a variacao de escrita/acentuacao).

---

## 6) Fontes de verdade atuais no projeto

## 6.1 Definicao de funis e etapas

- `src/data/salesFunnel.ts`
- `src/data/postFunnel.ts`

## 6.2 Validacao e mapeamento de colunas/campos

- `api/validar-sheets.js` (principal)
- `docs/n8n-rd-mapeamento-robusto.js` (mapeamento robusto por label)
- `scripts/n8n-validacao-etapas.js` (versao N8N)

## 6.3 Auditoria e reconciliacao RD x planilha

- `api/auditar-etapa1-rd-sheets.js`
- `api/sync-financeiro-rd.js`
- `docs/backfill-financeiro-operacao.md`
- `docs/financeiro-auditoria.md`

## 6.4 Exemplo real de deal RD

- `rd-deal-68924d7526c1f50018dc039b.json`

---

## 7) Inventario de campos - visao consolidada

Observacao:
- abaixo esta o consolidado funcional a partir de labels RD + mapeamentos de validacao;
- no novo projeto, transformar isso em dicionario unico versionado de campos.

## 7.1 Identificacao/base

- `deal_id`
- `stage_name`
- `stage_id`
- `funil`
- `status` / `estado`
- `created_at` / `updated_at`
- `motivo_perda`

## 7.2 Cadastro do lead (entrada comercial)

- Solicitante
- E-mail do Solicitante
- Cadastro realizado por (e-mail)
- Havera Due Diligence?
- Prazo de Entrega Due [DATA]
- Prazo de Entrega Due [HORARIO]
- Razao Social [CP]
- CNPJ [CP]
- Local da Reuniao
- Data Reuniao
- Horario da Reuniao
- Tipo de Lead
- Indicacao
- Nome da Indicacao
- Areas que serao objeto de analise
- Areas para comparecimento na reuniao

## 7.3 Confeccao de proposta [CP]

- Qualificacao completa (endereco, CEP, endereco eletronico etc.) [CP]
- Areas Objeto do contrato [CP]
- Realizou Due Diligence? [CP]
- Gestor do Contrato [CP]
- Nome do ponto focal / Comercial [CP]
- E-mail do ponto focal / Comercial [CP]
- Telefone do ponto focal / Comercial [CP]
- Captador [CP]
- Tributacao [CP]
- Prazo para entrega (minimo 2 dias uteis...) [CP]
- Data do primeiro vencimento [CP]
- Informacoes adicionais [CP]
- Demais Razoes sociais
- Link da Proposta [CP]

## 7.4 Confeccao de contrato [CC]

- Tipo de Instrumento [CC] (inclui Contrato/Aditivo/Acordo)
- Limitacao de processos e valor adicional por processo [CC]
- Limitacao de horas (Consultivo) [CC]
- Objeto do Contrato [CC]
- Exito (descrever areas e percentuais) [CC]
- Valores (descrever tipo de pagamento, valores e vencimento) [CC]
- Tipo de pagamento [CC]
- SPOT - Valor R$ [CC]
- Mensal - Fixo Valor R$ [CC]
- Mensal - Preco Fechado Parcelado - Valor R$ [CC]
- Mensal - Escalonado - Valor R$ [CC]
- Mensal - Variavel - Valor R$ [CC]
- Mensal - Condicionado - Valor R$ [CC]
- SPOT com Manutencao - Valor R$ [CC]
- SPOT - Parcelado - Valor R$ [CC]
- SPOT - Parcelado com manutencao - Valor R$ [CC]
- SPOT - Condicionado - Valor R$ [CC]
- Exito - Valor R$ [CC]
- RATEIO - PORCENTAGEM % (Reestruturacao e Insolvencia) - [CC]
- RATEIO - PORCENTAGEM % (Civel) - [CC]
- RATEIO - PORCENTAGEM % (Trabalhista) - [CC]
- RATEIO - PORCENTAGEM % (Tributario) - [CC]
- RATEIO - PORCENTAGEM % (Contratos / Societario) - [CC]
- RATEIO - PORCENTAGEM % (ADD) - [CC]
- Prazo para Confeccao do Contrato [CC]

## 7.5 Contrato elaborado/assinado

- Link Contrato [CE]
- Responsavel pela Elaboracao [CE]
- Data de assinatura do contrato [CA]
- Link do Arquivo DUE
- ID SHAREPOINT

## 7.6 Pos-venda - cadastro

- STATUS [CADASTRO]
- Razao Social Cliente Principal [CADASTRO]
- CNPJ / CPF Cliente Principal [CADASTRO]
- Endereco Cliente Principal [CADASTRO]
- Qualificacao dos Socios (...) [CADASTRO]
- Cadastrar na consulta automatizada de novas demandas? (...) [CADASTRO]
- Informacoes Adicionais [CADASTRO]

## 7.7 Pos-venda - financeiro

- STATUS [FINANCEIRO]
- ID SHAREPOINT [FINANCEIRO]
- Razao Social para Faturamento [FINANCEIRO]
- CPF/CNPJ para Faturamento [FINANCEIRO]
- Inicio da Vigencia do Contrato [FINANCEIRO]
- Primeiro Faturamento [FINANCEIRO]
- Responsavel Financeiro do Cliente [FINANCEIRO]
- Posicao do Responsavel (...) [FINANCEIRO]
- E-mail Responsavel Financeiro do Cliente [FINANCEIRO]
- Telefone Responsavel Financeiro do Cliente [FINANCEIRO]
- Repasse acordado % [FINANCEIRO]
- RATEIO - VALOR R$ (Reestruturacao e Insolvencia) - [FINANCEIRO]
- RATEIO - VALOR R$ (Civel) - [FINANCEIRO]
- RATEIO - VALOR R$ (Trabalhista) - [FINANCEIRO]
- RATEIO - VALOR R$ (Tributario) - [FINANCEIRO]
- RATEIO - VALOR R$ (Contratos / Societario) - [FINANCEIRO]
- RATEIO - VALOR R$ (ADD) - [FINANCEIRO]
- Indice de Reajuste - [FINANCEIRO]
- Periodicidade do Reajuste - [FINANCEIRO]
- Observacoes - [FINANCEIRO]

---

## 8) Validacoes atuais relevantes

## 8.1 Cadastro lead

- e-mails com regex;
- nome de solicitante validado contra lista fechada de nomes;
- due = Sim exige prazo/horario;
- tipo de lead = Indicacao exige `indicacao` + `nome_indicacao`;
- local da reuniao obrigatorio;
- CNPJ/CPF tratado com flexibilidade em parte dos fluxos (ha locais que validam mascara e locais que aliviam essa regra).

## 8.2 Proposta e contrato

- proposta enviada exige link de proposta;
- contrato elaborado/assinado exige link de contrato;
- validacao de links para dominios oficiais (sharepoint/vios);
- campos monetarios [CC] esperados como numericos;
- campos de percentual de rateio em formato percentual.

## 8.3 Pos-venda

- uso de status de automacao (`STATUS [CADASTRO]`, `STATUS [FINANCEIRO]`);
- pre-condicao para avancar ao financeiro depende de cadastro concluido.

---

## 9) Exemplo concreto de deal RD (amostra real)

Arquivo base:
- `rd-deal-68924d7526c1f50018dc039b.json`

Indicacoes encontradas:
- stage: `Inclusao no fluxo de faturamento`;
- pipeline: `Cliente Ativo`;
- possui grande conjunto de `deal_custom_fields` com labels de Vendas, Contrato, Cadastro e Financeiro;
- exemplo mostra `Tipo de Instrumento [CC] = Aditivo`.

Conclusao pratica:
- o proprio RD ja carrega semantica para aditivo, mas sem modelo nativo relacional de "cliente -> contratos -> aditivos" no projeto atual.

---

## 10) Gaps e dores identificadas (as-is)

- campo aberto de indicacao gera baixa qualidade cadastral;
- ausencia de cadastro unico de cliente causa repreenchimento;
- aditivos/novos contratos comecam do zero operacionalmente;
- dependencia de labels textuais para mapear campos aumenta fragilidade;
- dependencia de RD para movimentacoes-chave;
- parte do processo persiste em planilha e nao em dominio transacional unico.

---

## 11) Especificacao funcional inicial para o novo CRM (proposta objetiva)

## 11.1 Entidades minimas

- Cliente (fonte VIOS + consolidacao interna)
- Contato de cliente
- Indicador/Consultor
- Oportunidade
- Contrato
- Aditivo
- Pipeline
- Stage
- Definicao de campo (tipo, obrigatoriedade, condicao)
- Valor de campo por registro
- Historico de transicao

## 11.2 Fluxo de indicador pre-aprovado (nao bloqueante)

1. Solicitante informa nome livre no cadastro.
2. Sistema tenta casar com indicador existente.
3. Se nao casar:
   - cria registro `pendente_aprovacao`;
   - vincula provisoriamente ao lead;
   - nao bloqueia envio do cadastro.
4. Admin recebe fila de aprovacao:
   - aprovar como novo;
   - associar a existente (merge);
   - corrigir nome padrao.
5. Apos aprovacao, novas oportunidades usam valor padronizado.

## 11.3 Fluxo de abertura de demanda

No inicio do cadastro:
- escolher `novo_lead | novo_contrato | aditivo`.

Se `novo_contrato` ou `aditivo`:
- obrigar selecao de cliente existente (base VIOS + base interna sincronizada);
- herdar dados basicos do cliente automaticamente;
- evitar repreenchimento de campos repetidos.

## 11.4 Regra condicional de due diligence

- se `havera_due_diligence = Sim`, abrir caminho:
  - Levantamento -> Compilacao -> Revisao -> Due finalizada -> Reuniao...
- se `Nao`, iniciar direto em Reuniao (ou etapa definida como entrada sem due).

## 11.5 Macrofluxo de abertura (novo lead x contrato x aditivo)

- `novo_lead`: segue fluxo comercial padrao.
- `novo_contrato`: exige selecao de cliente existente e reaproveita base cadastral.
- `aditivo`: exige cliente + contrato base e reaproveita dados para evitar repreenchimento.

---

## 12) Migracao de dados - checklist de levantamento

- extrair todos os deals RD com campos customizados;
- extrair historico de etapas e atualizacoes relevantes;
- mapear deduplicacao de cliente por CNPJ/CPF + razao social;
- consolidar contratos e aditivos por cliente;
- preservar status de cadastro/financeiro e datas chave;
- guardar referencia cruzada `rd_deal_id -> novo_id`.

---

## 13) Fontes tecnicas utilizadas neste levantamento

- `README.md`
- `docs/processo-crm-para-ia.md`
- `src/data/salesFunnel.ts`
- `src/data/postFunnel.ts`
- `src/components/funnel/LeadForm.tsx`
- `api/validar-sheets.js`
- `docs/n8n-rd-mapeamento-robusto.js`
- `scripts/n8n-validacao-etapas.js`
- `api/auditar-etapa1-rd-sheets.js`
- `api/sync-financeiro-rd.js`
- `api/relatorio-posvenda-etapas.js`
- `scripts/check-etapa1-lead-local.js`
- `rd-deal-68924d7526c1f50018dc039b.json`

---

## 14) Proximo passo recomendado (antes de construir no outro projeto)

Gerar um "Dicionario de Dados Canonico v1" (csv/json) com:

- `codigo_campo`
- `label_exibicao`
- `entidade`
- `tipo`
- `obrigatorio`
- `condicao`
- `origem_atual (RD/planilha/manual)`
- `mantem/remove/substitui`
- `observacao_migracao`

Isso vira a base oficial para gerar telas, validacoes e migracao sem ambiguidade.
