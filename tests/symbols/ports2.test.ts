import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { getSymbol, searchSymbols, SYMBOLS } from '../../src/symbols/registry'
import { portDirection } from '../../src/canvas/shapes'

describe('multi-nozzle vessels', () => {
  it('vessels offer several separated connection points per side', () => {
    for (const id of ['vessel.vertical', 'vessel.tank', 'vessel.horizontal', 'vessel.column-tray']) {
      const def = getSymbol(id)
      expect(def.ports.length, id).toBeGreaterThanOrEqual(8)
    }
    // three distinct top connections on a tank, at least 8px apart
    const tank = getSymbol('vessel.tank')
    const tops = tank.ports.filter((p) => p.y <= 8).sort((a, b) => a.x - b.x)
    expect(tops.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < tops.length; i++) expect(tops[i]!.x - tops[i - 1]!.x).toBeGreaterThanOrEqual(8)
  })
  it('legacy port ids survive so old files keep their connections', () => {
    expect(getSymbol('vessel.vertical').ports.map((p) => p.id)).toEqual(expect.arrayContaining(['n', 's', 'e', 'w']))
    expect(getSymbol('vessel.tank').ports.map((p) => p.id)).toEqual(expect.arrayContaining(['n', 's', 'e', 'w']))
    expect(getSymbol('vessel.cstr').ports.map((p) => p.id)).toEqual(expect.arrayContaining(['e', 'w', 's']))
  })
  it('every port stays inside its symbol bounds with unique ids', () => {
    for (const def of SYMBOLS.values()) {
      const ids = new Set<string>()
      for (const p of def.ports) {
        expect(ids.has(p.id), `${def.id}:${p.id} duplicate`).toBe(false)
        ids.add(p.id)
        expect(p.x, `${def.id}:${p.id} x`).toBeGreaterThanOrEqual(0)
        expect(p.x, `${def.id}:${p.id} x`).toBeLessThanOrEqual(def.gridSize.w * 8)
        expect(p.y, `${def.id}:${p.id} y`).toBeGreaterThanOrEqual(0)
        expect(p.y, `${def.id}:${p.id} y`).toBeLessThanOrEqual(def.gridSize.h * 8)
      }
    }
  })
  it('flank nozzles slightly inside a dished head still get router directions', () => {
    expect(portDirection('vessel.vertical', 'n1')).toBe('top')
    expect(portDirection('vessel.vertical', 'e1')).toBe('right')
    expect(portDirection('vessel.tank', 's1')).toBe('bottom')
  })
})

describe('control valve connection points', () => {
  it('has process in/out, the top signal port, and the three positioner bosses', () => {
    const def = getSymbol('cv.globe')
    expect(def.ports.filter((p) => p.kind === 'process')).toHaveLength(2)
    expect(def.ports.filter((p) => p.kind === 'signal')).toHaveLength(4)
    // the bosses sit on the positioner box's right edge and route rightward
    for (const id of ['sw', 'se', 'sb']) expect(portDirection('cv.globe', id)).toBe('right')
  })
})

describe('signal converters', () => {
  it('registers and renders every conversion legend', () => {
    const def = getSymbol('instr.converter')
    expect(def.render({ conv: 'I/P' })).toContain('>I<')
    expect(def.render({ conv: 'I/P' })).toContain('>P<')
    expect(def.render({ conv: 'E/P' })).toContain('>E<')
    expect(def.render({})).toContain('>I<') // defaults to I/P
    expect(def.ports.every((p) => p.kind === 'signal')).toBe(true)
  })
  it('is findable by the searches users actually type', () => {
    for (const q of ['i/p', 'I/P', 'e/p', 'converter', 'transducer', 'fy']) {
      expect(searchSymbols(q).map((d) => d.id), q).toContain('instr.converter')
    }
  })
})
