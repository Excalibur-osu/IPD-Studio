import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { THEMES } from '../../src/hmi/theme'
import Tank from '../../src/hmi/widgets/tank'
import Pump from '../../src/hmi/widgets/pump'
import Valve from '../../src/hmi/widgets/valve'
import Lamp from '../../src/hmi/widgets/lamp'
import type { HmiWidget } from '../../src/hmi/model'

const w = (over: Partial<HmiWidget>): HmiWidget =>
  ({ id: 'w', type: 'tank', x: 0, y: 0, w: 96, h: 128, ...over })

const render = (el: React.ReactElement) => renderToStaticMarkup(<svg>{el}</svg>)

describe('process widgets', () => {
  it('tank clips liquid to the level PV', () => {
    const html = render(<Tank widget={w({ tag: 'TK-1' })} theme={THEMES.classic} sim={{ PV: 25 }} />)
    expect(html).toContain('TK-1')
    expect(html).toContain('25')
    expect(html).toContain(THEMES.classic.liquid)
  })
  it('pump colors by RUN state in classic, stays gray in hp', () => {
    const run = render(<Pump widget={w({ type: 'pump', w: 56, h: 56, tag: 'P-1' })} theme={THEMES.classic} sim={{ RUN: 1 }} />)
    const stop = render(<Pump widget={w({ type: 'pump', w: 56, h: 56, tag: 'P-1' })} theme={THEMES.classic} sim={{ RUN: 0 }} />)
    expect(run).toContain(THEMES.classic.running)
    expect(stop).toContain(THEMES.classic.stopped)
    const hp = render(<Pump widget={w({ type: 'pump', w: 56, h: 56 })} theme={THEMES.hp} sim={{ RUN: 1 }} />)
    expect(hp).not.toContain(THEMES.classic.running)
  })
  it('throttling valve shows percent, on/off valve shows state color', () => {
    const t = render(<Valve widget={w({ type: 'valve', w: 48, h: 32, tag: 'LV-1', props: { throttle: true } })} theme={THEMES.classic} sim={{ OP: 37 }} />)
    expect(t).toContain('37')
    const o = render(<Valve widget={w({ type: 'valve', w: 48, h: 32 })} theme={THEMES.classic} sim={{ OPEN: 1 }} />)
    expect(o).toContain(THEMES.classic.open)
  })
  it('lamp reads its bound signal', () => {
    const on = render(<Lamp widget={w({ type: 'lamp', w: 32, h: 32, props: { signal: 'P-1.RUN' } })} theme={THEMES.classic} sim={{ 'P-1.RUN': 1 }} />)
    expect(on).toContain(THEMES.classic.running)
  })
})
