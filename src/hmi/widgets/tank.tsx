import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Tank({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const level = Math.max(0, Math.min(100, sim.PV ?? 0))
  const liquidH = ((h - 8) * level) / 100
  const r = Math.min(12, w / 4)
  return (
    <g>
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={r} fill={theme.equipFill} stroke={theme.equipStroke} strokeWidth={2} />
      <clipPath id={`clip-${widget.id}`}>
        <rect x={4} y={4} width={w - 8} height={h - 8} rx={Math.max(0, r - 2)} />
      </clipPath>
      <rect x={4} y={4 + (h - 8) - liquidH} width={w - 8} height={liquidH} fill={theme.liquid} clipPath={`url(#clip-${widget.id})`} />
      <text x={w / 2} y={h / 2} textAnchor="middle" fill={theme.text} fontSize={13} fontWeight={600}>{fmt(sim.PV, 0)}%</text>
      <text x={w / 2} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
