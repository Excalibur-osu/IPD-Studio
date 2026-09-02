import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { applyFix } from '../../src/assist/fixes'
import { buildIndex } from '../../src/model/projectIndex'
import { runRules } from '../../src/validate/engine'
import { activeSheet, useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

describe('insert-ip fix', () => {
  it('splits the electric line into electric -> I/P -> pneumatic, tagged with the loop', () => {
    const s = useStore.getState()
    s.loadIntoStore(createEmptyDoc('fixtest'))
    const fic = s.addNode({
      symbolId: 'instr.bubble', kind: 'instrument', x: 96, y: 96, rotation: 0,
      tag: { letters: 'FIC', loop: '100' },
    })
    const fv = s.addNode({
      symbolId: 'cv.globe', kind: 'valve', x: 96, y: 320, rotation: 0,
      config: { actuator: 'diaphragm', fail: 'fc' }, tag: { letters: 'FV', loop: '100' },
    })
    s.addEdge({ lineClass: 'signal.electric', source: { nodeId: fic, portId: 's' }, target: { nodeId: fv, portId: 'sig' } })

    const hit = runRules(buildIndex(useStore.getState().doc)).groups
      .flatMap((g) => g.findings).find((x) => x.ruleId === 'needs-ip-converter')
    expect(hit?.fix).toBeDefined()
    const result = applyFix(hit!.fix!.spec)
    expect(result.ok).toBe(true)

    const sheet = activeSheet(useStore.getState())
    const conv = sheet.nodes.find((n) => n.symbolId === 'instr.converter')
    expect(conv).toBeDefined()
    expect(conv!.tag).toEqual({ letters: 'FY', loop: '100' })
    expect(sheet.edges).toHaveLength(2)
    const classes = sheet.edges.map((e) => e.lineClass).sort()
    expect(classes).toEqual(['signal.electric', 'signal.pneumatic'])
    // vertical run: signal enters the converter's top, leaves its bottom
    const out = sheet.edges.find((e) => e.lineClass === 'signal.pneumatic')!
    expect((out.source as { portId: string }).portId).toBe('s')
    // and the advice clears
    expect(runRules(buildIndex(useStore.getState().doc)).groups.map((g) => g.rule.id)).not.toContain('needs-ip-converter')
    s.loadIntoStore(createEmptyDoc('reset'))
  })
})
