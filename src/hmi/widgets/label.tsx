import type { WidgetView } from './shared'

export default function LabelText({ widget, theme }: WidgetView) {
  return (
    <text x={0} y={widget.h / 2 + 4} fill={theme.text} fontSize={Math.max(12, widget.h - 10)}>
      {widget.label ?? 'Text'}
    </text>
  )
}
