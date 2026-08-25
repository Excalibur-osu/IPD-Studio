import { describe, expect, it } from 'vitest'
import { importSheet, mapNodes } from '../../src/hmi/importFromPid'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantEdge, PlantNode, ProjectDoc, Sheet } from '../../src/model/types'

const N = (id: string, symbolId: string, kind: PlantNode['kind'], x: number, y: number, extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x, y, rotation: 0, ...extra })
const sheet = (nodes: PlantNode[]): Sheet =>
  ({ id: 'sh1', name: 'S1', drawingNumber: '', revision: '0', sheetSize: 'A3', nodes, edges: [] })

function docWith(nodes: PlantNode[], edges: PlantEdge[]): ProjectDoc {
  const doc = createEmptyDoc()
  doc.sheets[0]!.nodes = nodes
  doc.sheets[0]!.edges = edges
  return doc
}

function segCrossesRect(a: { x: number; y: number }, b: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  return x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y
}

describe('imported pipe routing', () => {
  it('facing port pairs import as a single straight segment', () => {
    const doc = docWith(
      [N('a', 'vessel.tank', 'equipment', 0, 0), N('v', 'valve.gate', 'valve', 100, 24)],
      [{ id: 'e1', lineClass: 'process.major', source: { nodeId: 'a', portId: 'e' }, target: { nodeId: 'v', portId: 'w' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const p = screen.pipes.find((x) => x.flowRef === 'e1')!
    expect(p.points).toHaveLength(2)
    expect(p.points[0]!.y).toBeCloseTo(p.points[1]!.y, 4)
  })

  it('routes imported pipes around equipment instead of through it', () => {
    const doc = docWith(
      [
        N('pu', 'pump.centrifugal', 'equipment', 0, 64),
        N('blk', 'vessel.tank', 'equipment', 150, 20),
        N('tk', 'vessel.tank', 'equipment', 400, 52),
      ],
      [{ id: 'e1', lineClass: 'process.major', source: { nodeId: 'pu', portId: 'discharge' }, target: { nodeId: 'tk', portId: 'w' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const p = screen.pipes.find((x) => x.flowRef === 'e1')!
    const blk = screen.widgets.find((w) => w.id === 'imp-blk')!
    // routed in the same scaled space as the widgets: no segment cuts the vessel
    const inflated = { x: blk.x - 4, y: blk.y - 4, w: blk.w + 8, h: blk.h + 8 }
    for (let i = 1; i < p.points.length; i++) {
      expect(segCrossesRect(p.points[i - 1]!, p.points[i]!, inflated), `segment ${i} crosses equipment`).toBe(false)
    }
    // orthogonal throughout
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1]!, b = p.points[i]!
      expect(Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01).toBe(true)
    }
  })

  it('arrives at a top port from above', () => {
    const doc = docWith(
      [N('tk', 'vessel.tank', 'equipment', 300, 200)],
      [{ id: 'e1', lineClass: 'process.major', source: { x: 100, y: 100 }, target: { nodeId: 'tk', portId: 'n' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const p = screen.pipes.find((x) => x.flowRef === 'e1')!
    const last = p.points[p.points.length - 1]!
    const beforeLast = p.points[p.points.length - 2]!
    expect(beforeLast.x).toBeCloseTo(last.x, 4)
    expect(beforeLast.y).toBeLessThan(last.y)
  })
})

describe('imported equipment fidelity', () => {
  it('vessel symbols keep their shape identity on the tank widget', () => {
    const { widgets } = mapNodes(sheet([
      N('1', 'vessel.vertical', 'equipment', 0, 0, { label: 'A' }),
      N('2', 'vessel.horizontal', 'equipment', 200, 0, { label: 'B' }),
      N('3', 'vessel.tank', 'equipment', 400, 0, { label: 'C' }),
      N('4', 'vessel.cstr', 'equipment', 600, 0, { label: 'D' }),
    ]), '-')
    const shapes = widgets.map((w) => w.props?.shape)
    expect(shapes).toEqual([undefined, 'horizontal', 'cone', 'agitated'])
  })

  it('carries P&ID rotation onto valve and symbol widgets', () => {
    const { widgets } = mapNodes(sheet([
      N('v', 'valve.gate', 'valve', 0, 0, { rotation: 90 }),
      N('lg', 'acc.lg', 'instrument', 100, 0, { rotation: 180 }),
    ]), '-')
    const valve = widgets.find((w) => w.type === 'valve')!
    expect(valve.rotation).toBe(90)
    expect(valve.w).toBeLessThan(valve.h) // footprint stays swapped
    const lg = widgets.find((w) => w.type === 'symbol')!
    expect(lg.rotation).toBe(180)
  })
})
