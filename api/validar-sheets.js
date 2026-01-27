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
].map((s) => s.trim().toLowerCase())

// --- Validação (mesma lógica do manual / scripts/n8n-validacao-etapas.js) ---
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/
const REGEX_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const REGEX_CNPJ_CPF = (v) =>
  typeof v === 'string' &&
  (REGEX_CNPJ.test(v.replace(/\s/g, '')) || REGEX_CPF.test(v.replace(/\s/g, '')))

// Parse de data para SLA: aceita ISO, DD/MM/YYYY, YYYY-MM-DD, etc. Retorna ISO ou null.
function parseDateSheet(val) {
  if (val == null || (typeof val === 'string' && !val.trim())) return null
  const s = String(val).trim()
  if (!s) return null
  // ISO ou "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..."
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return new Date(iso).toISOString()
  // DD/MM/YYYY ou DD/MM/YYYY HH:mm
  const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:](\d{2})(?::(\d{2}))?)?/
  const m = s.match(ddmmyyyy)
  if (m) {
    const [, d, mo, y, h, min, sec] = m.map(Number)
    const d2 = new Date(y, (mo || 1) - 1, d || 1, h || 0, min || 0, sec || 0)
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
  'Jansonn Mendonça',
  'Leonardo Loureiro',
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

function validarCadastroLead(data) {
  const errors = []
  const get = (key) => data[key]

  const sol = (get('solicitante') ?? '').toString().trim()
  if (vazio(sol))
    addError(errors, 'Solicitante', 'Campo obrigatório.', 'Use um dos nomes cadastrados (ex.: Gustavo Bismarchi, Ricardo Viscardi Pires).', sol)
  else if (!solicitanteNomeValido(sol))
    addError(
      errors,
      'Solicitante',
      'Nome incorreto. Deve ser um dos colaboradores cadastrados.',
      'Preencha exatamente como: ' + SOLICITANTE_NOMES_VALIDOS.join(', '),
      sol
    )

  const emailVal = (get('email') ?? '').toString().trim()
  if (vazio(emailVal))
    addError(errors, 'E-mail do Solicitante', 'Campo obrigatório.', 'E-mail corporativo válido.', emailVal)
  else if (!REGEX_EMAIL.test(emailVal))
    addError(errors, 'E-mail do Solicitante', 'E-mail inválido.', 'Use e-mail corporativo válido.', emailVal)
  else if (emailUsaDominioErrado(emailVal))
    addError(
      errors,
      'E-mail do Solicitante',
      'Use o domínio @bismarchipires.com.br.',
      'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).',
      emailVal
    )

  const cadPor = (get('cadastrado_por') ?? '').toString().trim()
  if (vazio(cadPor))
    addError(errors, 'Cadastro realizado por (e-mail)', 'Campo obrigatório.', 'E-mail do colaborador.', cadPor)
  else if (!REGEX_EMAIL.test(cadPor))
    addError(errors, 'Cadastro realizado por (e-mail)', 'E-mail inválido.', 'Use e-mail corporativo válido.', cadPor)
  else if (emailUsaDominioErrado(cadPor))
    addError(
      errors,
      'Cadastro realizado por (e-mail)',
      'Use o domínio @bismarchipires.com.br.',
      'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).',
      cadPor
    )

  if (vazio(get('due_diligence')))
    addError(errors, 'Haverá Due Diligence?', 'Campo obrigatório.', 'Selecione "Sim" ou "Não".', get('due_diligence'))
  if (vazio(get('local_reuniao')))
    addError(errors, 'Local da Reunião', 'Campo obrigatório.', 'Endereço, link ou "A definir".', get('local_reuniao'))

  // Tipo de Lead: pode vir em tipo_de_lead, tipo_lead, tipo_do_lead ou coluna cujo nome contenha "tipo" e "lead"
  let tipoLeadVal = get('tipo_de_lead') ?? get('tipo_lead') ?? get('tipo_do_lead')
  if ((tipoLeadVal == null || String(tipoLeadVal).trim() === '') && typeof data === 'object') {
    const tipoLeadKey = Object.keys(data).find(
      (k) => /tipo/.test(k) && /lead/.test(k) && data[k] != null && String(data[k]).trim() !== ''
    )
    if (tipoLeadKey) tipoLeadVal = data[tipoLeadKey]
  }
  if (vazio(tipoLeadVal))
    addError(errors, 'Tipo de Lead', 'Campo obrigatório.', 'Indicação | Lead Ativa | Lead Digital | Lead Passiva', tipoLeadVal)

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
      addError(errors, 'Razão Social / Nome Completo', 'Campo obrigatório.', 'Para PJ use CAIXA ALTA.', rs)
    if (vazio(cnpjVal))
      addError(errors, 'CNPJ/CPF', 'Campo obrigatório.', 'Informe CNPJ ou CPF.', cnpjVal)
    // Formatação CNPJ/CPF desconsiderada: não validar máscara
  }

  // Áreas Envolvidas: única fonte é a coluna areas_analise. Pode vir como array ["Cível","Tributário"] ou string. Apenas verificar se foi preenchido.
  const areas = get('areas_analise')
  const areasPreenchido = (val) => {
    if (val == null) return false
    if (Array.isArray(val)) return val.length > 0 && val.some((x) => x != null && String(x).trim() !== '')
    const s = typeof val === 'string' ? val.trim() : String(val).trim()
    if (s === '' || s.toLowerCase() === 'a definir') return false
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s)
        return Array.isArray(arr) && arr.length > 0
      } catch {
        return true
      }
    }
    return true
  }
  if (!areasPreenchido(areas))
    addError(errors, 'Áreas Envolvidas', 'Campo obrigatório.', 'Selecione ao menos uma área.', areas)

  if (String(get('due_diligence')).trim().toLowerCase() === 'sim') {
    if (vazio(get('prazo_reuniao_due')) || String(get('prazo_reuniao_due')).toLowerCase() === 'a definir')
      addError(errors, 'Prazo de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Informe a data de entrega.', get('prazo_reuniao_due'))
    if (vazio(get('horario_due')) || String(get('horario_due')).toLowerCase() === 'a definir')
      addError(errors, 'Horário de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Informe o horário de entrega.', get('horario_due'))
  }

  const tipoLead = String(tipoLeadVal ?? '').trim().toLowerCase()
  if (tipoLead === 'indicacao' || tipoLead === 'indicação') {
    if (vazio(get('indicacao')))
      addError(errors, 'Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Fundo | Consultor | Cliente | etc.', get('indicacao'))
    if (vazio(get('nome_indicacao')))
      addError(errors, 'Nome da Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Nome de quem indicou.', get('nome_indicacao'))
  }

  return { valid: errors.length === 0, errors }
}

