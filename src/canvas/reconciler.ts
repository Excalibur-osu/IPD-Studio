import type { dia } from '@joint/core'
import type { PlantEdge, SheetContent } from '../model/types'
import { isPortEnd } from '../model/types'
import { makeElement, makeLink, refreshLinkRouter, updateElement, updateLink } from './shapes'

/**
 * Make the JointJS graph mirror the document. The store is immutable, so
 * object identity is the change signal; identical references are skipped.
 */
export function reconcile(graph: dia.Graph, doc: SheetContent, prev: SheetContent | undefined): void {
  if (doc === prev) return
  const prevNodes = new Map(prev?.nodes.map((n) => [n.id, n]))
  const prevEdges = new Map(prev?.edges.map((e) => [e.id, e]))
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]))
  const movedNodes = new Set<string>()
  const keep = new Set<string>()

  for (const node of doc.nodes) {
    keep.add(node.id)
    const cell = graph.getCell(node.id) as dia.Element | undefined
    if (!cell) {
      graph.addCell(makeElement(node))
    } else {
      const before = prevNodes.get(node.id)
      if (before && before !== node) {
        updateElement(cell, node, before)
        movedNodes.add(node.id)
      }
    }
  }

  const touchesMoved = (edge: PlantEdge) =>
    (isPortEnd(edge.source) && movedNodes.has(edge.source.nodeId)) ||
    (isPortEnd(edge.target) && movedNodes.has(edge.target.nodeId))

  for (const edge of doc.edges) {
    keep.add(edge.id)
    const cell = graph.getCell(edge.id) as dia.Link | undefined
    if (!cell) {
      graph.addCell(makeLink(edge, nodeMap))
    } else {
      const before = prevEdges.get(edge.id)
      if (before && before !== edge) updateLink(cell, edge, before, nodeMap)
      // Straight-vs-manhattan depends on node geometry, so a moved or
      // rescaled endpoint re-decides the route even when the edge is same.
      else if (touchesMoved(edge)) refreshLinkRouter(cell, edge, nodeMap)
    }
  }

  for (const cell of graph.getCells()) {
    const id = String(cell.id)
    if (!keep.has(id)) cell.remove()
  }
}
