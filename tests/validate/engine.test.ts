import { beforeEach, describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { createEmptyDoc } from '../../src/model/doc'
import { buildIndex } from '../../src/model/projectIndex'
import { runRules, qaFor, resetQaCache } from '../../src/validate/engine'
import { ALL_RULES } from '../../src/validate/rules/index'
import type { PlantEdge, PlantNode, ProjectDoc } from '../../src/model/types'

let n = 0
const node = (p: Partial<PlantNode> = {}): PlantNode => ({
  id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, ...p,
})
function doc(nodes: PlantNode[], edges: PlantEdge[] = []): ProjectDoc {
  const d = createEmptyDoc('t')
  d.sheets[0]!.nodes = nodes
  d.sheets[0]!.edges = edges
  return d
}
const report = (d: ProjectDoc) => runRules(buildIndex(d), d.qa?.ignored ?? {})
const ids = (d: ProjectDoc) => report(d).groups.flatMap((g) => g.findings.map((f) => f.ruleId))

beforeEach(() => resetQaCache())

describe('the rule set', () => {
  it('every rule has a unique id', () => {
    const seen = ALL_RULES.map((r) => r.id)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('every rule declares a severity, a discipline and a reason', () => {
    for (const r of ALL_RULES) {
      expect(['critical', 'warning', 'info']).toContain(r.severity)
      expect(r.discipline).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.why, `${r.id} should say why it matters`).toBeTruthy()
    }
  })
})

describe('runRules', () => {
  it('a clean drawing reports nothing', () => {
    const ft = node({ tag: { letters: 'FT', loop: '100' } })
    const fic = node({ tag: { letters: 'FIC', loop: '100' } })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: ft.id, portId: 'n' }, target: { nodeId: fic.id, portId: 's' },
    }
    const d = doc([ft, fic], [wire])
    // only data-completeness advice should remain, never a critical
    expect(report(d).counts.critical).toBe(0)
  })

  it('reports duplicate tags as critical, once per extra wearer', () => {
    const d = doc([
      node({ tag: { letters: 'FT', loop: '100' } }),
      node({ tag: { letters: 'FT', loop: '100' } }),
      node({ tag: { letters: 'FT', loop: '100' } }),
    ])
    const dup = report(d).groups.find((g) => g.rule.id === 'duplicate-tag')
    expect(dup?.rule.severity).toBe('critical')
    expect(dup?.findings).toHaveLength(2)
  })

  it('sorts critical before warning before info', () => {
    const d = doc([node({}), node({ tag: { letters: 'FZZ', loop: '100' } })])
    const severities = report(d).groups.map((g) => g.rule.severity)
    const rank = { critical: 0, warning: 1, info: 2 } as const
    const ranks = severities.map((s) => rank[s])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('a rule that throws is contained, and the rest still run', () => {
    const broken = {
      id: 'boom', title: 'Boom', severity: 'info' as const, discipline: 'data' as const, why: 'x',
      run() { throw new Error('kaboom') },
    }
    ALL_RULES.push(broken)
    try {
      const d = doc([node({ tag: { letters: 'FT', loop: '100' } })])
      const r = report(d)
      const boom = r.groups.find((g) => g.rule.id === 'boom')
      expect(boom?.findings[0]?.message).toContain('kaboom')
      // the report still exists rather than the whole thing failing
      expect(r.groups.length).toBeGreaterThan(1)
    } finally {
      ALL_RULES.pop()
    }
  })
})

describe('finding identity', () => {
  it('emits one finding per rule+entity even when two symbols wear one tag', () => {
    // both bubbles are FT-100, so node-walking rules would otherwise produce
    // two findings under the identical key
    const d = doc([
      node({ tag: { letters: 'FT', loop: '100' } }),
      node({ tag: { letters: 'FT', loop: '100' } }),
    ])
    const all = report(d).groups.flatMap((g) => g.findings.map((f) => f.key))
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('ignores', () => {
  const dupDoc = () => doc([
    node({ tag: { letters: 'FT', loop: '100' } }),
    node({ tag: { letters: 'FT', loop: '100' } }),
  ])

  it('suppress a finding and move it to the ignored list', () => {
    const d = dupDoc()
    const key = report(d).groups.find((g) => g.rule.id === 'duplicate-tag')!.findings[0]!.key
    d.qa = { ignored: { [key]: { reason: 'second is an off-page continuation', at: '2026-01-01' } } }
    const after = report(d)
    expect(after.groups.find((g) => g.rule.id === 'duplicate-tag')).toBeUndefined()
    expect(after.ignored).toHaveLength(1)
    expect(after.ignored[0]!.entry.reason).toContain('off-page')
  })

  it('an unrelated key does not suppress anything', () => {
    const d = dupDoc()
    d.qa = { ignored: { 'duplicate-tag:nonsense': { reason: 'x', at: '2026-01-01' } } }
    expect(ids(d)).toContain('duplicate-tag')
  })
})

describe('qaFor caching', () => {
  it('returns the identical report for the same document', () => {
    const d = doc([node({ tag: { letters: 'FT', loop: '100' } })])
    expect(qaFor(d)).toBe(qaFor(d))
  })
})
