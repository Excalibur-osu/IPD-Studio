import type { WidgetView } from './shared'

export default function Pump({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const r = Math.min(w, h) / 2 - 4
  const cx = w / 2, cy = h / 2
  const running = (sim.RUN ?? 0) >= 0.5
  const fill = running ? theme.running : theme.stopped
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <g className={running ? 'hmi-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M ${cx} ${cy} L ${cx + r * 0.8} ${cy - r * 0.45} L ${cx + r * 0.8} ${cy + r * 0.45} Z`} fill={theme.bg} opacity={0.85} />
      </g>
      <text x={cx} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? ''}</text>
    </g>
  )
}
