# Manual por etapa — campos e instrucoes (fonte do CRM interno)

Este documento lista **cada etapa do funil**, em seguida **cada campo** (quando existir no modelo) e **logo abaixo o manual/instrucao oficial** conforme cadastrado no codigo.

Fonte de verdade:

- Funil de Vendas: `src/data/salesFunnel.ts` (`salesFunnelSteps`)
- Funil de Pos-Venda: `src/data/postFunnel.ts` (`postFunnelSteps`)

Observacao sobre numeracao: no codigo, **"Cadastro do Lead" e a etapa 1**; as etapas seguintes seguem a ordem do array.

---

# Funil de Vendas

## Etapa 1 — Cadastro do Lead (`cadastro-lead`)

**Titulo:** Cadastro do Lead  
**Subtitulo:** Registro inicial do lead

**Descricao da etapa**

> Primeira etapa do funil: registro completo dos dados do lead no sistema. Este cadastro inicial é fundamental para dar início ao processo comercial e ativar as automações necessárias.

**Criterio de saida**

> Todos os campos obrigatórios preenchidos corretamente → Lead cadastrado no sistema → Dispara automação para próxima etapa do funil

**Alertas da etapa**

- Se "Haverá Due Diligence?" = Sim, os campos "Prazo de Entrega da Due" e "Horário de Entrega da Due" se tornam obrigatórios.
- Se "Tipo de Lead" = Indicação, os campos "Indicação" e "Nome da Indicação" se tornam obrigatórios automaticamente.
- É possível adicionar múltiplas Razões Sociais/CNPJs clicando no botão "Adicionar Razão Social/Nome Completo e CNPJ/CPF".
- Após o preenchimento, o lead é automaticamente enviado para o sistema via webhook e inicia o processo no CRM.

**Checklist da etapa**

- Todos os campos obrigatórios preenchidos
- E-mails válidos e corporativos
- CNPJ/CPF no formato correto da Receita Federal
- Razão Social em CAIXA ALTA (se PJ)
- Campos condicionais preenchidos conforme seleção

### Campo: Solicitante *

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo da pessoa que está solicitando o serviço. Use nome completo (primeiro e último nome).

**Exemplo**

> João Silva

---

### Campo: E-mail do Solicitante *

- Obrigatorio no modelo: Sim

**Manual**

> E-mail corporativo válido do solicitante. Deve ser um e-mail profissional/empresarial, não pessoal.

**Exemplo**

> joao.silva@empresa.com

---

### Campo: Cadastro realizado por (e-mail) *

- Obrigatorio no modelo: Sim

**Manual**

> E-mail do colaborador do escritório que está realizando este cadastro. Usado para rastreabilidade e auditoria.

**Exemplo**

> maria.santos@bismarchipires.com.br

---

### Campo: Haverá Due Diligence? *

- Obrigatorio no modelo: Sim

**Manual**

> Selecione "Sim" se será necessário realizar uma Due Diligence (análise prévia) ou "Não" se o lead seguirá direto para reunião. Se Sim, campos adicionais aparecerão.

**Exemplo**

> Sim

---

### Campo: Prazo de Entrega da Due

- Obrigatorio no modelo: Nao (torna-se obrigatorio quando Due = Sim, conforme alertas da etapa)

**Manual**

> Data limite para entrega da Due Diligence. Formato: DD/MM/AAAA. Preencher APENAS se "Haverá Due Diligence?" = Sim.

**Exemplo**

> 15/06/2025

---

### Campo: Horário de Entrega da Due

- Obrigatorio no modelo: Nao (torna-se obrigatorio quando Due = Sim, conforme alertas da etapa)

**Manual**

> Horário limite para entrega da Due Diligence. Formato 24h (HH:MM). Preencher APENAS se "Haverá Due Diligence?" = Sim.

**Exemplo**

> 14:30

---

### Campo: Razão Social / Nome Completo *

- Obrigatorio no modelo: Sim

**Manual**

> Nome jurídico da empresa (PJ) ou nome completo da pessoa física (PF). Pode adicionar múltiplas razões sociais clicando no botão "Adicionar". Para empresas, usar sempre em CAIXA ALTA.

**Exemplo**

> ALFA SOLUÇÕES LTDA

---

### Campo: CNPJ/CPF *

- Obrigatorio no modelo: Sim

**Manual**

> Documento de identificação: CNPJ para pessoa jurídica ou CPF para pessoa física. Formato da Receita Federal (XX.XXX.XXX/XXXX-XX para CNPJ ou XXX.XXX.XXX-XX para CPF). Pode adicionar múltiplos documentos.

**Exemplo**

> 12.345.678/0001-90

---

### Campo: Local da Reunião *

- Obrigatorio no modelo: Sim

**Manual**

> Local onde será realizada a reunião inicial. Pode ser: endereço físico completo, link de reunião online (Teams, Zoom, etc.) ou "A definir" se ainda não foi agendado.

**Exemplo**

> Teams / Sede SP - Rua X, 120

---

### Campo: Data da Reunião

- Obrigatorio no modelo: Nao

**Manual**

> Data agendada para a reunião inicial. Formato: DD/MM/AAAA. Se ainda não foi agendada, deixar em branco ou preencher "A definir".

**Exemplo**

> 05/05/2025

---

### Campo: Horário da Reunião

- Obrigatorio no modelo: Nao

