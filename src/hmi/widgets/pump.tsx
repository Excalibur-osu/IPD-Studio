import type { WidgetView } from './shared'

export default function Pump({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const r = Math.min(w, h) / 2 - 6
  const cx = w / 2, cy = h / 2 - 2
  const running = (sim.RUN ?? 0) >= 0.5
  const fill = running ? theme.running : theme.stopped
  return (
    <g>
      {/* mounting base */}
      <rect x={cx - r - 2} y={cy + r - 1} width={2 * r + 4} height={6} rx={2} fill={theme.equipStroke} />
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00000030" strokeWidth={5} />
      <g className={running ? 'hmi-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M ${cx} ${cy} L ${cx + r * 0.8} ${cy - r * 0.45} L ${cx + r * 0.8} ${cy + r * 0.45} Z`} fill={theme.bg} opacity={0.85} />
      </g>
      <text x={cx} y={h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? ''}</text>
    </g>
  )
}
