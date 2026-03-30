import { useMemo, useEffect } from 'react'
import { salesFunnelSteps } from '@/data/salesFunnel'
import { DetailPanel } from './DetailPanel'
import { ProgressBar } from './ProgressBar'
import { SearchBar } from './SearchBar'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { AlertTriangle } from 'lucide-react'
import { normalizeForSearch } from '@/lib/searchUtils'

export function SalesFunnel() {
  const { activeStep, setActiveStep, searchTerm } = useAppStore()
  const activeIndex = salesFunnelSteps.findIndex(step => step.id === activeStep) || 0
  const currentActiveIndex = activeIndex >= 0 ? activeIndex : 0
  const activeStepData = salesFunnelSteps[currentActiveIndex]

  useEffect(() => {
    if (!activeStep && salesFunnelSteps.length > 0) {
      setActiveStep(salesFunnelSteps[0].id)
    }
  }, [activeStep, setActiveStep])

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return { matches: [], count: 0 }

    const term = normalizeForSearch(searchTerm)
    const matches: Array<{ stepIndex: number; fieldIndex: number }> = []

    salesFunnelSteps.forEach((step, stepIdx) => {
      const stepSearchable = [step.name, step.subtitle, step.description].join(' ')
      const stepNorm = normalizeForSearch(stepSearchable)
      if (stepNorm.includes(term)) {
        matches.push({ stepIndex: stepIdx, fieldIndex: -1 })
      }
      step.fields?.forEach((field, fieldIdx) => {
        const searchable = [field.name, field.instruction, field.example].join(' ')
        if (normalizeForSearch(searchable).includes(term)) {
          matches.push({ stepIndex: stepIdx, fieldIndex: fieldIdx })
        }
      })
    })

    return { matches, count: matches.length }
  }, [searchTerm])

  const highlightIndices = useMemo(() => {
    if (!searchTerm.trim() || !activeStepData) {
      return []
    }
    const stepMatches = searchResults.matches.filter(
      (m) => salesFunnelSteps[m.stepIndex]?.id === activeStepData.id && m.fieldIndex >= 0
    )
    if (stepMatches.length === 0 && searchResults.matches.find(
      (m) => salesFunnelSteps[m.stepIndex]?.id === activeStepData.id
    ) === undefined) {
      return []
    }
    return stepMatches.map((m) => m.fieldIndex)
  }, [searchTerm, searchResults, activeStepData])

  const highlightStepTitle = useMemo(() => {
    if (!searchTerm.trim() || !activeStepData) return false
    return searchResults.matches.some(
      (m) => salesFunnelSteps[m.stepIndex]?.id === activeStepData.id && m.fieldIndex === -1
    )
  }, [searchTerm, searchResults, activeStepData])

  // Auto-navigate to first match
  useEffect(() => {
    if (searchResults.matches.length > 0 && searchTerm.trim()) {
      const firstMatch = searchResults.matches[0]
      const firstMatchStep = salesFunnelSteps[firstMatch.stepIndex]
      if (firstMatchStep && firstMatchStep.id !== activeStep) {
        setActiveStep(firstMatchStep.id)
      }
    }
  }, [searchResults.matches, searchTerm, activeStep, setActiveStep])

  return (
    <section className="space-y-8">
      <header>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <h2 className="text-3xl font-semibold text-primary">Funil de Vendas</h2>
          <Badge variant="sales" className="text-xs font-semibold px-3 py-1">
            Fluxo Comercial
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Sequencial
          </div>
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Campos com validação
          </div>
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Disparo automações
          </div>
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-sales flex-shrink-0" />
          <h3 className="text-sm font-semibold text-primary">
            Regras Principais
          </h3>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs leading-snug m-0 pl-0 list-none mb-4">
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Sem saltos:</strong> pular etapa = perda de campos / gatilhos.
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Formatação:</strong> Razão Social em CAIXA ALTA; sem dado = N/A.
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Datas e Horas:</strong> DD/MM/AAAA e 24h (ex: 14:30).
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Listas:</strong> separar com ponto e vírgula ;
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Links:</strong> somente diretórios oficiais (Sharepoint / VIOS).
          </li>
        </ul>
        <div className="bg-gray-50 border-l-2 border-primary rounded p-2 text-xs leading-tight text-primary mb-4">
          Preenchimento consistente garante proposta e contrato sem retrabalho e ativa corretamente o Pós-Venda.
        </div>
        <div className="pt-4 border-t border-gray-100">
          <ProgressBar total={salesFunnelSteps.length} active={currentActiveIndex} variant="sales" />
        </div>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={(value) => useAppStore.getState().setSearchTerm(value)}
        resultCount={searchResults.count}
      />

      <div>
        {activeStepData && (
          <DetailPanel
            step={activeStepData}
            isActive={true}
            searchTerm={searchTerm}
            highlightFieldIndices={highlightIndices}
            highlightStepTitle={highlightStepTitle}
          />
        )}
      </div>
    </section>
  )
}
