import { describe, expect, it } from 'vitest'
import { alarmEvents, priorityOf } from '../../src/hmi/sim/alarms'
import type { AlarmRecord } from '../../src/hmi/sim/alarms'

const A = (id: string, phase: AlarmRecord['phase'], level: AlarmRecord['level'] = 'H'): AlarmRecord =>
  ({ id, tag: id.split(':')[0]!, level, phase, since: 0 })

describe('priorityOf', () => {
  it('trip limits are critical, warnings are not', () => {
    expect(priorityOf('HH')).toBe('high')
    expect(priorityOf('LL')).toBe('high')
    expect(priorityOf('H')).toBe('warn')
    expect(priorityOf('L')).toBe('warn')
  })
})

describe('alarmEvents diff', () => {
  it('new active alarm -> ALARM', () => {
    expect(alarmEvents([], [A('TK:H', 'active')], 3)).toEqual([{ t: 3, tag: 'TK', level: 'H', what: 'ALARM' }])
  })
  it('active -> cleared is RTN; cleared -> active re-raises', () => {
    expect(alarmEvents([A('TK:H', 'active')], [A('TK:H', 'cleared')], 4)[0]!.what).toBe('RTN')
    expect(alarmEvents([A('TK:H', 'cleared')], [A('TK:H', 'active')], 5)[0]!.what).toBe('ALARM')
  })
  it('ack transitions and silent removals are journaled', () => {
    expect(alarmEvents([A('TK:H', 'active')], [A('TK:H', 'acked')], 6)[0]!.what).toBe('ACK')
    // acked alarm silently dropped on return-to-normal
    expect(alarmEvents([A('TK:H', 'acked')], [], 7)[0]!.what).toBe('RTN')
    // cleared alarm removed by ack
    expect(alarmEvents([A('TK:H', 'cleared')], [], 8)[0]!.what).toBe('ACK')
  })
  it('steady states emit nothing', () => {
    expect(alarmEvents([A('TK:H', 'active')], [A('TK:H', 'active')], 9)).toEqual([])
    expect(alarmEvents([A('TK:H', 'acked')], [A('TK:H', 'acked')], 9)).toEqual([])
  })
})