**Manual**

> Horário agendado para a reunião inicial. Formato 24h (HH:MM). Se ainda não foi agendado, deixar em branco ou preencher "A definir".

**Exemplo**

> 14:30

---

### Campo: Tipo de Lead *

- Obrigatorio no modelo: Sim

**Manual**

> Classificação da origem do lead. Opções: Indicação (indicado por alguém), Lead Ativa (prospecção ativa), Lead Digital (captado digitalmente), Lead Passiva (chegou espontaneamente).

**Exemplo**

> Indicação

---

### Campo: Indicação

- Obrigatorio no modelo: Nao (torna-se obrigatorio quando Tipo de Lead = Indicacao, conforme alertas da etapa)

**Manual**

> Categoria de quem indicou o lead. Preencher APENAS se "Tipo de Lead" = Indicação. Opções: Fundo, Consultor, Cliente, Contador, Sindicatos, Conselhos profissionais, Colaborador, Outros parceiros.

**Exemplo**

> Consultor

---

### Campo: Nome da Indicação

- Obrigatorio no modelo: Nao (torna-se obrigatorio quando Tipo de Lead = Indicacao, conforme alertas da etapa)

**Manual**

> Nome completo ou razão social de quem fez a indicação. Preencher APENAS se "Tipo de Lead" = Indicação. Importante para rastreabilidade e relacionamento.

**Exemplo**

> Carlos Mendes

---

### Campo: Áreas de análise *

- Obrigatorio no modelo: Sim

**Manual**

> Selecione todas as áreas do escritório que estarão envolvidas neste caso. Obrigatório pelo menos uma. Múltipla escolha. Opções: Cível, Reestruturação, Tributário, Trabalhista, Distressed Deals, Societário e Contratos.

**Exemplo**

> Cível; Trabalhista; Tributário

---

## Etapa 2 — Levantamento de Dados (ADD) (`lev-dados`)

**Titulo:** Levantamento de Dados (ADD)  
**Subtitulo:** Coleta inicial coordenada

**Descricao da etapa**

> Coleta inicial coordenada para análise de viabilidade

**Criterio de saida**

> Todas as áreas entregaram insumos → mover para Compilação

### Itens de checklist (atuam como “campos operacionais” desta etapa)

#### Checklist: Pasta solicitada no VIOS (obrigatorio)

**Manual**

> Pasta solicitada no VIOS

#### Checklist: Subpasta criada (Due Diligence) (obrigatorio)

**Manual**

> Subpasta criada (Due Diligence)

#### Checklist: Áreas notificadas (obrigatorio)

**Manual**

> Áreas notificadas

#### Checklist: Pendências registradas (ou N/A) (obrigatorio)

**Manual**

> Pendências registradas (ou N/A)

---

## Etapa 3 — Compilação (MKT/COM.) (`compilacao`)

**Titulo:** Compilação (MKT/COM.)  
**Subtitulo:** Organização dos materiais

**Descricao da etapa**

> Organização dos materiais em template padronizado

**Criterio de saida**

> Documento único consolidado → mover para Revisão

### Itens de checklist

#### Checklist: Template oficial aplicado (obrigatorio)

**Manual**

> Template oficial aplicado

#### Checklist: Versão com data (YYYY-MM-DD) (obrigatorio)

**Manual**

> Versão com data (YYYY-MM-DD)

#### Checklist: Pendências listadas (ou N/A) (obrigatorio)

**Manual**

> Pendências listadas (ou N/A)

#### Checklist: Fontes identificadas por área (obrigatorio)

**Manual**

> Fontes identificadas por área

---

## Etapa 4 — Revisão (ADD) (`revisao`)

**Titulo:** Revisão (ADD)  
**Subtitulo:** Verificação de completude

**Descricao da etapa**

> Verificação de completude, coerência e formatação

**Alertas da etapa**

> Inconsistências? Retornar para Compilação com comentário

**Criterio de saida**

> Ajustes finalizados → Due Finalizada

### Itens de checklist

#### Checklist: Sem campos críticos em branco (obrigatorio)

**Manual**

> Sem campos críticos em branco

#### Checklist: Padronização de CAIXA ALTA onde aplicável (obrigatorio)

**Manual**

> Padronização de CAIXA ALTA onde aplicável

#### Checklist: Links funcionais (obrigatorio)

**Manual**

> Links funcionais

#### Checklist: Pendências claras (obrigatorio)

**Manual**

> Pendências claras

---

## Etapa 5 — Due Diligence Finalizada (SOLICITANTE) (`due-finalizada`)

**Titulo:** Due Diligence Finalizada (SOLICITANTE)  
**Subtitulo:** Responsabilidade do solicitante

**Descricao da etapa**

> Após a finalização da Due Diligence, o solicitante é responsável por agendar e definir os detalhes da reunião

### Campo: Data da Reunião

- Obrigatorio no modelo: Sim

**Manual**

> DD/MM/AAAA

**Exemplo**

> 05/05/2025

---

### Campo: Horário

- Obrigatorio no modelo: Sim

**Manual**

> Formato 24h

**Exemplo**

> 14:30

---

### Campo: Local

- Obrigatorio no modelo: Sim

**Manual**

> Endereço, link ou "A definir"

**Exemplo**

> Teams / Sede SP

---

## Etapa 6 — Reunião (SOLICITANTE) (`reuniao`)

