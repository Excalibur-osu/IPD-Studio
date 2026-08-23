import { describe, expect, it } from 'vitest'
import { importSheet } from '../../src/hmi/importFromPid'
import { buildNetwork } from '../../src/hmi/sim/network'
import { loadDoc } from '../../src/model/migrate'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantEdge, PlantNode, ProjectDoc } from '../../src/model/types'
import samplePlant from '../../examples/sample-plant.pnid.json'

const VESSEL = 'vessel.tank', PUMP = 'pump.centrifugal', CV = 'cv.globe', BUBBLE = 'instr.bubble'

function docWith(nodes: PlantNode[], edges: PlantEdge[]): ProjectDoc {
  const doc = createEmptyDoc()
  doc.sheets[0]!.nodes = nodes
  doc.sheets[0]!.edges = edges
  return doc
}
const N = (id: string, symbolId: string, kind: PlantNode['kind'], x: number, y: number, extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x, y, rotation: 0, ...extra })

describe('importSheet', () => {
  it('imports pipes from process edges only, keeps geometry, sets fromSheetId', () => {
    const doc = docWith(
      [N('pu', PUMP, 'equipment', 100, 100), N('tk', VESSEL, 'equipment', 500, 60)],
      [
        { id: 'e1', lineClass: 'process.major', source: { x: 0, y: 128 }, target: { nodeId: 'pu', portId: 'suction' }, vertices: [] },
        { id: 'e2', lineClass: 'process.major', source: { nodeId: 'pu', portId: 'discharge' }, target: { nodeId: 'tk', portId: 'w' }, vertices: [{ x: 300, y: 120 }] },
        { id: 'e3', lineClass: 'signal.electric', source: { x: 0, y: 0 }, target: { x: 50, y: 0 } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    expect(screen.fromSheetId).toBe(doc.sheets[0]!.id)
    expect(screen.pipes).toHaveLength(2)
    expect(screen.pipes.find((p) => p.flowRef === 'e2')!.points.length).toBeGreaterThanOrEqual(3)
    const net = buildNetwork(screen)
    expect(net.branches.some((b) => b.pumps.length === 1 && b.to.kind === 'tank')).toBe(true)
  })
  it('binds a level transmitter to its vessel through an impulse edge', () => {
    const doc = docWith(
      [
        N('tk', VESSEL, 'equipment', 500, 60, { tag: { letters: 'TK', loop: '101' } }),
        N('lt', BUBBLE, 'instrument', 650, 90, { tag: { letters: 'LT', loop: '101' } }),
        N('lv', CV, 'valve', 300, 100, { tag: { letters: 'LV', loop: '101' } }),
      ],
      [{ id: 'imp', lineClass: 'process.impulse', source: { nodeId: 'lt', portId: 'w' }, target: { nodeId: 'tk', portId: 'e' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const lt = screen.widgets.find((w) => w.tag === 'LT-101')!
    expect(lt.props?.bindTank).toBe('TK-101')
  })
  it('impulse tubing never becomes a flow pipe (would read as a phantom source)', () => {
    const doc = docWith(
      [N('tk', VESSEL, 'equipment', 500, 60, { tag: { letters: 'TK', loop: '1' } }), N('lt', BUBBLE, 'instrument', 700, 90, { tag: { letters: 'LT', loop: '1' } })],
      [{ id: 'imp', lineClass: 'process.impulse', source: { nodeId: 'lt', portId: 'w' }, target: { nodeId: 'tk', portId: 'e' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    expect(screen.pipes).toHaveLength(0)
    expect(buildNetwork(screen).branches).toHaveLength(0)
  })
  it('scales an oversized layout into the world with margin', () => {
    const doc = docWith([N('a', VESSEL, 'equipment', 3000, 2000)], [])
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const w = screen.widgets[0]!
    expect(w.x + w.w).toBeLessThanOrEqual(1600)
    expect(w.y + w.h).toBeLessThanOrEqual(1000)
  })
  it('imported pipes are orthogonal (no diagonal segments)', () => {
    const doc = docWith(
      [N('pu', PUMP, 'equipment', 100, 100), N('tk', VESSEL, 'equipment', 500, 300)],
      [{ id: 'e1', lineClass: 'process.major', source: { nodeId: 'pu', portId: 'discharge' }, target: { nodeId: 'tk', portId: 'w' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    for (const p of screen.pipes) {
      for (let i = 0; i + 1 < p.points.length; i++) {
        const a = p.points[i]!, b = p.points[i + 1]!
        expect(Math.abs(a.x - b.x) <= 6 || Math.abs(a.y - b.y) <= 6).toBe(true)
      }
    }
  })
  it('display widgets are nudged off equipment they overlap', () => {
    const doc = docWith(
      [
        N('tk', VESSEL, 'equipment', 500, 60, { tag: { letters: 'TK', loop: '1' } }),
        N('lt', BUBBLE, 'instrument', 510, 80, { tag: { letters: 'LT', loop: '1' } }), // bubble ON the vessel
      ],
      [],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const tank = screen.widgets.find((w) => w.type === 'tank')!
    const lt = screen.widgets.find((w) => w.tag === 'LT-1')!
    const overlap =
      lt.x < tank.x + tank.w && lt.x + lt.w > tank.x && lt.y < tank.y + tank.h && lt.y + lt.h > tank.y
    expect(overlap).toBe(false)
  })
  it('imports the shipped sample plant end-to-end', () => {
    const doc = loadDoc(samplePlant)
    const screen = importSheet(doc, doc.sheets[0]!.id)
    expect(screen.widgets.length).toBeGreaterThan(3)
    expect(screen.pipes.length).toBeGreaterThan(0)
    expect(buildNetwork(screen).branches.length).toBeGreaterThan(0)
  })
})
