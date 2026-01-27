# Referência completa – Etapas do Funil de Vendas

Documento com todas as informações para preencher/implementar o campo **etapa de vendas** em sistemas externos (CRM, formulários, integrações).

---

## 1. Estrutura de dados (tipos)

### Step (Etapa)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | sim | Identificador único da etapa (ex: `cadastro-lead`, `reuniao`) |
| `number` | number | sim | Ordem da etapa no funil (1, 2, 3…) |
| `name` | string | sim | Nome exibido da etapa |
| `subtitle` | string | sim | Subtítulo/descrição curta |
| `description` | string | sim | Descrição detalhada da etapa |
| `fields` | Field[] | não | Lista de campos a preencher (quando há formulário) |
| `checklist` | ChecklistItem[] | não | Itens de verificação |
| `exitCriteria` | string | não | Critério para sair da etapa |
| `alerts` | string[] | não | Avisos/regras importantes |
| `nextSteps` | string[] | não | Próximos passos possíveis |

### Field (Campo)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | sim | Nome do campo (label) |
| `instruction` | string | sim | Como preencher / regra de negócio |
| `example` | string | sim | Exemplo de valor válido |
| `required` | boolean | não | Se é obrigatório (default: false) |
| `tag` | string | não | Tag da etapa: `CP` \| `CC` \| `CE` \| `CA` \| `CADASTRO` \| `FINANCEIRO` |

### ChecklistItem
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `text` | string | sim | Texto do item |
| `required` | boolean | não | Se é obrigatório |

### Tags por contexto
- **CP** = Confecção de Proposta  
- **CC** = Confecção de Contrato  
- **CE** = Contrato Elaborado  
- **CA** = Contrato Assinado  
- **CADASTRO** = Etapas de cadastro (pós-venda)  
- **FINANCEIRO** = Etapas financeiras (pós-venda)

---

## 2. Lista de etapas do funil de vendas (IDs e ordem)

| Nº | id | name |
|----|-----|------|
| 1 | `cadastro-lead` | Cadastro do Lead |
| 2 | `lev-dados` | Levantamento de Dados (ADD) |
| 3 | `compilacao` | Compilação (MKT/COM.) |
| 4 | `revisao` | Revisão (ADD) |
| 5 | `due-finalizada` | Due Diligence Finalizada (SOLICITANTE) |
| 6 | `reuniao` | Reunião (SOLICITANTE) |
| 7 | `conf-proposta` | Confecção de Proposta (SOLICITANTE) |
| 8 | `proposta-enviada` | Proposta Enviada (AGUARDA CLIENTE) |
| 9 | `conf-contrato` | Confecção de Contrato (CONTRATOS) |
| 10 | `contrato-elaborado` | Contrato Elaborado (SOLICITANTE) |
| 11 | `contrato-enviado` | Contrato Enviado (SOLICITANTE) |
| 12 | `contrato-assinado` | Contrato Assinado (SOLICITANTE) |

---

## 3. Detalhes por etapa (campos, instruções, exemplos)

### Etapa 1 – Cadastro do Lead (`cadastro-lead`)

**Descrição:** Primeira etapa do funil: registro completo dos dados do lead no sistema. Este cadastro inicial é fundamental para dar início ao processo comercial e ativar as automações necessárias.

**Critério de saída:** Todos os campos obrigatórios preenchidos corretamente → Lead cadastrado no sistema → Dispara automação para próxima etapa do funil.

#### Campos

