import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOP_N = 5
const CARD_COLORS = [
  'bg-sky-100 border-sky-200/80',
  'bg-teal-100 border-teal-200/80',
  'bg-amber-100 border-amber-200/80',
  'bg-slate-100 border-slate-200/80',
  'bg-rose-100 border-rose-200/80',
  'bg-violet-100 border-violet-200/80',
]

export type MotivoPerdaItem = { name: string; value: number }
export type MotivoPerdaPorAreaItem = { area: string; totalLost: number; motivos: MotivoPerdaItem[] }

type MotivosPerdaSectionProps = {
  motivoPerdaData: MotivoPerdaItem[]
  motivoPerdaPorAreaData: MotivoPerdaPorAreaItem[]
  totalLost: number
  expandMotivosGeral: boolean
  setExpandMotivosGeral: (v: boolean) => void
  expandedMotivosArea: string | null
  setExpandedMotivosArea: (v: string | null) => void
  filterListaPorMotivo: string | null
  setFilterListaPorMotivo: (v: string | null) => void
  /** Ícones por nome da área (ex.: Sócio, Cível). Opcional. */
  areaIcons?: Record<string, LucideIcon>
}

export function MotivosPerdaSection({
  motivoPerdaData,
  motivoPerdaPorAreaData,
  totalLost,
  expandMotivosGeral,
  setExpandMotivosGeral,
  expandedMotivosArea,
  setExpandedMotivosArea,
  filterListaPorMotivo,
  setFilterListaPorMotivo,
  areaIcons,
}: MotivosPerdaSectionProps) {
  if (motivoPerdaData.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Nenhuma lead perdida ou motivo não preenchido.
      </p>
    )
  }

  const list = expandMotivosGeral ? motivoPerdaData : motivoPerdaData.slice(0, TOP_N)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Resumo geral ({totalLost} perdidas)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {list.map((item, idx) => {
            const pct = totalLost > 0 ? Math.round((item.value / totalLost) * 100) : 0
            const cardClass = CARD_COLORS[idx % CARD_COLORS.length]
            const isActive = filterListaPorMotivo === item.name
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setFilterListaPorMotivo(isActive ? null : item.name)}
                className={cn(
                  'rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow text-left cursor-pointer',
                  cardClass,
                  isActive && 'ring-2 ring-primary ring-offset-2'
                )}
                title={
                  isActive
                    ? 'Clique para remover filtro na lista de leads'
                    : 'Clique para filtrar lista de leads por este motivo'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-gray-700 shadow-sm">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate flex-1 min-w-0" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900 mt-2">
                  {item.value} <span className="text-sm font-medium text-gray-600">({pct}%)</span>
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gray-600/80 transition-all"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
        {motivoPerdaData.length > TOP_N && (
          <button
            type="button"
            onClick={() => setExpandMotivosGeral(!expandMotivosGeral)}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
          >
            {expandMotivosGeral ? (
              <>
                Mostrar menos <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Ver todos os {motivoPerdaData.length} motivos <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
      {motivoPerdaPorAreaData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Por área de atuação</p>
          <p className="text-xs text-gray-500 mb-2">Clique na área para ver os motivos</p>
          <div className="space-y-1">
            {motivoPerdaPorAreaData.map(({ area, totalLost: areaLost, motivos }) => {
              const isExpanded = expandedMotivosArea === area
              const areaList = motivos.slice(0, TOP_N)
              const hasMore = motivos.length > TOP_N
              return (
                <div key={area} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedMotivosArea(isExpanded ? null : area)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    <span className="flex items-center gap-2 font-semibold text-gray-800 min-w-0">
                      {areaIcons?.[area] && (
                        <span className="flex-shrink-0 text-primary">
                          {(() => {
                            const Icon = areaIcons[area]
                            return <Icon className="h-4 w-4" />
                          })()}
                        </span>
                      )}
                      <span className="truncate">{area}</span>
                    </span>
                    <span className="text-gray-500 text-sm shrink-0">
                      ({areaLost} perdida{areaLost !== 1 ? 's' : ''})
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                      {areaList.map((item, idx) => {
                        const pct = areaLost > 0 ? Math.round((item.value / areaLost) * 100) : 0
                        const isActive = filterListaPorMotivo === item.name
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setFilterListaPorMotivo(isActive ? null : item.name)}
                            className={cn(
                              'w-full flex items-center gap-2 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors',
                              isActive && 'bg-primary/10 ring-1 ring-primary/30'
                            )}
                            title={
                              isActive
                                ? 'Clique para remover filtro na lista de leads'
                                : 'Clique para filtrar lista de leads por este motivo'
                            }
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-700">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2 text-xs">
                                <span className="font-medium text-gray-800 truncate">{item.name}</span>
                                <span className="text-red-600 font-semibold shrink-0">
                                  {item.value} ({pct}%)
                                </span>
                              </div>
                              <div className="mt-0.5 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-red-400"
                                  style={{ width: `${Math.max(pct, 4)}%` }}
                                />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      {hasMore && (
                        <p className="text-xs text-gray-500 pt-0.5">+ {motivos.length - TOP_N} motivo(s)</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
