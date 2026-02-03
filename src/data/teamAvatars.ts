/**
 * Avatares, tags de área e nome por e-mail.
 * E-mails @bismarchipires.com.br e @bpplaw.com.br são a mesma pessoa (normalizados na busca).
 */
const BASE_URL = 'https://www.bismarchipires.com.br/img/team'

export type TeamMember = {
  avatar: string
  tag: string
  name: string
}

/** E-mails @bismarchipires são normalizados para @bpplaw na busca (considere bpplaw para todos). */
const TEAM_BY_EMAIL: Record<string, TeamMember> = {
  // Sócio
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
  'emanueli.lourenco@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/emanueli-lourenco.png`,
    tag: 'Distressed Deals',
    name: 'Emanueli Lourenço',
  },
  'ariany.bispo@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/ariany-bispo.png`,
    tag: 'Distressed Deals',
    name: 'Ariany Bispo',
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
    name: 'Leonardo Loureiro Basso',
  },
  'ligia@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/ligia-gilberti-lopes.jpg`,
    tag: 'Reestruturação',
    name: 'Ligia Lopes',
  },
  'wagner.armani@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/wagner.jpg`,
    tag: 'Reestruturação',
    name: 'Wagner Armani',
  },
  'jansonn@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jansonn.jpg`,
    tag: 'Reestruturação',
    name: 'Jansonn Mendonça Batista',
  },
  // Operações Legais
  'felipe@bpplaw.com.br': {
    avatar: `${BASE_URL}/legal-ops/felipe-carmargo.jpg`,
    tag: 'Operações Legais',
    name: 'Felipe Camargo',
  },
  'lavinia.ferraz@bpplaw.com.br': {
    avatar: 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg',
    tag: 'Operações Legais',
    name: 'Lavínia Ferraz Crispim',
  },
  // Tributário
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

/** E-mail no domínio @bismarchipires.com.br (para formulário e webhook). */
function toBismarchiEmail(bpplawEmail: string): string {
  if (!bpplawEmail || typeof bpplawEmail !== 'string') return ''
  return bpplawEmail
    .trim()
    .toLowerCase()
    .replace('@bpplaw.com.br', '@bismarchipires.com.br')
    .replace('@bpplaw.com', '@bismarchipires.com')
}

/** Lista de opções para select de solicitante (avatar + nome), ordenada por nome. email = chave bpplaw; emailBismarchi = e-mail a enviar. */
export type SolicitanteOption = { email: string; emailBismarchi: string; name: string; avatar: string }
export function getSolicitanteOptions(): SolicitanteOption[] {
  return Object.entries(TEAM_BY_EMAIL)
    .map(([email, m]) => ({
      email,
      emailBismarchi: toBismarchiEmail(email),
      name: m.name,
      avatar: m.avatar,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
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

/** Área (tag) do solicitante por e-mail. Usado no filtro por área (área = tag do solicitante). */
export function getAreaByEmail(email: string): string | null {
  const m = getTeamMember(email)
  return (m?.tag?.trim()) || null
}

/** Lista de áreas (tags) únicas, ordenada. */
export function getAreaTags(): string[] {
  const set = new Set<string>()
  Object.values(TEAM_BY_EMAIL).forEach((m) => {
    if (m.tag?.trim()) set.add(m.tag.trim())
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