| Nome do campo | Instrução | Exemplo | Obrigatório |
|---------------|-----------|---------|-------------|
| Solicitante * | Nome completo da pessoa que está solicitando o serviço. Use nome completo (primeiro e último nome). | João Silva | sim |
| E-mail do Solicitante * | E-mail corporativo válido do solicitante. Deve ser um e-mail profissional/empresarial, não pessoal. | joao.silva@empresa.com | sim |
| Cadastro realizado por (e-mail) * | E-mail do colaborador do escritório que está realizando este cadastro. Usado para rastreabilidade e auditoria. | maria.santos@bismarchipires.com.br | sim |
| Haverá Due Diligence? * | Selecione "Sim" se será necessário realizar uma Due Diligence (análise prévia) ou "Não" se o lead seguirá direto para reunião. Se Sim, campos adicionais aparecerão. | Sim | sim |
| Prazo de Entrega da Due | Data limite para entrega da Due Diligence. Formato: DD/MM/AAAA. Preencher APENAS se "Haverá Due Diligence?" = Sim. | 15/06/2025 | não* |
| Horário de Entrega da Due | Horário limite para entrega da Due Diligence. Formato 24h (HH:MM). Preencher APENAS se "Haverá Due Diligence?" = Sim. | 14:30 | não* |
| Razão Social / Nome Completo * | Nome jurídico da empresa (PJ) ou nome completo da pessoa física (PF). Pode adicionar múltiplas razões sociais clicando no botão "Adicionar". Para empresas, usar sempre em CAIXA ALTA. | ALFA SOLUÇÕES LTDA | sim |
| CNPJ/CPF * | Documento de identificação: CNPJ para pessoa jurídica ou CPF para pessoa física. Formato da Receita Federal (XX.XXX.XXX/XXXX-XX para CNPJ ou XXX.XXX.XXX-XX para CPF). Pode adicionar múltiplos documentos. | 12.345.678/0001-90 | sim |
| Áreas Envolvidas * | Selecione todas as áreas do escritório que estarão envolvidas neste caso. Opções: Cível, Reestruturação, Tributário, Trabalhista, Distressed Deals, Societário e Contratos. Múltipla escolha. | Cível; Trabalhista; Tributário | sim |
| Local da Reunião * | Local onde será realizada a reunião inicial. Pode ser: endereço físico completo, link de reunião online (Teams, Zoom, etc.) ou "A definir" se ainda não foi agendado. | Teams / Sede SP - Rua X, 120 | sim |
| Data da Reunião | Data agendada para a reunião inicial. Formato: DD/MM/AAAA. Se ainda não foi agendada, deixar em branco ou preencher "A definir". | 05/05/2025 | não |
| Horário da Reunião | Horário agendado para a reunião inicial. Formato 24h (HH:MM). Se ainda não foi agendado, deixar em branco ou preencher "A definir". | 14:30 | não |
| Tipo de Lead * | Classificação da origem do lead. Opções: Indicação, Lead Ativa, Lead Digital, Lead Passiva. | Indicação | sim |
| Indicação | Categoria de quem indicou o lead. Preencher APENAS se "Tipo de Lead" = Indicação. Opções: Fundo, Consultor, Cliente, Contador, Sindicatos, Conselhos profissionais, Colaborador, Outros parceiros. | Consultor | não* |
| Nome da Indicação | Nome completo ou razão social de quem fez a indicação. Preencher APENAS se "Tipo de Lead" = Indicação. | Carlos Mendes | não* |

\* Condicional: obrigatório quando o campo relacionado tiver valor que exige o preenchimento.

#### Regras condicionais – Cadastro do Lead

1. **Se "Haverá Due Diligence?" = Sim**  
   - "Prazo de Entrega da Due" e "Horário de Entrega da Due" tornam-se obrigatórios.

2. **Se "Tipo de Lead" = Indicação**  
   - "Indicação" e "Nome da Indicação" tornam-se obrigatórios.

#### Opções de seleção – Cadastro do Lead

- **Haverá Due Diligence?:** `Sim` | `Não`
- **Tipo de Lead:** `Indicação` | `Lead Ativa` | `Lead Digital` | `Lead Passiva`
- **Indicação (quando Tipo = Indicação):** `Fundo` | `Consultor` | `Cliente` | `Contador` | `Sindicatos` | `Conselhos profissionais` | `Colaborador` | `Outros parceiros`
- **Áreas Envolvidas (múltipla):** `Cível` | `Reestruturação` | `Tributário` | `Trabalhista` | `Distressed Deals` | `Societário e Contratos`

