import type { WidgetView } from './shared'
import { fmt } from './shared'

const CAP = 600

export default function Trend({ widget, theme, sim, history = [] }: WidgetView) {
  const { w, h } = widget
  const min = Number(widget.props?.min ?? 0)
  const max = Number(widget.props?.max ?? 100)
  const span = max - min || 1
  const pts = history.slice(-CAP)
  const step = pts.length > 1 ? (w - 8) / (pts.length - 1) : 0
  const path = pts.map((v, i) => `${4 + i * step},${4 + (h - 8) * (1 - (v - min) / span)}`).join(' ')
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      {pts.length > 1 && <polyline points={path} fill="none" stroke={theme.liquid} strokeWidth={2} />}
      <text x={6} y={12} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''} {fmt(sim.PV)}</text>
    </g>
  )
}
