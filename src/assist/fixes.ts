// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { ulid } from 'ulid'
import type { FixSpec } from '../validate/suggest'
import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import { portWorld } from '../canvas/alignment'
import { isDuplicateTag, nextLoopNumber } from '../isa/autonumber'
import { useStore } from '../store/store'

const snap8 = (v: number) => Math.round(v / 8) * 8

/**
 * Apply an Advisor fix. insert-ip splits an electric line into
 * controller → I/P converter → (pneumatic) valve, placing and tagging the
 * converter automatically — one undo step.
 */
export function applyFix(fix: FixSpec): void {
  if (fix.kind === 'purge-record') {
    useStore.getState().purgeRecord(fix.key)
    return
  }
  if (fix.kind !== 'insert-ip') return
  const s = useStore.getState()
  if (s.activeSheetId !== fix.sheetId) s.setActiveSheet(fix.sheetId)
  const state = useStore.getState()
  const sheet = state.doc.sheets.find((sh) => sh.id === fix.sheetId)
  const edge = sheet?.edges.find((e) => e.id === fix.edgeId)
  if (!sheet || !edge || !isPortEnd(edge.source) || !isPortEnd(edge.target)) return

  const nodeOf = (id: string) => sheet.nodes.find((n) => n.id === id)
  const srcNode = nodeOf(edge.source.nodeId)
  const tgtNode = nodeOf(edge.target.nodeId)
  if (!srcNode || !tgtNode) return
  const valveEndIsTarget = tgtNode.symbolId.startsWith('cv.')
  const valve = valveEndIsTarget ? tgtNode : srcNode
  const sender = valveEndIsTarget ? srcNode : tgtNode
  const senderEnd = valveEndIsTarget ? edge.source : edge.target
  const valveEnd = valveEndIsTarget ? edge.target : edge.source

  const pa = portWorld(sender, senderEnd.portId) ?? { x: sender.x, y: sender.y }
  const pb = portWorld(valve, valveEnd.portId) ?? { x: valve.x, y: valve.y }
  const mid = { x: snap8((pa.x + pb.x) / 2) - 16, y: snap8((pa.y + pb.y) / 2) - 16 }
  const vertical = Math.abs(pb.y - pa.y) >= Math.abs(pb.x - pa.x)
  const inPort = vertical ? (pb.y > pa.y ? 'n' : 's') : pb.x > pa.x ? 'w' : 'e'
  const outPort = vertical ? (pb.y > pa.y ? 's' : 'n') : pb.x > pa.x ? 'e' : 'w'

  // FY-style tag: sender family + Y, sharing the loop when free.
  const family = sender.tag?.letters[0] ?? valve.tag?.letters[0] ?? 'F'
  const letters = `${family}Y`
  const loop =
    sender.tag?.loop && !isDuplicateTag(state.doc, { letters, loop: sender.tag.loop })
      ? sender.tag.loop
      : nextLoopNumber(state.doc, letters)

  const converter: PlantNode = {
    id: ulid(),
    symbolId: 'instr.converter',
    kind: 'instrument',
    x: mid.x,
    y: mid.y,
    rotation: 0,
    config: { conv: 'I/P' },
    tag: { letters, loop },
  }
  const inEdge: PlantEdge = {
    id: ulid(),
    lineClass: 'signal.electric',
    source: { nodeId: sender.id, portId: senderEnd.portId },
    target: { nodeId: converter.id, portId: inPort },
  }
  const outEdge: PlantEdge = {
    id: ulid(),
    lineClass: 'signal.pneumatic',
    source: { nodeId: converter.id, portId: outPort },
    target: { nodeId: valve.id, portId: valveEnd.portId },
  }
  useStore.getState().addBatch([converter], [inEdge, outEdge], [edge.id])
}