**Titulo:** Reunião (SOLICITANTE)  
**Subtitulo:** Registro do encontro

**Descricao da etapa**

> Registro do encontro para definir continuidade. Responsabilidade do solicitante em conduzir a reunião e coletar as informações necessárias. Após a reunião, os dados coletados devem ser registrados na próxima etapa "Confecção de Proposta".

**Campos formais no modelo desta etapa**

> Nenhum (`fields` nao definido no arquivo para esta etapa).

---

## Etapa 7 — Confecção de Proposta (SOLICITANTE) (`conf-proposta`)

**Titulo:** Confecção de Proposta (SOLICITANTE)  
**Subtitulo:** Consolidação de dados

**Descricao da etapa**

> Consolidação de dados para envio formal. Responsabilidade do solicitante em preparar e enviar a proposta. Todos os campos abaixo são obrigatórios para avançar da etapa "Reunião" para esta etapa. Estes dados devem ser coletados durante ou após a reunião.

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Reunião" para "Confecção de Proposta".
- Os dados devem ser coletados durante ou após a reunião e registrados nesta etapa.
- O prazo para entrega deve ser de no mínimo 2 dias úteis. Exceções devem ser justificadas com motivo.
- As "Áreas Objeto do contrato" permitem seleção múltipla - selecione todas que se aplicam.
- A "Data do primeiro vencimento" deve ser selecionada usando o calendário para garantir precisão.
- A "Tributação" possui opções pré-definidas - selecione a que foi acordada na negociação.

### Campo: Razão Social [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> MAIÚSCULO. Nome jurídico oficial da empresa/pessoa física conforme acordado na reunião.

**Exemplo**

> ALFA SOLUÇÕES LTDA

---

### Campo: CNPJ [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> CNPJ ou CPF no formato da Receita Federal. Coletado durante a reunião.

**Exemplo**

> 12.345.678/0001-90

---

### Campo: Qualificação completa (endereço, CEP, endereço eletrônico etc.) [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Endereço completo da empresa/pessoa física: logradouro, número, complemento, bairro, cidade, estado, CEP e e-mail corporativo. Todos os dados devem estar completos e atualizados conforme coletado na reunião.

**Exemplo**

> Rua das Flores, 123 - Sala 45 - Centro - São Paulo/SP - CEP: 01234-567 | contato@empresa.com.br

---

### Campo: Áreas Objeto do contrato [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Selecione todas as áreas do escritório que serão objeto do contrato conforme acordado na reunião. Múltipla escolha - selecione todas que se aplicam. Opções: Cível, Reestruturação, Tributário, Trabalhista, Distressed Deals, Societário, Contratos, Trabalhista Consultivo, etc.

**Exemplo**

> Trabalhista Consultivo; Cível; Tributário

---

### Campo: Realizou Due Diligence? [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Selecione "Sim" se foi realizada uma Due Diligence prévia ou "Não" se não houve Due Diligence. Informação coletada durante a reunião.

**Exemplo**

> Sim

---

### Campo: Gestor do Contrato [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo do colaborador interno do escritório que será o gestor responsável por este contrato. Definido durante a reunião.

**Exemplo**

> João Silva Santos

---

### Campo: Nome do ponto focal / Comercial [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo da pessoa que será o contato principal/comercial do cliente para este contrato. Deve ser o responsável pela comunicação e negociação. Coletado durante a reunião.

**Exemplo**

> Maria Costa Silva

---

### Campo: E-mail do ponto focal / Comercial [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> E-mail corporativo válido do ponto focal/comercial. Deve ser um e-mail profissional/empresarial ativo. Coletado durante a reunião.

**Exemplo**

> maria.costa@cliente.com.br

---

### Campo: Telefone do ponto focal / Comercial [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Telefone de contato do ponto focal/comercial. Formato: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX. Incluir DDD e número completo. Coletado durante a reunião.

**Exemplo**

> (11) 9-1234-5678

---

### Campo: Captador [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo ou identificação do colaborador que captou/originou este lead. Pessoa responsável pela prospecção e captação inicial do cliente.

**Exemplo**

> Leonardo M. Oliveira

---

### Campo: Tributação [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Regime tributário e base de preço acordada na negociação. Opções pré-definidas: "Líquido/Englobando Tributos" ou "Bruto/Sem Tributos". Selecionar a opção que foi acordada na reunião.

**Exemplo**

> Líquido/Englobando Tributos

---

### Campo: Prazo para entrega (mínimo de 2 dias úteis - sinalizar exceções e motivos) [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Prazo acordado para entrega da proposta/primeira entrega conforme negociado na reunião. Mínimo de 2 dias úteis. Se houver exceção (prazo menor que 2 dias), é obrigatório informar o motivo da exceção. Formato: DD/MM/AAAA. Exemplo de exceção: "20/06/2025 - Exceção: Urgência do cliente devido a prazo legal. Motivo: Processo judicial com prazo de resposta em 3 dias."

**Exemplo**

> 20/06/2025

---

### Campo: Data do primeiro vencimento [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Data definida na negociação para o primeiro vencimento/faturamento do contrato. Formato: DD/MM/AAAA. Usar calendário para seleção. Esta data é fundamental para o planejamento financeiro e deve ser acordada na reunião.

**Exemplo**

> 15/07/2025

---

