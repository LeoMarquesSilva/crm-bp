/**
 * Script de validação para N8N – Etapas do Funil de Vendas
 *
 * Use dentro de um Code node no N8N.
 * Entrada: items com .json contendo os campos da linha + "etapa" (ou "etapa_id").
 * Saída: mesmo items com .valid e .errors adicionados em cada .json.
 *
 * Chaves esperadas (alinhadas ao webhook / manual):
 *   etapa ou etapa_id, email_notificar (ou email/cadastrado_por para definir destinatário),
 *   solicitante, email, cadastrado_por, due_diligence, prazo_reuniao_due, horario_due,
 *   razao_social_cnpj (array) ou razao_social + cnpj, areas_analise (array ou string ";"),
 *   local_reuniao, data_reuniao, horario_reuniao, tipo_de_lead, indicacao, nome_indicacao
 *
 * Refs: docs/ETAPAS-DE-VENDAS-REFERENCIA.md e docs/AUTOMACAO-VALIDACAO-NOTIFICACAO.md
 */

// --- Regras de formato ---
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/
const REGEX_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const REGEX_CNPJ_CPF = (v) => typeof v === 'string' && (REGEX_CNPJ.test(v.replace(/\s/g, '')) || REGEX_CPF.test(v.replace(/\s/g, '')))

function vazio(val) {
  if (val == null) return true
  if (typeof val === 'string') return val.trim() === ''
  if (Array.isArray(val)) return val.length === 0
  return false
}

function addError(errors, field, message, comoCorrigir) {
  errors.push({ field, message, comoCorrigir: comoCorrigir || message })
}

/**
 * Valida etapa "cadastro-lead" conforme o manual.
 * Recebe um objeto com as chaves do registro (planilha/webhook).
 */
