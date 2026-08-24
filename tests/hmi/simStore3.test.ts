import { beforeEach, describe, expect, it } from 'vitest'
import { useSimStore } from '../../src/hmi/simStore'
import type { HmiScreen } from '../../src/hmi/model'

// controller loop so SP/OP series get recorded alongside PV
const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 't', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'LT-1', props: { level0: 40 } },
    { id: 'v', type: 'valve', x: 200, y: 0, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
    { id: 'c', type: 'display', x: 400, y: 0, w: 96, h: 40, tag: 'LIC-1', props: { controller: true } },
    { id: 'p', type: 'pump', x: 600, y: 0, w: 56, h: 56, tag: 'P-1' },
  ],
  pipes: [],
}

const st = () => useSimStore.getState()
beforeEach(() => st().exitRun())

describe('signal-keyed history', () => {
  it('records PV for every tag and SP/OP for controllers, aligned with historyT', () => {
    st().enterRun(screen)
    for (let i = 0; i < 5; i++) st().tickOnce(0.2)
    const h = st().history
    expect(h['LT-1.PV']).toHaveLength(5)
    expect(h['LIC-1.PV']).toHaveLength(5)
    expect(h['LIC-1.SP']).toHaveLength(5)
    expect(h['LIC-1.OP']).toHaveLength(5)
    expect(st().historyT).toHaveLength(5)
    expect(st().historyT[4]).toBeCloseTo(1.0)
    // motors have no PV — no phantom series
    expect(h['P-1.PV']).toBeUndefined()
    expect(h['P-1.RUN']).toBeUndefined()
  })

  it('history keys survive a speed change with a truthful time axis', () => {
    st().enterRun(screen)
    st().tickOnce(0.2)
    st().tickOnce(1.0) // operator flipped to 5×
    expect(st().historyT).toEqual([0.2, 1.2])
  })
})
