import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { alignNodes, distributeNodes, snapGuides } from '../../src/canvas/alignment'
import type { PlantNode } from '../../src/model/types'

let n = 0
const mk = (x: number, y: number, symbolId = 'valve.gate'): PlantNode =>
  ({ id: `n${n++}`, symbolId, kind: 'valve', x, y, rotation: 0 })

describe('alignNodes', () => {
  it('aligns lefts to the minimum x', () => {
    const moves = alignNodes([mk(10, 0), mk(50, 20), mk(30, 40)], 'left')
    expect(moves.every((m) => m.x === 10)).toBe(true)
  })
  it('aligns horizontal centers', () => {
    const a = mk(0, 0)
    const b = mk(100, 50)
    const moves = alignNodes([a, b], 'center-v')
    // valve.gate is 32 wide -> centers at x+16; both should share one center
    const centers = moves.map((m) => m.x + 16)
    expect(centers[0]).toBe(centers[1])
  })
})

describe('distributeNodes', () => {
  it('spaces three nodes evenly by centers on x', () => {
    const moves = distributeNodes([mk(0, 0), mk(10, 0), mk(200, 0)], 'h')
    const centers = moves.map((m) => m.x + 16).sort((a, b) => a - b)
    // spacing even to within one 8px grid step (positions snap to the grid)
    expect(Math.abs((centers[1]! - centers[0]!) - (centers[2]! - centers[1]!))).toBeLessThanOrEqual(8)
    expect(moves.every((m) => m.x % 8 === 0)).toBe(true)
  })
  it('returns nodes unchanged when fewer than 3', () => {
    const nodes = [mk(0, 0), mk(50, 0)]
    expect(distributeNodes(nodes, 'h')).toEqual(nodes.map((nd) => ({ id: nd.id, x: nd.x, y: nd.y })))
  })
})

describe('snapGuides', () => {
  it('suggests x when centers nearly align, nothing when far', () => {
    const dragged = mk(97, 200) // center 113
    const other = mk(100, 0)    // center 116
    const g = snapGuides(dragged, [other])
    expect(g.x).toBe(100)
    expect(snapGuides(mk(0, 200), [other])).toEqual({})
  })
})
