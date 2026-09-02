import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { buildTypical, TYPICALS } from '../../src/assist/typicals'
import { createEmptyDoc } from '../../src/model/doc'
import { buildIndex } from '../../src/model/projectIndex'
import { runRules } from '../../src/validate/engine'
import { getSymbol } from '../../src/symbols/registry'
import type { ProjectDoc } from '../../src/model/types'

function docWithTypical(id: string): ProjectDoc {
  const doc = createEmptyDoc('t')
  const { nodes, edges } = buildTypical(id, doc, { x: 200, y: 200 })
  doc.sheets[0]!.nodes = nodes
  doc.sheets[0]!.edges = edges
  return doc
}

describe('typical loops', () => {
  it('flow control drops five wired components sharing one loop number', () => {
    const doc = docWithTypical('flow-control')
    const sheet = doc.sheets[0]!
    expect(sheet.nodes).toHaveLength(5)
    expect(sheet.edges).toHaveLength(5)
    const tags = sheet.nodes.map((n) => `${n.tag!.letters}-${n.tag!.loop}`).sort()
    expect(tags).toEqual(['FE-100', 'FIC-100', 'FT-100', 'FV-100', 'FY-100'])
  })
  it('signal classes follow the physics of the chain', () => {
    const doc = docWithTypical('flow-control')
    const classes = doc.sheets[0]!.edges.map((e) => e.lineClass).sort()
    expect(classes).toEqual(['process.impulse', 'process.major', 'signal.electric', 'signal.electric', 'signal.pneumatic'])
  })
  it('placements are valid drawings out of the box', () => {
    for (const t of TYPICALS) {
      const doc = docWithTypical(t.id)
      // what the app places must never be reported as a blocker
      expect(runRules(buildIndex(doc)).counts.critical, t.id).toBe(0)
    }
  })
  it('every edge lands on a real port of a real symbol', () => {
    for (const t of TYPICALS) {
      const doc = docWithTypical(t.id)
      const sheet = doc.sheets[0]!
      const byId = new Map(sheet.nodes.map((n) => [n.id, n]))
      for (const e of sheet.edges) {
        for (const end of [e.source, e.target]) {
          if (!('nodeId' in end)) throw new Error('typical produced a free end')
          const node = byId.get(end.nodeId)!
          const def = getSymbol(node.symbolId)
          expect(def.ports.some((p) => p.id === end.portId), `${t.id} ${node.symbolId}:${end.portId}`).toBe(true)
        }
      }
    }
  })
  it('a second placement takes the next shared number', () => {
    const doc = docWithTypical('level-control')
    const second = buildTypical('level-control', doc, { x: 600, y: 200 })
    expect(second.nodes.every((n) => n.tag!.loop === '101')).toBe(true)
  })
  it('honors the 001 numbering preference', () => {
    const doc = createEmptyDoc('t')
    doc.settings.numberStart = 1
    const { nodes } = buildTypical('temp-control', doc, { x: 0, y: 0 })
    expect(nodes[0]!.tag!.loop).toBe('001')
  })
})
