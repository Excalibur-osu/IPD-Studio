import type { WidgetView } from './shared'

/** Pure visual; the canvas wires pointer events in run mode. */
export default function PushButton({ widget, theme }: WidgetView) {
  const { w, h } = widget
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={6} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={600}>
        {widget.label ?? 'BUTTON'}
      </text>
    </g>
  )
}
