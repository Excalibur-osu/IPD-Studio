import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import { getSymbol } from '../symbols/registry'

export interface NodeMove {
  id: string
  x: number
  y: number
}

/** Effective per-axis scale factors for a node. */
export function scalesOf(node: Pick<PlantNode, 'scale' | 'scaleX' | 'scaleY'>): { sx: number; sy: number } {
  return { sx: node.scaleX ?? node.scale ?? 1, sy: node.scaleY ?? node.scale ?? 1 }
}

function sizeOf(node: PlantNode): { w: number; h: number } {
  try {
    const def = getSymbol(node.symbolId)
    const rotated = node.rotation === 90 || node.rotation === 270
    const { sx, sy } = scalesOf(node)
    const w = def.gridSize.w * 8 * sx
    const h = def.gridSize.h * 8 * sy
    return rotated ? { w: h, h: w } : { w, h }
  } catch {
    return { w: 32, h: 32 }
  }
}

/** Sheet-space position of a node's port, honoring rotation and scale. */
export function portWorld(node: PlantNode, portId: string): { x: number; y: number } | null {
  try {
    const def = getSymbol(node.symbolId)
    const port = def.ports.find((p) => p.id === portId)
    if (!port) return null
    const { sx, sy } = scalesOf(node)
    const w = def.gridSize.w * 8 * sx
    const h = def.gridSize.h * 8 * sy
    let dx = port.x * sx - w / 2
    let dy = port.y * sy - h / 2
    const turns = (((node.rotation % 360) + 360) % 360) / 90
    for (let i = 0; i < turns; i++) {
      const r = { x: -dy, y: dx }
      dx = r.x
      dy = r.y
    }
    return { x: node.x + w / 2 + dx, y: node.y + h / 2 + dy }
  } catch {
    return null
  }
}

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v'

export function alignNodes(nodes: PlantNode[], mode: AlignMode): NodeMove[] {
  if (nodes.length < 2) return nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))
  const boxes = nodes.map((n) => ({ n, ...sizeOf(n) }))
  const lefts = boxes.map((b) => b.n.x)
  const rights = boxes.map((b) => b.n.x + b.w)
  const tops = boxes.map((b) => b.n.y)
  const bottoms = boxes.map((b) => b.n.y + b.h)
  const cx = (Math.min(...lefts) + Math.max(...rights)) / 2
  const cy = (Math.min(...tops) + Math.max(...bottoms)) / 2
  return boxes.map(({ n, w, h }) => {
    switch (mode) {
      case 'left': return { id: n.id, x: Math.min(...lefts), y: n.y }
      case 'right': return { id: n.id, x: Math.max(...rights) - w, y: n.y }
      case 'top': return { id: n.id, x: n.x, y: Math.min(...tops) }
      case 'bottom': return { id: n.id, x: n.x, y: Math.max(...bottoms) - h }
      case 'center-v': return { id: n.id, x: Math.round((cx - w / 2) / 8) * 8, y: n.y }
      case 'center-h': return { id: n.id, x: n.x, y: Math.round((cy - h / 2) / 8) * 8 }
    }
  })
}

export function distributeNodes(nodes: PlantNode[], axis: 'h' | 'v'): NodeMove[] {
  if (nodes.length < 3) return nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))
  const boxes = nodes
    .map((n) => ({ n, ...sizeOf(n) }))
    .sort((a, b) => (axis === 'h' ? a.n.x - b.n.x : a.n.y - b.n.y))
  const first = boxes[0]!
  const last = boxes[boxes.length - 1]!
  const firstC = axis === 'h' ? first.n.x + first.w / 2 : first.n.y + first.h / 2
  const lastC = axis === 'h' ? last.n.x + last.w / 2 : last.n.y + last.h / 2
  const step = (lastC - firstC) / (boxes.length - 1)
  return boxes.map(({ n, w, h }, i) => {
    const center = firstC + step * i
    return axis === 'h'
      ? { id: n.id, x: Math.round((center - w / 2) / 8) * 8, y: n.y }
      : { id: n.id, x: n.x, y: Math.round((center - h / 2) / 8) * 8 }
  })
}

export interface GuideHit {
  x?: number
  y?: number
  guideX?: number
  guideY?: number
}

/**
 * Suggest a snapped position when the dragged node's edges/centers align with
 * others. When `edges` is given, alignment of CONNECTED PORTS takes priority
 * with a wider window (and may land off-grid): a transmitter dropped roughly
 * above a nozzle clicks into the exact position that lets its line run dead
 * straight — box centers can't do this because a 40px bubble and a 48px
 * vessel never share a center on the 8px grid.
 */
export function snapGuides(
  dragged: PlantNode,
  others: PlantNode[],
  tolerance = 4,
  edges?: PlantEdge[],
  portTolerance = 8,
): GuideHit {
  const d = { ...sizeOf(dragged) }
  const dCandidatesX = (x: number) => [x, x + d.w / 2, x + d.w]
  const dCandidatesY = (y: number) => [y, y + d.h / 2, y + d.h]
  const out: GuideHit = {}
  let bestDx = tolerance + 1
  let bestDy = tolerance + 1
  for (const o of others) {
    if (o.id === dragged.id) continue
    const s = sizeOf(o)
    const oxs = [o.x, o.x + s.w / 2, o.x + s.w]
    const oys = [o.y, o.y + s.h / 2, o.y + s.h]
    for (const ox of oxs) {
      dCandidatesX(dragged.x).forEach((dx, i) => {
        const delta = Math.abs(dx - ox)
        if (delta < bestDx && delta <= tolerance) {
          bestDx = delta
          out.x = ox - [0, d.w / 2, d.w][i]!
          out.guideX = ox
        }
      })
    }
    for (const oy of oys) {
      dCandidatesY(dragged.y).forEach((dy, i) => {
        const delta = Math.abs(dy - oy)
        if (delta < bestDy && delta <= tolerance) {
          bestDy = delta
          out.y = oy - [0, d.h / 2, d.h][i]!
          out.guideY = oy
        }
      })
    }
  }

  if (edges) {
    const byId = new Map(others.map((n) => [n.id, n]))
    let bestPx = portTolerance + 1
    let bestPy = portTolerance + 1
    for (const e of edges) {
      const pairs: [PlantEdge['source'], PlantEdge['source']][] = [
        [e.source, e.target],
        [e.target, e.source],
      ]
      for (const [mine, far] of pairs) {
        if (!isPortEnd(mine) || mine.nodeId !== dragged.id) continue
        const pa = portWorld(dragged, mine.portId)
        const pb = isPortEnd(far)
          ? far.nodeId === dragged.id
            ? null
            : portWorld(byId.get(far.nodeId) ?? dragged, far.portId)
          : { x: far.x, y: far.y }
        if (!pa || !pb) continue
        const ddx = Math.abs(pa.x - pb.x)
        const ddy = Math.abs(pa.y - pb.y)
        // Align across the axis the line runs along; skip when the ports are
        // basically coincident (nothing to straighten).
        if (ddx > 0 && ddx <= portTolerance && ddy > portTolerance && ddx < bestPx) {
          bestPx = ddx
          out.x = dragged.x + (pb.x - pa.x)
          out.guideX = pb.x
        }
        if (ddy > 0 && ddy <= portTolerance && ddx > portTolerance && ddy < bestPy) {
          bestPy = ddy
          out.y = dragged.y + (pb.y - pa.y)
          out.guideY = pb.y
        }
      }
    }
  }
  return out
}
