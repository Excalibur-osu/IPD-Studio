import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { makeElement } from '../../src/canvas/shapes'
import { portWorld, scalesOf } from '../../src/canvas/alignment'
import { activeSheet, useStore } from '../../src/store/store'
import type { PlantNode } from '../../src/model/types'

const base: PlantNode = {
  id: 's1', symbolId: 'vessel.horizontal', kind: 'equipment', x: 100, y: 100, rotation: 0,
}

describe('per-axis stretch', () => {
  it('scaleX stretches width only, ports follow their axis', () => {
    // vessel.horizontal is 80x48; stretch to double length
    const el = makeElement({ ...base, scaleX: 2 })
    expect(el.size()).toEqual({ width: 160, height: 48 })
    const items = (el.get('ports') as { items: { id: string; args: { x: number; y: number } }[] }).items
    expect(items.find((p) => p.id === 'e')!.args).toEqual({ x: 152, y: 24 }) // 76*2, 24*1
    expect((el.attr('sym') as { transform: string }).transform).toBe('scale(2 1)')
  })
  it('uniform scale still renders as scale(s) and legacy files read unchanged', () => {
    const el = makeElement({ ...base, scale: 1.5 })
    expect((el.attr('sym') as { transform: string }).transform).toBe('scale(1.5)')
    expect(scalesOf({ scale: 1.5 })).toEqual({ sx: 1.5, sy: 1.5 })
    expect(scalesOf({ scaleX: 2, scale: 1.5 })).toEqual({ sx: 2, sy: 1.5 })
  })
  it('portWorld honors per-axis stretch', () => {
    expect(portWorld({ ...base, scaleX: 2 }, 'e')).toEqual({ x: 252, y: 124 })
  })
})

describe('setNodeStretch store action', () => {
  it('writes per-axis fields, collapses to uniform, clears at 1/1', () => {
    const s = useStore.getState()
    const id = s.addNode({ symbolId: 'vessel.horizontal', kind: 'equipment', x: 0, y: 0, rotation: 0 })
    const find = () => activeSheet(useStore.getState()).nodes.find((n) => n.id === id)!
    s.setNodeStretch(id, 2, 1)
    expect(find().scaleX).toBe(2)
    expect(find().scaleY).toBe(1)
    s.setNodeStretch(id, 1.5, 1.5)
    expect(find().scale).toBe(1.5)
    expect(find().scaleX).toBeUndefined()
    s.setNodeStretch(id, 1, 1)
    expect('scale' in find()).toBe(false)
    expect('scaleX' in find()).toBe(false)
    s.setNodeStretch(id, 99, 0.1)
    expect(find().scaleX).toBe(4)
    expect(find().scaleY).toBe(0.5)
    s.deleteIds([id])
  })
})
