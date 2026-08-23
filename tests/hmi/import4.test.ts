import { describe, expect, it } from 'vitest'
import { deoverlap, mapNodes } from '../../src/hmi/importFromPid'
import { buildSimModel, initTags } from '../../src/hmi/sim/engine'
import type { HmiPipe, HmiScreen, HmiWidget } from '../../src/hmi/model'
import type { PlantNode, Sheet } from '../../src/model/types'

const N = (id: string, symbolId: string, kind: PlantNode['kind'], x: number, y: number, extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x, y, rotation: 0, ...extra })
const sheet = (nodes: PlantNode[]): Sheet =>
  ({ id: 'sh1', name: 'S1', drawingNumber: '', revision: '0', sheetSize: 'A3', nodes, edges: [] })

describe('hardware imports as graphics, never as phantom value displays', () => {
  it('untagged instruments (VFD, level gauge) and converters become symbols', () => {
    const { widgets } = mapNodes(sheet([
      N('1', 'vfd', 'instrument', 0, 0),
      N('2', 'acc.lg', 'instrument', 100, 0),
      N('3', 'instr.converter', 'instrument', 200, 0, { tag: { letters: 'LY', loop: '100' } }),
      N('4', 'instr.bubble', 'instrument', 300, 0, { tag: { letters: 'I/P', loop: '1' } }),
      N('5', 'instr.bubble', 'instrument', 400, 0, { tag: { letters: 'PT', loop: '100' } }),
    ]), '-')
    expect(widgets.map((w) => w.type)).toEqual(['symbol', 'symbol', 'symbol', 'symbol', 'display'])
    expect(widgets[0]!.props?.symbolId).toBe('vfd')
    // no invented tag text under anonymous hardware…
    expect(widgets[0]!.tag).toBeUndefined()
    expect(widgets[1]!.tag).toBeUndefined()
    // …but genuinely tagged hardware keeps its name
    expect(widgets[2]!.tag).toBe('LY-100')
  })
  it('junction dots stay unlabeled; pumps get a visible floor size', () => {
    const { widgets } = mapNodes(sheet([
      N('j', 'fit.junction', 'fitting', 0, 0),
      N('p', 'pump.centrifugal', 'equipment', 100, 0, { tag: { letters: 'P', loop: '3' }, scale: 0.5 }),
    ]), '-')
    const jn = widgets.find((w) => w.props?.symbolId === 'fit.junction')!
    expect(jn.type).toBe('symbol')
    expect(jn.tag).toBeUndefined()
    const pump = widgets.find((w) => w.type === 'pump')!
    expect(pump.w).toBeGreaterThanOrEqual(40)
    expect(pump.h).toBeGreaterThanOrEqual(40)
  })
})

describe('deoverlap avoids pipe runs', () => {
  it('nudges a display off a pipe segment', () => {
    const widgets: HmiWidget[] = [
      { id: 'd', type: 'display', x: 100, y: 96, w: 96, h: 40, tag: 'PT-1' },
    ]
    const pipes: HmiPipe[] = [{ id: 'p', points: [{ x: 0, y: 110 }, { x: 400, y: 110 }] }]
    deoverlap(widgets, pipes)
    const d = widgets[0]!
    // clear of the run, boundary touch allowed (that IS the 6px pad)
    const clear = d.y + d.h + 6 <= 110 || d.y - 6 >= 110
    expect(clear).toBe(true)
    expect(d.y).not.toBe(96)
  })
})

describe('calm start on a drain-stub plant (the Praharsh-Test failure)', () => {
  it('tank with an open-ended drain valve holds its level at RUN start', () => {
    const screen: HmiScreen = {
      id: 's', name: 'S', theme: 'classic',
      widgets: [
        { id: 't', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1', props: { level0: 40 } },
        { id: 'v', type: 'valve', x: 200, y: 150, w: 48, h: 32, tag: 'V-2' },
        { id: 'x', type: 'symbol', x: 320, y: 150, w: 12, h: 12, props: { symbolId: 'fit.junction' } },
      ],
      pipes: [
        { id: 'a', points: [{ x: 48, y: 120 }, { x: 210, y: 166 }] },
        { id: 'b', points: [{ x: 240, y: 166 }, { x: 322, y: 156 }] },
      ],
    }
    const model = buildSimModel(screen)
    const tags = initTags(model)
    expect(tags['V-2']!.OPEN).toBe(0) // drain starts closed
  })
  it('a transfer valve between two tanks also starts closed (levels hold until lined up), unpiped valves stay open', () => {
    const screen: HmiScreen = {
      id: 's', name: 'S', theme: 'classic',
      widgets: [
        { id: 'a', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-A' },
        { id: 'v', type: 'valve', x: 200, y: 150, w: 48, h: 32, tag: 'HV-9' },
        { id: 'b', type: 'tank', x: 400, y: 100, w: 96, h: 128, tag: 'TK-B' },
        { id: 'deco', type: 'valve', x: 700, y: 700, w: 48, h: 32, tag: 'HV-99' },
      ],
      pipes: [
        { id: 'p1', points: [{ x: 48, y: 120 }, { x: 210, y: 166 }] },
        { id: 'p2', points: [{ x: 240, y: 166 }, { x: 410, y: 200 }] },
      ],
    }
    const tags = initTags(buildSimModel(screen))
    expect(tags['HV-9']!.OPEN).toBe(0) // gravity would equalize TK-A into TK-B before the operator touched anything
    expect(tags['HV-99']!.OPEN).toBe(1) // not in any flow path
  })
})