### Campo: Informações adicionais [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Qualquer informação adicional relevante sobre o contrato, contexto especial, prioridades, observações importantes ou detalhes que devem ser considerados na proposta. Coletado durante a reunião. Se não houver informações adicionais, preencher "N/A".

**Exemplo**

> Prioridade reestruturação. Cliente solicita início imediato após assinatura.

---

### Campo: Demais Razões Sociais [CP] (tag: CP)

- Obrigatorio no modelo: Sim

**Manual**

> Lista todas as demais razões sociais envolvidas no contrato conforme identificadas na reunião. Separar múltiplas razões com ponto e vírgula (;). Se houver apenas uma razão social, deixar em branco ou preencher "N/A".

**Exemplo**

> ALFA HOLDING S.A.; ALFA INVEST LTDA

---

### Campo: Link da Proposta

- Obrigatorio no modelo: Nao (no cadastro desta etapa no arquivo; obrigatorio na etapa "Proposta Enviada", conforme alerta da etapa seguinte)

**Manual**

> Link ou caminho para a pasta compartilhada onde a proposta está armazenada (Sharepoint, VIOS, etc.). Obrigatório na etapa "Proposta Enviada" ao enviar a proposta ao cliente.

**Exemplo**

> https://sharepoint/.../proposta.pdf

---

## Etapa 8 — Proposta Enviada (AGUARDA CLIENTE) (`proposta-enviada`)

**Titulo:** Proposta Enviada (AGUARDA CLIENTE)  
**Subtitulo:** Aguardando resposta do cliente

**Descricao da etapa**

> Aguardando aceite ou recusa do cliente. O solicitante deve acompanhar a resposta.

**Alertas da etapa**

> Nesta etapa o campo "Link da Proposta" é obrigatório no CRM/planilha — preencha para registrar onde a proposta foi enviada (SharePoint, VIOS, etc.).

**Proximos passos (texto do modelo)**

- Aceite → Confecção de Contrato
- Recusa → Perda (registrar motivo)

### Campo operacional obrigatorio nesta etapa (conforme alerta): Link da Proposta

**Manual (copiado do campo homonimo na etapa de proposta)**

> Link ou caminho para a pasta compartilhada onde a proposta está armazenada (Sharepoint, VIOS, etc.). Obrigatório na etapa "Proposta Enviada" ao enviar a proposta ao cliente.

**Exemplo**

> https://sharepoint/.../proposta.pdf

---

## Etapa 9 — Confecção de Contrato (CONTRATOS) (`conf-contrato`)

**Titulo:** Confecção de Contrato (CONTRATOS)  
**Subtitulo:** Elaboração do documento

**Descricao da etapa**

> Elaboração do documento contratual. Responsabilidade da equipe de Contratos. Todos os campos abaixo são obrigatórios para avançar da etapa "Proposta Enviada" para esta etapa. Após a confecção, a responsabilidade retorna ao solicitante na etapa "Contrato Elaborado".

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Proposta Enviada" para "Confecção de Contrato".
- IMPORTANTE: Nos campos de VALOR (R$), informar APENAS números. Não incluir símbolos, texto ou formatação. Exemplo: para R$ 1.000,00, preencher apenas "1000" ou "1000.00".
- IMPORTANTE: Nos campos de RATEIO (%), informar APENAS a porcentagem com o símbolo %. Exemplo: para 50%, preencher apenas "50%". Não incluir texto adicional.
- Use o calendário para selecionar a "Data para Confecção do Contrato" e garantir precisão.
- Se algum tipo de pagamento ou rateio não se aplicar ao contrato, preencher com "0" ou "0%".
- O link do contrato deve apontar para um diretório oficial (Sharepoint ou VIOS).

**Checklist da etapa**

- Escopo alinha proposta
- Rateios conferidos
- Sem placeholders
- Modelo atualizado

### Campo: Tipo de Instrumento [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Selecione o tipo de instrumento contratual. Opções: Contrato, Aditivo ou Acordo/Confissão. Selecionar a opção que se aplica ao caso.

**Exemplo**

> Contrato

---

### Campo: Limitação de processos e valor adicional por processo [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Informar se há limitação de processos e qual o valor adicional por processo excedente. Descrever claramente a regra de limitação e o valor cobrado por processo adicional. Se não houver limitação, preencher "N/A" ou "Sem limitação".

**Exemplo**

> Limitação de 10 processos. Valor adicional: R$ 500,00 por processo excedente.

---

### Campo: Limitação de horas (Consultivo) [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Informar se há limitação de horas para serviços consultivos e qual a regra aplicada. Descrever o número de horas incluídas e o que acontece com horas excedentes. Se não houver limitação, preencher "N/A" ou "Sem limitação".

**Exemplo**

> Limitação de 20 horas/mês. Horas excedentes: R$ 300,00/hora.

---

### Campo: Êxito (Descrever áreas abrangidas e percentuais) [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Descrever detalhadamente as áreas abrangidas pelo êxito e os percentuais aplicados a cada área. Incluir todas as áreas envolvidas e seus respectivos percentuais de êxito. Se não houver êxito, preencher "N/A".

**Exemplo**

> Trabalhista: 20% | Cível: 15% | Tributário: 25%

---

