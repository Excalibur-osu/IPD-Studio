import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Valve({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const throttle = widget.props?.throttle === true
  // actual position (POS) once the stroke model runs; command (OP) as fallback
  const frac = throttle ? Math.max(0, Math.min(1, (sim.POS ?? sim.OP ?? 0) / 100)) : ((sim.OPEN ?? 0) >= 0.5 ? 1 : 0)
  const fill = frac > 0.02 ? theme.open : theme.closed
  const midX = w / 2, botY = h - 2
  return (
    <g>
      {/* actuator stem + bonnet on throttling valves */}
      {throttle && (
        <>
          <line x1={midX} y1={h / 2} x2={midX} y2={-4} stroke={theme.equipStroke} strokeWidth={2} />
          <line x1={midX - 8} y1={-4} x2={midX + 8} y2={-4} stroke={theme.equipStroke} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      <polygon points={`2,2 ${midX},${h / 2} 2,${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <polygon points={`${w - 2},2 ${midX},${h / 2} ${w - 2},${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      {throttle && (
        <text x={midX} y={-10} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
          stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{fmt((sim.POS ?? sim.OP), 0)}%</text>
      )}
      <text x={midX} y={h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? ''}</text>
    </g>
  )
}
