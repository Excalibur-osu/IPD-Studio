import type { PlantNode } from '../model/types'
import { getSymbol } from '../symbols/registry'

export interface NodeMove {
  id: string
  x: number
  y: number
}

function sizeOf(node: PlantNode): { w: number; h: number } {
  try {
    const def = getSymbol(node.symbolId)
    const rotated = node.rotation === 90 || node.rotation === 270
    const w = def.gridSize.w * 8
    const h = def.gridSize.h * 8
    return rotated ? { w: h, h: w } : { w, h }
  } catch {
    return { w: 32, h: 32 }
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

/** Suggest a snapped position when the dragged node's edges/centers align with others. */
export function snapGuides(dragged: PlantNode, others: PlantNode[], tolerance = 4): GuideHit {
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
  return out
}
