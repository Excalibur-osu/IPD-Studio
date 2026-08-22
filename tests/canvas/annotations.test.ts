import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { makeElement } from '../../src/canvas/shapes'
import type { PlantNode } from '../../src/model/types'

const base: PlantNode = {
  id: 'a1', symbolId: 'pump.centrifugal', kind: 'equipment', x: 0, y: 0, rotation: 0,
  tag: { letters: 'P', loop: '101' }, label: 'Feed Pump',
}

describe('annotation stays horizontal under rotation', () => {
  it('unrotated symbols get no counter-transform', () => {
    const el = makeElement(base)
    expect((el.attr('tagL') as { transform?: string }).transform).toBeUndefined()
  })
  it('rotated symbols counter-rotate every text about its anchor', () => {
    const el = makeElement({ ...base, rotation: 90 })
    for (const sel of ['tagL', 'tagN', 'lbl']) {
      const a = el.attr(sel) as { transform: string; x: number; y: number }
      expect(a.transform).toBe(`rotate(-90 ${a.x} ${a.y})`)
    }
  })
})

describe('draggable text offsets', () => {
  it('offsets shift the anchor and survive in the transform', () => {
    const el = makeElement({ ...base, tagOffset: { x: 24, y: -8 }, labelOffset: { x: 0, y: 16 } })
    const tagL = el.attr('tagL') as { x: number; y: number }
    expect(tagL).toMatchObject({ x: 24 + 24, y: -14 - 8 }) // w/2=24 base
    const lbl = el.attr('lbl') as { y: number }
    expect(lbl.y).toBe(48 + 12 + 16) // h=48, below + offset
  })
  it('texts are grabbable, ports and body unaffected', () => {
    const el = makeElement(base)
    expect((el.attr('lbl') as { pointerEvents: string }).pointerEvents).toBe('auto')
    expect((el.attr('hit') as { width: number }).width).toBe(48)
  })
})
