/**
 * Popups: preferências de gráficos por área (prévia gráfico a gráfico + edição) e detalhe de processos.
 */
import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts'
import type { DueDiligenceAreaRow } from '@/lib/due-diligence/types'
import type {
  AreaChartKindOverride,
  AreaChartOptionsPartial,
  AreaChartSlideStyle,
  AreaDetailConfig,
} from '@/lib/due-diligence/types'
import type { AreaChartPreviewSlide } from '@/lib/due-diligence/areaChartPreviews'
import { previewIdToOptionKey, AREA_CHART_KIND_OPTIONS, chartSlideSupportsKindPicker } from '@/lib/due-diligence/areaChartPreviews'
import {
  DEFAULT_AREA_CHART_SLIDE_STYLE,
  cloneDefaultStyle,
  applyStyleLayer,
  diffChartStyleFromDefault,
  diffChartStyleFromBase,
} from '@/lib/due-diligence/chartSlideStyles'
import { ChartStyleEditor } from '@/components/due-diligence/ChartStyleEditor'
import { makePieDonutLabelRenderer } from '@/components/due-diligence/rechartsPieLabel'
import { cn } from '@/lib/utils'

type ModalPrefsTab = 'slides' | 'global' | 'texts'

function ensureHashColor(hex: string): string {
  const s = hex.trim()
  if (!s) return '#101f2e'
  return s.startsWith('#') ? s : `#${s}`
}

function chartSlideIdsFromPreview(slides: AreaChartPreviewSlide[]): string[] {
  return slides.filter(chartSlideSupportsKindPicker).map((s) => s.id)
}

export interface AreaChartsPrefsModalProps {
  areaRow: DueDiligenceAreaRow
  areaLabel: string
  previewSlides: AreaChartPreviewSlide[]
  onClose: () => void
  onSave: (opts: AreaChartOptionsPartial) => Promise<void>
}

function initEnabledMap(opts: AreaChartOptionsPartial, slides: AreaChartPreviewSlide[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const s of slides) {
    const key = previewIdToOptionKey(s.id)
    if (!s.toggleable) continue
    if (!key) {
      out[s.id] = true
      continue
    }
    if (key === 'includeOptionalAudiencias' || key === 'includeOptionalCasos') {
      out[s.id] = opts[key] === true
    } else if (typeof opts[key] === 'boolean') {
      out[s.id] = opts[key] as boolean
    } else {
      out[s.id] = true
    }
  }
  return out
}

