import type { WidgetView } from './shared'
import { fmt, num } from './shared'

/** Radial gauge: needle sweeps -120°..+120° over props.min..props.max, with
 *  warn/alarm zone arcs when H/HH (or L/LL) limits are set. */
export default function Gauge({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const min = num(widget.props?.min) ?? 0
  const max = num(widget.props?.max) ?? 100
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const pv = sim.PV ?? min
  const span = max - min || 1
  const angOf = (v: number) => -120 + 240 * Math.max(0, Math.min(1, (v - min) / span))
  const cx = w / 2, cy = h * 0.58, r = Math.min(w, h) * 0.42
  const at = (a: number, rr = r) => {
    const rad = ((a - 90) * Math.PI) / 180
    return { x: cx + rr * Math.cos(rad), y: cy + rr * Math.sin(rad) }
  }
  const arcPath = (a0: number, a1: number, rr = r) => {
    const s = at(a0, rr), e = at(a1, rr)
    return `M ${s.x} ${s.y} A ${rr} ${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
  }
  const zones: { from: number | undefined; to: number | undefined; color: string }[] = [
    { from: num(widget.props?.H), to: num(widget.props?.HH) ?? max, color: theme.warn },
    { from: num(widget.props?.HH), to: max, color: theme.alarm },
    { from: min, to: num(widget.props?.L), color: theme.warn },
    { from: min, to: num(widget.props?.LL), color: theme.alarm },
  ]
  return (
    <g>
      <path d={arcPath(-120, 120)} fill="none" stroke={theme.equipStroke} strokeWidth={4} strokeLinecap="round" />
      {zones.map(({ from, to, color }, i) => {
        if (from === undefined || to === undefined || to <= from) return null
        return <path key={i} d={arcPath(angOf(from), angOf(to))} fill="none" stroke={color} strokeWidth={4} />
      })}
      <g transform={`rotate(${angOf(pv)} ${cx} ${cy})`}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke={theme.text} strokeWidth={2.5} />
      </g>
      <circle cx={cx} cy={cy} r={3.5} fill={theme.text} />
      <text x={at(-120).x} y={at(-120).y + 12} textAnchor="middle" fill={theme.textDim} fontSize={8}>{fmt(min, 0)}</text>
      <text x={at(120).x} y={at(120).y + 12} textAnchor="middle" fill={theme.textDim} fontSize={8}>{fmt(max, 0)}</text>
      <text x={cx} y={cy + r * 0.7} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={600}>{fmt(pv, 0)}{unit ? ` ${unit}` : ''}</text>
      <text x={cx} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
