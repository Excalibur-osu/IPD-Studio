import { describe, expect, it } from 'vitest'
import type { HmiPipe, HmiScreen, HmiWidget } from '../../src/hmi/model'
import { buildNetwork, pipeFlowMap, solveFlows } from '../../src/hmi/sim/network'

const W = (id: string, type: HmiWidget['type'], x: number, y: number, w: number, h: number, tag?: string, props?: HmiWidget['props']): HmiWidget =>
  ({ id, type, x, y, w, h, tag, props })
const P = (id: string, pts: [number, number][]): HmiPipe => ({ id, points: pts.map(([x, y]) => ({ x, y })) })
const screen = (widgets: HmiWidget[], pipes: HmiPipe[]): HmiScreen =>
  ({ id: 's', name: 'S', theme: 'classic', widgets, pipes })

// manifold: source -> P-1 -> junction symbol -> two valved lines -> TK-A / TK-B
//   e1: (0,100)->(100,100) into pump at (100,80,56,56)
//   e2: pump -> junction symbol at (300,90,12,12)
//   e3: junction -> LV-A at (500,80) -> continues? separate pipes:
// keep it simple: e3 junction->valveA, e4 valveA->tankA; e5 junction->valveB, e6 valveB->tankB
const manifold = screen(
  [
    W('p1', 'pump', 100, 80, 56, 56, 'P-1'),
    W('j1', 'symbol', 300, 100, 12, 12, undefined, { symbolId: 'fit.junction' }),
    W('va', 'valve', 500, 40, 48, 32, 'LV-A', { throttle: true }),
    W('vb', 'valve', 500, 160, 48, 32, 'LV-B', { throttle: true }),
    W('ta', 'tank', 700, 20, 96, 96, 'TK-A'),
    W('tb', 'tank', 700, 140, 96, 96, 'TK-B'),
  ],
  [
    P('e1', [[0, 106], [100, 106]]),
    P('e2', [[160, 106], [300, 106]]),
    P('e3', [[312, 106], [312, 56], [500, 56]]),
    P('e4', [[550, 56], [700, 56]]),
    P('e5', [[312, 106], [312, 176], [500, 176]]),
    P('e6', [[550, 176], [700, 176]]),
  ],
)

const tags = (op: { a: number; b: number }, run = 1) => {
  const fr = (v: string) => (v === 'LV-A' ? op.a / 100 : op.b / 100)
  return {
    frac: fr,
    pump: (_p: string) => run,
    level: (_t: string) => 50,
  }
}

describe('fan-out solver', () => {
  const net = buildNetwork(manifold)

  it('enumerates BOTH legs of the manifold (the v1 walker lost one)', () => {
    expect(net.branches).toHaveLength(2)
    const tanks = net.branches.map((b) => (b.to.kind === 'tank' ? b.to.tag : b.to.kind)).sort()
    expect(tanks).toEqual(['TK-A', 'TK-B'])
    for (const b of net.branches) expect(b.pumps).toEqual(['P-1'])
  })

  it('splits the pump flow across open legs by conductance', () => {
    const t = tags({ a: 100, b: 100 })
    const flows = solveFlows(net, t.frac, t.pump, t.level, undefined, { rated: 10, gravity: 4 })
    const vals = Object.values(flows).sort((x, y) => x - y)
    expect(vals[0]).toBeCloseTo(5)
    expect(vals[1]).toBeCloseTo(5)
  })

  it('closing one leg sends everything down the other', () => {
    const t = tags({ a: 0, b: 100 })
    const flows = solveFlows(net, t.frac, t.pump, t.level, undefined, { rated: 10, gravity: 4 })
    const byTank = Object.fromEntries(net.branches.map((b) => [(b.to as { tag: string }).tag, flows[b.id]]))
    expect(byTank['TK-A']).toBe(0)
    expect(byTank['TK-B']).toBeCloseTo(10)
  })

  it('a half-open leg gets its conductance share', () => {
    const t = tags({ a: 50, b: 100 })
    const flows = solveFlows(net, t.frac, t.pump, t.level, undefined, { rated: 10, gravity: 4 })
    const byTank = Object.fromEntries(net.branches.map((b) => [(b.to as { tag: string }).tag, flows[b.id]]))
    // conductance share conserves the pump's rating: 0.5:1.0 → 1/3 : 2/3
    expect(byTank['TK-A']).toBeCloseTo(10 * (0.5 / 1.5))
    expect(byTank['TK-B']).toBeCloseTo(10 * (1 / 1.5))
  })

  it('shared header pipes animate with the SUM of the legs', () => {
    const t = tags({ a: 100, b: 100 })
    const flows = solveFlows(net, t.frac, t.pump, t.level, undefined, { rated: 10, gravity: 4 })
    const pf = pipeFlowMap(net, flows)
    expect(pf.e1).toBeCloseTo(10) // both legs cross the header
    expect(pf.e4).toBeCloseTo(5)
    expect(pf.e6).toBeCloseTo(5)
  })

  it('a plugged pipe throttles only the legs crossing it', () => {
    const t = tags({ a: 100, b: 100 })
    const flows = solveFlows(net, t.frac, t.pump, t.level, (id) => (id === 'e4' ? 0.25 : 1), { rated: 10, gravity: 4 })
    const byTank = Object.fromEntries(net.branches.map((b) => [(b.to as { tag: string }).tag, flows[b.id]]))
    expect(byTank['TK-A']!).toBeLessThan(byTank['TK-B']!)
  })
})

describe('fan-in', () => {
  // two tanks gravity-feed one pump into a sink
  const fanIn = screen(
    [
      W('ta', 'tank', 0, 0, 96, 96, 'TK-A'),
      W('tb', 'tank', 0, 200, 96, 96, 'TK-B'),
      W('p1', 'pump', 300, 100, 56, 56, 'P-1'),
    ],
    [
      P('e1', [[96, 90], [300, 128]]),
      P('e2', [[96, 290], [300, 128]]),
      P('e3', [[356, 128], [600, 128]]),
    ],
  )
  it('both inlets reach the pump and share its rating', () => {
    const net = buildNetwork(fanIn)
    expect(net.branches).toHaveLength(2)
    const flows = solveFlows(net, () => 1, () => 1, () => 50, undefined, { rated: 10, gravity: 4 })
    const total = Object.values(flows).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(10) // the pump moves its rating, split across inlets
    expect(pipeFlowMap(net, flows).e3).toBeCloseTo(10)
  })
})