### Campo: Valores (descrever tipo de pagamento, valores e data de vencimento) [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Descrever de forma completa o tipo de pagamento acordado, os valores envolvidos e as datas de vencimento. Incluir todas as informações sobre pagamento de forma clara e organizada.

**Exemplo**

> Mensal - Fixo: R$ 5.000,00 | Vencimento: Todo dia 15 | Início: 15/07/2025

---

### Campo: Tipo de pagamento [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Selecione o tipo de pagamento acordado. Opções: Mensal (Fixo, Preço Fechado Parcelado, Escalonado, Variável, Condicionado), SPOT (À vista, Parcelado, com Manutenção, Condicionado), Êxito. Selecionar a opção que se aplica.

**Exemplo**

> Mensal - Fixo

---

### Campo: Objeto do Contrato [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Descrever de forma clara e completa o objeto do contrato. Deve incluir os serviços que serão prestados, escopo de atuação e demais detalhes relevantes do objeto contratual.

**Exemplo**

> Prestação de serviços jurídicos consultivos nas áreas Trabalhista, Cível e Tributária, incluindo consultas, pareceres e acompanhamento processual.

---

### Campo: Mensal – Fixo Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 1.000,00, preencher apenas "1000" ou "1000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 1000.00

---

### Campo: Mensal - Preço Fechado Parcelado - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 2.500,00, preencher apenas "2500" ou "2500.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 2500.00

---

### Campo: Mensal – Escalonado - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 3.000,00, preencher apenas "3000" ou "3000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 3000.00

---

### Campo: Mensal – Variável - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 1.500,00, preencher apenas "1500" ou "1500.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 1500.00

---

### Campo: Mensal – Condicionado - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 4.000,00, preencher apenas "4000" ou "4000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 4000.00

---

### Campo: SPOT - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 10.000,00, preencher apenas "10000" ou "10000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 10000.00

---

### Campo: SPOT com Manutenção - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 12.000,00, preencher apenas "12000" ou "12000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 12000.00

---

### Campo: SPOT – Parcelado - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 15.000,00, preencher apenas "15000" ou "15000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 15000.00

---

### Campo: SPOT - Parcelado com manutenção - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 18.000,00, preencher apenas "18000" ou "18000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 18000.00

---

### Campo: SPOT – Condicionado - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 20.000,00, preencher apenas "20000" ou "20000.00". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 20000.00

---

### Campo: Êxito - Valor R$ [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 0,00 (sem valor fixo, apenas percentual), preencher "0". Se não se aplicar, preencher "0" ou deixar em branco.

**Exemplo**

> 0

---

### Campo: RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 50%, preencher apenas "50%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 50%

---

### Campo: RATEIO - PORCENTAGEM % (Cível) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 30%, preencher apenas "30%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 30%

---

### Campo: RATEIO - PORCENTAGEM % (Trabalhista) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 25%, preencher apenas "25%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 25%

---

### Campo: RATEIO - PORCENTAGEM % (Tributário) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 20%, preencher apenas "20%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 20%

---

### Campo: RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 15%, preencher apenas "15%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 15%

---

### Campo: RATEIO - PORCENTAGEM % (ADD) - [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS a porcentagem com o símbolo %. Exemplo: se for 10%, preencher apenas "10%". Não incluir texto adicional, apenas o número e o símbolo %. Se não se aplicar, preencher "0%".

**Exemplo**

> 10%

---

### Campo: Prazo para Confecção do Contrato [CC] (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Data limite para confecção do contrato. Formato: DD/MM/AAAA. Usar calendário para seleção. Esta data é importante para o planejamento da equipe de Contratos.

**Exemplo**

> 25/07/2025

---

### Campo: Responsável pela Elaboração (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo do colaborador da equipe de Contratos que redigiu o contrato.

**Exemplo**

> Leticia S. Rodrigues

---

### Campo: Link do Contrato (tag: CC)

- Obrigatorio no modelo: Sim

**Manual**

> Link ou caminho para o arquivo do contrato armazenado. Deve ser um diretório oficial (Sharepoint, VIOS, etc.). Após a confecção, incluir o link completo aqui.

**Exemplo**

> https://sharepoint/.../contrato.docx

---

## Etapa 10 — Contrato Elaborado (SOLICITANTE) (`contrato-elaborado`)

**Titulo:** Contrato Elaborado (SOLICITANTE)  
**Subtitulo:** Documento final pronto

**Descricao da etapa**

> Documento final pronto para envio. Após a equipe de Contratos elaborar o contrato, a responsabilidade retorna ao solicitante para envio e acompanhamento. Todos os campos abaixo são obrigatórios para avançar da etapa "Confecção de Contrato" para esta etapa e devem ser preenchidos pela equipe de Contratos.

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Confecção de Contrato" para "Contrato Elaborado".
- Estes campos devem ser preenchidos pela equipe de Contratos após a elaboração do contrato.
- O link do contrato deve apontar para um diretório oficial (Sharepoint ou VIOS).
- Após o preenchimento, a responsabilidade retorna ao solicitante para envio e acompanhamento.

### Campo: Link Contrato [CE] (tag: CE)

- Obrigatorio no modelo: Sim

**Manual**

> Link ou caminho para o arquivo do contrato elaborado armazenado. Deve ser um diretório oficial (Sharepoint, VIOS, etc.). Após a elaboração do contrato pela equipe de Contratos, incluir o link completo aqui.

**Exemplo**

> https://sharepoint/.../contrato.docx

