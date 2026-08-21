import { describe, expect, it, vi } from 'vitest'
import { dia } from '@joint/core'
import '../../src/symbols/lib/index'
import { reconcile } from '../../src/canvas/reconciler'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantEdge, PlantNode, ProjectDoc } from '../../src/model/types'

let n = 0
function node(partial: Partial<PlantNode> = {}): PlantNode {
  return {
    id: `n${n++}`, symbolId: 'pump.centrifugal', kind: 'equipment',
    x: 40, y: 40, rotation: 0, ...partial,
  }
}
function docWith(nodes: PlantNode[], edges: PlantEdge[] = []): ProjectDoc {
  const doc = createEmptyDoc('t')
  doc.nodes = nodes
  doc.edges = edges
  return doc
}

describe('reconcile', () => {
  it('creates cells for nodes and edges', () => {
    const graph = new dia.Graph()
    const a = node(); const b = node({ x: 200 })
    const edge: PlantEdge = {
      id: 'e1', lineClass: 'process.major',
      source: { nodeId: a.id, portId: 'discharge' },
      target: { nodeId: b.id, portId: 'suction' },
    }
    reconcile(graph, docWith([a, b], [edge]), undefined)
    expect(graph.getCells()).toHaveLength(3)
    expect(graph.getCell(a.id).isElement()).toBe(true)
    const link = graph.getCell('e1') as dia.Link
    expect(link.isLink()).toBe(true)
    expect(link.source()).toMatchObject({ id: a.id, port: 'discharge' })
  })

  it('moves an element when the node moved', () => {
    const graph = new dia.Graph()
    const a = node({ x: 0, y: 0 })
    const doc1 = docWith([a])
    reconcile(graph, doc1, undefined)
    const doc2 = docWith([{ ...a, x: 96, y: 64 }])
    reconcile(graph, doc2, doc1)
    expect((graph.getCell(a.id) as dia.Element).position()).toEqual({ x: 96, y: 64 })
  })

  it('removes cells that left the doc', () => {
    const graph = new dia.Graph()
    const a = node(); const b = node()
    const doc1 = docWith([a, b])
    reconcile(graph, doc1, undefined)
    const doc2 = docWith([a])
    reconcile(graph, doc2, doc1)
    expect(graph.getCells()).toHaveLength(1)
  })

  it('is a no-op when doc identity is unchanged', () => {
    const graph = new dia.Graph()
    const doc = docWith([node()])
    reconcile(graph, doc, undefined)
    const cell = graph.getCells()[0]!
    const spy = vi.spyOn(cell, 'set')
    reconcile(graph, doc, doc)
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders instrument tag text inside the bubble', () => {
    const graph = new dia.Graph()
    const a = node({ symbolId: 'instr.bubble', kind: 'instrument', tag: { letters: 'FT', loop: '101' } })
    reconcile(graph, docWith([a]), undefined)
    const attrs = graph.getCell(a.id).attributes.attrs as Record<string, Record<string, unknown>>
    expect(attrs['tagL']?.text).toBe('FT')
    expect(attrs['tagN']?.text).toBe('101')
  })

  it('exposes every symbol port on the element', () => {
    const graph = new dia.Graph()
    const a = node({ symbolId: 'instr.bubble', kind: 'instrument' })
    reconcile(graph, docWith([a]), undefined)
    const el = graph.getCell(a.id) as dia.Element
    expect(el.getPorts()).toHaveLength(4)
  })

  it('jacketed renders double-line and reverts cleanly', () => {
    const graph = new dia.Graph()
    const e: PlantEdge = { id: 'ej', lineClass: 'pipe.jacketed', source: { x: 0, y: 0 }, target: { x: 80, y: 0 } }
    const doc1 = docWith([], [e])
    reconcile(graph, doc1, undefined)
    const link = graph.getCell('ej')
    expect(link.attr('outline/stroke')).toBe('#111')
    expect(link.attr('line/stroke')).toBe('#fff')
    const doc2 = docWith([], [{ ...e, lineClass: 'process.major' }])
    reconcile(graph, doc2, doc1)
    expect(link.attr('outline/stroke')).toBe('none')
    expect(link.attr('line/stroke')).toBe('#111')
    expect(link.attr('line/strokeWidth')).toBe(2.5)
  })

  it('applies line class stroke and updates on change', () => {
    const graph = new dia.Graph()
    const a = node(); const b = node()
    const e: PlantEdge = { id: 'e2', lineClass: 'signal.electric', source: { x: 0, y: 0 }, target: { x: 80, y: 0 } }
    const doc1 = docWith([a, b], [e])
    reconcile(graph, doc1, undefined)
    const link = graph.getCell('e2')
    expect(link.attr('line/strokeDasharray')).toBe('4 3')
    const doc2 = docWith([a, b], [{ ...e, lineClass: 'process.major' }])
    reconcile(graph, doc2, doc1)
    expect(link.attr('line/strokeDasharray')).toBeUndefined()
    expect(link.attr('line/strokeWidth')).toBe(2.5)
  })
})
