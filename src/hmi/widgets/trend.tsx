// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { useState } from 'react'
import type { WidgetView } from './shared'
import { fmt, num } from './shared'

/** Muted pen palette (pen 1 first); ISA-101-friendly, distinct at 1.5px. */
export const PEN_COLORS = ['#38a8e8', '#e8a838', '#63c88f', '#c58fff']

/** First index inside the [endT − span, endT] window (series are
 *  index-aligned with ts). Samples are not uniform in sim time — speed
 *  changes mid-run — so the window is found by time, never by count. */
export function trendWindow(ts: number[], spanS: number, endT: number): number {
  const t0 = endT - spanS
  for (let i = 0; i < ts.length; i++) if (ts[i]! >= t0) return i
  return ts.length
}

const mmss = (t: number) =>
  `${String(Math.max(0, Math.floor(t / 60))).padStart(2, '0')}:${String(Math.max(0, Math.floor(t % 60))).padStart(2, '0')}`

/** Multi-pen trend with a real time axis, limit/SP lines, and a hover cursor
 *  that freezes the window and reads out every pen at that instant. */
export default function Trend({ widget, theme, sim, hist }: WidgetView) {
  const [hover, setHover] = useState<{ fx: number; endT: number } | null>(null)
  const { w, h } = widget
  const min = num(widget.props?.min) ?? 0
  const max = num(widget.props?.max) ?? 100
  const span = max - min || 1
  const spanS = num(widget.props?.span) ?? 120
  const px0 = 4, px1 = w - 30
  const py0 = 16, py1 = h - 14
  const yOf = (v: number) => py1 - (py1 - py0) * Math.max(0, Math.min(1, (v - min) / span))

  const primary = widget.tag ? `${widget.tag}.PV` : 'PV'
  const pens = [
    { ref: primary, color: PEN_COLORS[0]! },
    ...(widget.pens ?? []).slice(0, 3).map((p, i) => ({ ref: p.ref, color: p.color ?? PEN_COLORS[i + 1]! })),
  ]

  const ts = hist?.t ?? []
  const endT = hover?.endT ?? ts[ts.length - 1] ?? 0
  const t0 = endT - spanS
  const i0 = trendWindow(ts, spanS, endT)
  let i1 = ts.length - 1
  while (i1 >= 0 && ts[i1]! > endT) i1--
  const xOf = (t: number) => px0 + (px1 - px0) * Math.max(0, Math.min(1, (t - t0) / spanS))

  const penPath = (ref: string): string => {
    const series = hist?.series[ref]
    if (!series) return ''
    const pts: string[] = []
    for (let i = i0; i <= i1; i++) {
      const v = series[i]
      if (v === undefined) continue
      pts.push(`${xOf(ts[i]!).toFixed(1)},${yOf(v).toFixed(1)}`)
    }
    return pts.join(' ')
  }

  /** Pen value at the cursor (nearest sample ≤ cursor time), else live. */
  const readout = (ref: string): number | undefined => {
    const series = hist?.series[ref]
    if (hover && series) {
      const tc = t0 + hover.fx * spanS
      let idx = -1
      for (let i = i0; i <= i1; i++) if (ts[i]! <= tc) idx = i
      return idx >= 0 ? series[idx] : undefined
    }
    if (ref === primary) return sim.PV
    return series ? series[i1] : undefined
  }

  const limitLines: { v: number | undefined; color: string }[] = [
    { v: num(widget.props?.HH), color: theme.alarm }, { v: num(widget.props?.H), color: theme.warn },
    { v: num(widget.props?.L), color: theme.warn }, { v: num(widget.props?.LL), color: theme.alarm },
  ]

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width <= 0) return
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    // freeze the right edge on hover entry so the readout doesn't scroll away
    setHover((prev) => ({ fx, endT: prev?.endT ?? endT }))
  }

  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={px0} x2={px1} y1={py0 + (py1 - py0) * f} y2={py0 + (py1 - py0) * f}
          stroke={theme.grid} strokeWidth={1} />
      ))}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={px0 + (px1 - px0) * f} x2={px0 + (px1 - px0) * f} y1={py0} y2={py1}
          stroke={theme.grid} strokeWidth={1} />
      ))}
      {limitLines.map(({ v, color }, i) =>
        v === undefined ? null : (
          <line key={i} x1={px0} x2={px1} y1={yOf(v)} y2={yOf(v)} stroke={color} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
        ),
      )}
      {sim.SP !== undefined && (
        <line x1={px0} x2={px1} y1={yOf(sim.SP)} y2={yOf(sim.SP)} stroke={theme.sp} strokeWidth={1} strokeDasharray="8 3" />
      )}
      {pens.map((p) => {
        const d = penPath(p.ref)
        return d ? <polyline key={p.ref} points={d} fill="none" stroke={p.color} strokeWidth={1.6} /> : null
      })}
      {/* legend: pen name + value (cursor value while hovering) */}
      {pens.map((p, i) => (
        <text key={p.ref} x={px0 + 2 + i * ((px1 - px0) / Math.max(2, pens.length))} y={11}
          fontSize={8} fill={p.color}>
          {p.ref.replace(/\.PV$/, '')} {fmt(readout(p.ref))}
        </text>
      ))}
      {/* value scale (right gutter) + time axis */}
      <text x={w - 4} y={py0 + 6} textAnchor="end" fill={theme.textDim} fontSize={8}>{max}</text>
      <text x={w - 4} y={py1} textAnchor="end" fill={theme.textDim} fontSize={8}>{min}</text>
      {[0, 0.5, 1].map((f) => {
        const tt = t0 + f * spanS
        if (endT <= 0 || tt < 0) return null
        return (
          <text key={f} x={xOf(tt)} y={h - 4} fontSize={7} fill={theme.textDim}
            textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{mmss(tt)}</text>
        )
      })}
      {hover && (
        <line x1={px0 + hover.fx * (px1 - px0)} x2={px0 + hover.fx * (px1 - px0)} y1={py0} y2={py1}
          stroke={theme.text} strokeWidth={1} strokeDasharray="2 2" />
      )}
      {/* hover surface (run mode value cursor; freezes the window) */}
      <rect x={px0} y={py0} width={px1 - px0} height={py1 - py0} fill="transparent"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
    </g>
  )
}