---

### Campo: Responsável pela Elaboração [CE] (tag: CE)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo do colaborador da equipe de Contratos que foi responsável pela elaboração/redação do contrato. Este campo identifica quem elaborou o documento.

**Exemplo**

> Leticia S. Rodrigues

---

## Etapa 11 — Contrato Enviado (SOLICITANTE) (`contrato-enviado`)

**Titulo:** Contrato Enviado (SOLICITANTE)  
**Subtitulo:** Aguardando assinatura

**Descricao da etapa**

> Aguardando assinatura do cliente. A negociação permanece nesta etapa até receber o retorno do lead/possível cliente. Responsabilidade do solicitante em acompanhar e aguardar a assinatura.

**Campos formais no modelo desta etapa**

> Nenhum (`fields` nao definido no arquivo para esta etapa).

---

## Etapa 12 — Contrato Assinado (SOLICITANTE) (`contrato-assinado`)

**Titulo:** Contrato Assinado (SOLICITANTE)  
**Subtitulo:** Venda concluída

**Descricao da etapa**

> Venda concluída e início do Pós-Venda. Responsabilidade do solicitante em finalizar o processo e iniciar as transições necessárias. Todos os campos abaixo são obrigatórios para avançar da etapa "Contrato Enviado" para esta etapa.

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Contrato Enviado" para "Contrato Assinado".
- IMPORTANTE: Após preencher a data de assinatura, o solicitante deve clicar na negociação e acionar o botão "Marcar Venda" localizado no canto superior direito do RD Station CRM.
- É OBRIGATÓRIO clicar no botão "Marcar Venda" para que a negociação seja automaticamente duplicada para o funil de Pós-Venda.
- Após marcar a venda, o sistema automaticamente cria uma nova oportunidade no funil de Pós-Venda com todos os dados do contrato.
- Para acessar a negociação no funil de Pós-Venda, o solicitante deve clicar no filtro de funil e selecionar o funil de "Pós-Venda".

**Proximos passos (texto do modelo)**

- Preencher "Data de assinatura do contrato" → Usar calendário para seleção
- Clicar na negociação → Acionar botão "Marcar Venda" no canto superior direito do RD Station
- Duplicação automática para funil de Pós-Venda
- Acessar funil de Pós-Venda através do filtro de funil
- Solicitar Cadastro
- Solicitar Inclusão Financeiro
- Transição para Onboarding

### Campo: Data de assinatura do contrato [CA] (tag: CA)

- Obrigatorio no modelo: Sim

**Manual**

> Data efetiva em que o contrato foi assinado pelo cliente. Formato: DD/MM/AAAA. Usar calendário para seleção. Esta data é fundamental para o registro da venda e início do processo de Pós-Venda.

**Exemplo**

> 28/05/2025

---

# Funil de Pos-Venda / Onboarding

## Etapa 1 — Aguardando Cadastro (SOLICITANTE) (`aguardando-cadastro`)

**Titulo:** Aguardando Cadastro (SOLICITANTE)  
**Subtitulo:** Preparação inicial

**Descricao da etapa**

> A negociação permanece nesta etapa até que o solicitante esteja com todos os dados em mãos para realizar o cadastro. Esta é uma etapa de espera enquanto o solicitante coleta as informações necessárias.

**Campos formais no modelo desta etapa**

> Nenhum (`fields` nao definido no arquivo para esta etapa).

---

## Etapa 2 — Cadastro de Novo Cliente (SOLICITANTE) (`cadastro-cliente`)

**Titulo:** Cadastro de Novo Cliente (SOLICITANTE)  
**Subtitulo:** Formulário de cadastro

**Descricao da etapa**

> Preenchimento do cadastro do cliente no sistema VIOS. Todos os campos abaixo são obrigatórios para avançar da etapa "Aguardando Cadastro" para esta etapa. Os dados preenchidos serão enviados para cadastro no VIOS.

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Aguardando Cadastro" para "Cadastro de Novo Cliente".
- Os dados preenchidos serão enviados automaticamente para cadastro no sistema VIOS.
- O campo STATUS [CADASTRO] deve ser marcado como "PENDENTE" para controle das automações.
- TEMPO ESTIMADO: A aprovação do cadastro pela equipe de Operações Legais é de 24 horas. Caso seja urgente, avisar no grupo direcionado ao cadastro de leads no WhatsApp.
- PROCESSO DE CORREÇÃO: Se algum campo estiver errado, o solicitante receberá um e-mail para correção. Deve entrar na negociação, corrigir o campo indicado no e-mail e mudar o STATUS [CADASTRO] para PENDENTE, ativando o fluxo novamente e aguardando a conclusão.
- APÓS CONCLUÍDO: Após receber e-mail confirmando STATUS [CADASTRO] = CONCLUÍDO, o solicitante deve movimentar a negociação para a etapa "Inclusão no Fluxo de Faturamento".
- Não avançar para a próxima etapa sem que STATUS [CADASTRO] = CONCLUÍDO.

### Campo: Razão Social Cliente Principal [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Nome jurídico oficial da empresa ou nome completo da pessoa física (cliente principal). Deve estar em CAIXA ALTA se for pessoa jurídica. Este é o cliente principal que será cadastrado no VIOS.

**Exemplo**

> ALFA SOLUÇÕES LTDA

---

