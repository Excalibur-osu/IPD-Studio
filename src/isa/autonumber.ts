// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { PlantNode, ProjectDoc, Tag } from '../model/types'
import { isPortEnd } from '../model/types'

/** Project numbering base: tags count from 100 (default) or from 001. */
export function numberStart(doc: ProjectDoc): number {
  return doc.settings.numberStart === 1 ? 1 : 100
}

const fmt = (n: number) => String(n).padStart(3, '0')

function usedNumbers(doc: ProjectDoc, letters: string): Set<number> {
  const used = new Set<number>()
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) {
      if (node.tag && node.tag.letters === letters) {
        const num = Number(node.tag.loop)
        if (Number.isFinite(num)) used.add(num)
      }
    }
  }
  return used
}

/**
 * Lowest unused number for EXACTLY these letters, project-wide. Every
 * component type counts on its own: the first TT is TT-100 and the first TIC
 * is TIC-100, regardless of each other.
 */
export function nextLoopNumber(doc: ProjectDoc, letters: string): string {
  const used = usedNumbers(doc, letters)
  let candidate = numberStart(doc)
  while (used.has(candidate)) candidate++
  return fmt(candidate)
}

/**
 * Lowest number free for EVERY letter set at once — used by typical-loop
 * placement so FT/FIC/FY/FV all share one loop number.
 */
export function sharedLoopNumber(doc: ProjectDoc, lettersList: string[]): string {
  const sets = lettersList.map((l) => usedNumbers(doc, l))
  let candidate = numberStart(doc)
  while (sets.some((s) => s.has(candidate))) candidate++
  return fmt(candidate)
}

/**
 * Number to auto-fill for a node being tagged with `letters`: if a connected
 * instrument in the same first-letter family already has a loop number,
 * inherit it (a TIC wired to TT-100 becomes TIC-100) unless that would
 * duplicate an existing tag; otherwise take this letter set's next number.
 */
export function suggestLoop(doc: ProjectDoc, nodeId: string, letters: string): string {
  for (const sheet of doc.sheets) {
    if (!sheet.nodes.some((n) => n.id === nodeId)) continue
    const neighbors: PlantNode[] = []
    for (const edge of sheet.edges) {
      const ends = [edge.source, edge.target]
      for (let i = 0; i < 2; i++) {
        const a = ends[i]!
        const b = ends[1 - i]!
        if (isPortEnd(a) && a.nodeId === nodeId && isPortEnd(b) && b.nodeId !== nodeId) {
          const other = sheet.nodes.find((n) => n.id === b.nodeId)
          if (other) neighbors.push(other)
        }
      }
    }
    for (const other of neighbors) {
      if (!other.tag || other.tag.letters[0] !== letters[0]) continue
      const loop = other.tag.loop
      if (!Number.isFinite(Number(loop))) continue
      if (!isDuplicateTag(doc, { letters, loop }, nodeId)) return loop
    }
  }
  return nextLoopNumber(doc, letters)
}

export function isDuplicateTag(doc: ProjectDoc, tag: Tag, excludeNodeId?: string): boolean {
  return doc.sheets.some((sheet) =>
    sheet.nodes.some(
      (node) =>
        node.id !== excludeNodeId &&
        node.tag !== undefined &&
        node.tag.letters === tag.letters &&
        node.tag.loop === tag.loop &&
        (node.tag.suffix ?? '') === (tag.suffix ?? ''),
    ),
  )
}

/** Next line-number sequence: max numeric seq across all sheets + 1, zero-padded to 3. */
export function nextLineSeq(doc: ProjectDoc): string {
  let max = 0
  for (const sheet of doc.sheets) {
    for (const edge of sheet.edges) {
      const num = Number(edge.lineNumber?.seq)
      if (Number.isFinite(num) && num > max) max = num
    }
  }
  return String(max + 1).padStart(3, '0')
}
