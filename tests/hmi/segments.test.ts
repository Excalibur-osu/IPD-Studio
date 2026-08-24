import { describe, expect, it } from 'vitest'
import type { HmiPipe } from '../../src/hmi/model'
import { segmentAt } from '../../src/hmi/editGeometry'

// L-shaped run: horizontal 100..500 at y=200, then vertical down to y=600
const pipe: HmiPipe = { id: 'p1', points: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 600 }] }

describe('segmentAt', () => {
  it('finds the horizontal segment with its axis', () => {
    expect(segmentAt(pipe, { x: 300, y: 202 })).toEqual({ index: 0, axis: 'h' })
  })
  it('finds the vertical segment', () => {
    expect(segmentAt(pipe, { x: 498, y: 400 })).toEqual({ index: 1, axis: 'v' })
  })
  it('misses beyond tolerance', () => {
    expect(segmentAt(pipe, { x: 300, y: 220 })).toBeNull()
  })
  it('near a vertex resolves to null so vertex handles win', () => {
    expect(segmentAt(pipe, { x: 500, y: 200 })).toBeNull()
    expect(segmentAt(pipe, { x: 104, y: 200 })).toBeNull() // endpoint counts as vertex
  })
  it('an oblique segment reports no axis', () => {
    const skew: HmiPipe = { id: 'p2', points: [{ x: 0, y: 0 }, { x: 100, y: 80 }] }
    expect(segmentAt(skew, { x: 50, y: 40 })).toEqual({ index: 0, axis: null })
  })
})
