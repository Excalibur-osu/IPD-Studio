import { describe, expect, it } from 'vitest'
import { makeRng } from '../../src/hmi/sim/noise'
import { buildTagDefs } from '../../src/hmi/sim/tags'
import type { HmiScreen } from '../../src/hmi/model'

const screen = (widgets: HmiScreen['widgets']): HmiScreen =>
  ({ id: 's', name: 'S', theme: 'classic', widgets, pipes: [] })

describe('noise', () => {
  it('is deterministic per seed and in 0..1', () => {
    const a = makeRng(42), b = makeRng(42), c = makeRng(7)
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual([c(), c(), c()])
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
})

describe('buildTagDefs', () => {
  it('creates defs per kind with defaults and prop overrides', () => {
    const defs = buildTagDefs(screen([
      { id: '1', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1', props: { H: 80, capacity: 200 } },
      { id: '2', type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-1' },
      { id: '3', type: 'valve', x: 0, y: 0, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
      { id: '4', type: 'valve', x: 0, y: 0, w: 48, h: 32, tag: 'HV-1' },
      { id: '5', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'LT-1', props: { bindTank: 'TK-1' } },
      { id: '6', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'LIC-1', props: { controller: true } },
    ]))
    const by = Object.fromEntries(defs.map((d) => [d.name, d]))
    expect(by['TK-1']).toMatchObject({ kind: 'tank', capacity: 200, limits: { LL: 5, L: 10, H: 80, HH: 95 } })
    expect(by['P-1']!.kind).toBe('motor')
    expect(by['LV-1']!.kind).toBe('valve')
    expect(by['HV-1']!.kind).toBe('valveOnOff')
    expect(by['LT-1']).toMatchObject({ kind: 'display', bindTank: 'TK-1' })
    expect(by['LIC-1']!.kind).toBe('controller')
  })
  it('a physical widget outranks a display sharing its tag, regardless of order', () => {
    const defs = buildTagDefs(screen([
      { id: '1', type: 'trend', x: 0, y: 0, w: 192, h: 96, tag: 'TK-1' },
      { id: '2', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1' },
    ]))
    expect(defs).toHaveLength(1)
    expect(defs[0]!.kind).toBe('tank')
  })
  it('dedupes repeated tags and skips untagged/static widgets', () => {
    const defs = buildTagDefs(screen([
      { id: '1', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'FT-1' },
      { id: '2', type: 'trend', x: 0, y: 0, w: 192, h: 96, tag: 'FT-1' },
      { id: '3', type: 'label', x: 0, y: 0, w: 96, h: 24 },
    ]))
    expect(defs).toHaveLength(1)
  })
})
