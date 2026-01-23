import { TrendingUp, Users, UserPlus, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { StepCard } from '@/components/StepCard'
import { salesFunnelSteps } from '@/data/salesFunnel'
import { postFunnelSteps } from '@/data/postFunnel'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export function Sidebar() {
  const { currentFunnel, setCurrentFunnel, activeStep, setActiveStep } = useAppStore()
  const allSteps = currentFunnel === 'sales' ? salesFunnelSteps : postFunnelSteps
  
  // Filtrar a etapa de cadastro do lead da lista de etapas
  const steps = allSteps.filter(step => step.id !== 'cadastro-lead')
  
  const activeIndex = steps.findIndex(step => step.id === activeStep)
  const currentActiveIndex = activeIndex >= 0 ? activeIndex : 0

  useEffect(() => {
    // Se a etapa ativa for cadastro-lead, não fazer nada
    if (activeStep === 'cadastro-lead') {
      return
    }
    // Se não houver etapa ativa ou a etapa não existir na lista filtrada, definir a primeira
    if (!activeStep || !steps.find(step => step.id === activeStep)) {
      setActiveStep(steps[0]?.id || null)
    }
  }, [currentFunnel, activeStep, setActiveStep, steps])

  const handleStepClick = (index: number) => {
    if (index > currentActiveIndex + 1) {
      console.warn('Evite pular etapas — sequência necessária para integridade dos dados.')
    }
    setActiveStep(steps[index].id)
  }

  return (
    <aside className="w-80 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">BP</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-primary">
              CRM Manual
            </h1>
            <p className="text-xs text-gray-500">
              Bismarchi | Pires
            </p>
          </div>
        </div>
      </div>

      {/* Cadastro de Lead Section */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Cadastro de Lead
        </h2>
        <div
          onClick={() => {
            setCurrentFunnel('sales')
            setActiveStep('cadastro-lead')
          }}
          className={cn(
            'cursor-pointer rounded-xl border-2 p-4 transition-all duration-280 relative',
            'bg-sales/10 border-sales text-sales shadow-sm hover:shadow-md',
            'hover:scale-[1.02] active:scale-[0.98]',
            activeStep === 'cadastro-lead' && 'ring-2 ring-sales ring-offset-2'
          )}
        >
          {/* Badge "Comece por aqui" */}
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-sales to-sales/80 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
            <Sparkles className="h-3 w-3" />
            <span>Comece por aqui</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sales rounded-lg flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                Cadastro do Lead
              </div>
              <div className="text-xs text-sales/70 truncate">
                Registro inicial do lead
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Funnel Selector */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Funis
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => setCurrentFunnel('sales')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-280',
              currentFunnel === 'sales'
                ? 'bg-sales/10 text-sales border-2 border-sales'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="font-medium">Vendas</span>
          </button>
          <button
            onClick={() => setCurrentFunnel('post')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-280',
              currentFunnel === 'post'
                ? 'bg-post/10 text-post border-2 border-post'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
            )}
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">Pós-Venda</span>
          </button>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3 sticky top-0 bg-white pb-2">
          Etapas ({steps.length})
        </h2>
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            isActive={index === currentActiveIndex}
            onClick={() => handleStepClick(index)}
            funnel={currentFunnel}
          />
        ))}
      </div>
    </aside>
  )
}
