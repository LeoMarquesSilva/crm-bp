import { Step } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react'
import { LeadForm } from './LeadForm'
import { cn } from '@/lib/utils'
import { getHighlightParts } from '@/lib/searchUtils'

interface StepDetailProps {
  step: Step
  isActive: boolean
  searchTerm?: string
  highlightFieldIndices?: number[]
  highlightStepTitle?: boolean
}

function highlightText(text: string, searchTerm: string) {
  const parts = getHighlightParts(text, searchTerm)
  return (
    <>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark key={index} className="bg-yellow-200 px-1 rounded">
            {part.text}
          </mark>
        ) : (
          part.text
        )
      )}
    </>
  )
}

export function StepDetail({
  step,
  isActive,
  searchTerm = '',
  highlightFieldIndices = [],
  highlightStepTitle = false,
}: StepDetailProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className={cn('mb-6', highlightStepTitle && 'rounded-lg bg-yellow-50 border border-yellow-200 p-3')}>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-primary">
            {highlightStepTitle ? highlightText(step.name, searchTerm) : step.name}
          </h2>
          <Badge variant="default" className="text-xs">
            Etapa {step.number}
          </Badge>
        </div>
        <p className="text-gray-600 text-base">
          {highlightStepTitle ? highlightText(step.description, searchTerm) : step.description}
        </p>
      </div>

      {/* Formulário de Cadastro - apenas para etapa de cadastro do lead */}
      {step.id === 'cadastro-lead' ? (
        <div className="mb-6">
          {/* Checklist compacto - apenas para cadastro */}
          {step.checklist && step.checklist.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                  Verificações Importantes
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {step.checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-blue-800">
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-blue-600" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <LeadForm alerts={step.alerts || []} />
        </div>
      ) : (
        <>
          {step.alerts && step.alerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {step.alerts.map((alert, index) => (
                <Alert key={index} variant="warning" className="text-sm">
                  {alert}
                </Alert>
              ))}
            </div>
          )}

          {/* Checklist - aparece antes do formulário na etapa de cadastro */}
          {step.checklist && step.checklist.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Checklist
              </h3>
              <ul className="space-y-2">
                {step.checklist.map((item, index) => (
                  <li
                    key={index}
                    className={cn(
                      'flex items-start gap-2 text-sm',
                      item.required
                        ? 'text-gray-900'
                        : 'text-gray-600'
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        'h-4 w-4 mt-0.5 flex-shrink-0',
                        item.required
                          ? 'text-green-600'
                          : 'text-gray-400'
                      )}
                    />
                    <span>{highlightText(item.text, searchTerm)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {step.id !== 'cadastro-lead' && (
        <>
          {step.fields && step.fields.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-primary mb-4">
                Campos Obrigatórios
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                        Campo
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                        Instrução
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                        Exemplo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.fields.map((field, index) => {
                      const isHighlighted = highlightFieldIndices.includes(index)
                      return (
                        <tr
                          key={index}
                          className={cn(
                            'border-b border-gray-100 transition-colors',
                            isHighlighted && 'bg-yellow-50',
                            'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {highlightText(field.name, searchTerm)}
                              </span>
                              {field.required && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                              {field.tag && (
                                <Badge
                                  variant={field.tag === 'CP' ? 'sales' : 'post'}
                                  className="text-xs"
                                >
                                  [{field.tag}]
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {highlightText(field.instruction, searchTerm)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 font-mono">
                            {highlightText(field.example, searchTerm)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {step.exitCriteria && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Critério de Saída
          </h3>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border-l-4 border-primary">
            {step.exitCriteria}
          </p>
        </div>
      )}

      {step.nextSteps && step.nextSteps.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Próximos Passos
          </h3>
          <ul className="space-y-2">
            {step.nextSteps.map((nextStep, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>{nextStep}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
