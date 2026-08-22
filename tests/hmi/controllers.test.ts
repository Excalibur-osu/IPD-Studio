import { describe, expect, it } from 'vitest'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'
import { makeRng } from '../../src/hmi/sim/noise'
import type { HmiScreen } from '../../src/hmi/model'

// source -> P-101 -> LV-101 -> TK-101 -> HV-101 -> sink, LT-101 bound to the tank, LIC-101 controller
const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-101' },
    { id: 'v', type: 'valve', x: 300, y: 95, w: 48, h: 32, tag: 'LV-101', props: { throttle: true } },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-101', props: { capacity: 100, level0: 30 } },
    { id: 'h', type: 'valve', x: 650, y: 150, w: 48, h: 32, tag: 'HV-101' },
    { id: 'lt', type: 'display', x: 700, y: 40, w: 96, h: 40, tag: 'LT-101', props: { bindTank: 'TK-101' } },
    { id: 'lic', type: 'display', x: 700, y: 90, w: 96, h: 40, tag: 'LIC-101', props: { controller: true } },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 310, y: 111 }] },
    { id: 'e3', points: [{ x: 340, y: 111 }, { x: 510, y: 100 }] },
    { id: 'e4', points: [{ x: 590, y: 160 }, { x: 660, y: 166 }] },
    { id: 'e5', points: [{ x: 692, y: 166 }, { x: 800, y: 166 }] },
  ],
}

const runFor = (seconds: number, mut?: (t: ReturnType<typeof initTags>) => void) => {
  const model = buildSimModel(screen)
  let tags = initTags(model)
  tags['P-101']!.RUN = 1
  if (mut) mut(tags)
  const rng = makeRng(2)
  for (let i = 0; i < seconds * 5; i++) tags = tick(model, tags, 0.2, rng).tags
  return { tags, model }
}

describe('auto-wired control loops', () => {
  it('wires LIC-101 to LT-101 (PV) and LV-101 (OP)', () => {
    const { model } = runFor(1)
    expect(model.controllers).toEqual([{ tag: 'LIC-101', pvTag: 'LT-101', outTag: 'LV-101' }])
  })
  it('holds level at SP against a constant drain (AUTO)', () => {
    const { tags } = runFor(240)
    expect(Math.abs(tags['TK-101']!.PV! - 50)).toBeLessThan(4)
  })
  it('tracks an SP change', () => {
    const { tags } = runFor(300, (t) => { t['LIC-101']!.SP = 70 })
    expect(Math.abs(tags['TK-101']!.PV! - 70)).toBeLessThan(5)
  })
  it('MAN mode passes operator OP through to the valve', () => {
    const { tags } = runFor(2, (t) => { t['LIC-101']!.MODE = 0; t['LIC-101']!.OP = 77 })
    expect(tags['LV-101']!.OP).toBe(77)
  })
})
