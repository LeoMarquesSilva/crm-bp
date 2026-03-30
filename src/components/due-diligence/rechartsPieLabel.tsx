/**
 * Rótulos de pizza/rosca na prévia Recharts respeitando cor/fonte/tamanho do estilo (igual ao PPT).
 */
import type { AreaChartSlideStyle } from '@/lib/due-diligence/types'

function ensureHashColor(hex: string): string {
  const s = hex.trim()
  if (!s) return '#101f2e'
  return s.startsWith('#') ? s : `#${s}`
}

export type PieLabelCallbackProps = {
  cx: number
  cy: number
  midAngle?: number
  innerRadius: number
  outerRadius: number
  percent?: number
  name?: string
  value?: number | string
}

export function makePieDonutLabelRenderer(st: AreaChartSlideStyle) {
  return (props: PieLabelCallbackProps) => {
    if (!st.showDataLabels) return null
    const RADIAN = Math.PI / 180
    const midAngle = props.midAngle ?? 0
    const radius = props.innerRadius + (props.outerRadius - props.innerRadius) * 0.5
    const x = props.cx + radius * Math.cos(-midAngle * RADIAN)
    const y = props.cy + radius * Math.sin(-midAngle * RADIAN)
    const text =
      st.showPercent && typeof props.percent === 'number'
        ? `${Math.round(props.percent * 100)}%`
        : String(props.value ?? '')
    const fs = st.dataLabelFontSize
    const tw = Math.max(22, text.length * fs * 0.58 + 8)
    const th = fs + 6
    const bg = st.dataLabelBackgroundHex ? ensureHashColor(st.dataLabelBackgroundHex) : null
    return (
      <g>
        {bg ? (
          <rect
            x={x - tw / 2}
            y={y - th / 2}
            width={tw}
            height={th}
            rx={3}
            ry={3}
            fill={bg}
          />
        ) : null}
        <text
          x={x}
          y={y}
          fill={ensureHashColor(st.dataLabelColor)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          fontFamily={st.dataLabelFontFace}
        >
          {text}
        </text>
      </g>
    )
  }
}
