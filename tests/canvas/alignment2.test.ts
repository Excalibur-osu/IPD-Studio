import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { portWorld, snapGuides } from '../../src/canvas/alignment'
import type { PlantEdge, PlantNode } from '../../src/model/types'

const node = (partial: Partial<PlantNode> & Pick<PlantNode, 'id' | 'symbolId' | 'x' | 'y'>): PlantNode => ({
  kind: 'equipment',
  rotation: 0,
  ...partial,
})

describe('portWorld', () => {
  it('maps ports to sheet space', () => {
    // instr.bubble s port local (20,40); node at (100,100)
    expect(portWorld(node({ id: 'a', symbolId: 'instr.bubble', x: 100, y: 100 }), 's')).toEqual({ x: 120, y: 140 })
  })
  it('honors rotation about the symbol center', () => {
    // 90° turns the south port to the west side: offset (0,20) -> (-20,0)
    const p = portWorld(node({ id: 'a', symbolId: 'instr.bubble', x: 100, y: 100, rotation: 90 }), 's')
    expect(p).toEqual({ x: 100, y: 120 })
  })
  it('honors scale', () => {
    // 2x bubble: s port at (40,80) from origin
    const p = portWorld(node({ id: 'a', symbolId: 'instr.bubble', x: 100, y: 100, scale: 2 }), 's')
    expect(p).toEqual({ x: 140, y: 180 })
  })
})

describe('connected-port snapping', () => {
  // The canonical impossible case: a 40px bubble can never share a center
  // with a 48px vessel on the 8px grid — port snap must land it off-grid.
  const vessel = node({ id: 'v', symbolId: 'vessel.vertical', x: 96, y: 240 })
  const bubble = node({ id: 'b', symbolId: 'instr.bubble', x: 96, y: 96, kind: 'instrument' })
  const edge: PlantEdge = {
    id: 'e1',
    lineClass: 'signal.electric',
    source: { nodeId: 'b', portId: 's' },
    target: { nodeId: 'v', portId: 'n' },
  }

  it('aligns the dragged bubble port over the vessel nozzle', () => {
    // bubble s at x+20=116; vessel n at 96+24=120 -> 4px off, inside window
    const hit = snapGuides(bubble, [bubble, vessel], 4, [edge])
    expect(hit.x).toBe(100) // 100+20 = 120 exactly over the nozzle
    expect(hit.guideX).toBe(120)
  })
  it('port alignment wins over box alignment', () => {
    // Box snap alone would keep left edges at 96; port snap must override.
    const boxOnly = snapGuides(bubble, [bubble, vessel], 4)
    expect(boxOnly.x).not.toBe(100)
    const withPorts = snapGuides(bubble, [bubble, vessel], 4, [edge])
    expect(withPorts.x).toBe(100)
  })
  it('does nothing when ports are farther than the window', () => {
    const far = { ...bubble, x: 160 }
    const hit = snapGuides(far, [far, vessel], 4, [edge])
    expect(hit.x).toBeUndefined()
  })
  it('aligns vertically for horizontal runs', () => {
    const sideBubble = node({ id: 'b', symbolId: 'instr.bubble', x: 240, y: 252, kind: 'instrument' })
    const sideEdge: PlantEdge = {
      id: 'e2',
      lineClass: 'process.impulse',
      source: { nodeId: 'b', portId: 'w' },
      target: { nodeId: 'v', portId: 'e' },
    }
    // bubble w at y+20=272; vessel e at 240+40=280 -> 8px off, inside 8px window
    const hit = snapGuides(sideBubble, [sideBubble, vessel], 4, [sideEdge])
    expect(hit.y).toBe(260) // 260+20 = 280
  })
})
