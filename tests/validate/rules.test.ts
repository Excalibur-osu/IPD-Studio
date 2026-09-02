import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { createEmptyDoc } from '../../src/model/doc'
import { buildIndex } from '../../src/model/projectIndex'
import { runRules } from '../../src/validate/engine'
import { TYPICALS, buildTypical } from '../../src/assist/typicals'
import type { PlantEdge, PlantNode, ProjectDoc, Tag } from '../../src/model/types'

/**
 * Behaviour ported from the retired tests/validate/checks.test.ts and
 * suggest.test.ts, restated against the rule engine. Each case names the rule
 * it exercises, so a rule that changes severity or id fails loudly here.
 */
let n = 0
const node = (p: Partial<PlantNode> & Pick<PlantNode, 'symbolId' | 'kind'>): PlantNode => ({
  id: `n${n++}`, x: 0, y: 0, rotation: 0, ...p,
})
const bubble = (tag: Tag, extra?: Partial<PlantNode>): PlantNode =>
  node({ symbolId: 'instr.bubble', kind: 'instrument', tag, ...extra })

function docOf(nodes: PlantNode[], edges: PlantEdge[] = []): ProjectDoc {
  const d = createEmptyDoc('t')
  d.sheets[0]!.nodes = nodes
  d.sheets[0]!.edges = edges
  return d
}
const ids = (doc: ProjectDoc) => runRules(buildIndex(doc)).groups.flatMap((g) => g.findings.map((f) => f.ruleId))
const severityOf = (doc: ProjectDoc, ruleId: string) =>
  runRules(buildIndex(doc)).groups.find((g) => g.rule.id === ruleId)?.rule.severity

describe('tagging', () => {
  // Found by running the rule set over the app's own bundled templates: P-101
  // on a pump was reported as an ISA error. Equipment does not follow the
  // instrument letter tables. This false positive existed in the old engine too.
  it('invalid-letters: leaves equipment tags alone', () => {
    const pump = node({ symbolId: 'pump.centrifugal', kind: 'equipment', tag: { letters: 'P', loop: '101' } })
    expect(ids(docOf([pump]))).not.toContain('invalid-letters')
  })

  it('duplicate-tag: critical, and only the extra wearers are flagged', () => {
    const d = docOf([bubble({ letters: 'FT', loop: '100' }), bubble({ letters: 'FT', loop: '100' })])
    expect(severityOf(d, 'duplicate-tag')).toBe('critical')
    expect(ids(d).filter((i) => i === 'duplicate-tag')).toHaveLength(1)
  })

  it('missing-tag: flags untagged instruments, never annotations', () => {
    const d = docOf([
      node({ symbolId: 'instr.bubble', kind: 'instrument' }),
      node({ symbolId: 'ann.text', kind: 'annotation' }),
    ])
    expect(ids(d).filter((i) => i === 'missing-tag')).toHaveLength(1)
  })

  it('invalid-letters: rejects an illegal ISA combination', () => {
    expect(ids(docOf([bubble({ letters: 'FZZ', loop: '100' })]))).toContain('invalid-letters')
  })

  it('valve-tag-on-bubble: a valve tag on a bubble is an observation', () => {
    const d = docOf([bubble({ letters: 'FV', loop: '100' })])
    expect(ids(d)).toContain('valve-tag-on-bubble')
    expect(severityOf(d, 'valve-tag-on-bubble')).toBe('info')
  })
})

