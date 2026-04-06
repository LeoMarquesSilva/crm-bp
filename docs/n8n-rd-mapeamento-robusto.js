/**
 * n8n Code node - mapeamento robusto RD custom fields
 * Entrada esperada: $input.first().json.body.document (deal do RD)
 */

if (
  !$input.first() ||
  !$input.first().json ||
  !$input.first().json.body ||
  !$input.first().json.body.document
) {
  throw new Error('Entrada invalida: esperado json.body.document')
}

const doc = $input.first().json.body.document
const fields = Array.isArray(doc.deal_custom_fields) ? doc.deal_custom_fields : []

function normalizeLabel(label) {
  if (!label) return ''
  return String(label)
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9[\]%()/+-]/g, '')
    .trim()
}

function valueToString(v) {
  if (v == null) return null
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') return item.label || item.name || item.value || ''
        return ''
      })
      .filter(Boolean)
      .join('; ') || null
  }
  if (typeof v === 'object') return v.label || v.name || v.value || null
  const s = String(v).trim()
  return s || null
}

function buildFieldIndex(fieldArray) {
  const map = new Map()
  for (const f of fieldArray) {
    const rawLabel = f?.custom_field?.label || f?.label || f?.name || ''
    const key = normalizeLabel(rawLabel)
    if (!key) continue
    const cur = valueToString(f?.value)
    if (!map.has(key) || (!map.get(key) && cur)) {
      map.set(key, cur)
    }
  }
  return map
}

function getFieldValue(index, labels) {
  const arr = Array.isArray(labels) ? labels : [labels]
  for (const lbl of arr) {
    const v = index.get(normalizeLabel(lbl))
    if (v != null) return v
  }
  return null
}

const fieldIndex = buildFieldIndex(fields)

const FIELD_LABELS = {
  solicitante: ['Solicitante'],
  cadastrado_por: ['Cadastro realizado por'],
  razao_social: ['Razao Social [CP]', 'Razão Social [CP]'],
  cnpj: ['CNPJ [CP]'],
  demais_razoes_sociais: ['Demais Razoes sociais', 'Demais Razões sociais'],
  areas_analise: ['Areas que serao objeto de analise', 'Áreas que serão objeto de análise'],
  areas_cp: ['Areas Objeto do contrato [CP]', 'Áreas Objeto do contrato [CP]'],
  gestor_contrato: ['Gestor do Contrato [CP]'],
  objeto_contrato_cc: ['Objeto do Contrato [CC]'],
  escopo_contratual_cadastro: ['Objeto do Contrato [CC]'],
  primeiro_faturamento_financeiro: ['Primeiro Faturamento [FINANCEIRO]'],
  valor_primeiro_faturamento_financeiro: ['Valor do primeiro faturamento [FINANCEIRO]', 'Valor Primeiro Faturamento [FINANCEIRO]'],
  valor_contrato_anual_financeiro: ['Valor do contrato anual [FINANCEIRO]', 'Valor Contrato Anual [FINANCEIRO]'],
  rateio_porcentagem_insolvencia_financeiro: ['RATEIO - PORCENTAGEM % (Reestruturacao e Insolvencia) - [CC]', 'RATEIO - PORCENTAGEM % (Reestruturação e Insolvência) - [CC]'],
  rateio_porcentagem_civel_financeiro: ['RATEIO - PORCENTAGEM % (Civel) - [CC]', 'RATEIO - PORCENTAGEM % (Cível) - [CC]'],
  rateio_porcentagem_trabalhista_financeiro: ['RATEIO - PORCENTAGEM % (Trabalhista) - [CC]'],
  rateio_porcentagem_tributario_financeiro: ['RATEIO - PORCENTAGEM % (Tributario) - [CC]', 'RATEIO - PORCENTAGEM % (Tributário) - [CC]'],
  rateio_porcentagem_contratos_financeiro: ['RATEIO - PORCENTAGEM % (Contratos / Societario) - [CC]', 'RATEIO - PORCENTAGEM % (Contratos / Societário) - [CC]'],
  rateio_porcentagem_add_financeiro: ['RATEIO - PORCENTAGEM % (ADD) - [CC]'],
  observacoes_financeiro: ['Observacoes - [FINANCEIRO]', 'Observações - [FINANCEIRO]'],
  status_financeiro: ['STATUS [FINANCEIRO]'],
}

const razaoSocial = getFieldValue(fieldIndex, FIELD_LABELS.razao_social)
const demaisRazoes = getFieldValue(fieldIndex, FIELD_LABELS.demais_razoes_sociais)

const result = {
  stage_name: doc.deal_stage?.name ?? null,
  stage_id: doc.deal_stage?.id ?? null,
  solicitante: getFieldValue(fieldIndex, FIELD_LABELS.solicitante),
  cadastrado_por: getFieldValue(fieldIndex, FIELD_LABELS.cadastrado_por),
  lead: razaoSocial ? razaoSocial.split(',')[0].trim() : null,
  razao_social: razaoSocial,
  cnpj: getFieldValue(fieldIndex, FIELD_LABELS.cnpj),
  demais_razoes_sociais: demaisRazoes,
  razao_social_completa: [razaoSocial, demaisRazoes].filter(Boolean).join(', ') || null,
  areas_analise: getFieldValue(fieldIndex, FIELD_LABELS.areas_analise),
  areas_cp: getFieldValue(fieldIndex, FIELD_LABELS.areas_cp),
  gestor_contrato: getFieldValue(fieldIndex, FIELD_LABELS.gestor_contrato),
  objeto_contrato_cc: getFieldValue(fieldIndex, FIELD_LABELS.objeto_contrato_cc),
  escopo_contratual_cadastro: getFieldValue(fieldIndex, FIELD_LABELS.escopo_contratual_cadastro),
  primeiro_faturamento_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.primeiro_faturamento_financeiro),
  valor_primeiro_faturamento_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.valor_primeiro_faturamento_financeiro),
  valor_contrato_anual_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.valor_contrato_anual_financeiro),
  rateio_porcentagem_insolvencia_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_insolvencia_financeiro),
  rateio_porcentagem_civel_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_civel_financeiro),
  rateio_porcentagem_trabalhista_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_trabalhista_financeiro),
  rateio_porcentagem_tributario_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_tributario_financeiro),
  rateio_porcentagem_contratos_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_contratos_financeiro),
  rateio_porcentagem_add_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.rateio_porcentagem_add_financeiro),
  observacoes_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.observacoes_financeiro),
  status_financeiro: getFieldValue(fieldIndex, FIELD_LABELS.status_financeiro),
}

return [{ json: result }]

