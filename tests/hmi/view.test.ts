import { describe, expect, it } from 'vitest'
import { HMI_WORLD } from '../../src/hmi/model'
import { effectiveK, panBy, viewBoxOf, zoomAt } from '../../src/hmi/view'

describe('viewBoxOf', () => {
  it('null view is the whole world (fit)', () => {
    expect(viewBoxOf(null)).toEqual({ x: 0, y: 0, w: HMI_WORLD.w, h: HMI_WORLD.h })
  })
  it('k=2 shows half the world centered on cx/cy', () => {
    const vb = viewBoxOf({ cx: 800, cy: 500, k: 2 })
    expect(vb).toEqual({ x: 400, y: 250, w: 800, h: 500 })
  })
  it('effectiveK inverts the box width', () => {
    expect(effectiveK(null)).toBe(1)
    expect(effectiveK({ cx: 0, cy: 0, k: 2.5 })).toBe(2.5)
  })
})

describe('zoomAt', () => {
  it('keeps the anchor point stationary on screen', () => {
    const anchor = { x: 400, y: 300 }
    const v1 = zoomAt(null, anchor, 2)
    const vb0 = viewBoxOf(null)
    const vb1 = viewBoxOf(v1)
    // the anchor's fractional position inside the box must not change
    const f0 = { x: (anchor.x - vb0.x) / vb0.w, y: (anchor.y - vb0.y) / vb0.h }
    const f1 = { x: (anchor.x - vb1.x) / vb1.w, y: (anchor.y - vb1.y) / vb1.h }
    expect(f1.x).toBeCloseTo(f0.x, 10)
    expect(f1.y).toBeCloseTo(f0.y, 10)
    expect(v1!.k).toBe(2)
  })
  it('clamps to [0.5, 4] and returns null at fit', () => {
    expect(zoomAt(null, { x: 0, y: 0 }, 100)!.k).toBe(4)
    expect(zoomAt({ cx: 800, cy: 500, k: 0.6 }, { x: 0, y: 0 }, 0.01)!.k).toBe(0.5)
    // zooming back to exactly 1 with a centered box collapses to fit (null)
    expect(zoomAt({ cx: 800, cy: 500, k: 2 }, { x: 800, y: 500 }, 0.5)).toBeNull()
  })
  it('chained zooms stay anchored', () => {
    const anchor = { x: 1200, y: 200 }
    let v = zoomAt(null, anchor, 1.2)
    v = zoomAt(v, anchor, 1.2)
    v = zoomAt(v, anchor, 1.2)
    const vb = viewBoxOf(v)
    const f = { x: (anchor.x - vb.x) / vb.w, y: (anchor.y - vb.y) / vb.h }
    expect(f.x).toBeCloseTo(1200 / HMI_WORLD.w, 10)
    expect(f.y).toBeCloseTo(200 / HMI_WORLD.h, 10)
  })
})

describe('panBy', () => {
  it('moves the center by world deltas', () => {
    const v = panBy({ cx: 800, cy: 500, k: 2 }, 40, -24)
    expect(v).toEqual({ cx: 840, cy: 476, k: 2 })
  })
  it('panning at fit starts a real view', () => {
    const v = panBy(null, 100, 0)
    expect(v).toEqual({ cx: HMI_WORLD.w / 2 + 100, cy: HMI_WORLD.h / 2, k: 1 })
  })
})