#### Checklist – Cadastro do Lead

- Todos os campos obrigatórios preenchidos  
- E-mails válidos e corporativos  
- CNPJ/CPF no formato correto da Receita Federal  
- Razão Social em CAIXA ALTA (se PJ)  
- Campos condicionais preenchidos conforme seleção  

#### Alerts – Cadastro do Lead

- Se "Haverá Due Diligence?" = Sim, os campos "Prazo de Entrega da Due" e "Horário de Entrega da Due" se tornam obrigatórios.  
- Se "Tipo de Lead" = Indicação, os campos "Indicação" e "Nome da Indicação" se tornam obrigatórios automaticamente.  
- É possível adicionar múltiplas Razões Sociais/CNPJs.  
- Após o preenchimento, o lead é automaticamente enviado para o sistema via webhook e inicia o processo no CRM.  

#### Mapeamento para webhook (payload cadastro)

Chaves usadas no envio para o webhook de cadastro de lead:

| Campo no formulário | Chave no JSON |
|---------------------|----------------|
| Solicitante | `solicitante` |
| E-mail do Solicitante | `email` |
| Cadastro realizado por (e-mail) | `cadastrado_por` |
| Haverá Due Diligence? | `due_diligence` |
| Prazo de Entrega da Due | `prazo_reuniao_due` (enviado em DD/MM/AAAA ou "A definir") |
| Horário de Entrega da Due | `horario_due` ("A definir" se vazio) |
| Razão Social / Nome Completo + CNPJ/CPF | `razao_social_cnpj` (array de `{ razao_social, cnpj }`) |
| Áreas Envolvidas | `areas_analise` (array de strings) |
| Local da Reunião | `local_reuniao` |
| Data da Reunião | `data_reuniao` ("A definir" se vazio) |
| Horário da Reunião | `horario_reuniao` ("A definir" se vazio) |
| Tipo de Lead | `tipo_de_lead` |
| Indicação | `indicacao` |
| Nome da Indicação | `nome_indicacao` |
| — | `timestamp` (ISO/local pt-BR) |
| — | `origem` (ex: "Bismarchi | Pires - Manual CRM") |
| — | `id` (ex: timestamp em string) |

---

### Etapa 2 – Levantamento de Dados (ADD) (`lev-dados`)

**Descrição:** Coleta inicial coordenada para análise de viabilidade.

**Critério de saída:** Todas as áreas entregaram insumos → mover para Compilação.

**Checklist:**

- Pasta solicitada no VIOS  
- Subpasta criada (Due Diligence)  
- Áreas notificadas  
- Pendências registradas (ou N/A)  

Sem campos de formulário; só checklist.

---

### Etapa 3 – Compilação (MKT/COM.) (`compilacao`)

**Descrição:** Organização dos materiais em template padronizado.

**Critério de saída:** Documento único consolidado → mover para Revisão.

**Checklist:**

- Template oficial aplicado  
- Versão com data (YYYY-MM-DD)  
- Pendências listadas (ou N/A)  
- Fontes identificadas por área  

Sem campos de formulário.

---

### Etapa 4 – Revisão (ADD) (`revisao`)

**Descrição:** Verificação de completude, coerência e formatação.

**Critério de saída:** Ajustes finalizados → Due Finalizada.

**Checklist:**

- Sem campos críticos em branco  
- Padronização de CAIXA ALTA onde aplicável  
- Links funcionais  
- Pendências claras  

**Alert:** Inconsistências? Retornar para Compilação com comentário.

Sem campos de formulário.

---

### Etapa 5 – Due Diligence Finalizada (SOLICITANTE) (`due-finalizada`)

**Descrição:** Após a finalização da Due Diligence, o solicitante é responsável por agendar e definir os detalhes da reunião.

#### Campos

