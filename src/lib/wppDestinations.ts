/**
 * Destinos salvos para envio de relatórios WhatsApp (pessoa ou grupo).
 * Persistência em localStorage (mesmo navegador).
 */

export type WppDestinationKind = 'pessoa' | 'grupo'

export type WppDestination = {
  id: string
  label: string
  kind: WppDestinationKind
  /** Telefone (DDD+número) ou JID do grupo (ex.: ...@g.us) para Evolution API */
  value: string
}

const STORAGE_KEY = 'crm-bp-wpp-destinations'
const DEFAULT_ID_KEY = 'crm-bp-wpp-default-destination-id'

export const WPP_DESTINATIONS_EVENT = 'wpp-destinations-updated'

export function loadWppDestinations(): WppDestination[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (x): x is WppDestination =>
          x &&
          typeof x === 'object' &&
          typeof (x as WppDestination).id === 'string' &&
          typeof (x as WppDestination).label === 'string' &&
          ((x as WppDestination).kind === 'pessoa' || (x as WppDestination).kind === 'grupo') &&
          typeof (x as WppDestination).value === 'string'
      )
      .map((d) => ({
        ...d,
        label: d.label.trim(),
        value: d.value.trim(),
      }))
  } catch {
    return []
  }
}

export function saveWppDestinations(list: WppDestination[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event(WPP_DESTINATIONS_EVENT))
  } catch {
    /* ignore */
  }
}

export function getDefaultWppDestinationId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = localStorage.getItem(DEFAULT_ID_KEY)
    return id && id.trim() ? id.trim() : null
  } catch {
    return null
  }
}

export function setDefaultWppDestinationId(id: string | null): void {
  try {
    if (!id || !id.trim()) localStorage.removeItem(DEFAULT_ID_KEY)
    else localStorage.setItem(DEFAULT_ID_KEY, id.trim())
  } catch {
    /* ignore */
  }
}

export function resolveRecipientNumber(
  destinations: WppDestination[],
  recipientId: string | 'manual',
  manual: string
): string {
  if (recipientId !== 'manual') {
    const d = destinations.find((x) => x.id === recipientId)
    if (d?.value) return d.value.trim()
  }
  return manual.trim()
}

/** Telefone para coluna `telefone` no histórico Supabase (JID preservado; dígitos com DDI 55). */
export function formatTelefoneHistorico(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.includes('@')) return t.replace(/\s/g, '')
  const num = t.replace(/\D/g, '')
  if (!num) return ''
  return num.length <= 11 ? `55${num}` : num
}

/** Destino válido para envio (número com ≥10 dígitos ou JID WhatsApp com @). */
export function isValidWppRecipient(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.includes('@')) {
    const j = t.replace(/\s/g, '')
    return j.length > 4 && j.includes('@')
  }
  const d = t.replace(/\D/g, '')
  return d.length >= 10
}

/** Ao abrir modal: destino padrão salvo ou manual com valor inicial. */
export function pickInitialRecipient(
  destinations: WppDestination[],
  manualFallback: string
): { recipientId: string | 'manual'; manual: string } {
  const def = getDefaultWppDestinationId()
  if (def && destinations.some((d) => d.id === def)) {
    return { recipientId: def, manual: '' }
  }
  return { recipientId: 'manual', manual: manualFallback.trim() }
}
