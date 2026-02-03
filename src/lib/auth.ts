/**
 * Autenticação do site (login único para acessar o CRM).
 * Credenciais: configuráveis via .env ou padrão gestor / gestor123.
 */

const AUTH_STORAGE_KEY = 'crm_auth'

export function getExpectedLogin(): string {
  return (import.meta.env.VITE_CRM_LOGIN_USER as string) || 'gestor'
}

export function getExpectedPassword(): string {
  return (import.meta.env.VITE_CRM_LOGIN_PASSWORD as string) || 'gestor123'
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === '1'
}

export function setAuthenticated(): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, '1')
}

export function clearAuthenticated(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
