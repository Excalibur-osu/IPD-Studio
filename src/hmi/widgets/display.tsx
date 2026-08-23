import type { WidgetView } from './shared'
import { fmt } from './shared'

/** Two-row layout: tag (and SP) on the top line, value+unit on the bottom —
 *  rows never collide however long the number gets. */
export default function Display({ widget, theme, sim, alarm }: WidgetView) {
  const { w, h } = widget
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const border = alarm === 'unacked' ? theme.alarm : alarm === 'acked' ? theme.alarmAck : theme.equipStroke
  const showSp = widget.props?.controller === true && sim.SP !== undefined
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} fill={theme.panel} stroke={border} strokeWidth={alarm && alarm !== 'none' ? 3 : 1.5} />
      <text x={8} y={14} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''}</text>
      {showSp && (
        <text x={w - 8} y={14} textAnchor="end" fill={theme.sp} fontSize={9}>SP {fmt(sim.SP, 0)}</text>
      )}
      <text x={w - 8} y={h - 8} textAnchor="end" fill={theme.text} fontSize={15} fontWeight={700}>
        {fmt(sim.PV)}{unit ? ` ${unit}` : ''}
      </text>
    </g>
  )
}
