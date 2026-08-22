import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Valve({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const throttle = widget.props?.throttle === true
  const frac = throttle ? Math.max(0, Math.min(1, (sim.OP ?? 0) / 100)) : ((sim.OPEN ?? 0) >= 0.5 ? 1 : 0)
  const fill = frac > 0.02 ? theme.open : theme.closed
  const midX = w / 2, botY = h - 2
  return (
    <g>
      <polygon points={`2,2 ${midX},${h / 2} 2,${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <polygon points={`${w - 2},2 ${midX},${h / 2} ${w - 2},${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      {throttle && (
        <text x={midX} y={-4} textAnchor="middle" fill={theme.text} fontSize={11}>{fmt(sim.OP, 0)}%</text>
      )}
      <text x={midX} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? ''}</text>
    </g>
  )
}
