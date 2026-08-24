import { beforeEach, describe, expect, it } from 'vitest'
import { useSimStore } from '../../src/hmi/simStore'
import type { HmiScreen } from '../../src/hmi/model'
import type { CommandEvent } from '../../src/hmi/sim/alarms'

// pump -> pipe -> tank, plus an FT display bound to the pipe (SBD candidate)
const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-1' },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1', props: { capacity: 50, level0: 96 } },
    { id: 'f', type: 'display', x: 300, y: 300, w: 96, h: 40, tag: 'FT-1', props: { L: 2, min: 0, max: 20 } },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 510, y: 100 }] },
  ],
}
// bind FT-1 to the artery pipe
screen.widgets[2]!.props = { ...screen.widgets[2]!.props, bindPipe: 'e2' }

const st = () => useSimStore.getState()
beforeEach(() => st().exitRun())

describe('shelving', () => {
  it('shelve hides, journal records, expiry re-annunciates', () => {
    st().enterRun(screen)
    st().tickOnce(0.2) // TK-1 at 96 trips H/HH
    const active = st().alarms.filter((a) => !a.sup)
    expect(active.length).toBeGreaterThan(0)
    const id = active[0]!.id
    st().shelve(id, 5)
    expect(st().shelved[id]).toBeCloseTo(st().t + 300)
    expect((st().journal[0] as CommandEvent).sig).toBe('SHELVE')
    st().tickOnce(0.2)
    expect(st().alarms.find((a) => a.id === id)!.sup).toBe('shelved')
    // jump past expiry: shelf auto-lifts and the alarm re-annunciates
    st().tickOnce(301)
    expect(st().shelved[id]).toBeUndefined()
    expect(st().alarms.find((a) => a.id === id)!.sup).toBeUndefined()
    expect(st().journal.some((e) => e.what === 'ALARM' && `${e.tag}:${'level' in e ? e.level : ''}` === id)).toBe(true)
  })

  it('unshelve restores immediately even while paused', () => {
    st().enterRun(screen)
    st().tickOnce(0.2)
    const id = st().alarms[0]!.id
    st().shelve(id, 30)
    expect(st().alarms.find((a) => a.id === id)!.sup).toBe('shelved') // stamped without a tick
    st().unshelve(id)
    expect(st().alarms.find((a) => a.id === id)!.sup).toBeUndefined()
  })
})

describe('out of service', () => {
  it('suppresses every alarm of the tag until restored', () => {
    st().enterRun(screen)
    st().tickOnce(0.2)
    st().toggleOos('TK-1')
    expect(st().alarms.filter((a) => a.tag === 'TK-1').every((a) => a.sup === 'oos')).toBe(true)
    expect((st().journal[0] as CommandEvent)).toMatchObject({ sig: 'OOS', to: 1 })
    st().toggleOos('TK-1')
    expect(st().alarms.filter((a) => a.tag === 'TK-1').every((a) => a.sup === undefined)).toBe(true)
  })
})

describe('suppressed by design', () => {
  it('a pipe-bound low-flow alarm is suppressed while its pump is off', () => {
    st().enterRun(screen)
    st().tickOnce(0.2) // pump off -> flow 0 -> FT-1 L trips, but SBD
    const ft = st().alarms.find((a) => a.tag === 'FT-1')
    expect(ft).toBeDefined()
    expect(ft!.sup).toBe('design')
    // start the pump: suppression lifts (tank is near-full so flow may stop
    // again later, but the design condition — pump commanded off — is gone)
    st().writeTag('P-1', 'RUN', 1)
    st().tickOnce(0.2)
    const after = st().alarms.find((a) => a.tag === 'FT-1')
    expect(after === undefined || after.sup !== 'design').toBe(true)
  })
})
