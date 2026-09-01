// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { WidgetView } from './shared'
import { fmt, num } from './shared'

/**
 * ISA-101 style analog indicator: vertical scale with the PV as pointer+fill,
 * alarm limits as colored ticks and the SP as a caret. The operator reads
 * "where is the value relative to normal" at a glance, not a number.
 */
export default function BarIndicator({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const min = num(widget.props?.min) ?? 0
  const max = num(widget.props?.max) ?? 100
  const span = max - min || 1
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const pv = sim.PV
  const sp = sim.SP

  const top = 16, bottom = h - 22
  const scaleH = bottom - top
  const yOf = (v: number) => bottom - Math.max(0, Math.min(1, (v - min) / span)) * scaleH
  const bx = Math.max(4, w / 2 - 12), bw = Math.min(24, w - 8)

  const limits: { key: 'LL' | 'L' | 'H' | 'HH'; color: string }[] = [
    { key: 'LL', color: theme.alarm }, { key: 'L', color: theme.warn },
    { key: 'H', color: theme.warn }, { key: 'HH', color: theme.alarm },
  ]

  return (
    <g>
      <text x={w / 2} y={10} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.tag ?? widget.label ?? ''}</text>
      <rect x={bx} y={top} width={bw} height={scaleH} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      {pv !== undefined && (
        <rect x={bx + 2} y={yOf(pv)} width={bw - 4} height={Math.max(0, bottom - yOf(pv) - 1)} fill={theme.liquid} opacity={0.85} />
      )}
      {limits.map(({ key, color }) => {
        const v = num(widget.props?.[key])
        if (v === undefined) return null
        const y = yOf(v)
        return (
          <g key={key}>
            <line x1={bx - 4} x2={bx + bw} y1={y} y2={y} stroke={color} strokeWidth={2} />
            <text x={bx - 6} y={y + 3} textAnchor="end" fill={color} fontSize={7} fontWeight={700}>{key}</text>
          </g>
        )
      })}
      {sp !== undefined && (
        <path d={`M ${bx + bw + 10} ${yOf(sp) - 5} L ${bx + bw + 2} ${yOf(sp)} L ${bx + bw + 10} ${yOf(sp) + 5} Z`} fill={theme.sp} />
      )}
      {pv !== undefined && (
        <line x1={bx - 2} x2={bx + bw + 2} y1={yOf(pv)} y2={yOf(pv)} stroke={theme.text} strokeWidth={2} />
      )}
      <text x={w / 2} y={h - 6} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={700}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{fmt(pv)}{unit ? ` ${unit}` : ''}</text>
    </g>
  )
}