### Campo: CNPJ / CPF Cliente Principal [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> CNPJ (para pessoa jurídica) ou CPF (para pessoa física) do cliente principal. Formato da Receita Federal: XX.XXX.XXX/XXXX-XX para CNPJ ou XXX.XXX.XXX-XX para CPF.

**Exemplo**

> 12.345.678/0001-90

---

### Campo: Endereço Cliente Principal [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Endereço completo do cliente principal: logradouro, número, complemento, bairro, cidade, estado e CEP. Deve incluir todas as informações de localização.

**Exemplo**

> Rua das Flores, 123 - Sala 45 - Centro - São Paulo/SP - CEP: 01234-567

---

### Campo: Qualificação dos Sócios (Nome, Posição (Sócio, consultor familiar, diretor etc), CPF) [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Lista completa de todos os sócios, consultores familiares, diretores e demais pessoas relacionadas. Para cada pessoa, informar: Nome completo, Posição (Sócio, Consultor Familiar, Diretor, etc.) e CPF. Separar múltiplas pessoas por ponto e vírgula (;).

**Exemplo**

> Maria Costa Silva – Sócia – 123.456.789-00; João Silva Santos – Diretor – 987.654.321-00

---

### Campo: Cadastrar na consulta automatizada de novas demandas? (Favor informar os nomes, CNPJs de TODOS abaixo) [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Se o cliente deve ser cadastrado na consulta automatizada de novas demandas, informar os nomes e CNPJs de TODAS as empresas/pessoas relacionadas que devem ser incluídas. Separar múltiplas entradas por vírgula (,). Se não se aplicar, preencher "N/A" ou "Não se aplica".

**Exemplo**

> ALFA HOLDING S.A., 12.345.678/0001-90, ALFA INVEST LTDA, 98.765.432/0001-10

---

### Campo: Informações Adicionais [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Qualquer informação adicional relevante sobre o cliente, contexto especial, observações importantes ou detalhes que devem ser considerados no cadastro. Se não houver informações adicionais, preencher "N/A".

**Exemplo**

> Prioridade tributária. Cliente possui múltiplas empresas relacionadas.

---

### Campo: STATUS [CADASTRO] (tag: CADASTRO)

- Obrigatorio no modelo: Sim

**Manual**

> Este campo é para controle das automações. Deve ser marcado como "PENDENTE" inicialmente. O sistema atualizará automaticamente para "CONCLUÍDO" quando o cadastro for finalizado no VIOS. Não alterar manualmente este campo.

**Exemplo**

> PENDENTE

---

## Etapa 3 — Inclusão no Fluxo de Faturamento (FINANCEIRO) (`inclusao-financeiro`)

**Titulo:** Inclusão no Fluxo de Faturamento (FINANCEIRO)  
**Subtitulo:** Configuração financeira

**Descricao da etapa**

> Configuração completa dos dados financeiros e de faturamento. Todos os campos abaixo são obrigatórios para avançar da etapa "Cadastro de Novo Cliente" para esta etapa. IMPORTANTE: A negociação só deve ser movimentada para esta etapa após o solicitante receber um e-mail indicando que o cadastro foi concluído (STATUS [CADASTRO] = CONCLUÍDO).

**Alertas da etapa**

- Todos os campos acima são obrigatórios para avançar da etapa "Cadastro de Novo Cliente" para "Inclusão no Fluxo de Faturamento".
- PRÉ-REQUISITO: STATUS [CADASTRO] = CONCLUÍDO (confirmado via e-mail da equipe de Operações Legais).
- TEMPO ESTIMADO: A aprovação do cadastro pela equipe de Operações Legais é de 24 horas. Caso seja urgente, avisar no grupo direcionado ao cadastro de leads no WhatsApp.
- PROCESSO DE CORREÇÃO: Se algum campo estiver errado, o solicitante receberá um e-mail para correção. Deve entrar na negociação, corrigir o campo indicado no e-mail e mudar o STATUS [CADASTRO] para PENDENTE, ativando o fluxo novamente e aguardando a conclusão.
- APÓS CONCLUÍDO: Após receber e-mail confirmando STATUS [CADASTRO] = CONCLUÍDO, o solicitante deve movimentar a negociação para esta etapa.
- FLUXO FINANCEIRO: Esta etapa segue o mesmo fluxo do cadastro. O solicitante receberá e-mail indicando se foi concluído ou se precisa corrigir algum campo. Se precisar corrigir, deve corrigir o campo indicado e mudar STATUS [FINANCEIRO] para PENDENTE.
- MOVIMENTAÇÃO: Após receber e-mail confirmando STATUS [FINANCEIRO] = CONCLUÍDO, a equipe do FINANCEIRO será responsável por movimentar o lead para a etapa "Boas-vindas".

### Campo: Razão Social para Faturamento [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Nome jurídico oficial da empresa ou pessoa física que será utilizada para faturamento. Deve estar em CAIXA ALTA se for pessoa jurídica.

**Exemplo**

> ALFA HOLDING S.A.

---

### Campo: CPF/CNPJ para Faturamento [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> CPF (para pessoa física) ou CNPJ (para pessoa jurídica) que será utilizado para faturamento. Formato da Receita Federal: XX.XXX.XXX/XXXX-XX para CNPJ ou XXX.XXX.XXX-XX para CPF.

**Exemplo**

> 02.345.678/0001-75

