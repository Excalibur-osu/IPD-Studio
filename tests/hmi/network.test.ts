import { describe, expect, it } from 'vitest'
import { buildNetwork, pipeFlowMap } from '../../src/hmi/sim/network'
import type { HmiScreen, HmiWidget, HmiPipe } from '../../src/hmi/model'

const W = (id: string, type: HmiWidget['type'], x: number, y: number, w: number, h: number, tag: string, props?: HmiWidget['props']): HmiWidget =>
  ({ id, type, x, y, w, h, tag, props })
const P = (id: string, ...pts: [number, number][]): HmiPipe =>
  ({ id, points: pts.map(([x, y]) => ({ x, y })) })
const S = (widgets: HmiWidget[], pipes: HmiPipe[]): HmiScreen =>
  ({ id: 's', name: 'S', theme: 'classic', widgets, pipes })

describe('buildNetwork', () => {
  it('chains source -> pump -> valve -> tank into one branch', () => {
    const screen = S(
      [W('p', 'pump', 100, 90, 56, 56, 'P-1'), W('v', 'valve', 300, 95, 48, 32, 'LV-1', { throttle: true }), W('t', 'tank', 500, 40, 96, 128, 'TK-1')],
      [P('e1', [0, 118], [110, 118]), P('e2', [150, 118], [310, 111]), P('e3', [340, 111], [510, 100])],
    )
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(1)
    const b = net.branches[0]!
    expect(b.from).toEqual({ kind: 'source' })
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-1' })
    expect(b.pumps).toEqual(['P-1'])
    expect(b.valves).toEqual(['LV-1'])
    expect(b.pipeIds).toEqual(['e1', 'e2', 'e3'])
  })
  it('tank -> valve -> sink is a drain branch', () => {
    const screen = S(
      [W('t', 'tank', 0, 0, 96, 128, 'TK-1'), W('v', 'valve', 200, 150, 48, 32, 'HV-1')],
      [P('e1', [48, 120], [210, 166]), P('e2', [240, 166], [400, 166])],
    )
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(1)
    expect(net.branches[0]!.from).toEqual({ kind: 'tank', tag: 'TK-1' })
    expect(net.branches[0]!.to).toEqual({ kind: 'sink' })
    expect(net.branches[0]!.valves).toEqual(['HV-1'])
  })
  it('two independent pipes make two branches; pipeFlowMap spreads branch flow to pipes', () => {
    const screen = S([], [P('a', [0, 0], [100, 0]), P('b', [0, 50], [100, 50])])
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(2)
    const flows = pipeFlowMap(net, { [net.branches[0]!.id]: 7, [net.branches[1]!.id]: 0 })
    expect(flows.a === 7 || flows.b === 7).toBe(true)
  })
})
