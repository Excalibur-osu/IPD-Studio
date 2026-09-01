// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { WidgetView } from './shared'

export default function Lamp({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const key = typeof widget.props?.signal === 'string' ? widget.props.signal : ''
  const on = (sim[key] ?? 0) >= 0.5
  return (
    <g>
      <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 3} fill={on ? theme.running : theme.panel} stroke={theme.equipStroke} strokeWidth={2} />
      <text x={w / 2} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.label ?? ''}</text>
    </g>
  )
}