export function AreaChartsPrefsModal({
  areaRow,
  areaLabel,
  previewSlides,
  onClose,
  onSave,
}: AreaChartsPrefsModalProps) {
  const initial = useMemo(() => (areaRow.area_chart_options ?? {}) as AreaChartOptionsPartial, [areaRow.area_chart_options])
  const areaChartOptsKey = useMemo(
    () => JSON.stringify(areaRow.area_chart_options ?? null),
    [areaRow.area_chart_options]
  )

  const [step, setStep] = useState(0)
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(() =>
    initEnabledMap(initial, previewSlides)
  )
  const [titlesById, setTitlesById] = useState<Record<string, string>>(() => ({
    ...(initial.chartSlideTitles ?? {}),
  }))
  const [kindsById, setKindsById] = useState<Partial<Record<string, AreaChartKindOverride>>>(() => ({
    ...(initial.chartSlideKinds ?? {}),
  }))
  const [globalStyleFull, setGlobalStyleFull] = useState<AreaChartSlideStyle>(() =>
    applyStyleLayer(cloneDefaultStyle(), initial.chartGlobalStyle)
  )
  const [slidePartials, setSlidePartials] = useState<Record<string, Partial<AreaChartSlideStyle>>>(() => {
    const out: Record<string, Partial<AreaChartSlideStyle>> = {}
    for (const id of chartSlideIdsFromPreview(previewSlides)) {
      const p = initial.chartSlideStyles?.[id]
      if (p && Object.keys(p).length > 0) out[id] = { ...p }
    }
    return out
  })
  const [modalTab, setModalTab] = useState<ModalPrefsTab>('slides')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const o = (areaRow.area_chart_options ?? {}) as AreaChartOptionsPartial
    setEnabledById(initEnabledMap(o, previewSlides))
    setTitlesById({ ...(o.chartSlideTitles ?? {}) })
    setKindsById({ ...(o.chartSlideKinds ?? {}) })
    setGlobalStyleFull(applyStyleLayer(cloneDefaultStyle(), o.chartGlobalStyle))
    const partials: Record<string, Partial<AreaChartSlideStyle>> = {}
    for (const id of chartSlideIdsFromPreview(previewSlides)) {
      const p = o.chartSlideStyles?.[id]
      if (p && Object.keys(p).length > 0) partials[id] = { ...p }
    }
    setSlidePartials(partials)
    setStep(0)
    setModalTab('slides')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewSlides estável por área; areaChartOptsKey cobre mudanças de prefs
  }, [areaRow.id, areaRow.updated_at, areaChartOptsKey])

  const slides = previewSlides
  const n = slides.length
  const safeStep = Math.min(step, Math.max(0, n - 1))
  const slide = slides[safeStep]

  const seriesData = useMemo(() => {
    if (!slide) return []
    const k = chartSlideSupportsKindPicker(slide)
      ? kindsById[slide.id] ?? (slide.kind as AreaChartKindOverride)
      : slide.kind
    const includeZeros = k === 'line'
    return slide.series.filter((x) => x.value > 0 || includeZeros)
  }, [slide, kindsById])

  const chartStyle = useMemo((): AreaChartSlideStyle | null => {
    if (!slide || !chartSlideSupportsKindPicker(slide)) return null
    return applyStyleLayer(globalStyleFull, slidePartials[slide.id])
  }, [slide, globalStyleFull, slidePartials])

  const patchGlobalStyle = (patch: Partial<AreaChartSlideStyle>) => {
    setGlobalStyleFull((prev) => applyStyleLayer(prev, patch))
  }

  const patchChartStyle = (patch: Partial<AreaChartSlideStyle>) => {
    if (!slide || !chartSlideSupportsKindPicker(slide)) return
    const currentEffective = applyStyleLayer(globalStyleFull, slidePartials[slide.id])
    const nextEffective = applyStyleLayer(currentEffective, patch)
    const partial = diffChartStyleFromBase(nextEffective, globalStyleFull)
    setSlidePartials((prev) => {
      const n = { ...prev }
      if (Object.keys(partial).length === 0) delete n[slide.id]
      else n[slide.id] = partial
      return n
    })
  }

  const optionKey = slide ? previewIdToOptionKey(slide.id) : null
  const included = slide?.toggleable === false ? true : slide ? (enabledById[slide.id] ?? true) : true

  const displayTitle =
    slide && titlesById[slide.id] !== undefined && String(titlesById[slide.id]).trim() !== ''
      ? String(titlesById[slide.id])
      : slide?.defaultTitle ?? ''

  const setTitleForCurrent = (v: string) => {
    if (!slide) return
    setTitlesById((prev) => ({ ...prev, [slide.id]: v }))
  }

  const setIncludedForCurrent = (v: boolean) => {
    if (!slide || !slide.toggleable) return
    setEnabledById((prev) => ({ ...prev, [slide.id]: v }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const mergedTitles: Record<string, string> = { ...(initial.chartSlideTitles ?? {}) }
      for (const s of slides) {
        const t = String(titlesById[s.id] ?? '').trim()
        if (t && t !== s.defaultTitle) mergedTitles[s.id] = t
        else delete mergedTitles[s.id]
      }

      const mergedKinds: Record<string, AreaChartKindOverride> = { ...(initial.chartSlideKinds ?? {}) }
      for (const s of slides) {
        if (!chartSlideSupportsKindPicker(s)) {
          delete mergedKinds[s.id]
          continue
        }
        const def = s.kind as AreaChartKindOverride
        const chosen = kindsById[s.id] ?? def
        if (chosen === def) delete mergedKinds[s.id]
        else mergedKinds[s.id] = chosen
      }

      const gdiff = diffChartStyleFromDefault(globalStyleFull)
      const mergedStyles: Record<string, Partial<AreaChartSlideStyle>> = { ...(initial.chartSlideStyles ?? {}) }
      for (const s of slides) {
        if (!chartSlideSupportsKindPicker(s)) continue
        const partial = slidePartials[s.id]
        const eff = applyStyleLayer(globalStyleFull, partial)
        const diff = diffChartStyleFromBase(eff, globalStyleFull)
        if (Object.keys(diff).length === 0) delete mergedStyles[s.id]
        else mergedStyles[s.id] = diff
      }

      const opts: AreaChartOptionsPartial = {
        ...initial,
        chartSlideTitles: mergedTitles,
        chartSlideKinds: mergedKinds,
        chartSlideStyles: mergedStyles,
      }
      if (Object.keys(gdiff).length === 0) delete opts.chartGlobalStyle
      else opts.chartGlobalStyle = gdiff

      for (const s of slides) {
        const k = previewIdToOptionKey(s.id)
        if (!k || !s.toggleable) continue
        if (k === 'includeOptionalAudiencias' || k === 'includeOptionalCasos') {
          opts[k] = enabledById[s.id] === true
        } else {
          opts[k] = enabledById[s.id] !== false
        }
      }

      const cleanOpts = JSON.parse(JSON.stringify(opts)) as AreaChartOptionsPartial
      await onSave(cleanOpts)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => {
    if (!slide) return null
    if (slide.kind === 'text') {
      return (
        <div className="h-56 flex flex-col justify-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 space-y-1 overflow-y-auto">
          {(slide.textLines ?? ['Sem texto']).map((line, i) => (
            <p key={i} className="leading-snug">
              {line}
            </p>
          ))}
        </div>
      )
    }
    if (slide.kind === 'table' && slide.table) {
      return (
        <div className="h-56 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                {slide.table.headers.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.table.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-slate-100">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    if (seriesData.length === 0) {
      return (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Sem pontos para este gráfico (dados zerados ou colunas não mapeadas).
        </div>
      )
    }
    const visKind: AreaChartKindOverride = chartSlideSupportsKindPicker(slide)
      ? kindsById[slide.id] ?? (slide.kind as AreaChartKindOverride)
      : (slide.kind as AreaChartKindOverride)
    const st = chartStyle ?? DEFAULT_AREA_CHART_SLIDE_STYLE
    const palette = st.colors.length ? st.colors : DEFAULT_AREA_CHART_SLIDE_STYLE.colors
    const barFill = st.seriesFill ? ensureHashColor(st.seriesFill) : undefined
    const tickAxis = { fontSize: st.axisFontSize, fill: st.axisLabelColor, fontFamily: st.axisFontFace }
    const lw = indexMaxLabel(seriesData) * 5
    const donutInner = (72 * st.donutHolePercent) / 100
    const pieStart = 90 - st.pieFirstSliceAngle
    const pieEnd = -270 - st.pieFirstSliceAngle
    const pieDonutLabel = makePieDonutLabelRenderer(st)
    const sliceBorder = st.pieDonutSliceBorderHex ? ensureHashColor(st.pieDonutSliceBorderHex) : undefined
    const sliceStrokeW = sliceBorder ? 2.2 : 0
    const donutCenterSum = seriesData.reduce((s, d) => s + Number(d.value) || 0, 0)
    const centerTextColor = ensureHashColor(st.colors[0] ?? '#101f2e')

    if (visKind === 'donut') {
      const sorted = [...seriesData].sort((a, b) => Number(b.value) - Number(a.value))
      const potencialLabel = slide.textLines?.[0]
      const potencialValor = slide.textLines?.[1]
      const showPotencialBloco = Boolean(potencialLabel && potencialValor)
      const bulletClsModal =
        'list-disc space-y-2 pl-[1.1rem] text-base leading-snug text-[#333] marker:text-[#d5b170]'
      const listBlockModal = (
        <ul className={`${bulletClsModal}${showPotencialBloco ? ' ml-6' : ''}`}>
          {slide.id === 'civel_rosca' ? (
            <li>
              <span className="font-bold">Total</span>
              {`: ${donutCenterSum} processo(s)`}
            </li>
          ) : null}
          {sorted.map((d) => (
            <li key={d.label}>
              <span className="font-bold">{d.label}</span>
              {`: ${d.value}`}
              {slide.id === 'trab_pizza' || slide.id === 'civel_rosca' ? ' processo(s)' : ''}
            </li>
          ))}
          {slide.id === 'civel_rosca' ? null : (
            <li>
              <span className="font-bold">Total</span>
              {`: ${donutCenterSum} processo(s)`}
            </li>
          )}
        </ul>
      )
      const chartBlockModal = (
        <div className="relative min-h-0 w-full min-w-0" style={{ filter: 'drop-shadow(0 3px 8px rgb(0 0 0 / 0.14))' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={seriesData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={donutInner}
                outerRadius={72}
                paddingAngle={1}
                startAngle={pieStart}
                endAngle={pieEnd}
                label={pieDonutLabel}
                labelLine={false}
              >
                {seriesData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={ensureHashColor(palette[i % palette.length])}
                    stroke={sliceBorder}
                    strokeWidth={sliceStrokeW}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-2xl font-bold tabular-nums" style={{ color: centerTextColor }}>
              {donutCenterSum}
            </span>
            <span className="mt-0.5 text-[11px] font-semibold tracking-wide" style={{ color: centerTextColor }}>
              Total
            </span>
          </div>
        </div>
      )
      return (
        <div
          className="h-56 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-0 pr-2 transition-colors"
          style={st.plotAreaFillHex ? { backgroundColor: ensureHashColor(st.plotAreaFillHex) } : undefined}
        >
          {showPotencialBloco ? (
            <div className="grid h-full min-h-0 w-full grid-cols-[minmax(0,42%)_1fr] grid-rows-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <div className="col-start-1 row-start-1 pl-0 pr-1">
                <p className="border-b border-slate-200/90 pb-2 text-lg leading-snug text-[#333]">
                  <span className="font-bold text-[#d5b170]">• </span>
                  <span className="font-bold">{potencialLabel}</span>
                  <span className="font-normal">: </span>
                  <span className="font-bold tabular-nums">{potencialValor}</span>
                </p>
              </div>
              <div className="col-start-1 row-start-2 overflow-y-auto self-start pl-0 pr-1">{listBlockModal}</div>
              <div className="col-start-2 row-start-2 min-h-0 min-w-0">{chartBlockModal}</div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 gap-3">
              <div className="flex w-[42%] shrink-0 flex-col justify-start overflow-y-auto pl-0 pr-1">
                {slide.textLines?.[0] ? (
                  <p className="mb-2 text-sm font-semibold leading-snug text-slate-700">{slide.textLines[0]}</p>
                ) : null}
                {listBlockModal}
              </div>
              <div className="relative min-h-0 min-w-0 flex-1">{chartBlockModal}</div>
            </div>
          )}
        </div>
      )
    }

    const legendEl = st.showLegend ? (
      <Legend
        wrapperStyle={{
          fontSize: st.legendFontSize,
          color: st.legendColor,
          fontFamily: st.legendFontFace,
          paddingTop: 4,
        }}
      />
    ) : null

    const chartEl =
      visKind === 'pie' ? (
        <PieChart>
          <Pie
            data={seriesData}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={72}
            startAngle={pieStart}
            endAngle={pieEnd}
            label={pieDonutLabel}
            labelLine={false}
            paddingAngle={1}
          >
            {seriesData.map((_, i) => (
              <Cell
                key={i}
                fill={ensureHashColor(palette[i % palette.length])}
                stroke={sliceBorder}
                strokeWidth={sliceStrokeW}
              />
            ))}
          </Pie>
          <Tooltip />
          {legendEl}
        </PieChart>
      ) : visKind === 'bar' ? (
        <BarChart data={seriesData} margin={{ top: 8, right: 12, left: 4, bottom: 28 }}>
          {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
          <XAxis
            dataKey="label"
            tick={tickAxis}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={54}
            stroke={st.axisLabelColor}
          />
          <YAxis tick={tickAxis} stroke={st.axisLabelColor} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {seriesData.map((_, i) => (
              <Cell key={i} fill={barFill ?? ensureHashColor(palette[i % palette.length])} />
            ))}
            {st.showDataLabels ? (
              <LabelList
                dataKey="value"
                fontSize={st.dataLabelFontSize}
                fill={st.dataLabelColor}
                fontFamily={st.dataLabelFontFace}
              />
            ) : null}
          </Bar>
          {st.showLegend ? legendEl : null}
        </BarChart>
      ) : visKind === 'barH' ? (
        <BarChart data={seriesData} layout="vertical" margin={{ top: 8, right: 12, left: lw + 8, bottom: 8 }}>
          {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
          <XAxis type="number" tick={tickAxis} stroke={st.axisLabelColor} />
          <YAxis type="category" dataKey="label" tick={tickAxis} width={lw + 4} stroke={st.axisLabelColor} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {seriesData.map((_, i) => (
              <Cell key={i} fill={barFill ?? ensureHashColor(palette[i % palette.length])} />
            ))}
            {st.showDataLabels ? (
              <LabelList
                dataKey="value"
                fontSize={st.dataLabelFontSize}
                fill={st.dataLabelColor}
                fontFamily={st.dataLabelFontFace}
              />
            ) : null}
          </Bar>
          {st.showLegend ? legendEl : null}
        </BarChart>
      ) : (
        <LineChart data={seriesData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
          {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
          <XAxis dataKey="label" tick={tickAxis} stroke={st.axisLabelColor} />
          <YAxis tick={tickAxis} stroke={st.axisLabelColor} />
          <Tooltip />
          <Line
            type={st.lineSmooth ? 'monotone' : 'linear'}
            dataKey="value"
            stroke={ensureHashColor(st.lineStroke)}
            strokeWidth={st.lineWidth}
            dot={
              st.lineSymbol === 'none'
                ? false
                : { r: Math.max(2, st.lineDotSize / 2), fill: ensureHashColor(st.lineDotFill) }
            }
            activeDot={{ r: Math.max(3, st.lineDotSize / 2 + 1) }}
          >
            {st.showDataLabels ? (
              <LabelList
                dataKey="value"
                fontSize={st.dataLabelFontSize}
                fill={st.dataLabelColor}
                fontFamily={st.dataLabelFontFace}
              />
            ) : null}
          </Line>
          {st.showLegend ? legendEl : null}
        </LineChart>
      )

    return (
      <div
        className="relative h-56 w-full rounded-lg border border-slate-200 bg-white transition-colors"
        style={st.plotAreaFillHex ? { backgroundColor: ensureHashColor(st.plotAreaFillHex) } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartEl}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-0 my-6 max-h-[92vh] overflow-hidden flex flex-col border border-slate-200/80">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Gráficos da área — {areaLabel}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Abas: ajuste global, textos de todos os slides ou refine slide a slide com prévia.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="px-5 flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50/50">
          {(
            [
              { id: 'slides' as const, label: 'Slides' },
              { id: 'global' as const, label: 'Configuração global' },
              { id: 'texts' as const, label: 'Textos dos slides' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setModalTab(t.id)}
              className={cn(
                'px-3 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
                modalTab === t.id
                  ? 'border-primary text-primary bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {modalTab === 'slides' && (
          <div className="px-5 py-3 flex items-center justify-between gap-2 bg-slate-50/80 border-b border-slate-100">
            <button
              type="button"
              disabled={safeStep <= 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {safeStep + 1} / {n}
              </span>
              <div className="flex gap-1 mt-1">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ir para gráfico ${i + 1}`}
                    onClick={() => setStep(i)}
                    className={cn('h-1.5 rounded-full transition-all', i === safeStep ? 'w-6 bg-primary' : 'w-1.5 bg-slate-300 hover:bg-slate-400')}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={safeStep >= n - 1}
              onClick={() => setStep((s) => Math.min(n - 1, s + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {modalTab === 'global' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Estas opções valem como <strong>base para todos os gráficos desta área</strong> no PowerPoint e na prévia. Na aba <strong>Slides</strong>, você
                pode sobrescrever estilo, tipo de gráfico e título slide a slide.
              </p>
              <ChartStyleEditor
                chartStyle={globalStyleFull}
                onPatch={patchGlobalStyle}
                summarySubtitle="Base da área — combinada com ajustes por slide (se houver)"
                onReset={() => setGlobalStyleFull(cloneDefaultStyle())}
                resetButtonLabel="Restaurar configuração global ao padrão do sistema"
              />
            </div>
          )}

          {modalTab === 'texts' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Título que aparece no cabeçalho de cada slide no PPT. O placeholder é o texto sugerido pelos dados; altere só o que precisar.
              </p>
              <div className="space-y-3 max-h-[min(520px,60vh)] overflow-y-auto pr-1">
                {slides.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400">{s.id}</span>
                      {s.toggleable ? (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabledById[s.id] ?? true}
                            onChange={(e) => setEnabledById((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                            className="rounded border-slate-300 text-primary"
                          />
                          Incluir no PPT
                        </label>
                      ) : (
                        <span className="text-[10px] text-amber-700">Sempre no resumo do bloco</span>
                      )}
                    </div>
                    <label className="block text-xs font-semibold text-slate-600">Título no slide</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary"
                      value={s.id in titlesById ? titlesById[s.id] : s.defaultTitle}
                      onChange={(e) => setTitlesById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder={s.defaultTitle}
                    />
                    <p className="text-[11px] text-slate-500">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === 'slides' && slide && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Título no slide</label>
                <input
                  type="text"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary"
                  value={slide.id in titlesById ? titlesById[slide.id] : slide.defaultTitle}
                  onChange={(e) => setTitleForCurrent(e.target.value)}
                  placeholder={slide.defaultTitle}
                />
                <p className="text-[11px] text-slate-500 mt-1">{slide.description}</p>
              </div>

              {chartSlideSupportsKindPicker(slide) && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tipo de gráfico (prévia e PowerPoint)</label>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    value={(kindsById[slide.id] ?? slide.kind) as AreaChartKindOverride}
                    onChange={(e) =>
                      setKindsById((prev) => ({
                        ...prev,
                        [slide.id]: e.target.value as AreaChartKindOverride,
                      }))
                    }
                  >
                    {AREA_CHART_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {chartSlideSupportsKindPicker(slide) && chartStyle && (
                <ChartStyleEditor
                  chartStyle={chartStyle}
                  onPatch={patchChartStyle}
                  summarySubtitle="Sobrescreve a configuração global só neste slide"
                  onReset={() => {
                    if (!slide || !chartSlideSupportsKindPicker(slide)) return
                    setSlidePartials((prev) => {
                      const n = { ...prev }
                      delete n[slide.id]
                      return n
                    })
                  }}
                  resetButtonLabel="Remover ajustes só deste slide (volta ao global)"
                />
              )}

              {slide.toggleable && (
                <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => setIncludedForCurrent(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-sm text-slate-800">Incluir este slide na apresentação</span>
                </label>
              )}

              {!slide.toggleable && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Este slide faz parte do bloco resumo da área e é sempre gerado com o bloco &quot;{areaLabel}&quot; nas opções globais.
                </p>
              )}

              {renderPreview()}

              {slide.kind === 'table' && slide.table && (
                <p className="text-[11px] text-slate-400">
                  Prévia da tabela como no PPT. Edite os dados na etapa de revisão da planilha, se necessário.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end bg-slate-50/50">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-white" disabled={saving}>
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-95',
              saving && 'opacity-60'
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar preferências
          </button>
        </div>
      </div>
    </div>
  )
}

function indexMaxLabel(data: { label: string }[]): number {
  if (!data.length) return 8
  return Math.min(28, Math.max(...data.map((d) => d.label.length)))
}

export interface AreaProcessDetailModalProps {
  areaRow: DueDiligenceAreaRow
  areaLabel: string
  processOptions: { value: string; label: string }[]
  onClose: () => void
  onSave: (config: AreaDetailConfig, manualRows: import('@/lib/due-diligence/types').ManualProcessSlideRow[]) => Promise<void>
}

export function AreaProcessDetailModal({
  areaRow,
  areaLabel,
  processOptions,
  onClose,
  onSave,
}: AreaProcessDetailModalProps) {
  const cfg = areaRow.area_detail_config ?? {}
  const [selected, setSelected] = useState<string[]>(cfg.selectedProcessNumbers ?? [])
  const [note, setNote] = useState(cfg.detailNote ?? '')
  const [saving, setSaving] = useState(false)

  const toggle = (num: string) => {
    setSelected((prev) => (prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const manualRows: import('@/lib/due-diligence/types').ManualProcessSlideRow[] = selected.map((num) => {
        const row = (areaRow.parsed_data?.rows as Record<string, unknown>[] | undefined)?.find(
          (r) => String(r.numero_processo ?? r.processo ?? '') === num
        )
        return {
          numero_processo: num,
          texto_livre: note,
          classe: row ? String(row.classe_acao ?? row.classe ?? '') : '',
          resumo_risco: row ? String(row.resumo ?? row.risco ?? '') : '',
          valor_causa: row ? String(row.valor_causa ?? row.valor ?? '') : '',
          vara: row ? String(row.vara ?? row.foro ?? '') : '',
          polos: row ? String(row.polo_passivo ?? row.polos ?? '') : '',
          socio: row ? String(row.socio_polo_passivo ?? '') : '',
          fase: row ? String(row.fase ?? '') : '',
        }
      })
      await onSave(
        {
          selectedProcessNumbers: selected,
          detailNote: note,
        },
        manualRows
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Detalhar processos — {areaLabel}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Selecione processos para destacar nos slides (ex.: críticos). Vinculado ao texto livre abaixo.</p>
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 mb-3">
          {processOptions.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum número de processo encontrado nos dados.</p>
          ) : (
            processOptions.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Texto / observações</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 min-h-[80px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notas para o slide de detalhe..."
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm" disabled={saving}>
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm', saving && 'opacity-60')}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
