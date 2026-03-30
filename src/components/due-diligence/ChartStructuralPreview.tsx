/**
 * Prévia Recharts para configuração estrutural dos gráficos do PPT (página global).
 */
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
import type { AreaChartKindOverride, AreaChartSlideStyle } from '@/lib/due-diligence/types'
import type { AreaChartPreviewSlide } from '@/lib/due-diligence/areaChartPreviews'
import { chartSlideSupportsKindPicker } from '@/lib/due-diligence/areaChartPreviews'
import { DEFAULT_AREA_CHART_SLIDE_STYLE } from '@/lib/due-diligence/chartSlideStyles'
import { makePieDonutLabelRenderer } from '@/components/due-diligence/rechartsPieLabel'

function ensureHashColor(hex: string): string {
  const s = hex.trim()
  if (!s) return '#101f2e'
  return s.startsWith('#') ? s : `#${s}`
}

function indexMaxLabel(data: { label: string }[]): number {
  if (!data.length) return 8
  return Math.min(28, Math.max(...data.map((d) => d.label.length)))
}

export interface ChartStructuralPreviewProps {
  slide: AreaChartPreviewSlide
  /** Tipo efetivo (picker ou fixo do slide). */
  visKind: AreaChartKindOverride
  chartStyle: AreaChartSlideStyle
}

