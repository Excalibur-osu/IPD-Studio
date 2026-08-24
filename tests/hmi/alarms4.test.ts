import { describe, expect, it } from 'vitest'
import type { TagDef } from '../../src/hmi/sim/tags'
import { alarmEvents, evalAlarms } from '../../src/hmi/sim/alarms'

const d: TagDef = { name: 'FT-1', kind: 'display', min: 0, max: 100, limits: { H: 80 } }
const tags = (pv: number) => ({ 'FT-1': { PV: pv } })

describe('suppression', () => {
  it('a shelved alarm stays listed but marked, and suppresses silently on RTN', () => {
    let recs = evalAlarms([d], tags(85), [], 1)
    expect(recs[0]!.phase).toBe('active')
    // shelved: record keeps living but carries the suppression
    const sup = { shelvedIds: new Set(['FT-1:H']) }
    const shelvedRecs = evalAlarms([d], tags(85), recs, 2, sup)
    expect(shelvedRecs[0]!.sup).toBe('shelved')
    // no journal events for entering suppression
    expect(alarmEvents(recs, shelvedRecs, 2)).toHaveLength(0)
    // returns to normal while shelved: dropped with NO RTN spam
    const gone = evalAlarms([d], tags(50), shelvedRecs, 3, sup)
    expect(gone).toHaveLength(0)
    expect(alarmEvents(shelvedRecs, gone, 3)).toHaveLength(0)
  })

  it('coming off the shelf while still violated re-annunciates', () => {
    const sup = { shelvedIds: new Set(['FT-1:H']) }
    let recs = evalAlarms([d], tags(85), [], 1, sup)
    expect(recs[0]!.sup).toBe('shelved')
    const back = evalAlarms([d], tags(85), recs, 2) // shelf expired
    expect(back[0]!.sup).toBeUndefined()
    const events = alarmEvents(recs, back, 2)
    expect(events).toEqual([{ t: 2, tag: 'FT-1', level: 'H', what: 'ALARM' }])
  })

  it('out-of-service suppresses every alarm of the tag', () => {
    const sup = { oosTags: new Set(['FT-1']) }
    const recs = evalAlarms([d], tags(85), [], 1, sup)
    expect(recs[0]!.sup).toBe('oos')
    expect(alarmEvents([], recs, 1)).toHaveLength(0)
  })

  it('suppressed-by-design marks records as design', () => {
    const sup = { sbdTags: new Set(['FT-1']) }
    const recs = evalAlarms([d], tags(85), [], 1, sup)
    expect(recs[0]!.sup).toBe('design')
  })

  it('a pending alarm that never activates emits nothing when it drops', () => {
    const dd: TagDef = { ...d, alarmDelay: 5 }
    const p = evalAlarms([dd], tags(85), [], 1)
    expect(p[0]!.phase).toBe('pending')
    expect(alarmEvents([], p, 1)).toHaveLength(0)
    const gone = evalAlarms([dd], tags(50), p, 2)
    expect(alarmEvents(p, gone, 2)).toHaveLength(0)
  })
})
