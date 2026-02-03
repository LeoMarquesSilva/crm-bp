import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/validacao': 'Validação de planilha',
  '/sla': 'Leads fora do SLA',
  '/dashboard-bi': 'Dashboard BI',
  '/analise-planilha': 'Análise da planilha',
}

export function CrmPageTitle() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? 'CRM'

  return (
    <div className="flex items-center gap-3 mb-4 lg:mb-5">
      <Link
        to="/"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
        title="Voltar ao início"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">{title}</h1>
    </div>
  )
}
