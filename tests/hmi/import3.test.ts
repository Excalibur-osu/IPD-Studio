import { describe, expect, it } from 'vitest'
import { mapNodes, importSheet } from '../../src/hmi/importFromPid'
import { getSymbol } from '../../src/symbols/registry'
import type { PlantNode, ProjectDoc, Sheet } from '../../src/model/types'
import { createEmptyDoc } from '../../src/model/doc'

const N = (id: string, symbolId: string, kind: PlantNode['kind'], x: number, y: number, extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x, y, rotation: 0, ...extra })
const sheet = (nodes: PlantNode[], edges: Sheet['edges'] = []): Sheet =>
  ({ id: 'sh1', name: 'S1', drawingNumber: '', revision: '0', sheetSize: 'A3', nodes, edges })

const VESSEL = 'vessel.horizontal', PUMP = 'pump.centrifugal', BUBBLE = 'instr.bubble'

function docWith(sh: Sheet): ProjectDoc {
  const doc = createEmptyDoc()
  return { ...doc, sheets: [sh] }
}

describe('import honors v0.7 geometry', () => {
  it('a stretched vessel imports at its stretched footprint', () => {
    const g = getSymbol(VESSEL).gridSize
    const { widgets } = mapNodes(sheet([
      N('1', VESSEL, 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' }, scaleX: 2.5, scaleY: 1 }),
    ]), '-')
    expect(widgets[0]!.w).toBe(g.w * 8 * 2.5)
    expect(widgets[0]!.h).toBe(Math.max(g.h * 8, 80)) // tank floor still applies
  })
  it('a 90°-rotated pump imports tall, not wide', () => {
    const g = getSymbol(PUMP).gridSize
    const { widgets } = mapNodes(sheet([
      N('1', PUMP, 'equipment', 0, 0, { tag: { letters: 'P', loop: '1' }, rotation: 90 }),
    ]), '-')
    expect(widgets[0]!.w).toBe(g.h * 8)
    expect(widgets[0]!.h).toBe(g.w * 8)
  })
})

describe('import professionalism', () => {
  it('instrument displays get family units; controllers keep controller flag', () => {
    const { widgets } = mapNodes(sheet([
      N('1', BUBBLE, 'instrument', 0, 0, { tag: { letters: 'LT', loop: '1' } }),
      N('2', BUBBLE, 'instrument', 60, 0, { tag: { letters: 'TIC', loop: '2' } }),
      N('3', BUBBLE, 'instrument', 120, 0, { tag: { letters: 'FT', loop: '3' } }),
      N('4', BUBBLE, 'instrument', 180, 0, { tag: { letters: 'ZS', loop: '4' } }),
    ]), '-')
    const by = Object.fromEntries(widgets.map((w) => [w.tag, w]))
    expect(by['LT-1']!.props?.unit).toBe('%')
    expect(by['TIC-2']!.props).toMatchObject({ controller: true, unit: '°C' })
    expect(by['FT-3']!.props?.unit).toBe('m³/h')
    expect(by['ZS-4']!.props?.unit).toBeUndefined()
  })
  it('binding is ISA-family-aware: F binds flow through the impulse hop, T stays unbound', () => {
    const end = (nodeId: string) => ({ nodeId, portId: 'c' })
    const sh = sheet(
      [
        N('ft', BUBBLE, 'instrument', 100, 0, { tag: { letters: 'FT', loop: '1' } }),
        N('tt', BUBBLE, 'instrument', 400, 0, { tag: { letters: 'TT', loop: '2' } }),
        N('gv', 'valve.gate', 'valve', 100, 100),
      ],
      [
        { id: 'imp', lineClass: 'process.impulse', source: end('ft'), target: end('gv') },
        { id: 'imp2', lineClass: 'process.impulse', source: end('tt'), target: end('gv') },
        { id: 'run', lineClass: 'process.major', source: end('gv'), target: { x: 500, y: 100 } },
      ] as Sheet['edges'],
    )
    const screen = importSheet(docWith(sh), 'sh1')
    const by = Object.fromEntries(screen.widgets.map((w) => [w.tag, w]))
    // FT walked through the impulse line to the process run; the ref was
    // retargeted to the imported pipe id
    expect(by['FT-1']!.props?.bindPipe).toBe(screen.pipes[0]!.id)
    // TT has no bulk model: no binding at all
    expect(by['TT-2']!.props?.bindPipe).toBeUndefined()
    expect(by['TT-2']!.props?.bindTank).toBeUndefined()
  })

  it('imported process pipes carry the artery width', () => {
    const sh = sheet(
      [N('1', VESSEL, 'equipment', 0, 0, { tag: { letters: 'TK', loop: '1' } })],
      [{
        id: 'e1', lineClass: 'process.major',
        source: { x: 300, y: 300 }, target: { x: 500, y: 300 },
      } as Sheet['edges'][number]],
    )
    const screen = importSheet(docWith(sh), 'sh1')
    expect(screen.pipes[0]!.width).toBe(5)
  })
})
