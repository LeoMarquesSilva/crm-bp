/**
 * Avatares, tags de área e nome por e-mail.
 * renato@bismarchipires.com.br e renato@bpplaw.com.br são a mesma pessoa (normalizados na busca).
 */
const BASE_URL = 'https://www.bismarchipires.com.br/img/team'

export type TeamMember = {
  avatar: string
  tag: string
  name: string
}

/** E-mails @bismarchipires são normalizados para @bpplaw na busca. */
const TEAM_BY_EMAIL: Record<string, TeamMember> = {
  // Sócios
  'gustavo@bpplaw.com.br': {
    avatar: `${BASE_URL}/socios/gustavo-site.png`,
    tag: 'Sócio',
    name: 'Gustavo Bismarchi',
  },
  'ricardo@bpplaw.com.br': {
    avatar: `${BASE_URL}/ricardo-pires.jpg`,
    tag: 'Sócio',
    name: 'Ricardo Viscardi Pires',
  },
  // Cível
  'gabriela.consul@bpplaw.com.br': {
    avatar: `${BASE_URL}/civel/gabriela-consul.jpg`,
    tag: 'Cível',
    name: 'Gabriela Consul',
  },
  'giancarlo@bpplaw.com.br': {
    avatar: `${BASE_URL}/civel/giancarlo.jpg`,
    tag: 'Cível',
    name: 'Giancarlo Zotini',
  },
  // Trabalhista
  'daniel@bpplaw.com.br': {
    avatar: `${BASE_URL}/trabalhista/daniel-pressato-fernandes.jpg`,
    tag: 'Trabalhista',
    name: 'Daniel Pressatto Fernandes',
  },
  'renato@bpplaw.com.br': {
    avatar: `${BASE_URL}/trabalhista/renato-rossetti.jpg`,
    tag: 'Trabalhista',
    name: 'Renato Vallim',
  },
  // Distressed Deals
  'michel.malaquias@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/michel.jpg`,
    tag: 'Distressed Deals',
    name: 'Michel Malaquias',
  },
  // Reestruturação
  'jorge@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jorge-pecht-souza.jpg`,
    tag: 'Reestruturação',
    name: 'Jorge Pecht Souza',
  },
  'leonardo@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/leo-loureiro.png`,
    tag: 'Reestruturação',
    name: 'Leonardo Loureiro',
  },
  'ligia@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/ligia-gilberti-lopes.jpg`,
    tag: 'Reestruturação',
    name: 'Ligia Lopes',
  },
  // Societário e Contratos
  'wagner.armani@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/wagner.jpg`,
    tag: 'Societário e Contratos',
    name: 'Wagner Armani',
  },
  'jansonn@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jansonn.jpg`,
    tag: 'Societário e Contratos',
    name: 'Jansonn Mendonça',
  },
  // Operações Legais (felipe@bpplaw.com / felipe@bismarchipires.com)
  'felipe@bpplaw.com.br': {
    avatar: 'https://www.bismarchipires.com.br/img/team/legal-ops/felipe-carmargo.jpg',
    tag: 'Operações Legais',
    name: 'Felipe Camargo',
  },
  // Tributário (francisco.zanin@bpplaw.com / francisco.zanin@bismarchipires.com)
  'francisco.zanin@bpplaw.com.br': {
    avatar: 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png',
    tag: 'Tributário',
    name: 'Francisco Zanin',
  },
}

function normalizeEmailForLookup(email: string): string {
  if (!email || typeof email !== 'string') return ''
  return email
    .trim()
    .toLowerCase()
    .replace('@bismarchipires.com.br', '@bpplaw.com.br')
    .replace('@bismarchipires.com', '@bpplaw.com')
}

/** Chave única por pessoa. renato@bismarchipires e renato@bpplaw → mesma chave. Use para agrupar. */
export function getSolicitanteKey(email: string): string {
  return normalizeEmailForLookup(email) || email.trim().toLowerCase() || ''
}

export function getTeamMember(email: string): TeamMember | null {
  const key = normalizeEmailForLookup(email)
  if (!key) return null
  return TEAM_BY_EMAIL[key] ?? null
}
