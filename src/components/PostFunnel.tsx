import { useMemo, useEffect } from 'react'
import { postFunnelSteps } from '@/data/postFunnel'
import { DetailPanel } from './DetailPanel'
import { ProgressBar } from './ProgressBar'
import { SearchBar } from './SearchBar'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { AlertTriangle } from 'lucide-react'

export function PostFunnel() {
  const { activeStep, setActiveStep, searchTerm } = useAppStore()
  const activeIndex = postFunnelSteps.findIndex(step => step.id === activeStep) || 0
  const currentActiveIndex = activeIndex >= 0 ? activeIndex : 0
  const activeStepData = postFunnelSteps[currentActiveIndex]

  useEffect(() => {
    if (!activeStep && postFunnelSteps.length > 0) {
      setActiveStep(postFunnelSteps[0].id)
    }
  }, [activeStep, setActiveStep])

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return { matches: [], count: 0 }

    const term = searchTerm.toLowerCase()
    const matches: Array<{ stepIndex: number; fieldIndex: number }> = []

    postFunnelSteps.forEach((step, stepIdx) => {
      step.fields?.forEach((field, fieldIdx) => {
        const searchable = [field.name, field.instruction, field.example]
          .join(' ')
          .toLowerCase()
        if (searchable.includes(term)) {
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
    const matchingStepIndex = searchResults.matches.find(m => 
      postFunnelSteps[m.stepIndex]?.id === activeStepData.id
    )?.stepIndex

    if (matchingStepIndex === undefined || matchingStepIndex !== currentActiveIndex) {
      return []
    }

    return searchResults.matches
      .filter((m) => m.stepIndex === currentActiveIndex)
      .map((m) => m.fieldIndex)
  }, [searchTerm, searchResults, currentActiveIndex, activeStepData])

  // Auto-navigate to first match
  useEffect(() => {
    if (searchResults.matches.length > 0 && searchTerm.trim()) {
      const firstMatch = searchResults.matches[0]
      const firstMatchStep = postFunnelSteps[firstMatch.stepIndex]
      if (firstMatchStep && firstMatchStep.id !== activeStep) {
        setActiveStep(firstMatchStep.id)
      }
    }
  }, [searchResults.matches, searchTerm, activeStep, setActiveStep])

  return (
    <section className="space-y-8">
      <header>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <h2 className="text-3xl font-semibold text-primary">Funil de Pós-Venda (Onboarding)</h2>
          <Badge variant="post" className="text-xs font-semibold px-3 py-1">
            Integração
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Gatilho: Contrato Assinado
          </div>
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Cadastro → Financeiro
          </div>
          <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Campos obrigatórios
          </div>
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-post flex-shrink-0" />
          <h3 className="text-sm font-semibold text-primary">
            Regras Críticas
          </h3>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs leading-snug m-0 pl-0 list-none mb-4">
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Financeiro:</strong> só após STATUS CADASTRO = CONCLUÍDO.
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">RATEIO:</strong> usar 0 se não aplicável.
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">Telefone:</strong> formato padrão.
          </li>
          <li className="text-gray-600">
            <strong className="text-primary font-semibold">STATUS:</strong> inicia PENDENTE (automação).
          </li>
        </ul>
        <div className="bg-gray-50 border-l-2 border-primary rounded p-2 text-xs leading-tight text-primary mb-4">
          Execução correta evita retrabalho e atraso no faturamento.
        </div>
        <div className="pt-4 border-t border-gray-100">
          <ProgressBar total={postFunnelSteps.length} active={currentActiveIndex} variant="post" />
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
          />
        )}
      </div>
    </section>
  )
}
