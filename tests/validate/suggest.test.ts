import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { runSuggestions } from '../../src/validate/suggest'
import { buildTypical } from '../../src/assist/typicals'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantEdge, PlantNode, ProjectDoc, Tag } from '../../src/model/types'

let n = 0
const node = (partial: Partial<PlantNode> & Pick<PlantNode, 'symbolId' | 'kind'>): PlantNode => ({
  id: `n${n++}`, x: 0, y: 0, rotation: 0, ...partial,
})
const bubble = (tag: Tag, extra?: Partial<PlantNode>): PlantNode =>
  node({ symbolId: 'instr.bubble', kind: 'instrument', tag, ...extra })

function docOf(nodes: PlantNode[], edges: PlantEdge[] = []): ProjectDoc {
  const doc = createEmptyDoc('t')
  doc.sheets[0]!.nodes = nodes
  doc.sheets[0]!.edges = edges
  return doc
}
const ids = (doc: ProjectDoc) => runSuggestions(doc).map((s) => s.checkId)

describe('advisor rules', () => {
  it('flags a transmitter nobody receives, clears when a receiver exists', () => {
    const lt = bubble({ letters: 'LT', loop: '100' })
    const lic = bubble({ letters: 'LIC', loop: '100' })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: lt.id, portId: 'n' }, target: { nodeId: lic.id, portId: 's' },
    }
    expect(ids(docOf([lt], []))).toContain('no-receiver')
    expect(ids(docOf([lt, lic], [wire]))).not.toContain('no-receiver')
  })

  it('flags a controller with no final element, clears when its valve exists', () => {
    const lic = bubble({ letters: 'LIC', loop: '101' })
    expect(ids(docOf([lic]))).toContain('no-final-element')
    const lv = node({ symbolId: 'cv.globe', kind: 'valve', tag: { letters: 'LV', loop: '101' } })
    expect(ids(docOf([lic, lv]))).not.toContain('no-final-element')
  })

  it('flags a tagged instrument with no connections', () => {
    expect(ids(docOf([bubble({ letters: 'PT', loop: '100' })]))).toContain('dead-end-instrument')
  })

  it('offers the I/P fix for electric line into a diaphragm valve', () => {
    const fic = bubble({ letters: 'FIC', loop: '100' })
    const fv = node({
      symbolId: 'cv.globe', kind: 'valve', x: 0, y: 200,
      config: { actuator: 'diaphragm', fail: 'fc' }, tag: { letters: 'FV', loop: '100' },
    })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: fic.id, portId: 's' }, target: { nodeId: fv.id, portId: 'sig' },
    }
    const suggestions = runSuggestions(docOf([fic, fv], [wire]))
    const hit = suggestions.find((s) => s.checkId === 'needs-ip-converter')
    expect(hit).toBeDefined()
    expect(hit!.fix!.kind).toBe('insert-ip')
    expect(hit!.fix!.edgeId).toBe('e1')
  })

  it('does not ask for an I/P on solenoid valves or pneumatic lines', () => {
    const hs = bubble({ letters: 'HS', loop: '100' })
    const xv = node({ symbolId: 'cv.ball', kind: 'valve', config: { actuator: 'solenoid', fail: 'fc' }, tag: { letters: 'XV', loop: '100' } })
    const wire: PlantEdge = {
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: hs.id, portId: 's' }, target: { nodeId: xv.id, portId: 'sig' },
    }
    expect(ids(docOf([hs, xv], [wire]))).not.toContain('needs-ip-converter')
  })

  it('nudges about vessels with process lines but no relief device', () => {
    const vessel = node({ symbolId: 'vessel.vertical', kind: 'equipment', label: 'V-101' })
    const pump = node({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 300 })
    const pipe: PlantEdge = {
      id: 'e1', lineClass: 'process.major',
      source: { nodeId: pump.id, portId: 'discharge' }, target: { nodeId: vessel.id, portId: 'w' },
    }
    expect(ids(docOf([vessel, pump], [pipe]))).toContain('no-relief')
    const psv = node({ symbolId: 'psv', kind: 'valve', x: 100, y: -100 })
    const reliefLine: PlantEdge = {
      id: 'e2', lineClass: 'process.major',
      source: { nodeId: vessel.id, portId: 'n1' }, target: { nodeId: psv.id, portId: 'in' },
    }
    const cleared = ids(docOf([vessel, pump, psv], [pipe, reliefLine]))
    expect(cleared).not.toContain('no-relief')
    // and an unpiped vessel is left alone
    expect(ids(docOf([node({ symbolId: 'vessel.vertical', kind: 'equipment' })]))).not.toContain('no-relief')
  })

  it('flags control valves without a failure position', () => {
    const fv = node({ symbolId: 'cv.globe', kind: 'valve', config: { actuator: 'diaphragm', fail: 'none' } })
    expect(ids(docOf([fv]))).toContain('no-fail-position')
    const ok = node({ symbolId: 'cv.globe', kind: 'valve', config: { actuator: 'diaphragm', fail: 'fc' } })
    expect(ids(docOf([ok]))).not.toContain('no-fail-position')
  })

  it('flags valve letters on an instrument bubble', () => {
    expect(ids(docOf([bubble({ letters: 'FV', loop: '100' })]))).toContain('valve-tag-on-bubble')
  })

  it('a placed typical loop is advice-clean', () => {
    const doc = createEmptyDoc('t')
    const { nodes, edges } = buildTypical('flow-control', doc, { x: 0, y: 0 })
    doc.sheets[0]!.nodes = nodes
    doc.sheets[0]!.edges = edges
    expect(runSuggestions(doc)).toEqual([])
  })
})
