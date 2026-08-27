import { beforeEach, describe, expect, it } from 'vitest'
import { activeSheet, useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import '../../src/symbols/lib/index'

const st = () => useStore.getState()

describe('budget in the store', () => {
  beforeEach(() => { st().loadIntoStore(createEmptyDoc()) })

  it('setBudget merges and is undoable', () => {
    st().setBudget({ total: 50000, currency: '₹' })
    expect(st().doc.budget).toMatchObject({ total: 50000, currency: '₹' })
    st().setBudget({ installFactor: 3 })
    expect(st().doc.budget).toMatchObject({ total: 50000, currency: '₹', installFactor: 3 })
    st().undo()
    expect(st().doc.budget?.installFactor).toBeUndefined()
  })

  it('price overrides set and clear', () => {
    st().setPriceOverride('pump.centrifugal', 7000)
    expect(st().doc.budget?.overrides?.['pump.centrifugal']).toBe(7000)
    st().setPriceOverride('pump.centrifugal', undefined)
    expect(st().doc.budget?.overrides?.['pump.centrifugal']).toBeUndefined()
  })

  it('per-node cost sets and clears', () => {
    const id = st().addNode({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 0, y: 0, rotation: 0 })
    st().setNodeCost(id, 1234)
    expect(activeSheet(st()).nodes.find((n) => n.id === id)?.cost).toBe(1234)
    st().setNodeCost(id, undefined)
    expect(activeSheet(st()).nodes.find((n) => n.id === id)?.cost).toBeUndefined()
  })
})