// Confecção de proposta (Funil de vendas): Nome completo, e-mail e telefone do ponto focal/comercial
function validarConfecaoProposta(data) {
  const errors = []
  const get = (key) => data[key]

  const nomePf = (get('nome_ponto_focal') ?? '').toString().trim()
  if (vazio(nomePf)) {
    addError(errors, 'Nome do ponto focal / Comercial [CP]', 'Campo obrigatório.', 'Nome completo. Ex.: Maria Costa Silva', nomePf)
  } else if (!nomeCompletoValido(nomePf)) {
    addError(
      errors,
      'Nome do ponto focal / Comercial [CP]',
      'Informe nome completo (nome e sobrenome).',
      'Ex.: Maria Costa Silva — não use apenas o primeiro nome.',
      nomePf
    )
  }

  const emailPf = (get('email_ponto_focal') ?? '').toString().trim()
  if (vazio(emailPf)) {
    addError(errors, 'E-mail do ponto focal / Comercial [CP]', 'Campo obrigatório.', 'E-mail corporativo válido.', emailPf)
  } else if (!REGEX_EMAIL.test(emailPf)) {
    addError(errors, 'E-mail do ponto focal / Comercial [CP]', 'E-mail inválido.', 'Use e-mail corporativo ativo.', emailPf)
  } else if (emailUsaDominioErrado(emailPf)) {
    addError(
      errors,
      'E-mail do ponto focal / Comercial [CP]',
      'Use o domínio @bismarchipires.com.br.',
      'O correto a ser preenchido é com o domínio @bismarchipires.com.br (não @bpplaw.com.br).',
      emailPf
    )
  }

  const telPf = (get('telefone_ponto_focal') ?? '').toString().trim()
  if (vazio(telPf)) {
    addError(errors, 'Telefone do ponto focal / Comercial [CP]', 'Campo obrigatório.', '(DD) 9XXXX-XXXX ou (DD) XXXX-XXXX', telPf)
  } else if (!telefoneValido(telPf)) {
    addError(
      errors,
      'Telefone do ponto focal / Comercial [CP]',
      'Telefone inválido ou incompleto.',
      'Inclua DDD e número. Ex.: (11) 91234-5678 ou (11) 1234-5678',
      telPf
    )
  }

  const linkProposta = (get('link_da_proposta') ?? '').toString().trim()
  if (vazio(linkProposta)) {
    addError(errors, 'Link da Proposta', 'Campo obrigatório.', 'Link ou caminho para a pasta compartilhada (SharePoint, VIOS, etc.). Ex.: https://bpplaw2.sharepoint.com/...', linkProposta)
  } else if (!linkPropostaOuContratoValido(linkProposta)) {
    addError(
      errors,
      'Link da Proposta',
      'Link deve ser diretório oficial (SharePoint, VIOS).',
      'Use link que comece com https:// e contenha sharepoint ou vios. Ex.: https://bpplaw2.sharepoint.com/...',
      linkProposta
    )
  }

  return { valid: errors.length === 0, errors }
}

