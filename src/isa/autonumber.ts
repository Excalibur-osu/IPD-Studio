import type { ProjectDoc, Tag } from '../model/types'

/** Lowest unused loop number >= 100 within the first-letter family, project-wide. */
export function nextLoopNumber(doc: ProjectDoc, letters: string): string {
  const family = letters[0]
  const used = new Set<number>()
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) {
      if (node.tag && node.tag.letters[0] === family) {
        const num = Number(node.tag.loop)
        if (Number.isFinite(num)) used.add(num)
      }
    }
  }
  let candidate = 100
  while (used.has(candidate)) candidate++
  return String(candidate)
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
