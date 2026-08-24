import { describe, expect, it } from 'vitest'
import type { TagDef } from '../../src/hmi/sim/tags'
import type { AlarmRecord } from '../../src/hmi/sim/alarms'
import { evalAlarms, priorityOf } from '../../src/hmi/sim/alarms'

const def = (over: Partial<TagDef> = {}): TagDef => ({
  name: 'FT-1', kind: 'display', min: 0, max: 100, limits: { H: 80 }, ...over,
})

const run = (defs: TagDef[], pvs: number[], dt = 1): AlarmRecord[] => {
  let recs: AlarmRecord[] = []
  let t = 0
  for (const pv of pvs) {
    t += dt
    recs = evalAlarms(defs, { [defs[0]!.name]: { PV: pv } }, recs, t)
  }
  return recs
}

describe('hysteresis deadband', () => {
  it('trips at the limit but clears only below limit − deadband (default 1% span)', () => {
    // H=80, span 100 → db 1: 80.2 trips, 79.5 must NOT clear, 78.9 clears
    let recs = run([def()], [80.2])
    expect(recs[0]!.phase).toBe('active')
    recs = evalAlarms([def()], { 'FT-1': { PV: 79.5 } }, recs, 2)
    expect(recs[0]!.phase).toBe('active') // inside the deadband: still in alarm
    recs = evalAlarms([def()], { 'FT-1': { PV: 78.9 } }, recs, 3)
    expect(recs[0]!.phase).toBe('cleared')
  })
  it('honors an explicit per-tag deadband, low limits mirrored', () => {
    const d = def({ limits: { L: 20 }, deadband: 5 })
    let recs = run([d], [19])
    expect(recs[0]!.phase).toBe('active')
    recs = evalAlarms([d], { 'FT-1': { PV: 24 } }, recs, 2)
    expect(recs[0]!.phase).toBe('active')
    recs = evalAlarms([d], { 'FT-1': { PV: 25.1 } }, recs, 3)
    expect(recs[0]!.phase).toBe('cleared')
  })
  it('records the PV at the moment of tripping', () => {
    const recs = run([def()], [93.7])
    expect(recs[0]!.value).toBe(93.7)
  })
})

describe('on-delay', () => {
  it('a violation shorter than the delay never annunciates', () => {
    const d = def({ alarmDelay: 3 })
    let recs = run([d], [85], 1) // t=1: pending
    expect(recs[0]!.phase).toBe('pending')
    recs = evalAlarms([d], { 'FT-1': { PV: 70 } }, recs, 2) // back to normal before 3s
    expect(recs).toHaveLength(0)
  })
  it('a persistent violation promotes to active after the delay', () => {
    const d = def({ alarmDelay: 3 })
    const recs = run([d], [85, 85, 85, 85], 1) // t=1..4; pending since t=1 → active at t=4
    expect(recs[0]!.phase).toBe('active')
  })
})

describe('three priorities', () => {
  it('defaults: HH/LL high, H/L medium; per-tag override shifts the pair', () => {
    expect(priorityOf('HH')).toBe('high')
    expect(priorityOf('L')).toBe('medium')
    expect(priorityOf('H', { priority: 'low' })).toBe('low')
    expect(priorityOf('HH', { priority: 'low' })).toBe('medium') // one step above
    expect(priorityOf('LL', { priority: 'high' })).toBe('high')
  })
  it('evalAlarms stamps the resolved priority on every record', () => {
    const d = def({ limits: { H: 80, HH: 90 }, priority: 'low' })
    const recs = run([d], [95])
    const by = Object.fromEntries(recs.map((r) => [r.level, r.priority]))
    expect(by.H).toBe('low')
    expect(by.HH).toBe('medium')
  })
})
