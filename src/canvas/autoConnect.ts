// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * Magnetic docking — connect by touching, not by drawing.
 *
 * Bring a symbol's connection point close to another symbol's connection
 * point and let go: the symbol clicks into place so the two points coincide
 * exactly, and the line between them is created for you. Because the line
 * stores PORTS and not coordinates, pulling the symbols apart afterwards
 * stretches the pipe instead of breaking it.
 *
 * Used from two places, one gesture each:
 *   - dropHandling.ts  — a symbol dragged in from the palette
 *   - interactions.ts  — a symbol already on the sheet, dragged by hand
 */

import type { dia } from '@joint/core'
import type { LineClass, PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import type { PortKind } from '../symbols/types'
import { getSymbol } from '../symbols/registry'
import { portWorld } from './alignment'
import { compatibleKinds, pickLineClass } from './connectionRules'

/**
 * How near a port has to come before it docks, in SCREEN px — the distance is
 * judged by what the user sees, so the reach feels the same zoomed in or out.
 * Clamped in sheet space so an extreme zoom can't make it either unhittable
 * or grabby enough to swallow neighbouring symbols.
 */
export const DOCK_SCREEN_PX = 18
const MIN_SHEET_RADIUS = 6
const MAX_SHEET_RADIUS = 48

export function dockRadius(scale: number): number {
  const s = scale > 0 ? scale : 1
  return Math.min(MAX_SHEET_RADIUS, Math.max(MIN_SHEET_RADIUS, DOCK_SCREEN_PX / s))
}

export interface Dock {
  /** Port on the symbol being moved. */
  movingPortId: string
  targetNodeId: string
  targetPortId: string
  /** Where the moving symbol has to sit for the two ports to coincide. */
  x: number
  y: number
  /** Sheet point the ports meet at — where the hint ring is drawn. */
  at: { x: number; y: number }
  lineClass: LineClass
}

interface PortRef {
  nodeId: string
  portId: string
  kind: PortKind
  x: number
  y: number
}

/** Catalog ports plus any user-added pins. Unknown symbols have none. */
function portsOf(node: PlantNode): { id: string; kind: PortKind }[] {
  try {
    return [...getSymbol(node.symbolId).ports, ...(node.extraPorts ?? [])].map((p) => ({
      id: p.id,
      kind: p.kind,
    }))
  } catch {
    return []
  }
}

const endKey = (end: PlantEdge['source']): string =>
  isPortEnd(end) ? `${end.nodeId}/${end.portId}` : ''

/**
 * The best port pairing for `moving` at its current x/y, or null when nothing
 * is in reach. `moving` may be a node that does not exist on the sheet yet
 * (a palette drag in flight); `others` is simply scanned for a different id.
 *
 * Pairs that are already joined are skipped, so nudging a symbol that is
 * docked doesn't stack a second identical line on top of the first.
 */
export function findDock(
  moving: PlantNode,
  others: PlantNode[],
  edges: PlantEdge[],
  activeLineClass: LineClass,
  radius: number,
): Dock | null {
  const mine = portsOf(moving)
  if (!mine.length) return null

  const joined = new Set<string>()
  for (const e of edges) {
    const a = endKey(e.source)
    const b = endKey(e.target)
    if (a && b) {
      joined.add(`${a}|${b}`)
      joined.add(`${b}|${a}`)
    }
  }

  // Resolve every candidate port once, not once per port of the moving symbol.
  const targets: PortRef[] = []
  for (const other of others) {
    if (other.id === moving.id) continue
    for (const p of portsOf(other)) {
      const at = portWorld(other, p.id)
      if (at) targets.push({ nodeId: other.id, portId: p.id, kind: p.kind, x: at.x, y: at.y })
    }
  }

  let best: Dock | null = null
  let bestDistance = radius
  for (const mp of mine) {
    const from = portWorld(moving, mp.id)
    if (!from) continue
    for (const t of targets) {
      const d = Math.hypot(t.x - from.x, t.y - from.y)
      if (d > bestDistance) continue
      if (!compatibleKinds(mp.kind, t.kind)) continue
      if (joined.has(`${moving.id}/${mp.id}|${t.nodeId}/${t.portId}`)) continue
      bestDistance = d
      best = {
        movingPortId: mp.id,
        targetNodeId: t.nodeId,
        targetPortId: t.portId,
        x: Math.round(moving.x + t.x - from.x),
        y: Math.round(moving.y + t.y - from.y),
        at: { x: t.x, y: t.y },
        lineClass: pickLineClass(mp.kind, t.kind, activeLineClass),
      }
    }
  }
  return best
}

/** The edge a dock creates, ready for addBatch/dockNode. */
export function dockEdge(movingId: string, dock: Dock): Omit<PlantEdge, 'id'> {
  return {
    lineClass: dock.lineClass,
    source: { nodeId: movingId, portId: dock.movingPortId },
    target: { nodeId: dock.targetNodeId, portId: dock.targetPortId },
  }
}

const HINT_CLASS = 'pid-dock-hint'
const NS = 'http://www.w3.org/2000/svg'

/**
 * Ring at the point the drag will dock onto — the visible promise that
 * letting go connects. Lives inside `.joint-layers`, the group carrying the
 * pan/zoom transform, so it sits on the sheet rather than on the viewport.
 * Passing null takes it down.
 */
export function showDockHint(paper: dia.Paper, at: { x: number; y: number } | null): void {
  const layer = paper.svg.querySelector('.joint-layers')
  if (!layer) return
  const existing = layer.querySelector(`.${HINT_CLASS}`) as SVGCircleElement | null
  if (!at) {
    existing?.remove()
    return
  }
  const ring = existing ?? document.createElementNS(NS, 'circle')
  ring.setAttribute('class', HINT_CLASS)
  ring.setAttribute('r', '7')
  ring.setAttribute('cx', String(at.x))
  ring.setAttribute('cy', String(at.y))
  ring.setAttribute('pointer-events', 'none')
  if (!existing) layer.appendChild(ring)
}
