/**
 * API Vercel – Validar dados do Google Sheets conforme manual de etapas
 * POST body: { accessToken, spreadsheetId, sheetName?, range? }
 * Resposta: { results: [{ rowIndex, valid, errors, email_notificar, ... }], total, comErros }
 */

// --- Mapeamento: nome da coluna na planilha → chave usada na validação ---
function normalizeHeader(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Mapeamento: nome normalizado da coluna na planilha → chave usada na validação
// Normalização: lowercase, sem acentos, espaços → _, só [a-z0-9_]
const COLUMN_TO_KEY = {
  // Identificação
  stage_name: 'stage_name',
  stage_id: 'stage_id',
  nome: 'nome',
  deal_id: 'deal_id',
  estado: 'status',
  lead: 'nome_lead',
  // Cadastro do Lead (Funil de vendas)
  solicitante: 'solicitante',
  email: 'email',
  email_solicitante: 'email',
  e_mail_do_solicitante: 'email',
  email_do_solicitante: 'email',
  cadastrado_por: 'cadastrado_por',
  cadastro_realizado_por: 'cadastrado_por',
  cadastro_realizado_por_email: 'cadastrado_por',
  due_diligence: 'due_diligence',
  havera_due_diligence: 'due_diligence',
  prazo_reuniao_due: 'prazo_reuniao_due',
  prazo_de_entrega_da_due: 'prazo_reuniao_due',
  prazo_entrega_data: 'prazo_reuniao_due',
  horario_due: 'horario_due',
  horario_de_entrega_da_due: 'horario_due',
  prazo_entrega_hora: 'horario_due',
  razao_social: 'razao_social',
  razao_social_nome_completo: 'razao_social',
  razao_social_completa: 'razao_social',
  cnpj: 'cnpj',
  cnpj_cpf: 'cnpj',
  areas_analise: 'areas_analise',
  local_reuniao: 'local_reuniao',
  local_da_reuniao: 'local_reuniao',
  data_reuniao: 'data_reuniao',
  data_da_reuniao: 'data_reuniao',
  horario_reuniao: 'horario_reuniao',
  horario_da_reuniao: 'horario_reuniao',
  tipo_de_lead: 'tipo_de_lead',
  tipo_lead: 'tipo_de_lead',
  tipo_do_lead: 'tipo_de_lead',
  indicacao: 'indicacao',
  nome_indicacao: 'nome_indicacao',
  nome_da_indicacao: 'nome_indicacao',
  etapa: 'etapa',
  etapa_id: 'etapa',
  stage: 'stage_name',
  nome_etapa: 'stage_name',
  nome_da_etapa: 'stage_name',
  funil: 'funil',
  email_notificar: 'email_notificar',
  telefone_notificar: 'telefone_notificar',
  whatsapp: 'telefone_notificar',
  telefone: 'telefone_notificar',
  celular: 'telefone_notificar',
  id_registro: 'id_registro',
  nome_lead: 'nome_lead',
  status: 'status',
  // Datas para SLA (tempo na etapa / última atualização)
  updated_at: 'updated_at',
  date_update: 'updated_at',
  follow_up: 'follow_up',
  follow_up_anotacao: 'follow_up_anotacao',
  ultimo_followup: 'follow_up',
  ultimo_follow_up: 'follow_up',
  ultima_atualizacao: 'updated_at',
  data_atualizacao: 'updated_at',
  data_de_atualizacao: 'updated_at',
  dataatualizacao: 'updated_at',
  last_updated: 'updated_at',
  created_at: 'created_at',
  date_create: 'created_at',
  data_criacao: 'created_at',
  data_de_criacao: 'created_at',
  datacriacao: 'created_at',
  data_criacao_do_registro: 'created_at',
  situacao: 'status',
  status_da_negociacao: 'status',
  status_negociacao: 'status',
  motivo_de_perda: 'motivo_perda',
  motivo_perda: 'motivo_perda',
  motivo_perda_lost: 'motivo_perda',
  // Confecção de proposta (ponto focal / comercial)
  nome_do_ponto_focal_comercial_cp: 'nome_ponto_focal',
  nome_do_ponto_focal: 'nome_ponto_focal',
  nome_ponto_focal: 'nome_ponto_focal',
  ponto_focal_comercial: 'nome_ponto_focal',
  email_do_ponto_focal_comercial_cp: 'email_ponto_focal',
  e_mail_do_ponto_focal_comercial_cp: 'email_ponto_focal',
  email_do_ponto_focal: 'email_ponto_focal',
  email_ponto_focal: 'email_ponto_focal',
  telefone_do_ponto_focal_comercial_cp: 'telefone_ponto_focal',
  telefone_do_ponto_focal: 'telefone_ponto_focal',
  telefone_ponto_focal: 'telefone_ponto_focal',
  // Link da proposta / Link do contrato (SharePoint, VIOS, etc.)
  link_da_proposta: 'link_da_proposta',
  link_proposta: 'link_da_proposta',
  link_do_contrato: 'link_do_contrato',
  link_contrato: 'link_do_contrato',
  // Confecção de proposta [CP] – campos adicionais
  razao_social_cp: 'razao_social_cp',
  razao_social_cp_cp: 'razao_social_cp',
  cnpj_cp: 'cnpj_cp',
  cnpj_cp_cp: 'cnpj_cp',
  qualificacao_completa: 'qualificacao_completa',
  qualificacao_completa_endereco_cep: 'qualificacao_completa',
  areas_objeto_do_contrato_cp: 'areas_objeto_contrato_cp',
  areas_objeto_contrato_cp: 'areas_objeto_contrato_cp',
  areas_objeto_contrato: 'areas_objeto_contrato_cp',
  areas_cp: 'areas_objeto_contrato_cp',
  realizou_due_diligence: 'realizou_due_diligence',
  realizou_due_diligence_cp: 'realizou_due_diligence',
  gestor_do_contrato_cp: 'gestor_contrato_cp',
  gestor_contrato_cp: 'gestor_contrato_cp',
  gestor_do_contrato: 'gestor_contrato_cp',
  gestor_contrato: 'gestor_contrato_cp',
  captador_cp: 'captador_cp',
  captador: 'captador_cp',
  tributacao_cp: 'tributacao_cp',
  tributacao: 'tributacao_cp',
  prazo_para_entrega_cp: 'prazo_entrega_cp',
  prazo_entrega_cp: 'prazo_entrega_cp',
  prazo_para_entrega: 'prazo_entrega_cp',
  data_do_primeiro_vencimento_cp: 'data_primeiro_vencimento_cp',
  data_primeiro_vencimento_cp: 'data_primeiro_vencimento_cp',
  data_do_primeiro_vencimento: 'data_primeiro_vencimento_cp',
  data_primeiro_vencimento: 'data_primeiro_vencimento_cp',
  informacoes_adicionais_cp: 'informacoes_adicionais_cp',
  informacoes_adicionais: 'informacoes_adicionais_cp',
  demais_razoes_sociais_cp: 'demais_razoes_sociais_cp',
  demais_razoes_sociais: 'demais_razoes_sociais_cp',
  // Confecção de contrato [CC]
  tipo_de_pagamento_cc: 'tipo_pagamento_cc',
  tipo_pagamento_cc: 'tipo_pagamento_cc',
  objeto_do_contrato_cc: 'objeto_contrato_cc',
  objeto_contrato_cc: 'objeto_contrato_cc',
  mensal_fixo_valor_r_cc: 'valor_mensal_fixo_cc',
  mensal_fixo_valor_cc: 'valor_mensal_fixo_cc',
  valor_mensal_fixo_cc: 'valor_mensal_fixo_cc',
  mensal_preco_fechado_parcelado_valor_r_cc: 'valor_mensal_preco_fechado_cc',
  valor_mensal_preco_fechado_cc: 'valor_mensal_preco_fechado_cc',
  mensal_escalonado_valor_r_cc: 'valor_mensal_escalonado_cc',
  valor_mensal_escalonado_cc: 'valor_mensal_escalonado_cc',
  mensal_variavel_valor_r_cc: 'valor_mensal_variavel_cc',
  valor_mensal_variavel_cc: 'valor_mensal_variavel_cc',
  mensal_condicionado_valor_r_cc: 'valor_mensal_condicionado_cc',
  valor_mensal_condicionado_cc: 'valor_mensal_condicionado_cc',
  spot_valor_r_cc: 'valor_spot_cc',
  valor_spot_cc: 'valor_spot_cc',
  spot_com_manutencao_valor_r_cc: 'valor_spot_manutencao_cc',
  valor_spot_manutencao_cc: 'valor_spot_manutencao_cc',
  spot_parcelado_valor_r_cc: 'valor_spot_parcelado_cc',
  valor_spot_parcelado_cc: 'valor_spot_parcelado_cc',
  spot_parcelado_com_manutencao_valor_r_cc: 'valor_spot_parcelado_manutencao_cc',
  valor_spot_parcelado_manutencao_cc: 'valor_spot_parcelado_manutencao_cc',
  spot_condicionado_valor_r_cc: 'valor_spot_condicionado_cc',
  valor_spot_condicionado_cc: 'valor_spot_condicionado_cc',
  exito_valor_r_cc: 'valor_exito_cc',
  valor_exito_cc: 'valor_exito_cc',
  rateio_porcentagem_reestruturacao_insolvencia_cc: 'rateio_reestruturacao_cc',
  rateio_reestruturacao_cc: 'rateio_reestruturacao_cc',
  rateio_porcentagem_civel_cc: 'rateio_civel_cc',
  rateio_civel_cc: 'rateio_civel_cc',
  rateio_porcentagem_trabalhista_cc: 'rateio_trabalhista_cc',
  rateio_trabalhista_cc: 'rateio_trabalhista_cc',
  rateio_porcentagem_tributario_cc: 'rateio_tributario_cc',
  rateio_tributario_cc: 'rateio_tributario_cc',
  rateio_porcentagem_contratos_societario_cc: 'rateio_contratos_cc',
  rateio_contratos_societario_cc: 'rateio_contratos_cc',
  rateio_contratos_cc: 'rateio_contratos_cc',
  rateio_porcentagem_add_cc: 'rateio_add_cc',
  rateio_add_cc: 'rateio_add_cc',
  prazo_para_confecao_do_contrato_cc: 'prazo_contrato_cc',
  prazo_confecao_contrato_cc: 'prazo_contrato_cc',
  prazo_contrato_cc: 'prazo_contrato_cc',
  // Confecção de contrato [CC] – campos do manual ainda sem validação
  tipo_instrumento_cc: 'tipo_instrumento_cc',
  tipo_de_instrumento_cc: 'tipo_instrumento_cc',
  tipo_instrumento: 'tipo_instrumento_cc',
  limitacao_processos_cc: 'limitacao_processos_cc',
  limitacao_processos: 'limitacao_processos_cc',
  limitacao_horas_cc: 'limitacao_horas_cc',
  limitacao_horas_consultivo_cc: 'limitacao_horas_cc',
  limitacao_horas: 'limitacao_horas_cc',
  responsavel_elaboracao_cc: 'responsavel_elaboracao_cc',
  responsavel_elaboracao: 'responsavel_elaboracao_cc',
  responsavel_pela_elaboracao: 'responsavel_elaboracao_cc',
  // Contrato Assinado [CA]
  data_assinatura: 'data_assinatura_contrato',
  data_de_assinatura_do_contrato: 'data_assinatura_contrato',
  data_assinatura_contrato: 'data_assinatura_contrato',
  // --- Colunas do CRM (mapeamento direto) ---
  // Identificação / cadastro lead
  deal_id: 'deal_id',
  estado: 'status',
  realizou_due_diligence: 'realizou_due_diligence',
  qualificacao_completa: 'qualificacao_completa',
  // Confecção de proposta / contrato – nomes do CRM
  tipo_pagamento: 'tipo_pagamento_cc',
  escopo_contratual_cadastro: 'objeto_contrato_cc',
  prazo_entrega_contrato: 'prazo_contrato_cc',
  data_assinatura_contrato: 'data_assinatura_contrato',
  // Valores [CC] – sufixo _financeiro no CRM
  mensal_fixo_financeiro: 'valor_mensal_fixo_cc',
  mensal_preco_fechado_financeiro: 'valor_mensal_preco_fechado_cc',
  mensal_escalonado_financeiro: 'valor_mensal_escalonado_cc',
  mensal_variavel_financeiro: 'valor_mensal_variavel_cc',
  mensal_condicionado_financeiro: 'valor_mensal_condicionado_cc',
  spot_financeiro: 'valor_spot_cc',
  spot_manutencao_financeiro: 'valor_spot_manutencao_cc',
  spot_parcelado_financeiro: 'valor_spot_parcelado_cc',
  spot_parcelado_manutencao_financeiro: 'valor_spot_parcelado_manutencao_cc',
  spot_condicionado_financeiro: 'valor_spot_condicionado_cc',
  exito_financeiro: 'valor_exito_cc',
  // Rateio % [CC] – sufixo _financeiro no CRM
  rateio_porcentagem_insolvencia_financeiro: 'rateio_reestruturacao_cc',
  rateio_porcentagem_civel_financeiro: 'rateio_civel_cc',
  rateio_porcentagem_trabalhista_financeiro: 'rateio_trabalhista_cc',
  rateio_porcentagem_tributario_financeiro: 'rateio_tributario_cc',
  rateio_porcentagem_contratos_financeiro: 'rateio_contratos_cc',
  rateio_porcentagem_add_financeiro: 'rateio_add_cc',
  // Colunas da planilha (nomes exatos após normalização)
  date_create: 'created_at',
  date_update: 'updated_at',
  razao_social_financeiro: 'razao_social_cp',
  cpf_cnpj_financeiro: 'cnpj_cp',
  // Variáveis do payload N8N/CRM (label → variável no script; aqui: nome da coluna/variável → chave validação)
  areas_comparecimento: 'areas_comparecimento',
  link_arquivo_due: 'link_arquivo_due',
  valores: 'valores',
  exito: 'exito',
  status_cadastro: 'status_cadastro',
  razao_social_principal_cadastro: 'razao_social_principal_cadastro',
  cnpj_cpf_cadastro: 'cnpj_cpf_cadastro',
  endereco_cadastro: 'endereco_cadastro',
  qualificacao_socios_cadastro: 'qualificacao_socios_cadastro',
  consulta_auto_cadastro: 'consulta_auto_cadastro',
  info_adicionais_cadastro: 'info_adicionais_cadastro',
  id_sharepoint: 'id_sharepoint',
  vigencia_contrato_financeiro: 'vigencia_contrato_financeiro',
  primeiro_faturamento_financeiro: 'primeiro_faturamento_financeiro',
  responsavel_cliente_financeiro: 'responsavel_cliente_financeiro',
  posicao_responsavel_financeiro: 'posicao_responsavel_financeiro',
  email_responsavel_financeiro: 'email_responsavel_financeiro',
  telefone_responsavel_financeiro: 'telefone_responsavel_financeiro',
  repasse_acordado_financeiro: 'repasse_acordado_financeiro',
  rateio_valor_insolvencia_financeiro: 'rateio_valor_insolvencia_financeiro',
  rateio_valor_civel_financeiro: 'rateio_valor_civel_financeiro',
  rateio_valor_trabalhista_financeiro: 'rateio_valor_trabalhista_financeiro',
  rateio_valor_tributario_financeiro: 'rateio_valor_tributario_financeiro',
  rateio_valor_contratos_financeiro: 'rateio_valor_contratos_financeiro',
  rateio_valor_add_financeiro: 'rateio_valor_add_financeiro',
  indice_reajuste_financeiro: 'indice_reajuste_financeiro',
  periodicidade_reajuste_financeiro: 'periodicidade_reajuste_financeiro',
  observacoes_financeiro: 'observacoes_financeiro',
  id_sharepoint_financeiro: 'id_sharepoint_financeiro',
  status_financeiro: 'status_financeiro',
}

/**
 * Nome exato do campo no CRM (deal_custom_fields) para cada variável.
 * Usar em getFieldValue(fields, label) no N8N: result[variable] = getFieldValue(fields, CRM_FIELD_LABELS[variable]).
 * Fonte única para alinhar script N8N e validação.
 */
const CRM_FIELD_LABELS = {
  solicitante: 'Solicitante',
  cadastrado_por: 'Cadastro realizado por',
  razao_social: 'Razão Social [CP]',
  cnpj: 'CNPJ [CP]',
  demais_razoes_sociais: 'Demais Razões Sociais',
  areas_analise: 'Áreas que serão objeto de análise',
  prazo_entrega_data: 'Prazo de Entrega Due [DATA]',
  prazo_entrega_hora: 'Prazo de Entrega Due [HORÁRIO]',
  local_reuniao: 'Local da Reunião',
  data_reuniao: 'Data Reunião',
  horario_reuniao: 'Horário da Reunião',
  email_solicitante: 'E-mail do Solicitante',
  havera_due_diligence: 'Haverá Due Diligence?',
  areas_comparecimento: 'Áreas para comparecimento na reunião',
  indicacao: 'Indicação',
  nome_indicacao: 'Nome da Indicação',
  tipo_instrumento: 'Tipo de Instrumento [CC]',
  limitacao_processos: 'Limitação de processos e valor adicional por processo [CC]',
  limitacao_horas: 'Limitação de horas (Consultivo) [CC]',
  exito: 'Êxito (Descrever áreas abrangidas e percentuais) [CC]',
  valores: 'Valores (descrever tipo de pagamento, valores e data de vencimento) [CC]',
  tipo_pagamento: 'Tipo de pagamento [CC]',
  link_arquivo_due: 'Link do Arquivo DUE',
  prazo_entrega_contrato: 'Prazo para Confecção do Contrato [CC]',
  data_assinatura_contrato: 'Data de assinatura do contrato [CA]',
  link_contrato: 'Link Contrato [CE]',
  responsavel_elaboracao: 'Responsável pela Elaboração [CE]',
  areas_cp: 'Áreas Objeto do contrato [CP]',
  gestor_contrato: 'Gestor do Contrato [CP]',
  captador: 'Captador [ CP]',
  tributacao: 'Tributação [CP]',
  informacoes_adicionais: 'Informações adicionais [CP]',
  data_primeiro_vencimento: 'Data do primeiro vencimento [CP]',
  prazo_entrega_cp: 'Prazo para entrega (mínimo de 2 dias úteis - sinalizar exceções e motivos) [CP]',
  qualificacao_completa: 'Qualificação completa (endereço, CEP, endereço eletrônico etc.) [CP]',
  realizou_due_diligence: 'Realizou Due Diligence? [CP]',
  nome_ponto_focal: 'Nome do ponto focal / Comercial [CP]',
  email_ponto_focal: 'E-mail do ponto focal / Comercial [CP]',
  telefone_ponto_focal: 'Telefone do ponto focal / Comercial [CP]',
  link_proposta: 'Link da Proposta [CP]',
  status_cadastro: 'STATUS [CADASTRO]',
  razao_social_principal_cadastro: 'Razão Social Cliente Principal [CADASTRO]',
  cnpj_cpf_cadastro: 'CNPJ / CPF Cliente Principal [CADASTRO]',
  endereco_cadastro: 'Endereço Cliente Principal [CADASTRO]',
  escopo_contratual_cadastro: 'Objeto do Contrato [CC]',
  qualificacao_socios_cadastro: 'Qualificação dos Sócios (Nome, Posição (Sócio, consultor familiar, diretor etc), CPF) [CADASTRO]',
  consulta_auto_cadastro: 'Cadastrar na consulta automatizada de novas demandas? (Favor informar os nomes, CNPJS de TODOS abaixo) [CADASTRO]',
  info_adicionais_cadastro: 'Informações Adicionais [CADASTRO]',
  id_sharepoint: 'ID SHAREPOINT',
  razao_social_financeiro: 'Razão Social para Faturamento [FINANCEIRO]',
  cpf_cnpj_financeiro: 'CPF/CNPJ para Faturamento [FINANCEIRO]',
  vigencia_contrato_financeiro: 'Início da Vigência do Contrato [FINANCEIRO]',
  primeiro_faturamento_financeiro: 'Primeiro Faturamento [FINANCEIRO]',
  responsavel_cliente_financeiro: 'Responsável Financeiro do Cliente [FINANCEIRO]',
  posicao_responsavel_financeiro: 'Posição do Responsável (Sócio, consultor, financeiro...) [FINANCEIRO]',
  email_responsavel_financeiro: 'E-mail Responsável Financeiro do Cliente [FINANCEIRO]',
  telefone_responsavel_financeiro: 'Telefone Responsável Financeiro do Cliente [FINANCEIRO]',
  repasse_acordado_financeiro: 'Repasse acordado % [FINANCEIRO]',
  mensal_fixo_financeiro: 'Mensal – Fixo Valor R$ [CC]',
  mensal_preco_fechado_financeiro: 'Mensal - Preço Fechado Parcelado - Valor R$ [CC]',
  mensal_escalonado_financeiro: 'Mensal – Escalonado - Valor R$ [CC]',
  mensal_variavel_financeiro: 'Mensal – Variável - Valor R$ [CC]',
  mensal_condicionado_financeiro: 'Mensal – Condicionado - Valor R$ [CC]',
  spot_financeiro: 'SPOT - Valor R$ [CC]',
  spot_manutencao_financeiro: 'SPOT com Manutenção - Valor R$ [CC]',
  spot_parcelado_financeiro: 'SPOT – Parcelado - Valor R$ [CC]',
  spot_parcelado_manutencao_financeiro: 'SPOT - Parcelado com manutenção - Valor R$ [CC]',
  spot_condicionado_financeiro: 'SPOT – Condicionado - Valor R$ [CC]',
  exito_financeiro: 'Êxito - Valor R$ [CC]',
  rateio_valor_insolvencia_financeiro: 'RATEIO - VALOR R$ (Reestruturação e Insolvência) - [FINANCEIRO]',
  rateio_porcentagem_insolvencia_financeiro: 'RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC]',
  rateio_valor_civel_financeiro: 'RATEIO - VALOR R$ (Cível) - [FINANCEIRO]',
  rateio_porcentagem_civel_financeiro: 'RATEIO - PORCENTAGEM % (Cível) - [CC]',
  rateio_valor_trabalhista_financeiro: 'RATEIO - VALOR R$ (Trabalhista) - [FINANCEIRO]',
  rateio_porcentagem_trabalhista_financeiro: 'RATEIO - PORCENTAGEM % (Trabalhista) - [CC]',
  rateio_valor_tributario_financeiro: 'RATEIO - VALOR R$ (Tributário) - [FINANCEIRO]',
  rateio_porcentagem_tributario_financeiro: 'RATEIO - PORCENTAGEM % (Tributário) - [CC]',
  rateio_valor_contratos_financeiro: 'RATEIO - VALOR R$ (Contratos / Societário) - [FINANCEIRO]',
  rateio_porcentagem_contratos_financeiro: 'RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC]',
  rateio_valor_add_financeiro: 'RATEIO - VALOR R$ (ADD) - [FINANCEIRO]',
  rateio_porcentagem_add_financeiro: 'RATEIO - PORCENTAGEM % (ADD) - [CC]',
  indice_reajuste_financeiro: 'Índice de Reajuste - [FINANCEIRO]',
  periodicidade_reajuste_financeiro: 'Periodicidade do Reajuste - [FINANCEIRO]',
  observacoes_financeiro: 'Observações - [FINANCEIRO]',
  id_sharepoint_financeiro: 'ID SHAREPOINT [FINANCEIRO]',
  status_financeiro: 'STATUS [FINANCEIRO]',
}

// Stage names que não entram na validação (linhas ignoradas)
const DISREGARD_STAGE_NAMES = [
  'Contato Inicial',
  'Contato feito',
  'Contato Trimestral',
  'Descartados',
  'Mensagem Enviada',
  'Suspenso',
  'Lead Quente',
  'Contato Mensal',
  'Lead Capturado',
  'Reunião Realizada',
  'Contatos',
  'Novos Contatos',
  'Execução do Serviço',
].map((s) => s.trim().toLowerCase())

// --- Configuração: ativar/desativar validações por campo (frontend envia validationConfig no body) ---
const DEFAULT_VALIDATION_CONFIG = {
  cadastro_lead: {
    solicitante: true,
    email: true,
    cadastrado_por: true,
    due_diligence: true,
    local_reuniao: true,
    tipo_de_lead: true,
    razao_social: true,
    cnpj: true,
    areas_analise: false, // não considerado mais na validação
    prazo_reuniao_due: true,
    horario_due: true,
    indicacao: true,
    nome_indicacao: true,
  },
  confecao_proposta: {
    razao_social_cp: true,
    cnpj_cp: true,
    qualificacao_completa: true,
    areas_objeto_contrato_cp: true,
    realizou_due_diligence: true,
    gestor_contrato_cp: true,
    nome_ponto_focal: true,
    email_ponto_focal: true,
    telefone_ponto_focal: true,
    captador_cp: true,
    tributacao_cp: true,
    prazo_entrega_cp: true,
    data_primeiro_vencimento_cp: true,
    informacoes_adicionais_cp: true,
    demais_razoes_sociais_cp: true,
    // link_da_proposta obrigatório apenas na etapa "Proposta enviada"
  },
  proposta_enviada: {
    link_da_proposta: true,
  },
  confecao_contrato: {
    tipo_pagamento_cc: true,
    objeto_contrato_cc: true,
    valores_cc: true,
    rateio_cc: true,
    prazo_contrato_cc: true,
    link_do_contrato: true,
  },
}

function mergeValidationConfig(userConfig) {
  if (!userConfig || typeof userConfig !== 'object') return DEFAULT_VALIDATION_CONFIG
  const merged = {}
  for (const scope of Object.keys(DEFAULT_VALIDATION_CONFIG)) {
    merged[scope] = { ...DEFAULT_VALIDATION_CONFIG[scope] }
    if (userConfig[scope] && typeof userConfig[scope] === 'object') {
      for (const key of Object.keys(userConfig[scope])) {
        if (merged[scope][key] !== undefined) merged[scope][key] = !!userConfig[scope][key]
      }
    }
  }
  return merged
}

// --- Validação (mesma lógica do manual / scripts/n8n-validacao-etapas.js) ---
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/
const REGEX_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const REGEX_CNPJ_CPF = (v) =>
  typeof v === 'string' &&
  (REGEX_CNPJ.test(v.replace(/\s/g, '')) || REGEX_CPF.test(v.replace(/\s/g, '')))

// Parse de data para SLA: aceita ISO, DD/MM/YYYY, YYYY-MM-DD, serial (Google Sheets/Excel). Retorna ISO ou null.
function parseDateSheet(val) {
  if (val == null) return null
  // Google Sheets pode retornar data como número (serial: dias desde 1899-12-30)
  if (typeof val === 'number' && !Number.isNaN(val)) {
    const serial = val
    if (serial >= 1 && serial < 300000) {
      const ms = (serial - 25569) * 86400 * 1000 // 25569 = serial de 1970-01-01
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return null
  }
  const s = typeof val === 'string' ? val.trim() : String(val).trim()
  if (!s) return null
  // String que é só número: tratar como serial (planilha exportada como texto)
  const asNum = Number(s)
  if (!Number.isNaN(asNum) && asNum >= 1 && asNum < 300000) {
    const ms = (asNum - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  // ISO ou "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..."
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return new Date(iso).toISOString()
  // DD/MM/YYYY ou MM/DD/YYYY (planilha/Sheets pode vir em US). Evitar rollover: se 2º número > 12 = MM/DD.
  const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:](\d{2})(?::(\d{2}))?)?/
  const m = s.match(ddmmyyyy)
  if (m) {
    const [, n1, n2, y, h, min, sec] = m.map(Number)
    let day, month
    if (n2 > 12) {
      // 2º número > 12 → interpretar como MM/DD/YYYY (ex.: 01/15/2025 = 15 jan 2025)
      month = (n1 || 1) - 1
      day = n2 || 1
    } else if (n1 > 12) {
      // 1º número > 12 → só pode ser DD/MM (ex.: 27/01/2026)
      day = n1
      month = (n2 || 1) - 1
    } else {
      // Ambos <= 12: assumir DD/MM/YYYY (padrão BR)
      day = n1 || 1
      month = (n2 || 1) - 1
    }
    const d2 = new Date(y, month, day, h || 0, min || 0, sec || 0)
    if (!Number.isNaN(d2.getTime())) return d2.toISOString()
  }
  return null
}

// Telefone BR: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX — exige 10 ou 11 dígitos
function telefoneValido(val) {
  if (!val || typeof val !== 'string') return false
  const digits = val.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

// Link da proposta / Link do contrato: deve ser diretório oficial (SharePoint, VIOS, etc.)
// Ex.: https://bpplaw2.sharepoint.com/... ou https://...sharepoint... ou https://...vios...
function linkPropostaOuContratoValido(val) {
  if (!val || typeof val !== 'string') return false
  const url = val.trim().toLowerCase()
  if (!url.startsWith('https://')) return false
  return url.includes('bpplaw2.sharepoint.com') || url.includes('sharepoint') || url.includes('vios')
}

// Nome completo: pelo menos 2 palavras (nome + sobrenome)
function nomeCompletoValido(val) {
  if (!val || typeof val !== 'string') return false
  const words = val.trim().split(/\s+/).filter((w) => w.length > 0)
  return words.length >= 2
}

// Solicitante: nomes corretos (exatamente como devem ser preenchidos)
const SOLICITANTE_NOMES_VALIDOS = [
  'Gustavo Bismarchi',
  'Ricardo Viscardi Pires',
  'Giancarlo Zotini',
  'Gabriela Consul',
  'Michel Malaquias',
  'Daniel Pressatto Fernandes',
  'Renato Vallim',
  'Wagner Armani',
  'Jansonn Mendonça Batista',
  'Leonardo Loureiro Basso',
  'Felipe Camargo',
  'Ligia Lopes',
  'Francisco Zanin',
  'Jorge Pecht Souza',
]

function normalizarNomeParaComparacao(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function solicitanteNomeValido(val) {
  if (!val || typeof val !== 'string') return false
  const n = normalizarNomeParaComparacao(val)
  return SOLICITANTE_NOMES_VALIDOS.some((nome) => normalizarNomeParaComparacao(nome) === n)
}

// E-mail: o correto é @bismarchipires.com.br; @bpplaw.com.br deve ser corrigido
const DOMINIO_CORRETO = 'bismarchipires.com.br'
const DOMINIO_ALTERNATIVO = 'bpplaw.com.br'

function emailUsaDominioErrado(val) {
  if (!val || typeof val !== 'string') return false
  const lower = val.trim().toLowerCase()
  return lower.endsWith('@' + DOMINIO_ALTERNATIVO)
}

function vazio(val) {
  if (val == null) return true
  if (typeof val === 'string') return val.trim() === ''
  if (Array.isArray(val)) return val.length === 0
  return false
}

function addError(errors, field, message, comoCorrigir, valorAtual) {
  const valor_atual = valorAtual !== undefined && valorAtual !== null ? String(valorAtual).trim() : ''
  errors.push({
    field,
    message,
    comoCorrigir: comoCorrigir || message,
    valor_atual: valor_atual === '' ? '(vazio)' : valor_atual,
  })
}

function addErrorIfEnabled(errors, config, scope, fieldKey, fieldLabel, message, comoCorrigir, valorAtual) {
  const scopeConfig = config && config[scope]
  if (scopeConfig && scopeConfig[fieldKey] === false) return
  addError(errors, fieldLabel, message, comoCorrigir, valorAtual)
}

function validarCadastroLead(data, config) {
  const errors = []
  const get = (key) => data[key]
  const add = (scope, key, label, msg, corrigir, val) =>
    addErrorIfEnabled(errors, config, scope, key, label, msg, corrigir, val)

  const sol = (get('solicitante') ?? '').toString().trim()
  if (vazio(sol))
    add('cadastro_lead', 'solicitante', 'Solicitante', 'Campo obrigatório.', 'Use um dos nomes cadastrados (ex.: Gustavo Bismarchi, Ricardo Viscardi Pires).', sol)
  else if (!solicitanteNomeValido(sol))
    add('cadastro_lead', 'solicitante', 'Solicitante', 'Nome incorreto. Deve ser um dos colaboradores cadastrados.', 'Preencha exatamente como: ' + SOLICITANTE_NOMES_VALIDOS.join(', '), sol)

  const emailVal = (get('email') ?? '').toString().trim()
  if (vazio(emailVal))
    add('cadastro_lead', 'email', 'E-mail do Solicitante', 'Campo obrigatório.', 'E-mail corporativo válido.', emailVal)
  else if (!REGEX_EMAIL.test(emailVal))
    add('cadastro_lead', 'email', 'E-mail do Solicitante', 'E-mail inválido.', 'Use e-mail corporativo válido.', emailVal)
  else if (emailUsaDominioErrado(emailVal))
    add('cadastro_lead', 'email', 'E-mail do Solicitante', 'Use o domínio @bismarchipires.com.br.', 'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).', emailVal)

  const cadPor = (get('cadastrado_por') ?? '').toString().trim()
  if (vazio(cadPor))
    add('cadastro_lead', 'cadastrado_por', 'Cadastro realizado por (e-mail)', 'Campo obrigatório.', 'E-mail do colaborador.', cadPor)
  else if (!REGEX_EMAIL.test(cadPor))
    add('cadastro_lead', 'cadastrado_por', 'Cadastro realizado por (e-mail)', 'E-mail inválido.', 'Use e-mail corporativo válido.', cadPor)
  else if (emailUsaDominioErrado(cadPor))
    add('cadastro_lead', 'cadastrado_por', 'Cadastro realizado por (e-mail)', 'Use o domínio @bismarchipires.com.br.', 'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).', cadPor)

  if (vazio(get('due_diligence')))
    add('cadastro_lead', 'due_diligence', 'Haverá Due Diligence?', 'Campo obrigatório.', 'Selecione "Sim" ou "Não".', get('due_diligence'))
  if (vazio(get('local_reuniao')))
    add('cadastro_lead', 'local_reuniao', 'Local da Reunião', 'Campo obrigatório.', 'Endereço, link ou "A definir".', get('local_reuniao'))

  // Tipo de Lead: pode vir em tipo_de_lead, tipo_lead, tipo_do_lead ou coluna cujo nome contenha "tipo" e "lead"
  let tipoLeadVal = get('tipo_de_lead') ?? get('tipo_lead') ?? get('tipo_do_lead')
  if ((tipoLeadVal == null || String(tipoLeadVal).trim() === '') && typeof data === 'object') {
    const tipoLeadKey = Object.keys(data).find(
      (k) => /tipo/.test(k) && /lead/.test(k) && data[k] != null && String(data[k]).trim() !== ''
    )
    if (tipoLeadKey) tipoLeadVal = data[tipoLeadKey]
  }
  if (vazio(tipoLeadVal))
    add('cadastro_lead', 'tipo_de_lead', 'Tipo de Lead', 'Campo obrigatório.', 'Indicação | Lead Ativa | Lead Digital | Lead Passiva', tipoLeadVal)

  let temRazaoCnpj = false
  const rsc = get('razao_social_cnpj')
  if (Array.isArray(rsc) && rsc.length > 0) {
    const primeiro = rsc[0]
    const rs = primeiro && (primeiro.razao_social ?? primeiro.razao_social_cnpj)
    const cnpj = primeiro && (primeiro.cnpj ?? primeiro.cnpj_cpf)
    if (!vazio(rs) && !vazio(cnpj)) {
      temRazaoCnpj = true
      // Formatação CNPJ/CPF desconsiderada: não validar máscara
    }
  }
  const rs = get('razao_social')
  const cnpjVal = get('cnpj') ?? get('cnpj_cpf')
  if (!temRazaoCnpj) {
    if (vazio(rs))
      add('cadastro_lead', 'razao_social', 'Razão Social / Nome Completo', 'Campo obrigatório.', 'Para PJ use CAIXA ALTA.', rs)
    if (vazio(cnpjVal))
      add('cadastro_lead', 'cnpj', 'CNPJ/CPF', 'Campo obrigatório.', 'Informe CNPJ ou CPF.', cnpjVal)
    // Formatação CNPJ/CPF desconsiderada: não validar máscara
  }

  // Áreas Envolvidas: não considerado mais na validação (removido conforme configuração)

  if (String(get('due_diligence')).trim().toLowerCase() === 'sim') {
    // Prazo de Entrega da Due: "A definir" é aceito; só exige quando estiver vazio
    if (vazio(get('prazo_reuniao_due')))
      add('cadastro_lead', 'prazo_reuniao_due', 'Prazo de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Informe a data de entrega ou "A definir".', get('prazo_reuniao_due'))
    // "A definir" é aceito quando a pessoa ainda não tem o horário
    const horarioDue = String(get('horario_due') ?? '').trim()
    if (!horarioDue)
      add('cadastro_lead', 'horario_due', 'Horário de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Informe o horário ou use "A definir" se ainda não tiver.', get('horario_due'))
  }

  const tipoLead = String(tipoLeadVal ?? '').trim().toLowerCase()
  if (tipoLead === 'indicacao' || tipoLead === 'indicação') {
    if (vazio(get('indicacao')))
      add('cadastro_lead', 'indicacao', 'Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Fundo | Consultor | Cliente | etc.', get('indicacao'))
    if (vazio(get('nome_indicacao')))
      add('cadastro_lead', 'nome_indicacao', 'Nome da Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Nome de quem indicou.', get('nome_indicacao'))
  }

  return { valid: errors.length === 0, errors }
}

// Confecção de proposta (Funil de vendas): todos os campos [CP] conforme manual
function validarConfecaoProposta(data, config) {
  const errors = []
  const get = (key) => data[key]
  const add = (scope, key, label, msg, corrigir, val) =>
    addErrorIfEnabled(errors, config, scope, key, label, msg, corrigir, val)

  const scope = 'confecao_proposta'

  // Razão Social [CP] – MAIÚSCULO para PJ (coluna pode ser razao_social_completa ou razao_social → mesma chave)
  const razaoSocialCp = (get('razao_social_completa') ?? get('razao_social') ?? get('razao_social_cp') ?? '').toString().trim()
  if (vazio(razaoSocialCp))
    add(scope, 'razao_social_cp', 'Razão Social [CP]', 'Campo obrigatório.', 'Nome jurídico em MAIÚSCULO. Ex.: ALFA SOLUÇÕES LTDA', razaoSocialCp)

  // CNPJ [CP] – formato Receita Federal (coluna pode ser cnpj, cnpj_cpf ou cnpj_cp → data usa cnpj ou cnpj_cp)
  const cnpjCp = (get('cnpj') ?? get('cnpj_cp') ?? '').toString().trim()
  if (vazio(cnpjCp))
    add(scope, 'cnpj_cp', 'CNPJ [CP]', 'Campo obrigatório.', 'CNPJ ou CPF no formato da Receita Federal.', cnpjCp)

  // Qualificação completa (endereço, CEP, e-mail etc.) – aceita "N/A" se não aplicável (chave: qualificacao_completa)
  const qualificacao = (get('qualificacao_completa') ?? '').toString().trim()
  if (vazio(qualificacao))
    add(scope, 'qualificacao_completa', 'Qualificação completa [CP]', 'Campo obrigatório.', 'Endereço completo, CEP e e-mail corporativo. Ou "N/A".', qualificacao)
  else if (qualificacao.toLowerCase() !== 'n/a' && qualificacao.length < 10)
    add(scope, 'qualificacao_completa', 'Qualificação completa [CP]', 'Dados insuficientes.', 'Preencha endereço, CEP e e-mail ou use "N/A".', qualificacao)

  // Áreas Objeto do contrato [CP] — coluna na planilha pode ser "areas_cp" (mapeada para areas_objeto_contrato_cp em data)
  const areasObjeto = get('areas_objeto_contrato_cp') ?? get('areas_cp')
  const areasObjetoPreenchido = (val) => {
    if (val == null) return false
    if (Array.isArray(val)) return val.length > 0 && val.some((x) => x != null && String(x).trim() !== '')
    const s = typeof val === 'string' ? val.trim() : String(val).trim()
    return s !== '' && s.toLowerCase() !== 'a definir'
  }
  if (!areasObjetoPreenchido(areasObjeto))
    add(scope, 'areas_objeto_contrato_cp', 'Áreas Objeto do contrato [CP]', 'Campo obrigatório.', 'Selecione ao menos uma área (Cível, Tributário, etc.).', areasObjeto)

  // Realizou Due Diligence? [CP] (coluna pode ser realizou_due_diligence ou realizou_due_diligence_cp → mesma chave)
  const realizouDue = (get('realizou_due_diligence') ?? '').toString().trim().toLowerCase()
  if (vazio(realizouDue) || (realizouDue !== 'sim' && realizouDue !== 'nao' && realizouDue !== 'não'))
    add(scope, 'realizou_due_diligence', 'Realizou Due Diligence? [CP]', 'Campo obrigatório.', 'Selecione "Sim" ou "Não".', get('realizou_due_diligence'))

  // Gestor do Contrato [CP] (coluna pode ser gestor_do_contrato_cp, gestor_contrato_cp, gestor_do_contrato, gestor_contrato → chave gestor_contrato_cp)
  const gestorContrato = (get('gestor_contrato_cp') ?? get('gestor_contrato') ?? '').toString().trim()
  if (vazio(gestorContrato))
    add(scope, 'gestor_contrato_cp', 'Gestor do Contrato [CP]', 'Campo obrigatório.', 'Nome completo do colaborador responsável.', gestorContrato)

  const nomePf = (get('nome_ponto_focal') ?? get('nome_do_ponto_focal') ?? '').toString().trim()
  if (vazio(nomePf)) {
    add(scope, 'nome_ponto_focal', 'Nome do ponto focal / Comercial [CP]', 'Campo obrigatório.', 'Nome completo. Ex.: Maria Costa Silva', nomePf)
  } else if (!nomeCompletoValido(nomePf)) {
    add(scope, 'nome_ponto_focal', 'Nome do ponto focal / Comercial [CP]', 'Informe nome completo (nome e sobrenome).', 'Ex.: Maria Costa Silva — não use apenas o primeiro nome.', nomePf)
  }

  const emailPf = (get('email_ponto_focal') ?? get('email_do_ponto_focal') ?? '').toString().trim()
  if (vazio(emailPf)) {
    add(scope, 'email_ponto_focal', 'E-mail do ponto focal / Comercial [CP]', 'Campo obrigatório.', 'E-mail corporativo válido.', emailPf)
  } else if (!REGEX_EMAIL.test(emailPf)) {
    add(scope, 'email_ponto_focal', 'E-mail do ponto focal / Comercial [CP]', 'E-mail inválido.', 'Use e-mail corporativo ativo.', emailPf)
  } else if (emailUsaDominioErrado(emailPf)) {
    add(scope, 'email_ponto_focal', 'E-mail do ponto focal / Comercial [CP]', 'Use o domínio @bismarchipires.com.br.', 'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).', emailPf)
  }

  const telPf = (get('telefone_ponto_focal') ?? get('telefone_do_ponto_focal') ?? '').toString().trim()
  if (vazio(telPf)) {
    add(scope, 'telefone_ponto_focal', 'Telefone do ponto focal / Comercial [CP]', 'Campo obrigatório.', '(DD) 9XXXX-XXXX ou (DD) XXXX-XXXX', telPf)
  } else if (!telefoneValido(telPf)) {
    add(scope, 'telefone_ponto_focal', 'Telefone do ponto focal / Comercial [CP]', 'Telefone inválido ou incompleto.', 'Inclua DDD e número. Ex.: (11) 91234-5678 ou (11) 1234-5678', telPf)
  }

  // Captador [CP] (coluna pode ser captador_cp ou captador → chave captador_cp)
  const captador = (get('captador_cp') ?? get('captador') ?? '').toString().trim()
  if (vazio(captador))
    add(scope, 'captador_cp', 'Captador [CP]', 'Campo obrigatório.', 'Nome ou identificação do colaborador que captou o lead.', captador)

  // Tributação [CP] – Líquido/Englobando Tributos ou Bruto/Sem Tributos (coluna pode ser tributacao_cp ou tributacao → chave tributacao_cp)
  const tributacao = (get('tributacao_cp') ?? get('tributacao') ?? '').toString().trim().toLowerCase()
  const tributacaoOk = tributacao.includes('valor líquido de tributos') || tributacao.includes('bruto') || tributacao.includes('englobando') || tributacao.includes('sem tributos')
  if (vazio(tributacao) || !tributacaoOk)
    add(scope, 'tributacao_cp', 'Tributação [CP]', 'Campo obrigatório.', 'Líquido/Englobando Tributos ou Bruto/Sem Tributos', tributacao || (get('tributacao_cp') ?? get('tributacao')))

  // Prazo para entrega (mínimo 2 dias úteis) [CP] – data DD/MM/AAAA (coluna pode ser prazo_para_entrega_cp, prazo_entrega_cp, prazo_para_entrega → chave prazo_entrega_cp)
  const prazoEntrega = (get('prazo_entrega_cp') ?? get('prazo_para_entrega_cp') ?? get('prazo_para_entrega') ?? '').toString().trim()
  if (vazio(prazoEntrega))
    add(scope, 'prazo_entrega_cp', 'Prazo para entrega [CP]', 'Campo obrigatório.', 'Formato DD/MM/AAAA. Mínimo 2 dias úteis.', prazoEntrega)
  else if (!dataDDMMAAAAValida(prazoEntrega) && !prazoEntrega.toLowerCase().includes('exceção'))
    add(scope, 'prazo_entrega_cp', 'Prazo para entrega [CP]', 'Data inválida.', 'Formato DD/MM/AAAA. Exceção: informar motivo.', prazoEntrega)

  // Data do primeiro vencimento [CP] (coluna pode ser data_do_primeiro_vencimento_cp, data_primeiro_vencimento_cp, etc. → chave data_primeiro_vencimento_cp)
  const dataPrimeiroVenc = (get('data_primeiro_vencimento_cp') ?? get('data_do_primeiro_vencimento_cp') ?? get('data_primeiro_vencimento') ?? '').toString().trim()
  if (vazio(dataPrimeiroVenc))
    add(scope, 'data_primeiro_vencimento_cp', 'Data do primeiro vencimento [CP]', 'Campo obrigatório.', 'Formato DD/MM/AAAA.', dataPrimeiroVenc)
  else if (!dataDDMMAAAAValida(dataPrimeiroVenc))
    add(scope, 'data_primeiro_vencimento_cp', 'Data do primeiro vencimento [CP]', 'Data inválida.', 'Formato DD/MM/AAAA. Ex.: 15/07/2025', dataPrimeiroVenc)

  // Informações adicionais [CP] – pode ser N/A (coluna pode ser informacoes_adicionais_cp ou informacoes_adicionais → chave informacoes_adicionais_cp)
  const infoAdic = (get('informacoes_adicionais_cp') ?? get('informacoes_adicionais') ?? '').toString().trim()
  if (vazio(infoAdic))
    add(scope, 'informacoes_adicionais_cp', 'Informações adicionais [CP]', 'Campo obrigatório.', 'Informe detalhes ou "N/A" se não houver.', infoAdic)

  // Demais Razões Sociais [CP] – pode ser N/A se só uma razão (coluna pode ser demais_razoes_sociais_cp ou demais_razoes_sociais → chave demais_razoes_sociais_cp)
  const demaisRazoes = (get('demais_razoes_sociais_cp') ?? get('demais_razoes_sociais') ?? '').toString().trim()
  if (vazio(demaisRazoes))
    add(scope, 'demais_razoes_sociais_cp', 'Demais Razões Sociais [CP]', 'Campo obrigatório.', 'Liste as demais razões com ; ou "N/A" se houver apenas uma.', demaisRazoes)

  // Link da Proposta: obrigatório apenas na etapa "Proposta enviada" (validado em validarPropostaEnviada)

  return { valid: errors.length === 0, errors }
}

// Confecção de contrato [CC]: tipo pagamento, objeto, valores, rateio %, prazo, link
// Opções válidas conforme manual: Mensal, Spot à vista, Spot parcelado, Escalonado, Variável, Alternativo, Só êxito
const TIPO_PAGAMENTO_OPCOES = [
  'mensal',
  'spot à vista',
  'spot a vista',
  'spot parcelado',
  'escalonado',
  'variável',
  'variavel',
  'alternativo',
  'só êxito',
  'so exito',
  'exito',
]
const REGEX_DATA_DDMMAAAA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const VALOR_CC_KEYS = [
  'valor_mensal_fixo_cc',
  'valor_mensal_preco_fechado_cc',
  'valor_mensal_escalonado_cc',
  'valor_mensal_variavel_cc',
  'valor_mensal_condicionado_cc',
  'valor_spot_cc',
  'valor_spot_manutencao_cc',
  'valor_spot_parcelado_cc',
  'valor_spot_parcelado_manutencao_cc',
  'valor_spot_condicionado_cc',
  'valor_exito_cc',
]
const VALOR_CC_LABEL = {
  valor_mensal_fixo_cc: 'Mensal – Fixo Valor R$ [CC]',
  valor_mensal_preco_fechado_cc: 'Mensal - Preço Fechado Parcelado - Valor R$ [CC]',
  valor_mensal_escalonado_cc: 'Mensal – Escalonado - Valor R$ [CC]',
  valor_mensal_variavel_cc: 'Mensal – Variável - Valor R$ [CC]',
  valor_mensal_condicionado_cc: 'Mensal – Condicionado - Valor R$ [CC]',
  valor_spot_cc: 'SPOT - Valor R$ [CC]',
  valor_spot_manutencao_cc: 'SPOT com Manutenção - Valor R$ [CC]',
  valor_spot_parcelado_cc: 'SPOT – Parcelado - Valor R$ [CC]',
  valor_spot_parcelado_manutencao_cc: 'SPOT - Parcelado com manutenção - Valor R$ [CC]',
  valor_spot_condicionado_cc: 'SPOT – Condicionado - Valor R$ [CC]',
  valor_exito_cc: 'Êxito - Valor R$ [CC]',
}
const RATEIO_CC_KEYS = [
  'rateio_reestruturacao_cc',
  'rateio_civel_cc',
  'rateio_trabalhista_cc',
  'rateio_tributario_cc',
  'rateio_contratos_cc',
  'rateio_add_cc',
]
const RATEIO_CC_LABEL = {
  rateio_reestruturacao_cc: 'RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC]',
  rateio_civel_cc: 'RATEIO - PORCENTAGEM % (Cível) - [CC]',
  rateio_trabalhista_cc: 'RATEIO - PORCENTAGEM % (Trabalhista) - [CC]',
  rateio_tributario_cc: 'RATEIO - PORCENTAGEM % (Tributário) - [CC]',
  rateio_contratos_cc: 'RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC]',
  rateio_add_cc: 'RATEIO - PORCENTAGEM % (ADD) - [CC]',
}

function valorNumericoCCValido(v) {
  if (v == null || v === '') return true
  const s = String(v).trim()
  if (s === '0' || s === '0.00') return true
  return /^\d+(\.\d+)?$/.test(s)
}

function rateioPercentValido(v) {
  if (v == null || v === '') return true
  const s = String(v).trim()
  return /^\d+%$/.test(s)
}

function dataDDMMAAAAValida(v) {
  if (!v || typeof v !== 'string') return false
  const m = v.trim().match(REGEX_DATA_DDMMAAAA)
  if (!m) return false
  const d = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const y = parseInt(m[3], 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  if (y < 2000 || y > 2100) return false
  return true
}

function validarConfecaoContrato(data, config) {
  const errors = []
  const get = (key) => data[key]
  const scope = 'confecao_contrato'
  const add = (scopeKey, fieldKey, label, msg, corrigir, val) =>
    addErrorIfEnabled(errors, config, scopeKey, fieldKey, label, msg, corrigir, val)

  const tipoPag = (get('tipo_pagamento_cc') ?? get('tipo_de_pagamento_cc') ?? '').toString().trim()
  if (vazio(tipoPag)) {
    add(scope, 'tipo_pagamento_cc', 'Tipo de pagamento [CC]', 'Campo obrigatório.', 'Mensal, Spot à vista, Spot parcelado, Escalonado, Variável, Alternativo, Só êxito', tipoPag)
  } else {
    const norm = tipoPag.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
    const ok = TIPO_PAGAMENTO_OPCOES.some((o) => {
      const normOpt = o.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
      return normOpt && (norm.includes(normOpt) || normOpt.includes(norm))
    })
    if (!ok) {
      add(scope, 'tipo_pagamento_cc', 'Tipo de pagamento [CC]', 'Opção inválida.', 'Selecione: Mensal, Spot à vista, Spot parcelado, Escalonado, Variável, Alternativo, Só êxito', tipoPag)
    }
  }

  const objeto = (get('objeto_contrato_cc') ?? get('objeto_do_contrato_cc') ?? get('escopo_contratual_cadastro') ?? '').toString().trim()
  if (vazio(objeto)) {
    add(scope, 'objeto_contrato_cc', 'Objeto do Contrato [CC]', 'Campo obrigatório.', 'Descrever de forma clara e completa o objeto do contrato (serviços, escopo, detalhes).', objeto)
  }

  for (const key of VALOR_CC_KEYS) {
    const label = VALOR_CC_LABEL[key] || key
    const v = get(key)
    if (v != null && String(v).trim() !== '' && !valorNumericoCCValido(v)) {
      add(scope, 'valores_cc', label, 'Apenas números.', 'Ex.: 1000 ou 1000.00. Se não se aplicar: 0 ou vazio.', v)
    }
  }

  for (const key of RATEIO_CC_KEYS) {
    const label = RATEIO_CC_LABEL[key] || key
    const v = get(key)
    if (v != null && String(v).trim() !== '' && !rateioPercentValido(v)) {
      add(scope, 'rateio_cc', label, 'Formato inválido.', 'Apenas número + %. Ex.: 50% ou 0%', v)
    }
  }

  const prazo = (get('prazo_contrato_cc') ?? get('prazo_confecao_contrato_cc') ?? get('prazo_entrega_contrato') ?? '').toString().trim()
  if (vazio(prazo)) {
    add(scope, 'prazo_contrato_cc', 'Prazo para Confecção do Contrato [CC]', 'Campo obrigatório.', 'Formato DD/MM/AAAA. Ex.: 25/07/2025', prazo)
  } else if (!dataDDMMAAAAValida(prazo)) {
    add(scope, 'prazo_contrato_cc', 'Prazo para Confecção do Contrato [CC]', 'Data inválida.', 'Formato DD/MM/AAAA. Ex.: 25/07/2025', prazo)
  }

  // Link do Contrato: obrigatório apenas a partir da etapa "Contrato Elaborado" (validado em validarLinkContratoQuandoElaborado)

  return { valid: errors.length === 0, errors }
}

// Etapa "Proposta enviada": apenas Link da Proposta é obrigatório (conforme manual)
function validarPropostaEnviada(data, config) {
  const errors = []
  const get = (key) => data[key]
  const scope = 'proposta_enviada'
  const add = (scopeKey, fieldKey, label, msg, corrigir, val) =>
    addErrorIfEnabled(errors, config, scopeKey, fieldKey, label, msg, corrigir, val)

  const linkProposta = (get('link_da_proposta') ?? get('link_proposta') ?? '').toString().trim()
  const linkPropostaEhNaPropostaSimples = /^N\/A\s*[-–—]?\s*Proposta simples por (telefone|whatsapp)/i.test(linkProposta)
  if (vazio(linkProposta)) {
    add(scope, 'link_da_proposta', 'Link da Proposta', 'Campo obrigatório na etapa Proposta enviada.', 'Link ou caminho para a pasta compartilhada (SharePoint, VIOS, etc.). Ex.: https://bpplaw2.sharepoint.com/...', linkProposta)
  } else if (!linkPropostaEhNaPropostaSimples && !linkPropostaOuContratoValido(linkProposta)) {
    add(scope, 'link_da_proposta', 'Link da Proposta', 'Link deve ser diretório oficial (SharePoint, VIOS).', 'Use link que comece com https:// e contenha sharepoint ou vios. Ex.: https://bpplaw2.sharepoint.com/...', linkProposta)
  }

  return { valid: errors.length === 0, errors }
}

// Link do Contrato: obrigatório apenas a partir da etapa "Contrato Elaborado" (e nas seguintes, ex.: Contrato Assinado)
function validarLinkContratoQuandoElaborado(data, config) {
  const errors = []
  const get = (key) => data[key]
  const scope = 'confecao_contrato'
  const add = (scopeKey, fieldKey, label, msg, corrigir, val) =>
    addErrorIfEnabled(errors, config, scopeKey, fieldKey, label, msg, corrigir, val)

  const linkContrato = (get('link_do_contrato') ?? get('link_contrato') ?? '').toString().trim()
  if (vazio(linkContrato)) {
    add(scope, 'link_do_contrato', 'Link do Contrato', 'Campo obrigatório a partir da etapa Contrato Elaborado.', 'Link para pasta compartilhada (SharePoint, VIOS). Ex.: https://bpplaw2.sharepoint.com/...', linkContrato)
  } else if (!linkPropostaOuContratoValido(linkContrato)) {
    add(scope, 'link_do_contrato', 'Link do Contrato', 'Link deve ser diretório oficial (SharePoint, VIOS).', 'Use link que comece com https:// e contenha sharepoint ou vios. Ex.: https://bpplaw2.sharepoint.com/...', linkContrato)
  }
  return { valid: errors.length === 0, errors }
}

function normStageForMatch(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Funil de vendas: validar cadastro do lead em todos os stages; Confecção de proposta tem regras extras
const FUNIL_VENDAS_KEY = 'funil de vendas'

function validarPorStageName(stageName, funil, data, config) {
  const fn = (funil || '').toString().trim().toLowerCase()
  const isFunilVendas = fn.includes(FUNIL_VENDAS_KEY) || fn.includes('vendas')

  if (!isFunilVendas) {
    return { valid: true, errors: [] }
  }

  const mergedConfig = mergeValidationConfig(config)
  const result = validarCadastroLead(data, mergedConfig)
  const sn = normStageForMatch(stageName)
  const isConfecaoProposta = sn.includes('confec') && sn.includes('proposta')
  const isConfecaoContrato = sn.includes('confec') && sn.includes('contrato')
  const isPropostaEnviada = sn.includes('proposta') && sn.includes('enviada') && !isConfecaoProposta
  // Link do Contrato: cobrado apenas a partir de "Contrato Elaborado" ou "Contrato Assinado" (e etapas posteriores)
  const isContratoElaboradoOuPosterior = sn.includes('contrato') && (sn.includes('elaborado') || sn.includes('assinado'))

  if (isConfecaoProposta) {
    const extra = validarConfecaoProposta(data, mergedConfig)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  if (isPropostaEnviada) {
    const extra = validarPropostaEnviada(data, mergedConfig)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  if (isConfecaoContrato) {
    const extra = validarConfecaoContrato(data, mergedConfig)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  if (isContratoElaboradoOuPosterior) {
    const extra = validarLinkContratoQuandoElaborado(data, mergedConfig)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  return result
}

// --- Handler Vercel ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  // GET: retorna configuração de validação, mapeamento coluna→chave e labels do CRM por variável
  if (req.method === 'GET') {
    const keyToColumns = {}
    for (const [colNorm, key] of Object.entries(COLUMN_TO_KEY)) {
      if (!keyToColumns[key]) keyToColumns[key] = []
      if (!keyToColumns[key].includes(colNorm)) keyToColumns[key].push(colNorm)
    }
    return res.status(200).json({
      defaultValidationConfig: DEFAULT_VALIDATION_CONFIG,
      columnMapping: keyToColumns,
      crmFieldLabels: CRM_FIELD_LABELS,
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { accessToken, spreadsheetId, sheetName, range: rangeParam, validationConfig, columnOverrides } = req.body || {}

    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({
        error: 'Faltam parâmetros',
        message: 'Envie accessToken e spreadsheetId no body (JSON).',
      })
    }

    // A:ZZ = muitas colunas (a planilha RD tem dezenas de colunas: email_solicitante, tipo_lead, etc.)
    const rangeStr = rangeParam || (sheetName ? `'${sheetName}'!A:ZZ` : 'A:ZZ')
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeStr)}`

    const sheetRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const sheetData = await sheetRes.json()
    if (sheetData.error) {
      return res.status(400).json({
        error: 'Erro ao ler planilha',
        message: sheetData.error.message || 'Verifique o ID da planilha e se você tem acesso.',
      })
    }

    const rawRows = sheetData.values || []
    if (rawRows.length === 0) {
      return res.status(200).json({ results: [], total: 0, comErros: 0 })
    }

    const headers = rawRows[0].map((c) => (c != null ? String(c).trim() : ''))
    const effectiveColumnToKey = { ...COLUMN_TO_KEY }
    if (columnOverrides && typeof columnOverrides === 'object') {
      for (const [colNorm, key] of Object.entries(columnOverrides)) {
        if (colNorm && typeof colNorm === 'string' && key && typeof key === 'string') {
          effectiveColumnToKey[colNorm.trim().toLowerCase().replace(/\s+/g, '_')] = key.trim()
        }
      }
    }
    const headerNormToKey = {}
    headers.forEach((h) => {
      const n = normalizeHeader(h)
      if (effectiveColumnToKey[n] !== undefined) headerNormToKey[n] = effectiveColumnToKey[n]
      else headerNormToKey[n] = n || null
    })

    const results = []
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] || []
      const data = {}
      headers.forEach((h, j) => {
        const n = normalizeHeader(String(h ?? '').trim())
        const key = headerNormToKey[n] || n || `col_${j}`
        const cellVal = row[j]
        let strVal
        if (cellVal == null) {
          strVal = ''
        } else if (Array.isArray(cellVal)) {
          strVal = cellVal.map((v) => (v != null ? String(v).trim() : '')).filter(Boolean).join(', ') || ''
        } else {
          strVal = String(cellVal).trim()
        }
        // Planilha/CRM às vezes envia "[]" (array vazio como string): tratar como vazio para não sobrescrever valor bom.
        if (strVal === '[]' || strVal === '{}') strVal = ''
        // Várias colunas podem mapear para a mesma chave (email, areas_analise, stage_name, telefone_notificar, etc.).
        // Não sobrescrever valor já preenchido com vazio — manter o primeiro não vazio.
        const jaTemValor = data[key] != null && String(data[key]).trim() !== '' && String(data[key]).trim() !== '[]'
        if (strVal === '' && jaTemValor) return
        data[key] = strVal
      })

      // Planilha pode ter só email_solicitante: usar como email e como cadastrado_por
      if (!(data.cadastrado_por && data.cadastrado_por.trim())) {
        data.cadastrado_por = (data.email ?? '').trim()
      }

      const stageNameRaw = (data.stage_name ?? data.stage ?? '').toString().trim()
      if (stageNameRaw && DISREGARD_STAGE_NAMES.includes(stageNameRaw.toLowerCase())) {
        continue
      }

      let funilVal = (data.funil ?? '').toString().trim()
      if (!funilVal && stageNameRaw) {
        const sn = stageNameRaw.toLowerCase()
        if (/cadastro de novo cliente|inclusao no fluxo|inclusão no fluxo|boas-vindas|aguardando cadastro|kick-off|kickoff/i.test(sn)) {
          funilVal = 'Inclusão no fluxo de faturamento'
        } else {
          funilVal = 'Funil de vendas'
        }
      }

      const config = mergeValidationConfig(validationConfig)
      const { valid, errors } = validarPorStageName(stageNameRaw, funilVal, data, config)

      // Quem cobrar: E-mail do Solicitante (coluna email_solicitante → data.email)
      const email_solicitante = (data.email ?? data.email_do_solicitante ?? '').trim()
      const email_notificar = data.email_notificar?.trim() || email_solicitante || (data.cadastrado_por ?? '').trim()
      // Exibir "Nome" (nome da negociação/lead) como identificador do registro, não o id
      const id_registro = (data.nome ?? data.nome_lead ?? data.id_registro ?? data.deal_id ?? data.razao_social ?? '').trim() || `Linha ${i + 1}`

      // Status: planilha usa "won" para ganho, "lost" para perda
      const rawStatus = (data.status ?? data.estado ?? '').toString().trim().toLowerCase()
      const statusNorm = rawStatus.includes('loss') || rawStatus.includes('perd') || rawStatus === 'lost' || rawStatus === 'perda'
        ? 'lost'
        : rawStatus === 'won' || rawStatus.includes('win') || rawStatus.includes('ganh') || rawStatus.includes('vend') || rawStatus === 'ganho'
          ? 'win'
          : rawStatus.includes('ongoing') || rawStatus.includes('andamento') || rawStatus.includes('abert') || rawStatus === 'aberto'
            ? 'ongoing'
            : rawStatus || null

      const deal_id = ((data.deal_id ?? '').toString().trim() || null)
      const telefone_notificar = ((data.telefone_notificar ?? data.telefone_ponto_focal ?? '').toString().trim() || null)
      const areas = data.areas_analise != null && String(data.areas_analise).trim() !== '' && String(data.areas_analise).trim() !== '[]'
        ? String(data.areas_analise).trim()
        : null

      const updated_at_iso = parseDateSheet(data.updated_at ?? data.date_update)
      const created_at_iso = parseDateSheet(data.created_at ?? data.date_create)
      const follow_up_iso = parseDateSheet(data.follow_up)
      const follow_up_anotacao = (data.follow_up_anotacao ?? '').toString().trim() || null

      const refMovimentacao = updated_at_iso || created_at_iso
      const tsMovimentacao = refMovimentacao ? new Date(refMovimentacao).getTime() : null
      const diasDesdeMovimentacao =
        tsMovimentacao != null ? Math.floor((Date.now() - tsMovimentacao) / (24 * 60 * 60 * 1000)) : null

      const tsFollowUp = follow_up_iso ? new Date(follow_up_iso).getTime() : null
      const diasDesdeFollowUp =
        tsFollowUp != null ? Math.floor((Date.now() - tsFollowUp) / (24 * 60 * 60 * 1000)) : null

      results.push({
        rowIndex: i + 1,
        valid,
        errors,
        email_notificar,
        email_solicitante: email_solicitante || email_notificar,
        id_registro,
        stage_name: stageNameRaw || null,
        funil: funilVal || null,
        status: statusNorm,
        status_raw: (data.status ?? '').toString().trim() || null,
        motivo_perda: (data.motivo_perda ?? '').toString().trim() || null,
        deal_id,
        telefone_notificar,
        areas,
        updated_at_iso: updated_at_iso || null,
        created_at_iso: created_at_iso || null,
        follow_up_iso: follow_up_iso || null,
        follow_up_anotacao,
        dias_desde_movimentacao: diasDesdeMovimentacao,
        dias_desde_followup: diasDesdeFollowUp,
        razao_social: (data.razao_social ?? data.razao_social_cp ?? '').toString().trim() || null,
        nome_lead: (data.nome ?? data.nome_lead ?? '').toString().trim() || null,
        valor_mensal_fixo_cc: (data.valor_mensal_fixo_cc ?? '').toString().trim() || null,
        valor_exito_cc: (data.valor_exito_cc ?? '').toString().trim() || null,
        valor_mensal_preco_fechado_cc: (data.valor_mensal_preco_fechado_cc ?? '').toString().trim() || null,
        // Dados completos da planilha para exibir no detalhe da negociação ganha
        planilha: data,
      })
    }

    const comErros = results.filter((r) => !r.valid).length

    return res.status(200).json({
      results,
      total: results.length,
      comErros,
    })
  } catch (err) {
    console.error('validar-sheets error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Tente novamente mais tarde.',
    })
  }
}