describe('topology', () => {
  it('dangling-end: an unattached end is flagged', () => {
    const pump = node({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const e: PlantEdge = {
      id: 'e1', lineClass: 'process.major',
      source: { nodeId: pump.id, portId: 'discharge' }, target: { x: 50, y: 50 },
    }
    expect(ids(docOf([pump], [e]))).toContain('dangling-end')
  })

  it('incompatible-connection: a stored illegal pairing is critical', () => {
    // both ends are strictly process ports, so a signal class cannot join them
    const pump = node({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const pump2 = node({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const bad: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: pump.id, portId: 'discharge' }, target: { nodeId: pump2.id, portId: 'suction' },
    }
    const d = docOf([pump, pump2], [bad])
    expect(ids(d)).toContain('incompatible-connection')
    expect(severityOf(d, 'incompatible-connection')).toBe('critical')
  })

  it('offpage-link: fine on one sheet, flagged once there are two', () => {
    const op = node({ symbolId: 'ann.offpage', kind: 'annotation' })
    const single = docOf([op])
    expect(ids(single)).not.toContain('offpage-link')

    const multi = docOf([op])
    multi.sheets.push({ ...multi.sheets[0]!, id: 'sheet2', name: 'Sheet 2', nodes: [], edges: [] })
    expect(ids(multi)).toContain('offpage-link')
  })

  it('offpage-link: a link pointing nowhere is flagged', () => {
    const op = node({ symbolId: 'ann.offpage', kind: 'annotation', link: { sheetId: 'nope', nodeId: 'gone' } })
    expect(ids(docOf([op]))).toContain('offpage-link')
  })

  it('duplicate-line-number: two runs cannot share a number', () => {
    const ln = { size: '6"', spec: 'CS', service: 'CW', seq: '001' }
    const a: PlantEdge = { id: 'e1', lineClass: 'process.major', source: { x: 0, y: 0 }, target: { x: 9, y: 0 }, lineNumber: ln }
    const b: PlantEdge = { id: 'e2', lineClass: 'process.major', source: { x: 0, y: 9 }, target: { x: 9, y: 9 }, lineNumber: ln }
    expect(ids(docOf([], [a, b]))).toContain('duplicate-line-number')
  })
})

describe('instrumentation', () => {
  it('no-receiver: flags a transmitter nobody receives, clears when one exists', () => {
    const lt = bubble({ letters: 'LT', loop: '100' })
    expect(ids(docOf([lt]))).toContain('no-receiver')
    const lic = bubble({ letters: 'LIC', loop: '100' })
    expect(ids(docOf([lt, lic]))).not.toContain('no-receiver')
  })

  it('no-final-element: flags a controller with no valve, clears when its valve exists', () => {
    const fic = bubble({ letters: 'FIC', loop: '100' })
    expect(ids(docOf([fic]))).toContain('no-final-element')
    const fv = node({ symbolId: 'cv.globe', kind: 'valve', tag: { letters: 'FV', loop: '100' } })
    expect(ids(docOf([fic, fv]))).not.toContain('no-final-element')
  })

  it('dead-end-instrument: a tagged instrument joined to nothing', () => {
    expect(ids(docOf([bubble({ letters: 'PI', loop: '100' })]))).toContain('dead-end-instrument')
  })

  // Warning, not critical, by default — plenty of early-stage drawings leave
  // it unstated, and a company standard is what makes it a blocker (v0.18).
  it('no-fail-position: a warning, and deliberately offers no auto-fix', () => {
    const cv = node({ symbolId: 'cv.globe', kind: 'valve', tag: { letters: 'FV', loop: '100' } })
    const d = docOf([cv])
    expect(severityOf(d, 'no-fail-position')).toBe('warning')
    const group = runRules(buildIndex(d)).groups.find((g) => g.rule.id === 'no-fail-position')
    expect(group!.findings[0]!.fix).toBeUndefined()
  })

  it('needs-ip-converter: offers the fix for an electric line into a diaphragm valve', () => {
    const fic = bubble({ letters: 'FIC', loop: '100' })
    const fv = node({ symbolId: 'cv.globe', kind: 'valve', config: { actuator: 'diaphragm', fail: 'fc' } })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: fic.id, portId: 's' }, target: { nodeId: fv.id, portId: 'sig' },
    }
    const d = docOf([fic, fv], [wire])
    const group = runRules(buildIndex(d)).groups.find((g) => g.rule.id === 'needs-ip-converter')
    expect(group).toBeDefined()
    expect(group!.findings[0]!.fix?.label).toMatch(/I\/P/)
  })

  it('needs-ip-converter: silent on a solenoid valve', () => {
    const fic = bubble({ letters: 'FIC', loop: '100' })
    const xv = node({ symbolId: 'valve.solenoid', kind: 'valve' })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: fic.id, portId: 's' }, target: { nodeId: xv.id, portId: 'sig' },
    }
    expect(ids(docOf([fic, xv], [wire]))).not.toContain('needs-ip-converter')
  })
})

describe('process', () => {
  it('no-relief: a vessel with process lines and no relief device', () => {
    const tank = node({ symbolId: 'vessel.tank', kind: 'equipment', tag: { letters: 'TK', loop: '100' } })
    const pump = node({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const pipe: PlantEdge = {
      id: 'e1', lineClass: 'process.major',
      source: { nodeId: tank.id, portId: 's' }, target: { nodeId: pump.id, portId: 'suction' },
    }
    expect(ids(docOf([tank, pump], [pipe]))).toContain('no-relief')
  })
})

describe('data', () => {
  it('orphan-record: a record with nothing wearing its key, with a purge fix', () => {
    const d = docOf([])
    d.registry = { 'FT-101': { key: 'FT-101', kind: 'instrument', fields: { 'signal.range': 'x' } } }
    const group = runRules(buildIndex(d)).groups.find((g) => g.rule.id === 'orphan-record')
    expect(group?.findings[0]!.fix?.label).toMatch(/discard/i)
  })

  it('orphan-record: silent while something still wears the key', () => {
    const d = docOf([bubble({ letters: 'FT', loop: '101' })])
    d.registry = { 'FT-101': { key: 'FT-101', kind: 'instrument', fields: {} } }
    expect(ids(d)).not.toContain('orphan-record')
  })

  it('required-field-empty: silent on a record nobody has started', () => {
    // Firing on every tagged object of a pre-registry drawing buried the report
    // under 11-13 identical warnings on the bundled samples.
    const d = docOf([bubble({ letters: 'FT', loop: '101' })])
    expect(ids(d)).not.toContain('required-field-empty')
  })

  it('required-field-empty: fires once a record is started but incomplete', () => {
    const d = docOf([bubble({ letters: 'FT', loop: '101' })])
    d.registry = { 'FT-101': { key: 'FT-101', kind: 'instrument', fields: { 'general.service': 'Feed' } } }
    expect(ids(d)).toContain('required-field-empty')
  })

  it('required-field-empty: clears once the required fields are filled', () => {
    const d = docOf([bubble({ letters: 'FT', loop: '101' })])
    d.registry = {
      'FT-101': { key: 'FT-101', kind: 'instrument', fields: { 'general.service': 'Feed', 'signal.range': '0-100' } },
    }
    expect(ids(d)).not.toContain('required-field-empty')
  })
})

describe('typical loops', () => {
  // A typical is what the app itself places. If the rule set calls the app's
  // own output critical, the rule set is wrong, not the typical.
  it('every typical the app places is critical-clean', () => {
    for (const t of TYPICALS) {
      const doc = createEmptyDoc('t')
      const built = buildTypical(t.id, doc, { x: 200, y: 200 })
      doc.sheets[0]!.nodes = built.nodes
      doc.sheets[0]!.edges = built.edges
      const critical = runRules(buildIndex(doc)).groups
        .filter((g) => g.rule.severity === 'critical')
        .map((g) => g.rule.id)
      expect(critical, `${t.id} raised ${critical.join(', ')}`).toEqual([])
    }
  })
})
