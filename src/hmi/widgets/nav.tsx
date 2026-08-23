import type { WidgetView } from './shared'

/** Screen navigation button: clicking it in run mode jumps to props.screen.
 *  The property panel keeps the label in sync with the target screen's name. */
export default function NavButton({ widget, theme }: WidgetView) {
  const { w, h } = widget
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={6} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      <text x={10} y={h / 2 + 4} fill={theme.text} fontSize={12} fontWeight={600}>
        {widget.label ?? 'Screen'}
      </text>
      <path d={`M ${w - 16} ${h / 2 - 5} L ${w - 9} ${h / 2} L ${w - 16} ${h / 2 + 5}`}
        fill="none" stroke={theme.textDim} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}
