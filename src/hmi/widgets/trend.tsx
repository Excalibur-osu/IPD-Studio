import type { WidgetView } from './shared'
import { fmt, num } from './shared'

const CAP = 600

/** Mini-trend with scale labels, gridlines, alarm-limit lines, and the SP —
 *  the embedded trend professional displays put next to every loop. */
export default function Trend({ widget, theme, sim, history = [] }: WidgetView) {
  const { w, h } = widget
  const min = num(widget.props?.min) ?? 0
  const max = num(widget.props?.max) ?? 100
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const span = max - min || 1
  const px0 = 4, px1 = w - 30 // right gutter for scale labels
  const py0 = 16, py1 = h - 6
  const yOf = (v: number) => py1 - (py1 - py0) * Math.max(0, Math.min(1, (v - min) / span))
  const pts = history.slice(-CAP)
  const step = pts.length > 1 ? (px1 - px0) / (pts.length - 1) : 0
  const path = pts.map((v, i) => `${px0 + i * step},${yOf(v)}`).join(' ')

  const limitLines: { v: number | undefined; color: string }[] = [
    { v: num(widget.props?.HH), color: theme.alarm }, { v: num(widget.props?.H), color: theme.warn },
    { v: num(widget.props?.L), color: theme.warn }, { v: num(widget.props?.LL), color: theme.alarm },
  ]

  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={px0} x2={px1} y1={py0 + (py1 - py0) * f} y2={py0 + (py1 - py0) * f}
          stroke={theme.grid} strokeWidth={1} />
      ))}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={px0 + (px1 - px0) * f} x2={px0 + (px1 - px0) * f} y1={py0} y2={py1}
          stroke={theme.grid} strokeWidth={1} />
      ))}
      {limitLines.map(({ v, color }, i) =>
        v === undefined ? null : (
          <line key={i} x1={px0} x2={px1} y1={yOf(v)} y2={yOf(v)} stroke={color} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
        ),
      )}
      {sim.SP !== undefined && (
        <line x1={px0} x2={px1} y1={yOf(sim.SP)} y2={yOf(sim.SP)} stroke={theme.sp} strokeWidth={1.5} strokeDasharray="6 4" />
      )}
      {pts.length > 1 && <polyline points={path} fill="none" stroke={theme.liquid} strokeWidth={2} />}
      <text x={px1 + 3} y={py0 + 4} fill={theme.textDim} fontSize={8}>{fmt(max, 0)}</text>
      <text x={px1 + 3} y={py1} fill={theme.textDim} fontSize={8}>{fmt(min, 0)}</text>
      <text x={6} y={12} fill={theme.textDim} fontSize={10}>
        {widget.tag ?? ''} <tspan fill={theme.text} fontWeight={700}>{fmt(sim.PV)}</tspan>{unit ? ` ${unit}` : ''}
      </text>
    </g>
  )
}
