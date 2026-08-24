import type { WidgetView } from './shared'
import { fmt, num } from './shared'

/** Two-row layout: tag (and SP) on the top line, value+unit on the bottom —
 *  rows never collide however long the number gets. An optional sparkline
 *  (ISA-101's "which way is it heading") sits bottom-left. */
export default function Display({ widget, theme, sim, alarm, hist }: WidgetView) {
  const { w, h } = widget
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const border = alarm === 'unacked' ? theme.alarm : alarm === 'acked' ? theme.alarmAck : theme.equipStroke
  const showSp = widget.props?.controller === true && sim.SP !== undefined
  const sparkSeries = widget.props?.spark === true
    ? hist?.series[widget.tag ? `${widget.tag}.PV` : 'PV']
    : undefined
  const spark = (() => {
    if (!sparkSeries || sparkSeries.length < 2) return null
    const recent = sparkSeries.slice(-60)
    const lo = num(widget.props?.min) ?? 0
    const hi = num(widget.props?.max) ?? 100
    const x0 = 8, x1 = Math.max(x0 + 24, w * 0.45), yTop = h - 17, yBot = h - 6
    return recent.map((v, i) => {
      const x = x0 + (i / (recent.length - 1)) * (x1 - x0)
      const y = yBot - Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1))) * (yBot - yTop)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  })()
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} fill={theme.panel} stroke={border} strokeWidth={alarm && alarm !== 'none' ? 3 : 1.5} />
      <text x={8} y={14} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''}</text>
      {showSp && (
        <text x={w - 8} y={14} textAnchor="end" fill={theme.sp} fontSize={9}>SP {fmt(sim.SP, 0)}</text>
      )}
      {spark && <polyline points={spark} fill="none" stroke={theme.textDim} strokeWidth={1.2} data-spark />}
      <text x={w - 8} y={h - 8} textAnchor="end" fill={theme.text} fontSize={15} fontWeight={700}>
        {fmt(sim.PV)}{unit ? ` ${unit}` : ''}
      </text>
    </g>
  )
}
