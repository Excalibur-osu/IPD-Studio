import { describe, expect, it } from 'vitest'
import { GLYPHS, glyphPointsForRoute } from '../../src/canvas/glyphs'
import { LINE_STROKES } from '../../src/canvas/lineStyle'
import type { LineClass } from '../../src/model/types'

describe('glyphPointsForRoute', () => {
  it('spaces stations along a straight line, clear of the ends', () => {
    const pts = glyphPointsForRoute([{ x: 0, y: 0 }, { x: 100, y: 0 }], 24)
    expect(pts.map((p) => p.x)).toEqual([24, 48, 72])
    expect(pts.every((p) => p.angle === 0)).toBe(true)
  })
  it('skips stations near corners and rotates after them', () => {
    const pts = glyphPointsForRoute(
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }],
      24,
    )
    expect(pts).toHaveLength(2)
    expect(pts[0]).toMatchObject({ x: 24, y: 0, angle: 0 })
    expect(pts[1]).toMatchObject({ x: 50, y: 22, angle: 90 })
  })
  it('returns nothing for degenerate routes', () => {
    expect(glyphPointsForRoute([{ x: 0, y: 0 }], 24)).toEqual([])
    expect(glyphPointsForRoute([], 24)).toEqual([])
  })
})

describe('GLYPHS table', () => {
  it('covers every line class', () => {
    for (const cls of Object.keys(LINE_STROKES) as LineClass[]) {
      expect(cls in GLYPHS, cls).toBe(true)
    }
  })
  it('decorated classes have spacing and markup', () => {
    for (const cls of ['signal.pneumatic', 'signal.data', 'signal.software', 'signal.hydraulic', 'signal.capillary'] as LineClass[]) {
      const g = GLYPHS[cls]
      expect(g, cls).not.toBeNull()
      expect(g!.spacing).toBeGreaterThan(0)
      expect(g!.markup.length).toBeGreaterThan(0)
    }
    expect(GLYPHS['process.major']).toBeNull()
    expect(GLYPHS['signal.electric']).toBeNull()
  })
})