| Nome do campo | Instrução | Exemplo | Obrigatório |
|---------------|-----------|---------|-------------|
| Data da Reunião | DD/MM/AAAA | 05/05/2025 | sim |
| Horário | Formato 24h | 14:30 | sim |
| Local | Endereço, link ou "A definir" | Teams / Sede SP | sim |

---

### Etapa 6 – Reunião (SOLICITANTE) (`reuniao`)

**Descrição:** Registro do encontro para definir continuidade. Responsabilidade do solicitante em conduzir a reunião e coletar as informações necessárias. Após a reunião, os dados coletados devem ser registrados na próxima etapa "Confecção de Proposta".

Sem campos de formulário na etapa; os dados são preenchidos na etapa "Confecção de Proposta".

---

### Etapa 7 – Confecção de Proposta (SOLICITANTE) (`conf-proposta`)

**Descrição:** Consolidação de dados para envio formal. Responsabilidade do solicitante em preparar e enviar a proposta. Todos os campos abaixo são obrigatórios para avançar da etapa "Reunião" para esta etapa. Estes dados devem ser coletados durante ou após a reunião.

**Tag dos campos:** CP (Confecção de Proposta).

#### Campos

| Nome do campo | Instrução | Exemplo | Obrigatório | Tag |
|---------------|-----------|---------|-------------|-----|
| Razão Social [CP] | MAIÚSCULO. Nome jurídico oficial da empresa/pessoa física conforme acordado na reunião. | ALFA SOLUÇÕES LTDA | sim | CP |
| CNPJ [CP] | CNPJ ou CPF no formato da Receita Federal. Coletado durante a reunião. | 12.345.678/0001-90 | sim | CP |
| Qualificação completa (endereço, CEP, endereço eletrônico etc.) [CP] | Endereço completo da empresa/pessoa física: logradouro, número, complemento, bairro, cidade, estado, CEP e e-mail corporativo. Todos os dados devem estar completos e atualizados conforme coletado na reunião. | Rua das Flores, 123 - Sala 45 - Centro - São Paulo/SP - CEP: 01234-567 \| contato@empresa.com.br | sim | CP |
| Áreas Objeto do contrato [CP] | Selecione todas as áreas do escritório que serão objeto do contrato conforme acordado na reunião. Múltipla escolha. Opções: Cível, Reestruturação, Tributário, Trabalhista, Distressed Deals, Societário, Contratos, Trabalhista Consultivo, etc. | Trabalhista Consultivo; Cível; Tributário | sim | CP |
| Realizou Due Diligence? [CP] | Selecione "Sim" se foi realizada uma Due Diligence prévia ou "Não" se não houve Due Diligence. Informação coletada durante a reunião. | Sim | sim | CP |
| Gestor do Contrato [CP] | Nome completo do colaborador interno do escritório que será o gestor responsável por este contrato. Definido durante a reunião. | João Silva Santos | sim | CP |
| Nome do ponto focal / Comercial [CP] | Nome completo da pessoa que será o contato principal/comercial do cliente para este contrato. Coletado durante a reunião. | Maria Costa Silva | sim | CP |
| E-mail do ponto focal / Comercial [CP] | E-mail corporativo válido do ponto focal/comercial. Coletado durante a reunião. | maria.costa@cliente.com.br | sim | CP |
| Telefone do ponto focal / Comercial [CP] | Telefone de contato. Formato: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX. Coletado durante a reunião. | (11) 9-1234-5678 | sim | CP |
| Captador [CP] | Nome completo ou identificação do colaborador que captou/originou este lead. | Leonardo M. Oliveira | sim | CP |
| Tributação [CP] | Regime tributário e base de preço acordada. Opções: "Líquido/Englobando Tributos" ou "Bruto/Sem Tributos". | Líquido/Englobando Tributos | sim | CP |
| Prazo para entrega (mínimo de 2 dias úteis - sinalizar exceções e motivos) [CP] | Prazo acordado para entrega da proposta. Mínimo de 2 dias úteis. Se exceção, informar motivo. Formato: DD/MM/AAAA. | 20/06/2025 | sim | CP |
| Data do primeiro vencimento [CP] | Data definida na negociação para o primeiro vencimento/faturamento. Formato: DD/MM/AAAA. | 15/07/2025 | sim | CP |
| Informações adicionais [CP] | Qualquer informação adicional relevante. Se não houver, "N/A". | Prioridade reestruturação. Cliente solicita início imediato após assinatura. | sim | CP |
| Demais Razões Sociais [CP] | Demais razões sociais envolvidas no contrato, separadas por ";". Se apenas uma, "N/A" ou em branco. | ALFA HOLDING S.A.; ALFA INVEST LTDA | sim | CP |
| Link da Proposta | Link ou caminho para a pasta onde a proposta está armazenada. | https://sharepoint/.../proposta.pdf | sim | — |

