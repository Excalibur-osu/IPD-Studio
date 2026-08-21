import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { runChecks } from '../../src/validate/checks'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantEdge, PlantNode, ProjectDoc } from '../../src/model/types'

let n = 0
function mk(partial: Partial<PlantNode>): PlantNode {
  return { id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, ...partial }
}
function doc(nodes: PlantNode[], edges: PlantEdge[] = []): ProjectDoc {
  const d = createEmptyDoc('t')
  d.sheets[0]!.nodes = nodes
  d.sheets[0]!.edges = edges
  return d
}
const ids = (findings: { checkId: string }[]) => findings.map((f) => f.checkId)

describe('off-page link checks', () => {
  it('unlinked off-page is fine on single-sheet docs, flagged on multi-sheet', () => {
    const op = mk({ symbolId: 'ann.offpage', kind: 'annotation' })
    const single = doc([op])
    expect(runChecks(single).map((f) => f.checkId)).not.toContain('unlinked-offpage')
    const multi = doc([op])
    multi.sheets.push({ ...multi.sheets[0]!, id: 'sheet2', name: 'Sheet 2', nodes: [], edges: [] })
    expect(runChecks(multi).map((f) => f.checkId)).toContain('unlinked-offpage')
  })
  it('flags broken links', () => {
    const op = mk({ symbolId: 'ann.offpage', kind: 'annotation', link: { sheetId: 'nope', nodeId: 'gone' } })
    expect(runChecks(doc([op])).map((f) => f.checkId)).toContain('broken-link')
  })
})

describe('runChecks', () => {
  it('clean doc has no findings', () => {
    const a = mk({ tag: { letters: 'FT', loop: '100' } })
    expect(runChecks(doc([a]))).toEqual([])
  })
  it('flags duplicate tags', () => {
    const a = mk({ tag: { letters: 'FT', loop: '100' } })
    const b = mk({ tag: { letters: 'FT', loop: '100' } })
    expect(ids(runChecks(doc([a, b])))).toContain('duplicate-tag')
  })
  it('flags untagged instruments but not annotations', () => {
    const a = mk({})
    const ann = mk({ symbolId: 'ann.text', kind: 'annotation' })
    const findings = runChecks(doc([a, ann]))
    expect(findings.filter((f) => f.checkId === 'missing-tag')).toHaveLength(1)
  })
  it('flags invalid letter combinations', () => {
    const a = mk({ tag: { letters: 'FZZ', loop: '100' } })
    expect(ids(runChecks(doc([a])))).toContain('invalid-letters')
  })
  it('flags dangling free ends unless on an off-page connector', () => {
    const a = mk({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const dangling: PlantEdge = { id: 'e1', lineClass: 'process.major', source: { nodeId: a.id, portId: 'discharge' }, target: { x: 50, y: 50 } }
    expect(ids(runChecks(doc([a], [dangling])))).toContain('dangling-end')
  })
  it('flags incompatible stored connections', () => {
    const a = mk({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const b = mk({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const bad: PlantEdge = { id: 'e2', lineClass: 'signal.electric', source: { nodeId: a.id, portId: 'discharge' }, target: { nodeId: b.id, portId: 'suction' } }
    expect(ids(runChecks(doc([a, b], [bad])))).toContain('incompatible-connection')
  })
  it('flags duplicate line numbers', () => {
    const a = mk({ symbolId: 'pump.centrifugal', kind: 'equipment' })
    const ln = { size: '2', spec: 'CS150', service: 'P', seq: '001' }
    const e1: PlantEdge = { id: 'e3', lineClass: 'process.major', source: { x: 0, y: 0 }, target: { nodeId: a.id, portId: 'suction' }, lineNumber: ln }
    const e2: PlantEdge = { id: 'e4', lineClass: 'process.major', source: { x: 0, y: 90 }, target: { nodeId: a.id, portId: 'discharge' }, lineNumber: { ...ln } }
    const findings = runChecks(doc([a], [e1, e2]))
    expect(ids(findings)).toContain('duplicate-line-number')
    expect(ids(findings)).toContain('dangling-end')
  })
})
