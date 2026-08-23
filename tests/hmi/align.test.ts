import { describe, expect, it } from 'vitest'
import { alignPatches, distributePatches, duplicateWidgets } from '../../src/hmi/align'
import type { HmiWidget } from '../../src/hmi/model'

const W = (id: string, x: number, y: number, w = 40, h = 20): HmiWidget =>
  ({ id, type: 'display', x, y, w, h })

describe('alignPatches', () => {
  const trio = [W('a', 10, 10), W('b', 100, 50), W('c', 60, 120, 80, 40)]
  it('left/right/top/bottom align to the group extents', () => {
    expect(alignPatches(trio, 'left').map((p) => p.patch.x)).toEqual([10, 10, 10])
    expect(alignPatches(trio, 'right').map((p) => p.patch.x)).toEqual([100, 100, 60])
    expect(alignPatches(trio, 'top').map((p) => p.patch.y)).toEqual([10, 10, 10])
    expect(alignPatches(trio, 'bottom').map((p) => p.patch.y)).toEqual([140, 140, 120])
  })
  it('centerX centers every widget on the group center', () => {
    const cx = (10 + 140) / 2
    for (const [i, p] of alignPatches(trio, 'centerX').entries()) {
      expect(p.patch.x).toBe(Math.round(cx - trio[i]!.w / 2))
    }
  })
  it('needs at least two widgets', () => {
    expect(alignPatches([W('a', 0, 0)], 'left')).toEqual([])
  })
})

describe('distributePatches', () => {
  it('spaces three widgets with equal gaps, outermost pinned', () => {
    const patches = distributePatches([W('a', 0, 0), W('b', 50, 0), W('c', 200, 0)], 'h')
    // span 0..240, content 120 -> gap 60; b moves to 100
    expect(patches).toEqual([{ id: 'b', patch: { x: 100 } }])
  })
  it('vertical too, and <3 widgets is a no-op', () => {
    const patches = distributePatches([W('a', 0, 0), W('b', 0, 30), W('c', 0, 200)], 'v')
    expect(patches).toEqual([{ id: 'b', patch: { y: 100 } }])
    expect(distributePatches([W('a', 0, 0), W('b', 0, 100)], 'v')).toEqual([])
  })
})

describe('duplicateWidgets', () => {
  it('clones without ids, offset, deep-copies props', () => {
    const src: HmiWidget = { id: 'x', type: 'tank', x: 8, y: 16, w: 96, h: 128, tag: 'TK-1', props: { H: 90 } }
    const [c] = duplicateWidgets([src])
    expect(c).toMatchObject({ type: 'tank', x: 24, y: 32, tag: 'TK-1' })
    expect('id' in c!).toBe(false)
    expect(c!.props).toEqual({ H: 90 })
    expect(c!.props).not.toBe(src.props)
  })
})