**Alerts:**

- Todos os campos acima são obrigatórios para avançar da etapa "Reunião" para "Confecção de Proposta".  
- Os dados devem ser coletados durante ou após a reunião e registrados nesta etapa.  
- O prazo para entrega deve ser de no mínimo 2 dias úteis. Exceções devem ser justificadas com motivo.  
- "Áreas Objeto do contrato" permite seleção múltipla.  
- "Data do primeiro vencimento" deve ser selecionada via calendário.  
- "Tributação" possui opções pré-definidas.  

---

### Etapa 8 – Proposta Enviada (AGUARDA CLIENTE) (`proposta-enviada`)

**Descrição:** Aguardando aceite ou recusa do cliente. O solicitante deve acompanhar a resposta.

**Próximos passos:**

- Aceite → Confecção de Contrato  
- Recusa → Perda (registrar motivo)  

Sem campos de formulário.

---

### Etapa 9 – Confecção de Contrato (CONTRATOS) (`conf-contrato`)

**Descrição:** Elaboração do documento contratual. Responsabilidade da equipe de Contratos. Todos os campos abaixo são obrigatórios para avançar da etapa "Proposta Enviada" para esta etapa. Após a confecção, a responsabilidade retorna ao solicitante na etapa "Contrato Elaborado".

**Tag dos campos:** CC (Confecção de Contrato).

#### Campos (resumo – nomes e instruções principais)

