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

describe('controller-to-valve wiring through signal lines', () => {
  it('tags the untagged CV a controller signals into the loop (LIC-100 -> LV-100)', async () => {
    const doc = docWith(
      [
        N('tk', 'vessel.tank', 'equipment', 300, 200, { tag: { letters: 'TK', loop: '100' } }),
        N('lt', 'instr.bubble', 'instrument', 500, 100, { tag: { letters: 'LT', loop: '100' } }),
        N('lic', 'instr.bubble', 'instrument', 560, 100, { tag: { letters: 'LIC', loop: '100' } }),
        N('ip', 'instr.converter', 'instrument', 620, 160),
        N('cv', 'cv.globe', 'valve', 100, 60),
        N('gv', 'valve.gate', 'valve', 100, 300),
      ],
      [
        { id: 's1', lineClass: 'signal.electric', source: { nodeId: 'lic', portId: 's' }, target: { nodeId: 'ip', portId: 'e' } },
        { id: 's2', lineClass: 'signal.pneumatic', source: { nodeId: 'ip', portId: 'w' }, target: { nodeId: 'cv', portId: 'sig' } },
        { id: 'imp', lineClass: 'process.impulse', source: { nodeId: 'lt', portId: 'w' }, target: { nodeId: 'tk', portId: 'e' } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const cv = screen.widgets.find((w) => w.id === 'imp-cv')!
    expect(cv.tag).toBe('LV-100')
    const gv = screen.widgets.find((w) => w.id === 'imp-gv')!
    expect(gv.tag).not.toBe('LV-100')
    // and the sim engine now pairs the loop end-to-end
    const { buildSimModel } = await import('../../src/hmi/sim/engine')
    const model = buildSimModel([{ ...screen }])
    const lic = model.controllers.find((c) => c.tag === 'LIC-100')!
    expect(lic.outTag).toBe('LV-100')
    expect(lic.pvTag).toBe('LT-100')
  })
  it('a CV the P&ID already tagged keeps its tag', () => {
    const doc = docWith(
      [
        N('lic', 'instr.bubble', 'instrument', 560, 100, { tag: { letters: 'LIC', loop: '7' } }),
        N('cv', 'cv.globe', 'valve', 100, 60, { tag: { letters: 'XV', loop: '9' } }),
      ],
      [{ id: 's1', lineClass: 'signal.electric', source: { nodeId: 'lic', portId: 's' }, target: { nodeId: 'cv', portId: 'sig' } }],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    expect(screen.widgets.find((w) => w.id === 'imp-cv')!.tag).toBe('XV-9')
  })
})

describe('imported pipe orientation (flow direction)', () => {
  it('reverses a line the user drew against the flow: bottom outlet chains stay tank-sourced', async () => {
    // TK-A bottom -> V1 drawn forward; V1 -> TK-B top drawn BACKWARDS (from the tank up to the valve)
    const doc = docWith(
      [
        N('ta', 'vessel.tank', 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' } }),
        N('v1', 'valve.gate', 'valve', 16, 200, { rotation: 90 }),
        N('tb', 'vessel.tank', 'equipment', 0, 400, { tag: { letters: 'TK', loop: '2' } }),
      ],
      [
        { id: 'e1', lineClass: 'process.major', source: { nodeId: 'ta', portId: 's' }, target: { nodeId: 'v1', portId: 'w' } },
        { id: 'e2', lineClass: 'process.major', source: { nodeId: 'tb', portId: 'n' }, target: { nodeId: 'v1', portId: 'e' } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const { buildNetwork } = await import('../../src/hmi/sim/network')
    const net = buildNetwork(screen)
    const b = net.branches.find((x) => x.from.kind === 'tank' && x.from.tag === 'TK-1')!
    expect(b).toBeDefined()
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-2' })
    expect(b.fromBottom).toBe(true)
    expect(net.branches.filter((x) => x.from.kind === 'source')).toHaveLength(0)
  })

  it('pump suction/discharge ports orient their lines regardless of draw direction', async () => {
    // both lines drawn backwards: pump.suction -> tank, tank2 <- discharge
    const doc = docWith(
      [
        N('ta', 'vessel.tank', 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' } }),
        N('pu', 'pump.centrifugal', 'equipment', 200, 20),
        N('tb', 'vessel.tank', 'equipment', 500, 0, { tag: { letters: 'TK', loop: '2' } }),
      ],
      [
        { id: 'e1', lineClass: 'process.major', source: { nodeId: 'pu', portId: 'suction' }, target: { nodeId: 'ta', portId: 'e' } },
        { id: 'e2', lineClass: 'process.major', source: { nodeId: 'tb', portId: 'w' }, target: { nodeId: 'pu', portId: 'discharge' } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const { buildNetwork } = await import('../../src/hmi/sim/network')
    const net = buildNetwork(screen)
    const b = net.branches.find((x) => x.pumps.length === 1)!
    expect(b).toBeDefined()
    expect(b.from).toEqual({ kind: 'tank', tag: 'TK-1' })
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-2' })
  })

  it('orientation propagates through valve chains from a single evidence end', async () => {
    // TK-A.s -> Va forward, middle drawn backwards (Vb -> Va), then Vb -> TK-B.n forward
    const doc = docWith(
      [
        N('ta', 'vessel.tank', 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' } }),
        N('va', 'valve.gate', 'valve', 16, 200, { rotation: 90 }),
        N('vb', 'valve.gate', 'valve', 16, 320, { rotation: 90 }),
        N('tb', 'vessel.tank', 'equipment', 0, 480, { tag: { letters: 'TK', loop: '2' } }),
      ],
      [
        { id: 'e1', lineClass: 'process.major', source: { nodeId: 'ta', portId: 's' }, target: { nodeId: 'va', portId: 'w' } },
        { id: 'e2', lineClass: 'process.major', source: { nodeId: 'vb', portId: 'w' }, target: { nodeId: 'va', portId: 'e' } },
        { id: 'e3', lineClass: 'process.major', source: { nodeId: 'vb', portId: 'e' }, target: { nodeId: 'tb', portId: 'n' } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const { buildNetwork } = await import('../../src/hmi/sim/network')
    const net = buildNetwork(screen)
    const b = net.branches.find((x) => x.from.kind === 'tank' && x.from.tag === 'TK-1')!
    expect(b).toBeDefined()
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-2' })
    expect(b.valves).toHaveLength(2)
  })
})

describe('pipe endpoint anchoring', () => {
  it('a chain into a tank right below its valve attaches to the tank, not back to the valve', async () => {
    // cv.globe directly above the vessel, outlet port ON the vessel boundary —
    // geometric attachment used to resolve to the valve (later in z-order)
    const doc = docWith(
      [
        N('t2', 'vessel.horizontal', 'equipment', 200, 0, { tag: { letters: 'TK', loop: '2' } }),
        N('v8', 'valve.gate', 'valve', 232, 100, { rotation: 90 }),
        N('cv', 'cv.globe', 'valve', 220, 180, { rotation: 270, tag: { letters: 'LV', loop: '1' } }),
        N('t3', 'vessel.vertical', 'equipment', 216, 228, { tag: { letters: 'TK', loop: '3' } }),
      ],
      [
        { id: 'e1', lineClass: 'process.major', source: { nodeId: 't2', portId: 's' }, target: { nodeId: 'v8', portId: 'w' } },
        { id: 'e2', lineClass: 'process.major', source: { nodeId: 'v8', portId: 'e' }, target: { nodeId: 'cv', portId: 'w' } },
        { id: 'e3', lineClass: 'process.major', source: { nodeId: 'cv', portId: 'e' }, target: { nodeId: 't3', portId: 'n' } },
      ],
    )
    const screen = importSheet(doc, doc.sheets[0]!.id)
    const { buildNetwork } = await import('../../src/hmi/sim/network')
    const net = buildNetwork(screen)
    const b = net.branches.find((x) => x.from.kind === 'tank' && x.from.tag === 'TK-2')!
    expect(b).toBeDefined()
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-3' })
    expect(b.valves).toContain('LV-1')
  })
})
