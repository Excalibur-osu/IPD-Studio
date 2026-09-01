import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../src/symbols/lib/index'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantNode, ProjectDoc } from '../../src/model/types'
import { issuesFor, resetIssuesCache } from '../../src/validate/issues'
import * as checks from '../../src/validate/checks'
import * as suggest from '../../src/validate/suggest'

let n = 0
const mk = (partial: Partial<PlantNode> = {}): PlantNode => ({
  id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, ...partial,
})
function doc(nodes: PlantNode[]): ProjectDoc {
  const d = createEmptyDoc('t')
  d.sheets[0]!.nodes = nodes
  return d
}

beforeEach(() => resetIssuesCache())

describe('issuesFor', () => {
  it('reports findings and suggestions together with a combined total', () => {
    // untagged instrument -> a finding; nothing connected -> no suggestion for it
    const r = issuesFor(doc([mk()]))
    expect(r.findings.length).toBeGreaterThan(0)
    expect(r.total).toBe(r.findings.length + r.suggestions.length)
  })

  it('returns the identical object for the same document', () => {
    const d = doc([mk({ tag: { letters: 'FT', loop: '100' } })])
    expect(issuesFor(d)).toBe(issuesFor(d))
  })

  // The regression this module exists to prevent: three panels each holding
  // their own useMemo ran the checks three times per keystroke.
  it('runs each engine once however many callers ask', () => {
    const runChecks = vi.spyOn(checks, 'runChecks')
    const runSuggestions = vi.spyOn(suggest, 'runSuggestions')
    resetIssuesCache()
    const d = doc([mk({ tag: { letters: 'FT', loop: '100' } })])
    issuesFor(d)
    issuesFor(d)
    issuesFor(d)
    expect(runChecks).toHaveBeenCalledTimes(1)
    expect(runSuggestions).toHaveBeenCalledTimes(1)
    runChecks.mockRestore()
    runSuggestions.mockRestore()
  })

  it('recomputes when the document changes identity', () => {
    const a = doc([mk({ tag: { letters: 'FT', loop: '100' } })])
    const b = doc([mk()])
    const ra = issuesFor(a)
    const rb = issuesFor(b)
    expect(ra).not.toBe(rb)
    expect(rb.findings.length).toBeGreaterThan(ra.findings.length)
  })
})
