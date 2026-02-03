# Mapeamento: Colunas da Planilha → Campos de Validação

Este documento descreve **como está hoje**: qual nome de coluna na planilha alimenta qual campo de validação.

## Como funciona

1. **Cabeçalho da planilha** (ex.: `E-mail do Solicitante`, `areas_cp`) é **normalizado**: minúsculas, sem acentos, espaços viram `_`, só letras/números/`_`.  
   Ex.: `E-mail do Solicitante` → `email_do_solicitante`, `Haverá Due Diligence?` → `havera_due_diligence`.

2. O **mapeamento** (`COLUMN_TO_KEY` na API) associa esse nome normalizado a uma **chave de validação** (ex.: `email`, `due_diligence`, `areas_objeto_contrato_cp`).

3. A **validação** usa só a chave. Várias colunas podem mapear para a mesma chave (a primeira com valor preenchido “ganha”).

---

## Cadastro do Lead (todas as etapas do Funil de vendas)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **solicitante** | `solicitante` |
| **email** | `email`, `email_solicitante`, `e_mail_do_solicitante`, `email_do_solicitante` |
| **cadastrado_por** | `cadastrado_por`, `cadastro_realizado_por`, `cadastro_realizado_por_email` |
| **due_diligence** | `due_diligence`, `havera_due_diligence` |
| **local_reuniao** | `local_reuniao`, `local_da_reuniao` |
| **tipo_de_lead** | `tipo_de_lead`, `tipo_lead`, `tipo_do_lead` |
| **razao_social** | `razao_social`, `razao_social_nome_completo`, `razao_social_completa` |
| **cnpj** | `cnpj`, `cnpj_cpf` |
| **areas_analise** | `areas_analise` — *não considerado mais na validação* |
| **prazo_reuniao_due** | `prazo_reuniao_due`, `prazo_de_entrega_da_due`, `prazo_entrega_data` — aceita "A definir" |
| **horario_due** | `horario_due`, `horario_de_entrega_da_due`, `prazo_entrega_hora` |
| **indicacao** | `indicacao` |
| **nome_indicacao** | `nome_indicacao`, `nome_da_indicacao` |
| **data_reuniao** | `data_reuniao`, `data_da_reuniao` — *opcional; não validado* |
| **horario_reuniao** | `horario_reuniao`, `horario_da_reuniao` — *opcional; não validado* |

---

## Confecção de Proposta [CP] (etapa Confecção de Proposta)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **razao_social_cp** | `razao_social_cp`, `razao_social_cp_cp`, `razao_social_financeiro` |
| **cnpj_cp** | `cnpj_cp`, `cnpj_cp_cp`, `cpf_cnpj_financeiro` |
| **qualificacao_completa** | `qualificacao_completa`, `qualificacao_completa_endereco_cep` |
| **areas_objeto_contrato_cp** | `areas_objeto_do_contrato_cp`, `areas_objeto_contrato_cp`, `areas_objeto_contrato`, **`areas_cp`** |
| **realizou_due_diligence** | `realizou_due_diligence`, `realizou_due_diligence_cp` |
| **gestor_contrato_cp** | `gestor_do_contrato_cp`, `gestor_contrato_cp`, `gestor_do_contrato`, **`gestor_contrato`** |
| **nome_ponto_focal** | `nome_do_ponto_focal_comercial_cp`, `nome_do_ponto_focal`, `nome_ponto_focal`, `ponto_focal_comercial` |
| **email_ponto_focal** | `email_do_ponto_focal_comercial_cp`, `e_mail_do_ponto_focal_comercial_cp`, `email_do_ponto_focal`, `email_ponto_focal` |
| **telefone_ponto_focal** | `telefone_do_ponto_focal_comercial_cp`, `telefone_do_ponto_focal`, `telefone_ponto_focal` |
| **captador_cp** | `captador_cp`, `captador` |
| **tributacao_cp** | `tributacao_cp`, `tributacao` |
| **prazo_entrega_cp** | `prazo_para_entrega_cp`, `prazo_entrega_cp`, `prazo_para_entrega` |
| **data_primeiro_vencimento_cp** | `data_do_primeiro_vencimento_cp`, `data_primeiro_vencimento_cp`, `data_do_primeiro_vencimento`, **`data_primeiro_vencimento`** |
| **informacoes_adicionais_cp** | `informacoes_adicionais_cp`, `informacoes_adicionais` |
| **demais_razoes_sociais_cp** | `demais_razoes_sociais_cp`, `demais_razoes_sociais` |
| **link_da_proposta** | *Obrigatório apenas na etapa "Proposta enviada"* — `link_da_proposta`, `link_proposta` |

---

## Proposta Enviada (etapa Proposta Enviada)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **link_da_proposta** | `link_da_proposta`, `link_proposta` — obrigatório apenas nesta etapa |

---

## Confecção de Contrato [CC] (etapa Confecção de Contrato)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **tipo_pagamento_cc** | `tipo_de_pagamento_cc`, `tipo_pagamento_cc`, `tipo_pagamento` |
| **objeto_contrato_cc** | `objeto_do_contrato_cc`, `objeto_contrato_cc`, `escopo_contratual_cadastro` |
| **valores_cc** (grupo) | Valores R$: `mensal_fixo_financeiro`, `mensal_preco_fechado_financeiro`, `mensal_escalonado_financeiro`, `mensal_variavel_financeiro`, `mensal_condicionado_financeiro`, `spot_financeiro`, `spot_manutencao_financeiro`, `spot_parcelado_financeiro`, `spot_parcelado_manutencao_financeiro`, `spot_condicionado_financeiro`, `exito_financeiro` (e equivalentes com sufixo `_valor_r_cc` / `_valor_cc`) |
| **rateio_cc** (grupo) | Rateio %: `rateio_porcentagem_insolvencia_financeiro`, `rateio_porcentagem_civel_financeiro`, `rateio_porcentagem_trabalhista_financeiro`, `rateio_porcentagem_tributario_financeiro`, `rateio_porcentagem_contratos_financeiro`, `rateio_porcentagem_add_financeiro` (e equivalentes com sufixo `_cc`) |
| **prazo_contrato_cc** | `prazo_para_confecao_do_contrato_cc`, `prazo_confecao_contrato_cc`, `prazo_contrato_cc`, `prazo_entrega_contrato` |
| **link_do_contrato** | `link_do_contrato`, `link_contrato` |