---

### Campo: Início da Vigência do Contrato [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Data de início da vigência do contrato conforme acordado. Formato: DD/MM/AAAA. Usar calendário para seleção. Esta data é fundamental para o controle de vigência contratual.

**Exemplo**

> 15/03/2025

---

### Campo: Primeiro Faturamento [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Data do primeiro faturamento conforme acordado no contrato. Formato: DD/MM/AAAA. Usar calendário para seleção. Esta data define quando será gerada a primeira fatura.

**Exemplo**

> 15/04/2025

---

### Campo: Responsável Financeiro do Cliente [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Nome completo da pessoa responsável pelo setor financeiro do cliente. Esta pessoa será o contato principal para questões financeiras e faturamento.

**Exemplo**

> João Pereira Silva

---

### Campo: Posição do Responsável (Sócio, consultor, financeiro...) [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Cargo, função ou posição do responsável financeiro no cliente. Opções: Sócio, Consultor, Financeiro, Controller, Diretor Financeiro, etc. Informar a posição exata.

**Exemplo**

> Controller

---

### Campo: E-mail Responsável Financeiro do Cliente [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> E-mail corporativo válido do responsável financeiro do cliente. Deve ser um e-mail profissional/empresarial ativo para recebimento de faturas e comunicações financeiras.

**Exemplo**

> financeiro@cliente.com.br

---

### Campo: Telefone Responsável Financeiro do Cliente [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Telefone de contato do responsável financeiro do cliente. Formato: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX. Incluir DDD e número completo.

**Exemplo**

> (11) 9-8765-4321

---

### Campo: Repasse acordado % [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o número, sem o símbolo %. Exemplo: se for 50%, preencher apenas "50". Não incluir símbolos ou texto adicional.

**Exemplo**

> 50

---

### Campo: RATEIO - VALOR R$ (Reestruturação e Insolvência) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 3.000,00, preencher apenas "3000" ou "3000.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 3000.00

---

### Campo: RATEIO - VALOR R$ (Cível) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 2.000,00, preencher apenas "2000" ou "2000.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 2000.00

---

### Campo: RATEIO - VALOR R$ (Trabalhista) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 1.500,00, preencher apenas "1500" ou "1500.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 1500.00

---

### Campo: RATEIO - VALOR R$ (Tributário) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 500,00, preencher apenas "500" ou "500.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 500.00

---

### Campo: RATEIO - VALOR R$ (Contratos / Societário) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 0,00, preencher apenas "0" ou "0.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 0.00

---

### Campo: RATEIO - VALOR R$ (ADD) - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> ⚠️ IMPORTANTE: Informar APENAS o valor numérico, sem símbolos ou texto adicional. Apenas números. Exemplo: se o valor for R$ 0,00, preencher apenas "0" ou "0.00". Se não se aplicar, preencher "0" ou "0.00".

**Exemplo**

> 0.00

---

### Campo: Índice de Reajuste - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Nome do índice de reajuste acordado no contrato. Exemplos: IPCA, IGP-M, INPC, etc. Informar o índice exato que será utilizado para reajuste dos valores.

**Exemplo**

> IPCA

---

### Campo: Periodicidade do Reajuste - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Periodicidade em que o reajuste será aplicado. Informar em meses (ex: 12 meses, 6 meses, etc.) conforme acordado no contrato.

**Exemplo**

> 12 meses

---

### Campo: Observações - [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Qualquer informação adicional relevante sobre condições financeiras, multas, juros, observações importantes ou detalhes que devem ser considerados no faturamento. Se não houver observações, preencher "N/A".

**Exemplo**

> Multa 2% + 1% a.m. de juros em caso de atraso.

---

### Campo: STATUS [FINANCEIRO] (tag: FINANCEIRO)

- Obrigatorio no modelo: Sim

**Manual**

> Este campo é para controle das automações. Deve ser marcado como "PENDENTE" neste primeiro pop-up. O sistema atualizará automaticamente para "CONCLUÍDO" quando a inclusão financeira for finalizada. Não alterar manualmente este campo.

**Exemplo**

> PENDENTE

---

## Etapa 4 — Boas-vindas (RECEP.) (`boas-vindas`)

**Titulo:** Boas-vindas (RECEP.)  
**Subtitulo:** Envio institucional

**Descricao da etapa**

> Envio institucional inicial ao cliente. Esta etapa é acessada após a conclusão da "Inclusão no Fluxo de Faturamento". A movimentação do lead para esta etapa é realizada pela equipe do FINANCEIRO após receberem confirmação de que STATUS [FINANCEIRO] = CONCLUÍDO.

**Campos formais no modelo desta etapa**

> Nenhum (`fields` nao definido no arquivo para esta etapa).

---

## Etapa 5 — Reunião Kick-off (ALINH.) (`reuniao-kickoff`)

**Titulo:** Reunião Kick-off (ALINH.)  
**Subtitulo:** Alinhamento inicial

**Descricao da etapa**

> Reunião de alinhamento e kick-off do projeto

### Itens de checklist

#### Checklist: Escopo confirmado (obrigatorio)

**Manual**

> Escopo confirmado

#### Checklist: Responsáveis definidos (obrigatorio)

**Manual**

> Responsáveis definidos

#### Checklist: Pendências registradas (obrigatorio)

**Manual**

> Pendências registradas