export function ChartStructuralPreview({ slide, visKind, chartStyle }: ChartStructuralPreviewProps) {
  const includeZeros = visKind === 'line'
  const seriesData = slide.series.filter((x) => x.value > 0 || includeZeros)

  if (slide.kind === 'text') {
    return (
      <div className="h-44 flex flex-col justify-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1 overflow-y-auto">
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
      <div className="h-44 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-[10px]">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              {slide.table.headers.map((h) => (
                <th key={h} className="px-2 py-1 text-left font-semibold text-slate-800">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slide.table.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-100">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-0.5 text-slate-700">
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
      <div className="h-44 flex items-center justify-center text-[11px] text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        Sem pontos para prévia.
      </div>
    )
  }

  const st = chartStyle ?? DEFAULT_AREA_CHART_SLIDE_STYLE
  const palette = st.colors.length ? st.colors : DEFAULT_AREA_CHART_SLIDE_STYLE.colors
  const barFill = st.seriesFill ? ensureHashColor(st.seriesFill) : undefined
  const tickAxis = { fontSize: st.axisFontSize, fill: st.axisLabelColor, fontFamily: st.axisFontFace }
  const lw = indexMaxLabel(seriesData) * 5
  const donutInner = (60 * st.donutHolePercent) / 100
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
    const bulletCls =
      'list-disc space-y-1.5 pl-[1.05rem] text-base leading-snug text-[#333] marker:text-[#d5b170]'
    const listBlock = (
      <ul className={`${bulletCls}${showPotencialBloco ? ' ml-5' : ''}`}>
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
    const chartBlock = (
      <div
        className="relative min-h-0 w-full min-w-0"
        style={{ filter: 'drop-shadow(0 3px 8px rgb(0 0 0 / 0.14))' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Pie
              data={seriesData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={donutInner}
              outerRadius={60}
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
          <span className="text-xl font-bold tabular-nums" style={{ color: centerTextColor }}>
            {donutCenterSum}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide" style={{ color: centerTextColor }}>
            Total
          </span>
        </div>
      </div>
    )
    return (
      <div
        className="h-44 w-full rounded-lg border border-slate-200 bg-white py-1 pl-0 pr-1 transition-colors"
        style={st.plotAreaFillHex ? { backgroundColor: ensureHashColor(st.plotAreaFillHex) } : undefined}
      >
        {showPotencialBloco ? (
          <div className="grid h-full min-h-0 w-full grid-cols-[minmax(0,42%)_1fr] grid-rows-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
            <div className="col-start-1 row-start-1 pl-0 pr-0.5">
              <p className="border-b border-slate-200/90 pb-2 text-[18px] leading-snug text-[#333]">
                <span className="font-bold text-[#d5b170]">• </span>
                <span className="font-bold">{potencialLabel}</span>
                <span className="font-normal">: </span>
                <span className="font-bold tabular-nums">{potencialValor}</span>
              </p>
            </div>
            <div className="col-start-1 row-start-2 overflow-y-auto self-start pl-0 pr-0.5">{listBlock}</div>
            <div className="col-start-2 row-start-2 min-h-0 min-w-0">{chartBlock}</div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 gap-2">
            <div className="flex w-[42%] shrink-0 flex-col justify-start overflow-y-auto pl-0 pr-0.5">
              {slide.textLines?.[0] ? (
                <p className="mb-2 text-sm font-semibold leading-snug text-slate-700">{slide.textLines[0]}</p>
              ) : null}
              {listBlock}
            </div>
            <div className="relative min-h-0 min-w-0 flex-1">{chartBlock}</div>
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
        paddingTop: 2,
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
          outerRadius={60}
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
      <BarChart data={seriesData} margin={{ top: 6, right: 8, left: 2, bottom: 22 }}>
        {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
        <XAxis
          dataKey="label"
          tick={tickAxis}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={46}
          stroke={st.axisLabelColor}
        />
        <YAxis tick={tickAxis} stroke={st.axisLabelColor} width={32} />
        <Tooltip />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {seriesData.map((_, i) => (
            <Cell key={i} fill={barFill ?? ensureHashColor(palette[i % palette.length])} />
          ))}
          {st.showDataLabels ? (
            <LabelList
              dataKey="value"
              fontSize={st.dataLabelFontSize - 1}
              fill={st.dataLabelColor}
              fontFamily={st.dataLabelFontFace}
            />
          ) : null}
        </Bar>
        {st.showLegend ? legendEl : null}
      </BarChart>
    ) : visKind === 'barH' ? (
      <BarChart data={seriesData} layout="vertical" margin={{ top: 6, right: 8, left: lw + 6, bottom: 6 }}>
        {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
        <XAxis type="number" tick={tickAxis} stroke={st.axisLabelColor} />
        <YAxis type="category" dataKey="label" tick={tickAxis} width={lw + 2} stroke={st.axisLabelColor} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {seriesData.map((_, i) => (
            <Cell key={i} fill={barFill ?? ensureHashColor(palette[i % palette.length])} />
          ))}
          {st.showDataLabels ? (
            <LabelList
              dataKey="value"
              fontSize={st.dataLabelFontSize - 1}
              fill={st.dataLabelColor}
              fontFamily={st.dataLabelFontFace}
            />
          ) : null}
        </Bar>
        {st.showLegend ? legendEl : null}
      </BarChart>
    ) : (
      <LineChart data={seriesData} margin={{ top: 6, right: 8, left: 2, bottom: 6 }}>
        {st.showGrid ? <CartesianGrid strokeDasharray="3 3" stroke={st.gridColor} /> : null}
        <XAxis dataKey="label" tick={tickAxis} stroke={st.axisLabelColor} />
        <YAxis tick={tickAxis} stroke={st.axisLabelColor} width={32} />
        <Tooltip />
        <Line
          type={st.lineSmooth ? 'monotone' : 'linear'}
          dataKey="value"
          stroke={ensureHashColor(st.lineStroke)}
          strokeWidth={Math.max(1, st.lineWidth - 1)}
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
              fontSize={st.dataLabelFontSize - 1}
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
      className="relative h-44 w-full rounded-lg border border-slate-200 bg-white transition-colors"
      style={st.plotAreaFillHex ? { backgroundColor: ensureHashColor(st.plotAreaFillHex) } : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chartEl}
      </ResponsiveContainer>
    </div>
  )
}

/** Kind efetivo para prévia: usa picker quando o slide suporta. */
export function structuralPreviewKind(
  slide: AreaChartPreviewSlide,
  kindsById: Partial<Record<string, AreaChartKindOverride>>
): AreaChartKindOverride {
  return chartSlideSupportsKindPicker(slide)
    ? kindsById[slide.id] ?? (slide.kind as AreaChartKindOverride)
    : (slide.kind as AreaChartKindOverride)
}
