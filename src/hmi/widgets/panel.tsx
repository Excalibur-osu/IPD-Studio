// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { WidgetView } from './shared'

/** Grouping frame: professional screens box related equipment into sections.
 *  Selectable only by its title strip or border band (see hitWidget). */
export default function PanelFrame({ widget, theme }: WidgetView) {
  const { w, h } = widget
  const title = widget.label ?? ''
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={8} fill={theme.panel} fillOpacity={0.3}
        stroke={theme.equipStroke} strokeWidth={1.5} />
      {title && (
        <>
          <text x={12} y={17} fill={theme.textDim} fontSize={12} fontWeight={700} letterSpacing={0.5}>{title.toUpperCase()}</text>
          <line x1={8} x2={w - 8} y1={24} y2={24} stroke={theme.equipStroke} strokeWidth={1} opacity={0.5} />
        </>
      )}
    </g>
  )
}
