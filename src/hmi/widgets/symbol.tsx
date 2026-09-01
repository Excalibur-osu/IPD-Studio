// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { getSymbol } from '../../symbols/registry'
import type { WidgetView } from './shared'

/** Any P&ID catalog symbol as an HMI graphic, scaled to the widget box and
 *  tinted by run/open state when the widget has a bound tag. */
export default function SymbolGraphic({ widget, theme, sim }: WidgetView) {
  const id = typeof widget.props?.symbolId === 'string' ? widget.props.symbolId : ''
  let inner = '', sw = 8, sh = 8
  try {
    const def = getSymbol(id)
    inner = def.render((widget.props as Record<string, string>) ?? {})
    sw = def.gridSize.w * 8
    sh = def.gridSize.h * 8
  } catch {
    inner = '<rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor"/>'
    sw = sh = 32
  }
  const on = (sim.RUN ?? sim.OPEN ?? 0) >= 0.5
  const color = on ? theme.running : theme.equipStroke
  // imported rotation: the widget box is already the rotated footprint, so
  // 90/270 fit the glyph's swapped extents and spin it about the box center
  const rot = widget.rotation ?? 0
  const swapped = rot === 90 || rot === 270
  const scale = Math.min(widget.w / (swapped ? sh : sw), widget.h / (swapped ? sw : sh))
  const transform = rot === 0
    ? `scale(${scale})`
    : `translate(${widget.w / 2} ${widget.h / 2}) rotate(${rot}) scale(${scale}) translate(${-sw / 2} ${-sh / 2})`
  return (
    <g data-hmi-symbol={id}>
      <g color={color} transform={transform} dangerouslySetInnerHTML={{ __html: inner }} />
      <text x={widget.w / 2} y={widget.h + 12} textAnchor="middle" fill={theme.text} fontSize={10} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