| Nome do campo | Instrução resumida | Exemplo | Obrigatório | Tag |
|---------------|--------------------|---------|-------------|-----|
| Tipo de Instrumento [CC] | Contrato, Aditivo ou Acordo/Confissão | Contrato | sim | CC |
| Limitação de processos e valor adicional por processo [CC] | Regra de limitação e valor por processo excedente. Se não houver: "N/A" ou "Sem limitação". | Limitação de 10 processos. Valor adicional: R$ 500,00 por processo excedente. | sim | CC |
| Limitação de horas (Consultivo) [CC] | Horas incluídas e regra para excedentes. Se não houver: "N/A" ou "Sem limitação". | Limitação de 20 horas/mês. Horas excedentes: R$ 300,00/hora. | sim | CC |
| Êxito (Descrever áreas abrangidas e percentuais) [CC] | Áreas e percentuais de êxito. Se não houver: "N/A". | Trabalhista: 20% \| Cível: 15% \| Tributário: 25% | sim | CC |
| Valores (descrever tipo de pagamento, valores e data de vencimento) [CC] | Tipo de pagamento, valores e datas de vencimento. | Mensal - Fixo: R$ 5.000,00 \| Vencimento: Todo dia 15 \| Início: 15/07/2025 | sim | CC |
| Tipo de pagamento [CC] | Mensal (Fixo, Preço Fechado Parcelado, Escalonado, Variável, Condicionado), SPOT (À vista, Parcelado, com Manutenção, Condicionado), Êxito. | Mensal - Fixo | sim | CC |
| Objeto do Contrato [CC] | Descrição clara e completa do objeto do contrato. | Prestação de serviços jurídicos consultivos nas áreas Trabalhista, Cível e Tributária... | sim | CC |
| Mensal – Fixo Valor R$ [CC] | Apenas número. Ex.: 1000 ou 1000.00. Se não aplicar: 0 ou em branco. | 1000.00 | sim | CC |
| Mensal - Preço Fechado Parcelado - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 2500.00 | sim | CC |
| Mensal – Escalonado - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 3000.00 | sim | CC |
| Mensal – Variável - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 1500.00 | sim | CC |
| Mensal – Condicionado - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 4000.00 | sim | CC |
| SPOT - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 10000.00 | sim | CC |
| SPOT com Manutenção - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 12000.00 | sim | CC |
| SPOT – Parcelado - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 15000.00 | sim | CC |
| SPOT - Parcelado com manutenção - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 18000.00 | sim | CC |
| SPOT – Condicionado - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 20000.00 | sim | CC |
| Êxito - Valor R$ [CC] | Apenas número. Se não aplicar: 0 ou em branco. | 0 | sim | CC |
| RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC] | Apenas número + %. Ex.: 50%. Se não aplicar: 0%. | 50% | sim | CC |
| RATEIO - PORCENTAGEM % (Cível) - [CC] | Apenas número + %. Se não aplicar: 0%. | 30% | sim | CC |
| RATEIO - PORCENTAGEM % (Trabalhista) - [CC] | Apenas número + %. Se não aplicar: 0%. | 25% | sim | CC |
| RATEIO - PORCENTAGEM % (Tributário) - [CC] | Apenas número + %. Se não aplicar: 0%. | 20% | sim | CC |
| RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC] | Apenas número + %. Se não aplicar: 0%. | 15% | sim | CC |
| RATEIO - PORCENTAGEM % (ADD) - [CC] | Apenas número + %. Se não aplicar: 0%. | 10% | sim | CC |
| Prazo para Confecção do Contrato [CC] | Data limite. DD/MM/AAAA. | 25/07/2025 | sim | CC |
| Responsável pela Elaboração | Nome completo do colaborador de Contratos que redigiu o contrato. | Leticia S. Rodrigues | sim | CC |
| Link do Contrato | Link ou caminho para o arquivo do contrato. | https://sharepoint/.../contrato.docx | sim | CC |

**Checklist:** Escopo alinha proposta | Rateios conferidos | Sem placeholders | Modelo atualizado.

**Alerts:**

- Todos os campos são obrigatórios para avançar da "Proposta Enviada" para "Confecção de Contrato".  
- Nos campos de VALOR (R$), informar APENAS números.  
- Nos campos de RATEIO (%), informar APENAS número + símbolo % (ex.: 50%).  
- Usar calendário para "Prazo para Confecção do Contrato".  
- Se algum tipo de pagamento ou rateio não se aplicar, preencher com "0" ou "0%".  

---

### Etapa 10 – Contrato Elaborado (SOLICITANTE) (`contrato-elaborado`)

**Descrição:** Documento final pronto para envio. Após a equipe de Contratos elaborar o contrato, a responsabilidade retorna ao solicitante para envio e acompanhamento. Os campos abaixo são obrigatórios e devem ser preenchidos pela equipe de Contratos.

**Tag dos campos:** CE (Contrato Elaborado).

#### Campos

| Nome do campo | Instrução | Exemplo | Obrigatório | Tag |
|---------------|-----------|---------|-------------|-----|
| Link Contrato [CE] | Link ou caminho para o arquivo do contrato elaborado. | https://sharepoint/.../contrato.docx | sim | CE |
| Responsável pela Elaboração [CE] | Nome completo do colaborador de Contratos responsável pela elaboração. | Leticia S. Rodrigues | sim | CE |

---

### Etapa 11 – Contrato Enviado (SOLICITANTE) (`contrato-enviado`)

