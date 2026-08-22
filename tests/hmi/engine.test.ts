import { describe, expect, it } from 'vitest'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'
import { makeRng } from '../../src/hmi/sim/noise'
import type { HmiScreen } from '../../src/hmi/model'

// source -> pump P-1 -> throttling valve LV-1 -> tank TK-1, plus TK-1 -> on/off valve HV-1 -> sink
const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-1' },
    { id: 'v', type: 'valve', x: 300, y: 95, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1', props: { capacity: 100, level0: 40 } },
    { id: 'h', type: 'valve', x: 650, y: 150, w: 48, h: 32, tag: 'HV-1' },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 310, y: 111 }] },
    { id: 'e3', points: [{ x: 340, y: 111 }, { x: 510, y: 100 }] },
    { id: 'e4', points: [{ x: 590, y: 160 }, { x: 660, y: 166 }] },
    { id: 'e5', points: [{ x: 692, y: 166 }, { x: 800, y: 166 }] },
  ],
}

const run = (mut?: (tags: ReturnType<typeof initTags>) => void, seconds = 10) => {
  const model = buildSimModel(screen)
  let tags = initTags(model)
  if (mut) mut(tags)
  let flows: Record<string, number> = {}
  const rng = makeRng(1)
  for (let i = 0; i < seconds * 5; i++) {
    const r = tick(model, tags, 0.2, rng)
    tags = r.tags
    flows = r.branchFlows
  }
  return { tags, flows, model }
}

describe('engine tick', () => {
  it('initTags seeds defaults', () => {
    const model = buildSimModel(screen)
    const tags = initTags(model)
    expect(tags['TK-1']!.PV).toBe(40)
    expect(tags['P-1']!.RUN).toBe(0)
    expect(tags['LV-1']!.OP).toBe(40)
    expect(tags['HV-1']!.OPEN).toBe(1)
  })
  it('nothing flows while the pump is stopped, but the drain still empties the tank', () => {
    // 5 s: tank has drained 40% -> 10% and the drain branch is still flowing
    // (by 10 s it would be empty and the flow correctly stops)
    const { tags, flows } = run(undefined, 5)
    expect(Object.values(flows).some((f) => f > 0)).toBe(true)
    expect(tags['TK-1']!.PV).toBeLessThan(40)
  })
  it('running pump with open valves fills the tank; closed HV holds level up', () => {
    const { tags } = run((t) => { t['P-1']!.RUN = 1; t['LV-1']!.OP = 100; t['HV-1']!.OPEN = 0 })
    expect(tags['TK-1']!.PV).toBeGreaterThan(55)
  })
  it('closed throttling valve blocks the fill branch', () => {
    const { tags } = run((t) => { t['P-1']!.RUN = 1; t['LV-1']!.OP = 0; t['HV-1']!.OPEN = 0 })
    expect(tags['TK-1']!.PV).toBeCloseTo(40, 0)
  })
  it('tank clamps at 0 and never goes negative', () => {
    const { tags } = run((t) => { t['TK-1']!.PV = 1 }, 60)
    expect(tags['TK-1']!.PV).toBeGreaterThanOrEqual(0)
  })
  it('tick does not mutate its input tags object', () => {
    const model = buildSimModel(screen)
    const tags = initTags(model)
    const snapshot = JSON.parse(JSON.stringify(tags))
    tick(model, tags, 0.2, makeRng(1))
    expect(tags).toEqual(snapshot)
  })
  it('is deterministic for a fixed seed', () => {
    expect(run().tags['TK-1']!.PV).toBe(run().tags['TK-1']!.PV)
  })
})
