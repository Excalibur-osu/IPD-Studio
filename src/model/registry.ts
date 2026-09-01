// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { PlantEdge, PlantNode } from './types'
import { formatTag } from '../isa/tag'

/**
 * The engineering record: what an object *is*, as opposed to where it is drawn.
 *
 * Records are keyed by TAG, never by node id. A tag is the engineering
 * identity; a node is one placement of it. That matters for four reasons:
 *
 *  1. The same tag legitimately appears more than once — an off-page
 *     continuation, a valve shown on two sheets, a header on a utility drawing.
 *  2. Delete-and-redraw is normal drafting. Node-id keying silently destroys an
 *     approved datasheet; tag keying survives it.
 *  3. Every deliverable already joins on tag — the instrument index, the loop
 *     derivation, the loop diagram, the HMI widget binding.
 *  4. It makes a duplicate tag a DATA error rather than a cosmetic one.
 *
 * The trade-off is deliberate: an untagged object gets no record. "Tag it
 * before you can spec it" is how an engineering database works, and the QA
 * engine offers to assign the next free tag rather than leaving you stuck.
 */
export type EntityKind = 'instrument' | 'valve' | 'equipment' | 'line'

export type RecordStatus = 'draft' | 'in-review' | 'approved' | 'issued'

export const RECORD_STATUSES: readonly RecordStatus[] = ['draft', 'in-review', 'approved', 'issued']

export interface EngineeringRecord {
  /** Canonical identity: 'FT-101', 'P-101', '6"-CS-CW-001'. */
  key: string
  kind: EntityKind
  /** Values keyed by field id from the catalog in model/fields.ts. */
  fields: Record<string, string>
  status?: RecordStatus
  owner?: string
  /** Revision in which this record last changed (populated from v0.19). */
  rev?: string
  updated?: string
}

export type Registry = Record<string, EngineeringRecord>

/**
 * Valves are their own kind rather than a flavour of equipment: a control valve
 * needs body/trim/Cv/fail-position/actuator, which is neither the instrument
 * catalog nor the pump one, and valves are a large share of any P&ID.
 */
export function kindOfNode(node: PlantNode): EntityKind | null {
  if (node.kind === 'annotation') return null
  if (node.kind === 'instrument') return 'instrument'
  if (node.kind === 'valve') return 'valve'
  return 'equipment'
}

/** The record key for a node, or null when it has no engineering identity. */
export function keyOfNode(node: PlantNode): string | null {
  if (node.kind === 'annotation') return null
  if (!node.tag?.letters || !node.tag.loop) return null
  return formatTag(node.tag, '-')
}

/** The record key for a line: its line number, the same string the line list
 *  prints. A line with no number has no identity to hang a record on. */
export function keyOfEdge(edge: PlantEdge): string | null {
  const ln = edge.lineNumber
  if (!ln) return null
  const key = [ln.size, ln.spec, ln.service, ln.seq].filter(Boolean).join('-')
  return key || null
}

export function emptyRecord(key: string, kind: EntityKind): EngineeringRecord {
  return { key, kind, fields: {} }
}

/**
 * Carry a record across a rename.
 *
 *  - The old key has a record and the new one does not → MOVE it. A rename is
 *    the same object under a new name; losing its spec would be a data loss bug.
 *  - The old key is still worn by another object on some sheet → COPY, because
 *    that other object still needs its record.
 *  - The new key ALREADY has a record → do not touch either one and report a
 *    collision. Silently merging two engineering records is unrecoverable, and
 *    a duplicate tag is already a finding the user must resolve.
 */
export function retagRegistry(
  registry: Registry | undefined,
  oldKey: string | null,
  newKey: string | null,
  opts: { oldKeyStillUsed: boolean },
): { registry: Registry | undefined; collision: boolean } {
  if (!registry || !oldKey || !newKey || oldKey === newKey) return { registry, collision: false }
  const existing = registry[oldKey]
  if (!existing) return { registry, collision: false }
  if (registry[newKey]) return { registry, collision: true }

  const next: Registry = { ...registry, [newKey]: { ...existing, key: newKey } }
  if (!opts.oldKeyStillUsed) delete next[oldKey]
  return { registry: next, collision: false }
}

/** Every key currently worn by something on a sheet — the live set a record
 *  can be checked against to find orphans. */
export function liveKeys(sheets: { nodes: PlantNode[]; edges: PlantEdge[] }[]): Set<string> {
  const keys = new Set<string>()
  for (const sheet of sheets) {
    for (const n of sheet.nodes) {
      const k = keyOfNode(n)
      if (k) keys.add(k)
    }
    for (const e of sheet.edges) {
      const k = keyOfEdge(e)
      if (k) keys.add(k)
    }
  }
  return keys
}

/**
 * Read one engineering value for a node: the record first, then the object's
 * legacy `node.datasheet`.
 *
 * The fallback is what makes the schemaVersion 5 move non-destructive. A
 * document written before the registry existed still shows every value it had,
 * and the first edit promotes it into the record. Remove the fallback only
 * once documents in the wild have been through a migrating save.
 */
export function fieldValue(registry: Registry | undefined, node: PlantNode, fieldKey: string): string {
  const key = keyOfNode(node)
  const fromRecord = key ? registry?.[key]?.fields[fieldKey] : undefined
  return fromRecord ?? node.datasheet?.[fieldKey] ?? ''
}
