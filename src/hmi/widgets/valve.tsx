// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Valve({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const throttle = widget.props?.throttle === true
  // a valve imported from a rotated P&ID symbol keeps its run orientation
  const vert = widget.rotation === 90 || widget.rotation === 270
  // actuator side follows the P&ID rotation: 90° puts it on the right
  const side = widget.rotation === 270 ? -1 : 1
  // actual position (POS) once the stroke model runs; command (OP) as fallback
  const frac = throttle ? Math.max(0, Math.min(1, (sim.POS ?? sim.OP ?? 0) / 100)) : ((sim.OPEN ?? 0) >= 0.5 ? 1 : 0)
  const fill = frac > 0.02 ? theme.open : theme.closed
  const midX = w / 2, midY = h / 2, botY = h - 2
  return (
    <g data-orient={vert ? 'v' : 'h'}>
      {/* actuator stem + bonnet on throttling valves */}
      {throttle && !vert && (
        <>
          <line x1={midX} y1={midY} x2={midX} y2={-4} stroke={theme.equipStroke} strokeWidth={2} />
          <line x1={midX - 8} y1={-4} x2={midX + 8} y2={-4} stroke={theme.equipStroke} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {throttle && vert && (
        <>
          <line x1={midX} y1={midY} x2={midX + side * (w / 2 + 6)} y2={midY} stroke={theme.equipStroke} strokeWidth={2} />
          <line x1={midX + side * (w / 2 + 6)} y1={midY - 8} x2={midX + side * (w / 2 + 6)} y2={midY + 8} stroke={theme.equipStroke} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {vert ? (
        <>
          <polygon points={`2,2 ${w - 2},2 ${midX},${midY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
          <polygon points={`2,${botY} ${w - 2},${botY} ${midX},${midY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
        </>
      ) : (
        <>
          <polygon points={`2,2 ${midX},${midY} 2,${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
          <polygon points={`${w - 2},2 ${midX},${midY} ${w - 2},${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
        </>
      )}
      {throttle && (
        <text x={vert ? midX + side * (w / 2 + 12) : midX} y={vert ? midY + 4 : -10}
          textAnchor={vert ? (side > 0 ? 'start' : 'end') : 'middle'} fill={theme.text} fontSize={11} fontWeight={600}
          stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{fmt((sim.POS ?? sim.OP), 0)}%</text>
      )}
      <text x={midX} y={h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? ''}</text>
    </g>
  )
}
