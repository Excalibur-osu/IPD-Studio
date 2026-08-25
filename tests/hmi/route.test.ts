import { describe, expect, it } from 'vitest'
import { routePipe } from '../../src/hmi/routePipes'
import type { Rect, RouteEnd } from '../../src/hmi/routePipes'

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })

/** Strict-interior crossing: touching a boundary is not a cross. */
function segCrossesRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): boolean {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  return x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y
}

function assertOrtho(pts: { x: number; y: number }[]): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!
    expect(a.x === b.x || a.y === b.y, `segment ${i} is diagonal: ${JSON.stringify([a, b])}`).toBe(true)
  }
}

describe('routePipe', () => {
  it('facing collinear ports route as one straight segment', () => {
    const a: RouteEnd = { x: 64, y: 32, dir: 'right' }
    const b: RouteEnd = { x: 100, y: 32, dir: 'left' }
    const pts = routePipe(a, b, [], [])
    expect(pts).toEqual([{ x: 64, y: 32 }, { x: 100, y: 32 }])
  })

  it('exit directions shape the elbow: right-exit then drop into a top port', () => {
    const a: RouteEnd = { x: 100, y: 100, dir: 'right' }
    const b: RouteEnd = { x: 200, y: 160, dir: 'top' }
    const pts = routePipe(a, b, [], [])
    assertOrtho(pts)
    expect(pts[0]).toEqual({ x: 100, y: 100 })
    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 160 })
    // first move leaves rightward, last move arrives moving down
    expect(pts[1]!.y).toBe(100)
    expect(pts[1]!.x).toBeGreaterThan(100)
    const beforeEnd = pts[pts.length - 2]!
    expect(beforeEnd.x).toBe(200)
    expect(beforeEnd.y).toBeLessThan(160)
  })

  it('routes around an obstacle sitting on the direct corridor', () => {
    const a: RouteEnd = { x: 44, y: 84, dir: 'right' }
    const b: RouteEnd = { x: 400, y: 84, dir: 'left' }
    const blocker = R(150, 20, 64, 80)
    const pts = routePipe(a, b, [blocker], [])
    assertOrtho(pts)
    expect(pts[0]).toEqual({ x: 44, y: 84 })
    expect(pts[pts.length - 1]).toEqual({ x: 400, y: 84 })
    const inflated = R(blocker.x - 7, blocker.y - 7, blocker.w + 14, blocker.h + 14)
    for (let i = 1; i < pts.length; i++) {
      expect(segCrossesRect(pts[i - 1]!, pts[i]!, inflated), `segment ${i} crosses the blocker`).toBe(false)
    }
  })

  it('free ends without directions still connect orthogonally', () => {
    const pts = routePipe({ x: 10, y: 10 }, { x: 90, y: 70 }, [], [])
    assertOrtho(pts)
    expect(pts[0]).toEqual({ x: 10, y: 10 })
    expect(pts[pts.length - 1]).toEqual({ x: 90, y: 70 })
  })

  it('falls back to a naive elbow when the target is sealed off', () => {
    // a ring of walls around b leaves no way in
    const walls = [R(180, 80, 140, 10), R(180, 210, 140, 10), R(180, 80, 10, 140), R(310, 80, 10, 140)]
    const pts = routePipe({ x: 20, y: 150, dir: 'right' }, { x: 250, y: 150 }, walls, [])
    assertOrtho(pts)
    expect(pts[0]).toEqual({ x: 20, y: 150 })
    expect(pts[pts.length - 1]).toEqual({ x: 250, y: 150 })
  })

  it('own equipment rects do not block the port stubs', () => {
    // port sits on its vessel's boundary; the vessel itself must not wall the exit
    const own = R(0, 0, 64, 80)
    const pts = routePipe({ x: 64, y: 32, dir: 'right' }, { x: 200, y: 32, dir: 'left' }, [], [own])
    expect(pts[0]).toEqual({ x: 64, y: 32 })
    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 32 })
  })
})
