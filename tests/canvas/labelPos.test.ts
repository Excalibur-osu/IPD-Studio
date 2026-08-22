import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { makeElement, updateElement } from '../../src/canvas/shapes'
import { activeSheet, useStore } from '../../src/store/store'
import type { PlantNode } from '../../src/model/types'

const base: PlantNode = {
  id: 'lp1', symbolId: 'vessel.vertical', kind: 'equipment', x: 0, y: 0, rotation: 0, label: 'Hot Tank',
}

describe('label position option', () => {
  it('defaults below the symbol', () => {
    const el = makeElement(base)
    const lbl = el.attr('lbl') as { x: number; y: number }
    expect(lbl.y).toBe(92) // h(80) + 12
    expect(lbl.x).toBe(24)
  })
  it('centers inside the symbol when labelPos is center', () => {
    const el = makeElement({ ...base, labelPos: 'center' })
    const lbl = el.attr('lbl') as { x: number; y: number }
    expect(lbl.y).toBe(43) // h/2 + 3
    expect(lbl.x).toBe(24)
  })
  it('center tracks the scaled size', () => {
    const el = makeElement({ ...base, labelPos: 'center', scale: 2 })
    expect((el.attr('lbl') as { y: number }).y).toBe(83) // 160/2 + 3
  })
  it('updateElement moves the label when the position changes', () => {
    const el = makeElement(base)
    updateElement(el, { ...base, labelPos: 'center' }, base)
    expect((el.attr('lbl') as { y: number }).y).toBe(43)
    updateElement(el, base, { ...base, labelPos: 'center' })
    expect((el.attr('lbl') as { y: number }).y).toBe(92)
  })
})

describe('setLabelPos store action', () => {
  it('sets center and drops the field when back to below', () => {
    const s = useStore.getState()
    const id = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 0, y: 0, rotation: 0, label: 'T-1' })
    const find = () => activeSheet(useStore.getState()).nodes.find((n) => n.id === id)!
    s.setLabelPos(id, 'center')
    expect(find().labelPos).toBe('center')
    s.setLabelPos(id, 'below')
    expect('labelPos' in find()).toBe(false)
    s.deleteIds([id])
  })
})
