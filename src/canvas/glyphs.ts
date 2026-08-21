import type { LineClass } from '../model/types'

export interface GlyphStation {
  x: number
  y: number
  angle: number
  /** Distance from route start, for label placement. */
  distance: number
}

const END_CLEARANCE = 12

/**
 * Evenly spaced stations along a polyline, skipping any station closer than
 * 12px to a segment end (route ends and corners), with the segment angle.
 */
export function glyphPointsForRoute(
  points: { x: number; y: number }[],
  spacing: number,
): GlyphStation[] {
  if (points.length < 2) return []
  const segments: { x0: number; y0: number; dx: number; dy: number; len: number; start: number }[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len === 0) continue
    segments.push({ x0: a.x, y0: a.y, dx: dx / len, dy: dy / len, len, start: total })
    total += len
  }
  const out: GlyphStation[] = []
  for (let d = spacing; d < total - END_CLEARANCE; d += spacing) {
    const seg = segments.find((s) => d >= s.start && d <= s.start + s.len)
    if (!seg) continue
    const local = d - seg.start
    if (local < END_CLEARANCE || seg.len - local < END_CLEARANCE) continue
    out.push({
      x: seg.x0 + seg.dx * local,
      y: seg.y0 + seg.dy * local,
      angle: ((Math.atan2(seg.dy, seg.dx) * 180) / Math.PI + 360) % 360,
      distance: d,
    })
  }
  return out
}

export interface GlyphSpec {
  spacing: number
  /** JointJS label JSON markup. */
  markup: { tagName: string; selector: string; attributes: Record<string, string | number> }[]
}

const strokeGlyph = (d: string): GlyphSpec['markup'] => [
  { tagName: 'path', selector: 'glyph', attributes: { d, stroke: '#111', 'stroke-width': 1.25, fill: 'none' } },
]

export const GLYPHS: Record<LineClass, GlyphSpec | null> = {
  'process.major': null,
  'process.minor': null,
  'process.impulse': null,
  'signal.electric': null,
  'signal.pneumatic': { spacing: 24, markup: strokeGlyph('M -5 4 L 1 -4 M -1 4 L 5 -4') },
  'signal.hydraulic': { spacing: 24, markup: strokeGlyph('M -2 -4 V 4 H 4') },
  'signal.capillary': { spacing: 24, markup: strokeGlyph('M -4 -4 L 4 4 M 4 -4 L -4 4') },
  'signal.data': {
    spacing: 24,
    markup: [{ tagName: 'circle', selector: 'glyph', attributes: { r: 2.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.25 } }],
  },
  'signal.software': {
    spacing: 24,
    markup: [{ tagName: 'circle', selector: 'glyph', attributes: { r: 2.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.25 } }],
  },
  'link.internal': null,
}
