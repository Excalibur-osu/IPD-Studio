import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Display({ widget, theme, sim, alarm }: WidgetView) {
  const { w, h } = widget
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const border = alarm === 'unacked' ? theme.alarm : alarm === 'acked' ? theme.alarmAck : theme.equipStroke
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} fill={theme.panel} stroke={border} strokeWidth={alarm && alarm !== 'none' ? 3 : 1.5} />
      <text x={8} y={h / 2 + 5} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''}</text>
      <text x={w - 8} y={h / 2 + 5} textAnchor="end" fill={theme.text} fontSize={14} fontWeight={600}>
        {fmt(sim.PV)}{unit ? ` ${unit}` : ''}
      </text>
    </g>
  )
}
