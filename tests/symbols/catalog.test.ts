import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { getSymbol, SYMBOLS } from '../../src/symbols/registry'

const PHASE2_IDS = [
  'valve.pinch', 'valve.stopcheck', 'valve.fourway', 'valve.angle', 'valve.knife',
  'psv.pilot', 'pvsv', 'vacuum-breaker', 'flame-arrestor', 'breather', 'bpcv', 'tcv.self',
  'fe.nozzle', 'fe.pitot', 'fe.avgpitot', 'fe.ultrasonic', 'fe.thermal', 'fe.pd',
  'acc.bulb', 'acc.bimetal', 'acc.seal', 'acc.floatcage', 'acc.radar', 'acc.loadcell',
  'pump.peristaltic', 'pump.plunger', 'pump.submersible', 'pump.vacuum',
  'comp.recip', 'comp.screw', 'turbine.steam', 'vfd',
  'vessel.floating-roof', 'vessel.sphere', 'vessel.bullet', 'vessel.open', 'vessel.silo',
  'vessel.column-packed', 'vessel.fixedbed', 'vessel.sep3', 'cyclone',
  'hx.kettle', 'hx.doublepipe', 'heater.electric', 'heater.fired', 'hx.condenser', 'cooling-tower',
  'strainer.basket', 'strainer.cone', 'centrifuge', 'scrubber', 'demister', 'mixer.static',
  'fit.reducer-ecc', 'fit.blind', 'fit.spade', 'fit.hose', 'fit.expansion', 'fit.sightglass',
  'fit.silencer', 'fit.quill',
  'ann.insulation', 'ann.slope', 'ann.tiein', 'ann.bl-flag', 'ann.onpage', 'ann.revtriangle', 'ann.equipstrip',
]

const PHASE1_IDS = [
  'fe.orifice', 'fe.venturi', 'fe.magmeter', 'fe.coriolis', 'fe.vortex', 'fe.turbine', 'fe.rotameter', 'fe.ro',
  'acc.thermowell', 'acc.pg', 'acc.lg',
  'pump.centrifugal', 'pump.gear', 'pump.diaphragm', 'ejector', 'comp.centrifugal', 'blower', 'motor', 'agitator',
  'vessel.vertical', 'vessel.horizontal', 'vessel.tank', 'vessel.column-tray', 'vessel.cstr', 'vessel.ko-drum',
  'hx.shell-tube', 'hx.plate', 'hx.air-cooler',
  'strainer.y', 'filter.cartridge',
  'fit.reducer', 'fit.flanges', 'fit.spectacle', 'fit.steam-trap', 'fit.sample', 'fit.drain', 'fit.vent', 'fit.specbreak',
  'ctl.interlock',
  'ann.offpage', 'ann.arrow', 'ann.text', 'ann.noteflag', 'ann.cloud',
]

describe('phase-2 catalog (valves/safety)', () => {
  it('registers every phase-2 valve/safety id', () => {
    for (const id of PHASE2_IDS) expect(() => getSymbol(id), id).not.toThrow()
  })
  it('fourway has 4 ports; digital actuator renders D', () => {
    expect(getSymbol('valve.fourway').ports).toHaveLength(4)
    expect(getSymbol('cv.globe').render({ actuator: 'digital', fail: 'none' })).toContain('>D<')
    expect(getSymbol('cv.globe').render({ actuator: 'electro-hydraulic', fail: 'none' })).toContain('>EH<')
  })
  it('pinch valve has two facing arcs', () => {
    expect((getSymbol('valve.pinch').render({}).match(/Q16/g) ?? []).length).toBe(2)
  })
})

describe('phase-1 catalog', () => {
  it('registers every phase-1 id', () => {
    for (const id of PHASE1_IDS) expect(() => getSymbol(id), id).not.toThrow()
  })
  it('has at least 60 symbols', () => {
    expect(SYMBOLS.size).toBeGreaterThanOrEqual(60)
  })
  it('pump is a circle r14 with discharge duct', () => {
    const svg = getSymbol('pump.centrifugal').render({})
    expect(svg).toContain('r="14"')
    expect(svg).toContain('H44')
  })
  it('tray column has at least 3 trays', () => {
    const svg = getSymbol('vessel.column-tray').render({})
    expect((svg.match(/H36/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
  it('orifice is line plus two flange bars', () => {
    const svg = getSymbol('fe.orifice').render({})
    expect(svg).toContain('M0 8 H32')
    expect(svg).toContain('M14 0')
    expect(svg).toContain('M18 0')
  })
  it('off-page connector pentagon closes', () => {
    expect(getSymbol('ann.offpage').render({})).toMatch(/Z/)
  })
  it('interlock ports are signal-kind', () => {
    expect(getSymbol('ctl.interlock').ports.every((p) => p.kind === 'signal')).toBe(true)
  })
})
