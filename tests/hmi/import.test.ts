import { describe, expect, it } from 'vitest'
import { mapNodes } from '../../src/hmi/importFromPid'
import type { PlantNode, Sheet } from '../../src/model/types'

const N = (id: string, symbolId: string, kind: PlantNode['kind'], x: number, y: number, extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x, y, rotation: 0, ...extra })
const sheet = (nodes: PlantNode[]): Sheet =>
  ({ id: 'sh1', name: 'S1', drawingNumber: '', revision: '0', sheetSize: 'A3', nodes, edges: [] })

const VESSEL = 'vessel.tank', PUMP = 'pump.centrifugal', CV = 'cv.globe', GV = 'valve.gate', BUBBLE = 'instr.bubble', PSV = 'psv'

describe('mapNodes', () => {
  it('maps each category to its widget type', () => {
    const { widgets } = mapNodes(sheet([
      N('1', VESSEL, 'equipment', 100, 100, { tag: { letters: 'TK', loop: '101' } }),
      N('2', PUMP, 'equipment', 200, 100, { tag: { letters: 'P', loop: '101' } }),
      N('3', CV, 'valve', 300, 100, { tag: { letters: 'LV', loop: '101' } }),
      N('4', GV, 'valve', 400, 100),
      N('5', BUBBLE, 'instrument', 500, 100, { tag: { letters: 'LT', loop: '101' } }),
      N('6', BUBBLE, 'instrument', 600, 100, { tag: { letters: 'LIC', loop: '101' } }),
      N('7', PSV, 'valve', 700, 100),
    ]), '-')
    const by = Object.fromEntries(widgets.map((w) => [w.tag, w]))
    expect(by['TK-101']!.type).toBe('tank')
    expect(by['P-101']!.type).toBe('pump')
    expect(by['LV-101']).toMatchObject({ type: 'valve', props: expect.objectContaining({ throttle: true }) })
    expect(by['LT-101']!.type).toBe('display')
    expect(by['LIC-101']).toMatchObject({ type: 'display', props: expect.objectContaining({ controller: true }) })
    const gate = widgets.find((w) => w.tag === 'V-1')!
    expect(gate.type).toBe('valve')
    expect(gate.props?.throttle).toBeUndefined()
    const psv = widgets.find((w) => w.type === 'symbol')!
    expect(psv.props?.symbolId).toBe(PSV)
  })
  it('skips annotation nodes and uses labels before auto-names', () => {
    const { widgets } = mapNodes(sheet([
      N('1', VESSEL, 'equipment', 0, 0, { label: 'Feed Drum' }),
      N('2', 'ann.note', 'annotation', 50, 50),
    ]), '-')
    expect(widgets).toHaveLength(1)
    expect(widgets[0]!.tag).toBe('Feed Drum')
  })
  it('ctx.nameOf records every mapped node', () => {
    const { ctx } = mapNodes(sheet([N('1', VESSEL, 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' } })]), '-')
    expect(ctx.nameOf.get('1')).toBe('TK-1')
  })
})
