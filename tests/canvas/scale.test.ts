import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { makeElement, updateElement } from '../../src/canvas/shapes'
import { useStore } from '../../src/store/store'
import { activeSheet } from '../../src/store/store'
import type { PlantNode } from '../../src/model/types'

const base: PlantNode = {
  id: 'n1', symbolId: 'vessel.tank', kind: 'equipment', x: 100, y: 100, rotation: 0,
}

describe('node scale in the graph layer', () => {
  it('scales element size and port positions', () => {
    const el = makeElement({ ...base, scale: 2 })
    expect(el.size()).toEqual({ width: 128, height: 112 })
    const items = (el.get('ports') as { items: { id: string; args: { x: number; y: number } }[] }).items
    const n = items.find((p) => p.id === 'n')!
    expect(n.args).toEqual({ x: 64, y: 0 })
    const e = items.find((p) => p.id === 'e')!
    expect(e.args).toEqual({ x: 128, y: 64 })
  })
  it('defaults to 1x with ports at catalog coordinates', () => {
    const el = makeElement(base)
    expect(el.size()).toEqual({ width: 64, height: 56 })
    const items = (el.get('ports') as { items: { id: string; args: { x: number; y: number } }[] }).items
    expect(items.find((p) => p.id === 'n')!.args).toEqual({ x: 32, y: 0 })
  })
  it('updateElement applies a scale change to size, ports, and attrs', () => {
    const el = makeElement(base)
    updateElement(el, { ...base, scale: 1.5 }, base)
    expect(el.size()).toEqual({ width: 96, height: 84 })
    const items = (el.get('ports') as { items: { id: string; args: { x: number; y: number } }[] }).items
    expect(items.find((p) => p.id === 'n')!.args).toEqual({ x: 48, y: 0 })
    expect((el.attr('sym') as { transform: string }).transform).toBe('scale(1.5)')
    expect((el.attr('hit') as { width: number }).width).toBe(96)
  })
})

describe('setNodeScale store action', () => {
  it('sets, clamps to [0.5, 3], and drops the field at 1x', () => {
    const s = useStore.getState()
    const id = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 0, y: 0, rotation: 0 })
    const find = () => activeSheet(useStore.getState()).nodes.find((n) => n.id === id)!
    s.setNodeScale(id, 2)
    expect(find().scale).toBe(2)
    s.setNodeScale(id, 99)
    expect(find().scale).toBe(3)
    s.setNodeScale(id, 0.1)
    expect(find().scale).toBe(0.5)
    s.setNodeScale(id, 1)
    expect('scale' in find()).toBe(false)
    s.deleteIds([id])
  })
})