function validarCadastroLead(data) {
  const errors = []
  const get = (key) => data[key]

  // Obrigatórios fixos
  if (vazio(get('solicitante'))) addError(errors, 'Solicitante', 'Campo obrigatório.', 'Nome completo (primeiro e último nome). Ex.: João Silva')
  if (vazio(get('email'))) addError(errors, 'E-mail do Solicitante', 'Campo obrigatório.', 'E-mail corporativo válido. Ex.: joao.silva@empresa.com')
  else if (!REGEX_EMAIL.test(String(get('email')).trim())) addError(errors, 'E-mail do Solicitante', 'E-mail inválido.', 'Use e-mail corporativo válido. Ex.: joao.silva@empresa.com')

  if (vazio(get('cadastrado_por'))) addError(errors, 'Cadastro realizado por (e-mail)', 'Campo obrigatório.', 'E-mail do colaborador. Ex.: maria.santos@bismarchipires.com.br')
  else if (!REGEX_EMAIL.test(String(get('cadastrado_por')).trim())) addError(errors, 'Cadastro realizado por (e-mail)', 'E-mail inválido.', 'Use e-mail corporativo válido.')

  if (vazio(get('due_diligence'))) addError(errors, 'Haverá Due Diligence?', 'Campo obrigatório.', 'Selecione "Sim" ou "Não".')
  if (vazio(get('local_reuniao'))) addError(errors, 'Local da Reunião', 'Campo obrigatório.', 'Endereço, link (Teams/Zoom) ou "A definir".')
  if (vazio(get('tipo_de_lead'))) addError(errors, 'Tipo de Lead', 'Campo obrigatório.', 'Indicação | Lead Ativa | Lead Digital | Lead Passiva')

  // Razão Social / CNPJ – suporta razao_social_cnpj (array) ou colunas soltas
  let temRazaoCnpj = false
  const rsc = get('razao_social_cnpj')
  if (Array.isArray(rsc) && rsc.length > 0) {
    const primeiro = rsc[0]
    const rs = primeiro && (primeiro.razao_social ?? primeiro.razao_social_cnpj)
    const cnpj = primeiro && (primeiro.cnpj ?? primeiro.cnpj_cpf)
    if (!vazio(rs) && !vazio(cnpj)) {
      temRazaoCnpj = true
      if (!REGEX_CNPJ_CPF(String(cnpj).trim())) addError(errors, 'CNPJ/CPF', 'Formato inválido.', 'CNPJ: XX.XXX.XXX/XXXX-XX. CPF: XXX.XXX.XXX-XX.')
    }
  }
  const rs = get('razao_social')
  const cnpjVal = get('cnpj') ?? get('cnpj_cpf')
  if (!temRazaoCnpj) {
    if (vazio(rs)) addError(errors, 'Razão Social / Nome Completo', 'Campo obrigatório.', 'Para PJ use CAIXA ALTA. Ex.: ALFA SOLUÇÕES LTDA')
    if (vazio(cnpjVal)) addError(errors, 'CNPJ/CPF', 'Campo obrigatório.', 'Formato Receita: XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX')
    else if (!REGEX_CNPJ_CPF(String(cnpjVal).trim())) addError(errors, 'CNPJ/CPF', 'Formato inválido.', 'CNPJ: XX.XXX.XXX/XXXX-XX. CPF: XXX.XXX.XXX-XX.')
  }

  // Áreas envolvidas – string ";" ou array
  const areas = get('areas_analise') ?? get('areas_envolvidas')
  if (vazio(areas)) addError(errors, 'Áreas Envolvidas', 'Campo obrigatório.', 'Selecione ao menos uma: Cível, Reestruturação, Tributário, Trabalhista, Distressed Deals, Societário e Contratos')
  else if (typeof areas === 'string' && areas.trim().toLowerCase() === 'a definir') addError(errors, 'Áreas Envolvidas', 'Selecione as áreas jurídicas.', 'Ex.: Cível; Trabalhista; Tributário')

  // Condicionais – Due Diligence
  if (String(get('due_diligence')).trim().toLowerCase() === 'sim') {
    if (vazio(get('prazo_reuniao_due')) || String(get('prazo_reuniao_due')).toLowerCase() === 'a definir') addError(errors, 'Prazo de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Formato DD/MM/AAAA. Ex.: 15/06/2025')
    if (vazio(get('horario_due')) || String(get('horario_due')).toLowerCase() === 'a definir') addError(errors, 'Horário de Entrega da Due', 'Obrigatório quando Haverá Due Diligence = Sim.', 'Formato 24h HH:MM. Ex.: 14:30')
  }

  // Condicionais – Tipo de Lead = Indicação
  if (String(get('tipo_de_lead')).trim().toLowerCase() === 'indicação') {
    if (vazio(get('indicacao'))) addError(errors, 'Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Fundo | Consultor | Cliente | Contador | Sindicatos | Conselhos profissionais | Colaborador | Outros parceiros')
    if (vazio(get('nome_indicacao'))) addError(errors, 'Nome da Indicação', 'Obrigatório quando Tipo de Lead = Indicação.', 'Nome completo ou razão social de quem indicou.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Valida conforme a etapa. Hoje só "cadastro-lead" está implementado.
 * Para novas etapas, adicione if (etapa === 'conf-proposta') { return validarConfProposta(data) } etc.
 */
function validarPorEtapa(etapa, data) {
  const id = (etapa || '').toString().trim().toLowerCase()
  if (id === 'cadastro-lead') return validarCadastroLead(data)
  // Etapas sem validação automática (só checklist no manual): devolver válido e array vazio
  return { valid: true, errors: [] }
}

// --- Código do Code node no N8N ---
// Use "Run Once for All Items". O N8N injeta o input do node anterior.
// Se o N8N passar $input, use: const items = $input.all();
// Senão, o node anterior deve estar conectado e os items virão como array.

const items = typeof $input !== 'undefined' && $input.all ? $input.all() : [];

const results = []
for (const item of items) {
  const data = item.json instanceof Object ? { ...item.json } : {}
  const etapa = data.etapa ?? data.etapa_id ?? data.Etapa ?? 'cadastro-lead'
  const resultado = validarPorEtapa(etapa, data)

  results.push({
    json: {
      ...data,
      valid: resultado.valid,
      errors: resultado.errors
    }
  })
}

return results
