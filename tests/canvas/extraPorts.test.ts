import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { localPortPoint, portWorld } from '../../src/canvas/alignment'
import { getSymbol } from '../../src/symbols/registry'
import { activeSheet, useStore } from '../../src/store/store'
import type { PlantNode } from '../../src/model/types'

const base: PlantNode = {
  id: 'n1', symbolId: 'vessel.tank', kind: 'equipment', x: 96, y: 96, rotation: 0,
  extraPorts: [{ id: 'pin-1', x: 32, y: 0, kind: 'both' }],
}

describe('user pins in geometry', () => {
  it('portWorld resolves an extra pin like a catalog port', () => {
    expect(portWorld(base, 'pin-1')).toEqual({ x: 96 + 32, y: 96 })
  })
  it('honors rotation and stretch', () => {
    const g = getSymbol('vessel.tank').gridSize
    const stretched = { ...base, scaleX: 2, scaleY: 1 }
    expect(portWorld(stretched, 'pin-1')).toEqual({ x: 96 + 64, y: 96 })
    const rotated: PlantNode = { ...base, rotation: 90 }
    const w = g.w * 8, h = g.h * 8
    // after a quarter turn about the center, the top-edge pin lands on the right edge
    const p = portWorld(rotated, 'pin-1')!
    expect(p.x).toBeCloseTo(96 + w / 2 + h / 2)
    expect(p.y).toBeCloseTo(96 + h / 2 - (w / 2 - 32))
  })
  it('localPortPoint inverts portWorld (rotation + stretch)', () => {
    for (const node of [base, { ...base, rotation: 90 as const }, { ...base, scaleX: 2, rotation: 270 as const }]) {
      const world = portWorld(node, 'pin-1')!
      const local = localPortPoint(node, world)!
      expect(local.x).toBeCloseTo(32)
      expect(local.y).toBeCloseTo(0)
    }
  })
})

describe('pin store actions', () => {
  it('addExtraPort names pins uniquely; removeExtraPort takes its lines along', () => {
    const s = useStore.getState()
    const nid = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 0, y: 0, rotation: 0 })
    const other = s.addNode({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 300, y: 0, rotation: 0 })
    s.addExtraPort(nid, { x: 16, y: 0, kind: 'both' })
    s.addExtraPort(nid, { x: 48, y: 0, kind: 'both' })
    const find = () => activeSheet(useStore.getState()).nodes.find((n) => n.id === nid)!
    expect(find().extraPorts!.map((p) => p.id)).toEqual(['pin-1', 'pin-2'])

    const eid = s.addEdge({ lineClass: 'process.major', source: { nodeId: nid, portId: 'pin-1' }, target: { nodeId: other, portId: 'suction' } })
    s.removeExtraPort(nid, 'pin-1')
    const sheet = activeSheet(useStore.getState())
    expect(find().extraPorts!.map((p) => p.id)).toEqual(['pin-2'])
    expect(sheet.edges.some((e) => e.id === eid)).toBe(false)
    s.deleteIds([nid, other])
  })
})

describe('control valve positioner', () => {
  it('renders the ISA positioner box only when configured', () => {
    const def = getSymbol('cv.globe')
    const plain = def.render({ actuator: 'diaphragm', fail: 'none', positioner: 'none' })
    const withPos = def.render({ actuator: 'diaphragm', fail: 'none', positioner: 'yes' })
    expect(plain).not.toContain('M-2 2 h12 v12')
    expect(withPos).toContain('M-2 2 h12 v12')
    expect(def.configOptions?.positioner).toEqual(['none', 'yes'])
    // the sw signal port sits inside the positioner box
    const sw = def.ports.find((p) => p.id === 'sw')!
    expect(sw.x).toBeGreaterThanOrEqual(-2)
    expect(sw.x).toBeLessThanOrEqual(10)
    expect(sw.y).toBeGreaterThanOrEqual(2)
    expect(sw.y).toBeLessThanOrEqual(14)
  })
})
