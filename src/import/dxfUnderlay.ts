// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import DxfParser from 'dxf-parser'

export interface UnderlayResult {
  polylines: { x: number; y: number }[][]
  warnings: string[]
}

interface DxfEntityLike {
  type: string
  vertices?: { x: number; y: number }[]
  center?: { x: number; y: number }
  radius?: number
  startAngle?: number
  endAngle?: number
}

/**
 * Parse a DXF file into flattened, sheet-fitted polylines for a locked
 * background underlay (trace-over workflow). Arcs/circles are tessellated;
 * unsupported entity types are counted into warnings, never silently dropped.
 */
export function parseDxfUnderlay(text: string, sheet: { w: number; h: number }): UnderlayResult {
  const parser = new DxfParser()
  const dxf = parser.parse(text)
  if (!dxf || !Array.isArray(dxf.entities)) throw new Error('Could not parse DXF')

  const raw: { x: number; y: number }[][] = []
  const skipped = new Map<string, number>()

  for (const ent of dxf.entities as unknown as DxfEntityLike[]) {
    switch (ent.type) {
      case 'LINE':
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const pts = (ent.vertices ?? []).map((v) => ({ x: v.x, y: v.y }))
        if (pts.length >= 2) raw.push(pts)
        break
      }
      case 'CIRCLE': {
        if (!ent.center || !ent.radius) break
        const pts: { x: number; y: number }[] = []
        for (let a = 0; a <= 360; a += 15) {
          const rad = (a * Math.PI) / 180
          pts.push({ x: ent.center.x + ent.radius * Math.cos(rad), y: ent.center.y + ent.radius * Math.sin(rad) })
        }
        raw.push(pts)
        break
      }
      case 'ARC': {
        if (!ent.center || !ent.radius) break
        const start = ent.startAngle ?? 0
        const end = ent.endAngle ?? Math.PI * 2
        const sweep = end > start ? end - start : end + Math.PI * 2 - start
        const steps = Math.max(4, Math.ceil(sweep / (Math.PI / 12)))
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= steps; i++) {
          const a = start + (sweep * i) / steps
          pts.push({ x: ent.center.x + ent.radius * Math.cos(a), y: ent.center.y + ent.radius * Math.sin(a) })
        }
        raw.push(pts)
        break
      }
      default:
        skipped.set(ent.type, (skipped.get(ent.type) ?? 0) + 1)
    }
  }

  const warnings = [...skipped.entries()].map(
    ([type, count]) => `Skipped ${count} ${type} entit${count > 1 ? 'ies' : 'y'}`,
  )
  if (raw.length === 0) return { polylines: [], warnings: [...warnings, 'No drawable entities found'] }

  // fit into sheet with margin, y-flipped (DXF is y-up)
  const all = raw.flat()
  const minX = Math.min(...all.map((p) => p.x))
  const maxX = Math.max(...all.map((p) => p.x))
  const minY = Math.min(...all.map((p) => p.y))
  const maxY = Math.max(...all.map((p) => p.y))
  const margin = 24
  const scale = Math.min(
    (sheet.w - 2 * margin) / Math.max(maxX - minX, 1),
    (sheet.h - 2 * margin) / Math.max(maxY - minY, 1),
  )
  const polylines = raw.map((line) =>
    line.map((p) => ({
      x: margin + (p.x - minX) * scale,
      y: margin + (maxY - p.y) * scale,
    })),
  )
  return { polylines, warnings }
}