Campos adicionais do manual (mapeados na API; validação opcional): `tipo_instrumento_cc`, `limitacao_processos_cc`, `limitacao_horas_cc`, `responsavel_elaboracao_cc` — ver seção "O que ainda falta mapear".

---

## Contrato Elaborado [CE] (etapa Contrato Elaborado)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **link_do_contrato** | `link_do_contrato`, `link_contrato` (mesmo que CC) |
| **responsavel_elaboracao_cc** | `responsavel_elaboracao_cc`, `responsavel_elaboracao`, `responsavel_pela_elaboracao` — *mapeado na API; validação em CE não implementada* |

---

## Contrato Assinado [CA] (etapa Contrato Assinado)

| Campo de validação (chave) | Colunas na planilha que alimentam este campo |
|----------------------------|-----------------------------------------------|
| **data_assinatura_contrato** | `data_assinatura_contrato`, `data_assinatura`, `data_de_assinatura_do_contrato` — *mapeado na API; validação na etapa Contrato Assinado não implementada* |

---

## Outras colunas (identificação / SLA, não ligadas a checkboxes)

- **stage_name** / **nome_lead** / **deal_id** / **status** / **funil** / **email_notificar** / **telefone_notificar** / **created_at** / **updated_at**  
  São usadas para identificar a linha, filtrar etapas e calcular SLA; o mapeamento está em `COLUMN_TO_KEY` na API (arquivo `api/validar-sheets.js`).

---

## O que ainda falta mapear (manual vs. código)

Campos presentes no manual de etapas (`ETAPAS-DE-VENDAS-REFERENCIA.md`) que ainda **não** têm coluna → chave na API (ou não têm validação por etapa):

| Etapa | Campo no manual | Chave sugerida | Situação |
|-------|-----------------|---------------|----------|
| **Cadastro do Lead** | Data da Reunião, Horário da Reunião | `data_reuniao`, `horario_reuniao` | Já mapeados na API; opcionais, não validados |
| **Due Finalizada (5)** | Data da Reunião, Horário, Local | `data_reuniao`, `horario_reuniao`, `local_reuniao` | Mesmos keys do cadastro; validação por etapa 5 não implementada |
| **Confecção de Contrato (9)** | Tipo de Instrumento [CC] (Contrato, Aditivo, Acordo) | `tipo_instrumento_cc` | Mapeado na API; validação em CC opcional |
| **Confecção de Contrato (9)** | Limitação de processos e valor adicional por processo [CC] | `limitacao_processos_cc` | Mapeado na API; validação em CC opcional |
| **Confecção de Contrato (9)** | Limitação de horas (Consultivo) [CC] | `limitacao_horas_cc` | Mapeado na API; validação em CC opcional |
| **Confecção de Contrato (9)** / **Contrato Elaborado (10)** | Responsável pela Elaboração | `responsavel_elaboracao_cc` | Mapeado na API; validação em CC/CE opcional |
| **Contrato Assinado (12)** | Data de assinatura do contrato [CA] | `data_assinatura_contrato` | Mapeado na API; validação na etapa CA não implementada |

**Resumo do que ainda falta (apenas validação, se quiser alinhar 100% ao manual):**

1. **API `COLUMN_TO_KEY`:** já inclui `tipo_instrumento_cc`, `limitacao_processos_cc`, `limitacao_horas_cc`, `responsavel_elaboracao_cc` e variantes.
2. **Validação:** opcionalmente validar esses campos na etapa Confecção de Contrato; validar `data_assinatura_contrato` na etapa Contrato Assinado; validar Data/Horário/Local na etapa Due Finalizada.

---

## Payload N8N / CRM (variáveis do script)

Quando os dados vêm do CRM via N8N, o objeto usa as **variáveis** do script (ex.: `prazo_entrega_data`, `link_contrato`, `areas_cp`). Todas essas variáveis estão em `COLUMN_TO_KEY` mapeando para a chave de validação correspondente. Referência completa: **`docs/N8N-CRM-CAMPOS-VARIAVEIS.md`** (Label do CRM → variável → chave API).

---

## Onde está no código

- **Mapeamento coluna → chave:** `api/validar-sheets.js` → `COLUMN_TO_KEY` e `normalizeHeader()`.
- **Quais campos validar (ligar/desligar):** `DEFAULT_VALIDATION_CONFIG` no mesmo arquivo; na tela “Configuração de validação” você ativa/desativa por chave e por etapa.
- **Configurar qual coluna é cada variável:** na tela de Validações, use a seção "Configurar qual coluna é cada variável (mapeamento manual)" para definir coluna da planilha → campo de validação. Os overrides são enviados como `columnOverrides` no body da validação.
- **Incluir nova coluna da planilha:** editar `COLUMN_TO_KEY` em `api/validar-sheets.js`, ou usar o mapeamento manual no frontend.

Se quiser uma **aba na interface** para configurar mapeamentos manualmente (ex.: “coluna X da minha planilha → campo Y”), isso pode ser feito enviando um objeto de override no body da validação; o doc pode ser ampliado com esse fluxo.
