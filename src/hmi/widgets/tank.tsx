import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Tank({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const level = Math.max(0, Math.min(100, sim.PV ?? 0))
  const liquidH = ((h - 8) * level) / 100
  const r = Math.min(12, w / 4)
  const gid = `tg-${widget.id}`
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.liquid} stopOpacity={0.65} />
          <stop offset="45%" stopColor={theme.liquid} />
          <stop offset="100%" stopColor={theme.liquid} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={r} fill={theme.equipFill} stroke={theme.equipStroke} strokeWidth={2} />
      <clipPath id={`clip-${widget.id}`}>
        <rect x={4} y={4} width={w - 8} height={h - 8} rx={Math.max(0, r - 2)} />
      </clipPath>
      <rect x={4} y={4 + (h - 8) - liquidH} width={w - 8} height={liquidH} fill={`url(#${gid})`} clipPath={`url(#clip-${widget.id})`} />
      {/* level ticks at 25/50/75% */}
      {[25, 50, 75].map((tk) => (
        <line key={tk} x1={w - 12} x2={w - 5} y1={4 + (h - 8) * (1 - tk / 100)} y2={4 + (h - 8) * (1 - tk / 100)}
          stroke={theme.equipStroke} strokeWidth={1.5} opacity={0.8} />
      ))}
      {/* alarm-limit markers (same defaults the sim applies) */}
      {([['LL', 5, theme.alarm], ['L', 10, theme.warn], ['H', 90, theme.warn], ['HH', 95, theme.alarm]] as const).map(([key, dflt, color]) => {
        const raw = widget.props?.[key]
        const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : dflt
        const y = 4 + (h - 8) * (1 - Math.max(0, Math.min(100, v)) / 100)
        return (
          <g key={key}>
            <line x1={2} x2={10} y1={y} y2={y} stroke={color} strokeWidth={2} />
            <text x={12} y={y + 2.5} fill={color} fontSize={7} fontWeight={700}>{key}</text>
          </g>
        )
      })}
      <text x={w / 2} y={h / 2 + 5} textAnchor="middle" fill={theme.text} fontSize={14} fontWeight={700}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{fmt(sim.PV, 0)}%</text>
      <text x={w / 2} y={h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
