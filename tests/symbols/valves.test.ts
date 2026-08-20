import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { getSymbol, SYMBOLS } from '../../src/symbols/registry'

describe('manual valves', () => {
  const ids = ['valve.gate', 'valve.globe', 'valve.ball', 'valve.butterfly', 'valve.plug', 'valve.needle', 'valve.diaphragm', 'valve.check', 'valve.threeway']
  it('all register', () => {
    for (const id of ids) expect(getSymbol(id)).toBeDefined()
  })
  it('gate is the plain bowtie', () => {
    const svg = getSymbol('valve.gate').render({})
    expect(svg).toContain('M0 0 L0 16 L16 8 Z M32 0 L32 16 L16 8 Z')
  })
  it('globe has a solid center, ball an open circle', () => {
    expect(getSymbol('valve.globe').render({})).toMatch(/circle[^>]*fill="currentColor"/)
    expect(getSymbol('valve.ball').render({})).toMatch(/circle[^>]*fill="none"/)
  })
  it('threeway has a third port', () => {
    expect(getSymbol('valve.threeway').ports).toHaveLength(3)
  })
})

describe('control valves', () => {
  const actuators = ['diaphragm', 'piston', 'motor', 'solenoid', 'manual'] as const
  it('cv bodies register with signal port on top', () => {
    for (const id of ['cv.globe', 'cv.butterfly', 'cv.ball']) {
      const def = getSymbol(id)
      const sig = def.ports.find((p) => p.id === 'sig')
      expect(sig?.kind).toBe('signal')
      expect(sig?.y).toBe(0)
    }
  })
  it('each actuator renders a distinct glyph', () => {
    const svgs = actuators.map((a) => getSymbol('cv.globe').render({ actuator: a, fail: 'none' }))
    expect(new Set(svgs).size).toBe(actuators.length)
    expect(svgs[2]).toContain('>M<')
    expect(svgs[3]).toContain('>S<')
  })
  it('fail marks render only when set', () => {
    const none = getSymbol('cv.globe').render({ actuator: 'diaphragm', fail: 'none' })
    const fc = getSymbol('cv.globe').render({ actuator: 'diaphragm', fail: 'fc' })
    const fo = getSymbol('cv.globe').render({ actuator: 'diaphragm', fail: 'fo' })
    expect(fc).not.toBe(none)
    expect(fo).not.toBe(fc)
  })
})

describe('safety devices', () => {
  it('psv has bottom inlet, side outlet, and a spring', () => {
    const def = getSymbol('psv')
    expect(def.render({})).toMatch(/l-?\d+ -3 l-?\d+ -3/)
    const portYs = def.ports.map((p) => p.y)
    expect(Math.max(...portYs)).toBe(def.gridSize.h * 8)
  })
  it('rupture disc and self-regulator register', () => {
    expect(getSymbol('pse')).toBeDefined()
    expect(getSymbol('pcv.self')).toBeDefined()
  })
})

describe('port grid alignment', () => {
  it('every registered port lands on a 4px lattice', () => {
    for (const def of SYMBOLS.values()) {
      for (const p of def.ports) {
        expect(p.x % 4, `${def.id}:${p.id} x`).toBe(0)
        expect(p.y % 4, `${def.id}:${p.id} y`).toBe(0)
      }
    }
  })
})