**Descrição:** Aguardando assinatura do cliente. A negociação permanece nesta etapa até receber o retorno do lead/possível cliente. Responsabilidade do solicitante em acompanhar e aguardar a assinatura.

Sem campos de formulário.

---

### Etapa 12 – Contrato Assinado (SOLICITANTE) (`contrato-assinado`)

**Descrição:** Venda concluída e início do Pós-Venda. Responsabilidade do solicitante em finalizar o processo e iniciar as transições necessárias. Todos os campos abaixo são obrigatórios para avançar da etapa "Contrato Enviado" para esta etapa.

**Tag do campo:** CA (Contrato Assinado).

#### Campos

| Nome do campo | Instrução | Exemplo | Obrigatório | Tag |
|---------------|-----------|---------|-------------|-----|
| Data de assinatura do contrato [CA] | Data efetiva em que o contrato foi assinado pelo cliente. DD/MM/AAAA. | 28/05/2025 | sim | CA |

**Próximos passos:**

- Preencher "Data de assinatura do contrato" → Usar calendário para seleção  
- Clicar na negociação → Acionar botão "Marcar Venda" no canto superior direito do RD Station  
- Duplicação automática para funil de Pós-Venda  
- Acessar funil de Pós-Venda através do filtro de funil  
- Solicitar Cadastro  
- Solicitar Inclusão Financeiro  
- Transição para Onboarding  

**Alerts:**

- Após preencher a data de assinatura, o solicitante deve clicar na negociação e acionar o botão "Marcar Venda" no canto superior direito do RD Station CRM.  
- É OBRIGATÓRIO clicar no botão "Marcar Venda" para que a negociação seja automaticamente duplicada para o funil de Pós-Venda.  
- Após marcar a venda, o sistema cria uma nova oportunidade no funil de Pós-Venda com todos os dados do contrato.  
- Para acessar a negociação no funil de Pós-Venda, o solicitante deve clicar no filtro de funil e selecionar o funil de "Pós-Venda".  

---

## 4. Formatos e convenções

- **Data:** DD/MM/AAAA (ex.: 15/07/2025).  
- **Horário:** 24h, HH:MM (ex.: 14:30).  
- **CNPJ:** XX.XXX.XXX/XXXX-XX.  
- **CPF:** XXX.XXX.XXX-XX.  
- **Razão Social (PJ):** CAIXA ALTA.  
- **Valores monetários em campos numéricos:** apenas número, sem "R$" ou vírgula (ex.: 1000 ou 1000.00).  
- **Porcentagem em rateio:** número + % (ex.: 50%).  
- **Valores "não se aplica":** 0, 0% ou "N/A" conforme o tipo de campo.  
- **"A definir":** usado em data/horário/local quando ainda não definido.

---

## 5. Fluxo entre etapas (resumo)

1. Cadastro do Lead → Levantamento de Dados (ou direto para Reunião se não houver Due).  
2. Levantamento de Dados → Compilação → Revisão → Due Finalizada → Reunião.  
3. Reunião → Confecção de Proposta (campos obrigatórios preenchidos).  
4. Confecção de Proposta → Proposta Enviada.  
5. Proposta Enviada → Confecção de Contrato (aceite) ou Perda (recusa).  
6. Confecção de Contrato → Contrato Elaborado.  
7. Contrato Elaborado → Contrato Enviado.  
8. Contrato Enviado → Contrato Assinado.  
9. Contrato Assinado → Funil de Pós-Venda (via "Marcar Venda" no RD Station).

---

## 6. Arquivo de dados de referência no projeto

- **Tipos:** `src/types/index.ts`  
- **Dados do funil de vendas:** `src/data/salesFunnel.ts`  
- **Formulário de cadastro (Etapa 1):** `src/components/funnel/LeadForm.tsx`  
- **Exibição de etapas/campos:** `src/components/funnel/StepDetail.tsx`  

Este documento foi gerado a partir do código do projeto CRM-BP e pode ser usado como base para configurar o campo de etapa de vendas em outros sistemas.
