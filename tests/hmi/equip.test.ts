import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'
import { buildTagDefs } from '../../src/hmi/sim/tags'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'
import { renderWidget } from '../../src/hmi/widgets/index'
import { THEMES } from '../../src/hmi/theme'
import '../../src/symbols/lib/index'

const rng = () => 0.5
const screen = (widgets: HmiWidget[], pipes: HmiScreen['pipes'] = []): HmiScreen =>
  ({ id: 's1', name: 'S', theme: 'classic', widgets, pipes })
const equip = (tag: string, x = 200, y = 200): HmiWidget =>
  ({ id: `w-${tag}`, type: 'equip', x, y, w: 64, h: 64, tag, props: { symbolId: 'comp.centrifugal' } })

describe('equip tag model', () => {
  it('a tagged equip widget is a motor', () => {
    const defs = buildTagDefs(screen([equip('K-101')]))
    expect(defs).toEqual([{ name: 'K-101', kind: 'motor', min: 0, max: 1 }])
  })

  it('starts stopped and ramps up over ~2s once RUN is set', () => {
    const model = buildSimModel(screen([equip('K-101')]))
    let tags = initTags(model)
    expect(tags['K-101']).toEqual({ RUN: 0, RAMP: 0 })
    tags['K-101']!.RUN = 1
    for (let i = 0; i < 5; i++) tags = tick(model, tags, 0.2, rng).tags
    expect(tags['K-101']!.RAMP).toBeGreaterThan(0.4)
    expect(tags['K-101']!.RAMP).toBeLessThan(0.6)
  })

  it('a FAULT opens the breaker like a pump trip', () => {
    const model = buildSimModel(screen([equip('K-101')]))
    const tags = initTags(model)
    tags['K-101']!.RUN = 1
    tags['K-101']!.FAULT = 1
    const out = tick(model, tags, 0.2, rng).tags
    expect(out['K-101']!.RUN).toBe(0)
    expect(out['K-101']!.RAMP).toBe(0)
  })
})

describe('equip widget rendering', () => {
  const render = (sim: Record<string, number>) =>
    renderToStaticMarkup(renderWidget({ widget: equip('K-101'), theme: THEMES.classic, sim }))

  it('renders the P&ID glyph and the tag', () => {
    const html = render({})
    expect(html).toContain('data-hmi-equip="comp.centrifugal"')
    expect(html).toContain('K-101')
    expect(html).not.toContain('hmi-spin')
  })
  it('spins its badge while running and blinks while starting', () => {
    const html = render({ RUN: 1, RAMP: 0.3 })
    expect(html).toContain('hmi-spin')
    expect(html).toContain('hmi-blink')
  })
  it('marks a fault', () => {
    const html = render({ RUN: 0, FAULT: 1 })
    expect(html).toContain('data-fault')
    expect(html).toContain('hmi-blink')
  })
})