// Confecção de contrato [CC]: tipo pagamento, objeto, valores, rateio %, prazo, link
const TIPO_PAGAMENTO_OPCOES = [
  'mensal - fixo',
  'mensal - preço fechado parcelado',
  'mensal - escalonado',
  'mensal - variável',
  'mensal - condicionado',
  'spot - à vista',
  'spot - parcelado',
  'spot com manutenção',
  'spot - parcelado com manutenção',
  'spot - condicionado',
  'êxito',
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

function validarConfecaoContrato(data) {
  const errors = []
  const get = (key) => data[key]

  const tipoPag = (get('tipo_pagamento_cc') ?? '').toString().trim()
  if (vazio(tipoPag)) {
    addError(
      errors,
      'Tipo de pagamento [CC]',
      'Campo obrigatório.',
      'Mensal (Fixo, Preço Fechado Parcelado, Escalonado, Variável, Condicionado), SPOT (À vista, Parcelado, com Manutenção, Condicionado), Êxito',
      tipoPag
    )
  } else {
    const norm = tipoPag.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const ok = TIPO_PAGAMENTO_OPCOES.some((o) => norm.includes(o.replace(/\s+/g, ' ')))
    if (!ok) {
      addError(
        errors,
        'Tipo de pagamento [CC]',
        'Opção inválida.',
        'Selecione: Mensal - Fixo, Mensal - Preço Fechado Parcelado, Mensal - Escalonado, Mensal - Variável, Mensal - Condicionado, SPOT - À vista, SPOT - Parcelado, SPOT com Manutenção, SPOT - Condicionado, Êxito',
        tipoPag
      )
    }
  }

  const objeto = (get('objeto_contrato_cc') ?? '').toString().trim()
  if (vazio(objeto)) {
    addError(
      errors,
      'Objeto do Contrato [CC]',
      'Campo obrigatório.',
      'Descrever de forma clara e completa o objeto do contrato (serviços, escopo, detalhes).',
      objeto
    )
  }

  for (const key of VALOR_CC_KEYS) {
    const label = VALOR_CC_LABEL[key] || key
    const v = get(key)
    if (v != null && String(v).trim() !== '' && !valorNumericoCCValido(v)) {
      addError(errors, label, 'Apenas números.', 'Ex.: 1000 ou 1000.00. Se não se aplicar: 0 ou vazio.', v)
    }
  }

  for (const key of RATEIO_CC_KEYS) {
    const label = RATEIO_CC_LABEL[key] || key
    const v = get(key)
    if (v != null && String(v).trim() !== '' && !rateioPercentValido(v)) {
      addError(errors, label, 'Formato inválido.', 'Apenas número + %. Ex.: 50% ou 0%', v)
    }
  }

  const prazo = (get('prazo_contrato_cc') ?? '').toString().trim()
  if (vazio(prazo)) {
    addError(errors, 'Prazo para Confecção do Contrato [CC]', 'Campo obrigatório.', 'Formato DD/MM/AAAA. Ex.: 25/07/2025', prazo)
  } else if (!dataDDMMAAAAValida(prazo)) {
    addError(errors, 'Prazo para Confecção do Contrato [CC]', 'Data inválida.', 'Formato DD/MM/AAAA. Ex.: 25/07/2025', prazo)
  }

  const linkContrato = (get('link_do_contrato') ?? '').toString().trim()
  if (vazio(linkContrato)) {
    addError(
      errors,
      'Link do Contrato',
      'Campo obrigatório.',
      'Link para pasta compartilhada (SharePoint, VIOS). Ex.: https://bpplaw2.sharepoint.com/...',
      linkContrato
    )
  } else if (!linkPropostaOuContratoValido(linkContrato)) {
    addError(
      errors,
      'Link do Contrato',
      'Link deve ser diretório oficial (SharePoint, VIOS).',
      'Use link que comece com https:// e contenha sharepoint ou vios. Ex.: https://bpplaw2.sharepoint.com/...',
      linkContrato
    )
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

function validarPorStageName(stageName, funil, data) {
  const fn = (funil || '').toString().trim().toLowerCase()
  const isFunilVendas = fn.includes(FUNIL_VENDAS_KEY) || fn.includes('vendas')

  if (!isFunilVendas) {
    return { valid: true, errors: [] }
  }

  const result = validarCadastroLead(data)
  const sn = normStageForMatch(stageName)
  const isConfecaoProposta = sn.includes('confec') && sn.includes('proposta')
  const isConfecaoContrato = sn.includes('confec') && sn.includes('contrato')

  if (isConfecaoProposta) {
    const extra = validarConfecaoProposta(data)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  if (isConfecaoContrato) {
    const extra = validarConfecaoContrato(data)
    result.errors = result.errors.concat(extra.errors)
    result.valid = result.errors.length === 0
  }

  return result
}

// --- Handler Vercel ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { accessToken, spreadsheetId, sheetName, range: rangeParam } = req.body || {}

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
    const headerNormToKey = {}
    headers.forEach((h) => {
      const n = normalizeHeader(h)
      if (COLUMN_TO_KEY[n] !== undefined) headerNormToKey[n] = COLUMN_TO_KEY[n]
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

      const { valid, errors } = validarPorStageName(stageNameRaw, funilVal, data)

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

      const updated_at_iso = parseDateSheet(data.updated_at)
      const created_at_iso = parseDateSheet(data.created_at)
      const refDate = updated_at_iso || created_at_iso
      const refTs = refDate ? new Date(refDate).getTime() : null
      const diasDesdeRef = refTs != null ? (Date.now() - refTs) / (24 * 60 * 60 * 1000) : null

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
        deal_id,
        telefone_notificar,
        areas,
        updated_at_iso: updated_at_iso || null,
        created_at_iso: created_at_iso || null,
        dias_desde_atualizacao: diasDesdeRef != null ? Math.floor(diasDesdeRef) : null,
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
