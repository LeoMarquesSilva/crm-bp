/**
 * Formulário reutilizável: estilo de gráfico (global ou por slide).
 */
import type { AreaChartSlideStyle } from '@/lib/due-diligence/types'
import {
  CHART_UI_FONT_PRESETS,
  CHART_LEGEND_POS_OPTIONS,
  CHART_DATA_LABEL_POS_OPTIONS,
  CHART_LINE_SYMBOL_OPTIONS,
} from '@/lib/due-diligence/chartSlideStyles'

function ensureHashColor(hex: string): string {
  const s = hex.trim()
  if (!s) return '#101f2e'
  return s.startsWith('#') ? s : `#${s}`
}

export interface ChartStyleEditorProps {
  chartStyle: AreaChartSlideStyle
  onPatch: (patch: Partial<AreaChartSlideStyle>) => void
  summarySubtitle?: string
  onReset?: () => void
  resetButtonLabel?: string
}

export function ChartStyleEditor({
  chartStyle,
  onPatch,
  summarySubtitle = 'Cores, fontes, legenda, eixos — reflete no PPT',
  onReset,
  resetButtonLabel = 'Restaurar padrão',
}: ChartStyleEditorProps) {
  const patch = onPatch
  const c = chartStyle

  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50/40 open:bg-white" open>
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800 list-none [&::-webkit-details-marker]:hidden flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
        <span>Estilo do gráfico</span>
        <span className="text-xs font-normal text-slate-500">{summarySubtitle}</span>
      </summary>
      <div className="px-3 py-3 space-y-4 max-h-[min(420px,55vh)] overflow-y-auto">
        <div>
          <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Paleta (até 6 cores)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {c.colors.map((col, i) => (
              <label key={i} className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                Série {i + 1}
                <div className="flex gap-1 items-center">
                  <input
                    type="color"
                    className="h-8 w-10 rounded border border-slate-200 cursor-pointer"
                    value={ensureHashColor(col).slice(0, 7)}
                    onChange={(e) => {
                      const next = [...c.colors]
                      next[i] = e.target.value
                      patch({ colors: next })
                    }}
                  />
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 text-xs font-mono"
                    value={col}
                    onChange={(e) => {
                      const next = [...c.colors]
                      next[i] = e.target.value
                      patch({ colors: next })
                    }}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Cor única em barras (opcional)
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.seriesFill ?? c.colors[0] ?? '#101f2e').slice(0, 7)}
                onChange={(e) => patch({ seriesFill: e.target.value })}
              />
              <button type="button" className="text-xs text-primary underline" onClick={() => patch({ seriesFill: null })}>
                Usar paleta por barra
              </button>
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Linha — cor do traço
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.lineStroke).slice(0, 7)}
                onChange={(e) => patch({ lineStroke: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                value={c.lineStroke}
                onChange={(e) => patch({ lineStroke: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Linha — marcador (preenchimento)
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.lineDotFill).slice(0, 7)}
                onChange={(e) => patch({ lineDotFill: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                value={c.lineDotFill}
                onChange={(e) => patch({ lineDotFill: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Fundo da área do gráfico (plotagem)
            <span className="text-[10px] font-normal text-slate-500">
              Área atrás das barras/fatias/linha no PPT e na prévia — não é o fundo do slide.
            </span>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.plotAreaFillHex ?? '#ffffff').slice(0, 7)}
                onChange={(e) => patch({ plotAreaFillHex: e.target.value })}
              />
              <button type="button" className="text-xs text-primary underline" onClick={() => patch({ plotAreaFillHex: null })}>
                Transparente / tema
              </button>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Fonte (eixos)
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.axisFontFace}
              onChange={(e) => patch({ axisFontFace: e.target.value })}
            >
              {CHART_UI_FONT_PRESETS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Fonte legenda
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.legendFontFace}
              onChange={(e) => patch({ legendFontFace: e.target.value })}
            >
              {CHART_UI_FONT_PRESETS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Tamanho fonte eixos
            <input
              type="number"
              min={6}
              max={24}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.axisFontSize}
              onChange={(e) => patch({ axisFontSize: Number(e.target.value) || 10 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Cor rótulos dos eixos
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.axisLabelColor).slice(0, 7)}
                onChange={(e) => patch({ axisLabelColor: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                value={c.axisLabelColor}
                onChange={(e) => patch({ axisLabelColor: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Cor da legenda
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.legendColor).slice(0, 7)}
                onChange={(e) => patch({ legendColor: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                value={c.legendColor}
                onChange={(e) => patch({ legendColor: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Tamanho fonte legenda
            <input
              type="number"
              min={6}
              max={28}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.legendFontSize}
              onChange={(e) => patch({ legendFontSize: Number(e.target.value) || 10 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Posição da legenda (PPT)
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.legendPos}
              onChange={(e) => patch({ legendPos: e.target.value as AreaChartSlideStyle['legendPos'] })}
            >
              {CHART_LEGEND_POS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.showLegend} onChange={(e) => patch({ showLegend: e.target.checked })} className="rounded border-slate-300" />
            Legenda
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.showGrid} onChange={(e) => patch({ showGrid: e.target.checked })} className="rounded border-slate-300" />
            Grade
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.showDataLabels} onChange={(e) => patch({ showDataLabels: e.target.checked })} className="rounded border-slate-300" />
            Rótulos de dado
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.showPercent} onChange={(e) => patch({ showPercent: e.target.checked })} className="rounded border-slate-300" />
            % na pizza/rosca (PPT)
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.lineSmooth} onChange={(e) => patch({ lineSmooth: e.target.checked })} className="rounded border-slate-300" />
            Linha suavizada
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Cor grade
            <input
              type="color"
              className="h-8 w-28 rounded border border-slate-200"
              value={ensureHashColor(c.gridColor).slice(0, 7)}
              onChange={(e) => patch({ gridColor: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Posição rótulo de dados (PPT)
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.dataLabelPosition}
              onChange={(e) => patch({ dataLabelPosition: e.target.value as AreaChartSlideStyle['dataLabelPosition'] })}
            >
              {CHART_DATA_LABEL_POS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Fonte rótulos de dado
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.dataLabelFontFace}
              onChange={(e) => patch({ dataLabelFontFace: e.target.value })}
            >
              {CHART_UI_FONT_PRESETS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Tamanho rótulos de dado
            <input
              type="number"
              min={6}
              max={28}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.dataLabelFontSize}
              onChange={(e) => patch({ dataLabelFontSize: Number(e.target.value) || 12 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Fundo atrás dos rótulos (caixa no PPT)
            <span className="text-[10px] font-normal text-slate-500">
              Destaque atrás do número/% no gráfico (como o verde-água antigo). Deixe transparente se não quiser.
            </span>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.dataLabelBackgroundHex ?? '#CCCCCC').slice(0, 7)}
                onChange={(e) => patch({ dataLabelBackgroundHex: e.target.value })}
              />
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => patch({ dataLabelBackgroundHex: null })}
              >
                Sem fundo nos rótulos
              </button>
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Cor do texto dos rótulos (números / %)
            <span className="text-[10px] font-normal text-slate-500">Pizza, rosca, barras e linha — PPT e prévia.</span>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.dataLabelColor).slice(0, 7)}
                onChange={(e) => patch({ dataLabelColor: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                value={c.dataLabelColor}
                onChange={(e) => patch({ dataLabelColor: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Marcador linha (PPT)
            <select
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.lineSymbol}
              onChange={(e) => patch({ lineSymbol: e.target.value as AreaChartSlideStyle['lineSymbol'] })}
            >
              {CHART_LINE_SYMBOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Espessura linha (pt PPT)
            <input
              type="number"
              min={1}
              max={12}
              step={0.5}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.lineWidth}
              onChange={(e) => patch({ lineWidth: Number(e.target.value) || 2 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Tamanho marcador (PPT)
            <input
              type="number"
              min={2}
              max={24}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.lineDotSize}
              onChange={(e) => patch({ lineDotSize: Number(e.target.value) || 6 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Borda das fatias (pizza / rosca)
            <span className="text-[10px] font-normal text-slate-500">
              Contorno dourado entre fatias (estilo slide passivo). Sem cor = sem borda.
            </span>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200"
                value={ensureHashColor(c.pieDonutSliceBorderHex ?? '#d5b170').slice(0, 7)}
                onChange={(e) => patch({ pieDonutSliceBorderHex: e.target.value })}
              />
              <button type="button" className="text-xs text-primary underline" onClick={() => patch({ pieDonutSliceBorderHex: null })}>
                Sem borda nas fatias
              </button>
            </div>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Buraco rosca (% 10–90)
            <input
              type="number"
              min={10}
              max={90}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.donutHolePercent}
              onChange={(e) => patch({ donutHolePercent: Number(e.target.value) || 52 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Ângulo 1ª fatia pizza (0–359°)
            <input
              type="number"
              min={0}
              max={359}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.pieFirstSliceAngle}
              onChange={(e) => patch({ pieFirstSliceAngle: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Largura entre barras % (0–500, PPT)
            <input
              type="number"
              min={0}
              max={500}
              className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
              value={c.barGapWidthPct}
              onChange={(e) => {
                const v = Number(e.target.value)
                patch({ barGapWidthPct: Number.isFinite(v) ? Math.min(500, Math.max(0, v)) : 150 })
              }}
            />
          </label>
        </div>

        {onReset ? (
          <div className="flex justify-end pt-1">
            <button type="button" className="text-xs font-medium text-slate-600 underline hover:text-slate-900" onClick={onReset}>
              {resetButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  )
}
