// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { ulid } from 'ulid'
import type { PlantEdge, PlantNode, ProjectDoc } from '../model/types'
import { sharedLoopNumber } from '../isa/autonumber'

export interface TypicalResult {
  nodes: PlantNode[]
  edges: PlantEdge[]
}

export interface TypicalDef {
  id: string
  name: string
  /** Letter sets that share the loop number, in placement order. */
  members: string[]
}

export const TYPICALS: TypicalDef[] = [
  { id: 'flow-control', name: 'Flow control loop', members: ['FE', 'FT', 'FIC', 'FY', 'FV'] },
  { id: 'level-control', name: 'Level control loop', members: ['LT', 'LIC', 'LY', 'LV'] },
  { id: 'pressure-control', name: 'Pressure control loop', members: ['PT', 'PIC', 'PY', 'PV'] },
  { id: 'temp-control', name: 'Temperature control loop', members: ['TT', 'TIC', 'TY', 'TV'] },
  { id: 'onoff-valve', name: 'On/off valve + switch', members: ['HS', 'XV'] },
]

const snap8 = (v: number) => Math.round(v / 8) * 8

/**
 * Build a fully wired, fully tagged typical loop. All members share one loop
 * number — the lowest free across every member letter set — while each
 * letter set's own sequence stays intact for standalone placements.
 */
export function buildTypical(id: string, doc: ProjectDoc, at: { x: number; y: number }): TypicalResult {
  const def = TYPICALS.find((t) => t.id === id)
  if (!def) throw new Error(`Unknown typical: ${id}`)
  const loop = sharedLoopNumber(doc, def.members)
  const ox = snap8(at.x)
  const oy = snap8(at.y)

  const nodes: PlantNode[] = []
  const edges: PlantEdge[] = []
  const node = (partial: Omit<PlantNode, 'id'>): string => {
    const nid = ulid()
    nodes.push({ ...partial, id: nid, x: ox + partial.x, y: oy + partial.y })
    return nid
  }
  const edge = (
    lineClass: PlantEdge['lineClass'],
    from: [string, string],
    to: [string, string],
    arrow?: 'flow',
  ): void => {
    edges.push({
      id: ulid(),
      lineClass,
      source: { nodeId: from[0], portId: from[1] },
      target: { nodeId: to[0], portId: to[1] },
      ...(arrow ? { arrow } : {}),
    })
  }
  const bubble = (letters: string, x: number, y: number, location = 'field'): string =>
    node({
      symbolId: 'instr.bubble', kind: 'instrument', x, y, rotation: 0,
      config: { display: 'discrete', location },
      tag: { letters, loop },
    })

  if (def.id === 'onoff-valve') {
    const hs = bubble('HS', -4, 0)
    const xv = node({
      symbolId: 'cv.ball', kind: 'valve', x: 0, y: 104, rotation: 0,
      config: { actuator: 'solenoid', fail: 'fc' },
      tag: { letters: 'XV', loop },
    })
    edge('signal.electric', [hs, 's'], [xv, 'sig'])
    return { nodes, edges }
  }

  const family = def.members[0]![0]! // F, L, P, T
  const isFlow = def.id === 'flow-control'

  const xt = bubble(`${family}T`, -4, 64)
  const xic = bubble(`${family}IC`, -4, -24, 'control-room')
  const xy = node({
    symbolId: 'instr.converter', kind: 'instrument', x: 84, y: -20, rotation: 0,
    config: { conv: 'I/P' },
    tag: { letters: `${family}Y`, loop },
  })
  const xv = node({
    symbolId: 'cv.globe', kind: 'valve', x: 160, y: 128, rotation: 0,
    config: { actuator: 'diaphragm', fail: 'fc' },
    tag: { letters: `${family}V`, loop },
  })

  edge('signal.electric', [xt, 'n'], [xic, 's'])
  edge('signal.electric', [xic, 'e'], [xy, 'w'])
  edge('signal.pneumatic', [xy, 's'], [xv, 'sig'])

  if (isFlow) {
    const fe = node({
      symbolId: 'fe.orifice', kind: 'instrument', x: 0, y: 152, rotation: 0,
      tag: { letters: 'FE', loop },
    })
    edge('process.impulse', [xt, 's'], [fe, 'tap'])
    edge('process.major', [fe, 'e'], [xv, 'w'], 'flow')
  }
  return { nodes, edges }
}
