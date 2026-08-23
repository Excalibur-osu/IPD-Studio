import { describe, expect, it } from 'vitest'
import demo from '../../examples/template-hmi-demo.pnid.json'
import { loadDoc } from '../../src/model/migrate'
import { activeHmiScreen } from '../../src/store/store'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'
import { makeRng } from '../../src/hmi/sim/noise'

describe('HMI demo template', () => {
  it('loads as a valid v4 doc with one screen linked to its sheet', () => {
    const doc = loadDoc(demo)
    expect(doc.hmiScreens).toHaveLength(1)
    expect(doc.hmiScreens[0]!.fromSheetId).toBe(doc.sheets[0]!.id)
    expect(activeHmiScreen({ doc, activeScreenId: 'screen-demo' })!.name).toBe('Tank Level HMI')
  })
  it('compiles to a working control loop: pump on -> LIC holds level at SP', () => {
    const doc = loadDoc(demo)
    const model = buildSimModel(doc.hmiScreens[0]!)
    expect(model.controllers).toEqual([{ tag: 'LIC-101', pvTag: 'LT-101', outTag: 'LV-101', action: 1 }])
    expect(model.net.branches.length).toBeGreaterThanOrEqual(2)
    let tags = initTags(model)
    tags['P-101']!.RUN = 1
    const rng = makeRng(3)
    for (let i = 0; i < 240 * 5; i++) tags = tick(model, tags, 0.2, rng).tags
    expect(Math.abs(tags['TK-101']!.PV! - 50)).toBeLessThan(4)
  })
})
