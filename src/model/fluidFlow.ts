import type { PlantNode, SheetContent } from './types'
import { isPortEnd } from './types'
import { isProcessClass } from '../canvas/lineStyle'
import { getSymbol } from '../symbols/registry'

/** Symbol categories a fluid flows straight through: the medium on one side
 *  is the medium on the other. Vessels, columns, exchangers, and process
 *  units transform or mix — the service "starts over" there. */
const PASS_CATEGORIES = new Set([
  'valves', 'control-valves', 'safety', 'flow-elements', 'accessories', 'inline', 'rotating', 'custom',
])

function passesThrough(node: PlantNode): boolean {
  if (node.kind === 'valve' || node.kind === 'fitting') return true
  if (node.kind !== 'equipment') return false
  try {
    return PASS_CATEGORIES.has(getSymbol(node.symbolId).category)
  } catch {
    return true // unknown/custom symbols: assume inline hardware
  }
}

/** The connected run of process edges a fluid assignment covers: walk from
 *  the start edge in BOTH directions through pass-through hardware (valves,
 *  pumps, junctions, fittings), stopping at vessels/exchangers/units.
 *  Returns the edge ids to restyle (always includes the start edge). */
export function propagateFluid(content: SheetContent, startEdgeId: string): string[] {
  const start = content.edges.find((e) => e.id === startEdgeId)
  if (!start) return []
  const nodesById = new Map(content.nodes.map((n) => [n.id, n]))
  const processEdges = content.edges.filter((e) => isProcessClass(e.lineClass))
  const edgesAt = new Map<string, typeof processEdges>()
  for (const e of processEdges) {
    for (const end of [e.source, e.target]) {
      if (!isPortEnd(end)) continue
      edgesAt.set(end.nodeId, [...(edgesAt.get(end.nodeId) ?? []), e])
    }
  }
  const out = new Set<string>([start.id])
  let frontier = [start]
  while (frontier.length > 0) {
    const next: typeof frontier = []
    for (const e of frontier) {
      for (const end of [e.source, e.target]) {
        if (!isPortEnd(end)) continue
        const n = nodesById.get(end.nodeId)
        if (!n || !passesThrough(n)) continue
        for (const other of edgesAt.get(end.nodeId) ?? []) {
          if (out.has(other.id)) continue
          out.add(other.id)
          next.push(other)
        }
      }
    }
    frontier = next
  }
  return [...out]
}
