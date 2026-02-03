/**
 * Normaliza texto para comparação de busca: minúsculas, sem acentos, hífens/underscores como espaço.
 */
export function normalizeForSearch(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mc}|\p{Mn}|\p{Me}/gu, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

/**
 * Escapa caracteres especiais de regex para usar o termo literal em RegExp.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Retorna índices no texto original que correspondem às ocorrências do termo normalizado.
 * Permite destacar "email" em "E-mail do Solicitante" ou "cadastro" em "Cadastro do Lead".
 */
function getNormalizedRanges(text: string, normalizedTerm: string): Array<[number, number]> {
  if (!text || !normalizedTerm) return []

  const normText = normalizeForSearch(text)
  if (normText.indexOf(normalizedTerm) === -1) return []

  const ranges: Array<[number, number]> = []
  let searchFrom = 0

  while (true) {
    const normIdx = normText.indexOf(normalizedTerm, searchFrom)
    if (normIdx === -1) break

    const origStart = normToOrigOffset(text, normIdx)
    const origEnd = normToOrigOffset(text, normIdx + normalizedTerm.length)
    ranges.push([origStart, origEnd])
    searchFrom = normIdx + 1
  }

  return ranges
}

/**
 * Mapeia posição no texto normalizado para índice no texto original (inclusive para start, exclusive para end).
 */
function normToOrigOffset(original: string, normTargetIndex: number): number {
  let cum = 0
  for (let i = 0; i < original.length; i++) {
    const n = normalizeForSearch(original[i]).length
    if (cum + n >= normTargetIndex) return i
    cum += n
  }
  return original.length
}

/**
 * Fragmenta o texto em partes normais e destacadas com base no termo de busca normalizado.
 * Retorna array de { text, highlight } para renderizar com <mark> onde highlight === true.
 */
export function getHighlightParts(text: string, searchTerm: string): Array<{ text: string; highlight: boolean }> {
  const trimmed = searchTerm.trim()
  if (!text || !trimmed) return [{ text, highlight: false }]

  const normalizedTerm = normalizeForSearch(trimmed)
  const ranges = getNormalizedRanges(text, normalizedTerm)
  if (ranges.length === 0) return [{ text, highlight: false }]

  const parts: Array<{ text: string; highlight: boolean }> = []
  let lastEnd = 0

  for (const [start, end] of ranges) {
    if (start > lastEnd) {
      parts.push({ text: text.slice(lastEnd, start), highlight: false })
    }
    parts.push({ text: text.slice(start, end), highlight: true })
    lastEnd = end
  }
  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), highlight: false })
  }
  return parts
}
