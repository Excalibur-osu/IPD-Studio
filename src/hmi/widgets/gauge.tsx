import type { WidgetView } from './shared'
import { fmt } from './shared'

/** Radial gauge: needle sweeps -120°..+120° over props.min..props.max. */
export default function Gauge({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const min = Number(widget.props?.min ?? 0)
  const max = Number(widget.props?.max ?? 100)
  const pv = sim.PV ?? min
  const frac = max > min ? Math.max(0, Math.min(1, (pv - min) / (max - min))) : 0
  const angle = -120 + 240 * frac
  const cx = w / 2, cy = h * 0.58, r = Math.min(w, h) * 0.42
  const arc = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const s = arc(-120), e = arc(120)
  return (
    <g>
      <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`} fill="none" stroke={theme.equipStroke} strokeWidth={4} strokeLinecap="round" />
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke={theme.text} strokeWidth={2.5} />
      </g>
      <circle cx={cx} cy={cy} r={3.5} fill={theme.text} />
      <text x={cx} y={cy + r * 0.7} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={600}>{fmt(pv, 0)}</text>
      <text x={cx} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
