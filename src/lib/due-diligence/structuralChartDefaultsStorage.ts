/**
 * Preferências estruturais dos gráficos do PPT (mesmo para todos os leads, neste navegador).
 */
import type { LeadPptAreaChartDefaults } from '@/lib/due-diligence/types'

export const STRUCTURAL_CHART_DEFAULTS_KEY = 'crm-bp-structural-ppt-chart-defaults'

export function readStructuralChartDefaults(): LeadPptAreaChartDefaults | null {
  try {
    const s = localStorage.getItem(STRUCTURAL_CHART_DEFAULTS_KEY)
    if (!s) return null
    const parsed = JSON.parse(s) as LeadPptAreaChartDefaults
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeStructuralChartDefaults(data: LeadPptAreaChartDefaults | null): void {
  try {
    if (!data || Object.keys(data).length === 0) {
      localStorage.removeItem(STRUCTURAL_CHART_DEFAULTS_KEY)
      return
    }
    localStorage.setItem(STRUCTURAL_CHART_DEFAULTS_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}
