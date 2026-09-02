import { describe, expect, it } from 'vitest'
import { createShakeDetector } from '../../src/canvas/shake'

/** Feed a run of samples along one axis and report when it first reads as a shake. */
function feed(points: [number, number][], start = 1_000, gap = 40): boolean {
  const d = createShakeDetector()
  let t = start
  let shook = false
  for (const [x, y] of points) {
    if (d.push(x, y, t)) shook = true
    t += gap
  }
  return shook
}

/** A waggle: `legs` reversals of `amp` px along x. */
const waggle = (legs: number, amp = 40): [number, number][] => {
  const pts: [number, number][] = [[0, 0]]
  for (let i = 0; i < legs; i++) pts.push([i % 2 === 0 ? amp : 0, 0])
  return pts
}

describe('createShakeDetector', () => {
  it('reads a back-forth-back waggle as a shake', () => {
    expect(feed(waggle(5))).toBe(true)
  })

  it('ignores a straight drag across the sheet, however long', () => {
    const straight: [number, number][] = Array.from({ length: 40 }, (_, i) => [i * 20, i * 6])
    expect(feed(straight)).toBe(false)
  })

  it('ignores one change of mind', () => {
    expect(feed([[0, 0], [200, 0], [40, 0]])).toBe(false)
  })

  it('ignores a slow waggle — re-aiming a symbol is not a shake', () => {
    expect(feed(waggle(7), 1_000, 400)).toBe(false)
  })

  it('ignores jitter too small to be deliberate', () => {
    expect(feed(waggle(9, 6))).toBe(false)
  })

  it('reads a vertical waggle too', () => {
    const pts: [number, number][] = [[0, 0]]
    for (let i = 0; i < 5; i++) pts.push([0, i % 2 === 0 ? 40 : 0])
    expect(feed(pts)).toBe(true)
  })

  it('forgets the gesture on reset', () => {
    const d = createShakeDetector()
    let t = 1_000
    for (const [x, y] of waggle(3)) {
      d.push(x, y, t)
      t += 40
    }
    d.reset()
    // two more reversals would have tipped it over without the reset
    let shook = false
    for (const [x, y] of waggle(2)) {
      if (d.push(x, y, t)) shook = true
      t += 40
    }
    expect(shook).toBe(false)
  })
})
