import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Tenta corrigir mojibake: texto UTF-8 que foi incorretamente interpretado como Latin-1.
 * Ex: "JurÃ­dica" → "Jurídica", "AÃ§Ã£o" → "Ação"
 * Só aplica a correção quando detecta o padrão típico (Ã seguido de caractere acentuado).
 */
export function fixMojibake(str: string | null | undefined): string {
  if (str == null || typeof str !== 'string') return ''
  if (!str.includes('Ã')) return str
  try {
    const bytes = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      bytes[i] = code > 255 ? 0x3f : code
    }
    const decoded = new TextDecoder('utf-8').decode(bytes)
    return decoded.includes('\uFFFD') ? str : decoded
  } catch {
    return str
  }
}
