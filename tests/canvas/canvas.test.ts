import { describe, expect, it } from 'vitest'
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from '../../src/canvas/paperSetup'
import { sheetPx } from '../../src/model/doc'

describe('zoom math', () => {
  it('clamps to [0.25, 4]', () => {
    expect(clampZoom(1 * 1.1)).toBeCloseTo(1.1)
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0.001)).toBe(MIN_ZOOM)
  })
})

describe('sheet pixel sizes', () => {
  it('A3 paper is 1587x1122 px', () => {
    const { w, h } = sheetPx('A3')
    expect(w).toBeCloseTo(1587.4, 0)
    expect(h).toBeCloseTo(1122.5, 0)
  })
})
