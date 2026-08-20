import type { ProjectDoc, Tag } from '../model/types'

/** Lowest unused loop number >= 100 within the first-letter family. */
export function nextLoopNumber(doc: ProjectDoc, letters: string): string {
  const family = letters[0]
  const used = new Set<number>()
  for (const node of doc.nodes) {
    if (node.tag && node.tag.letters[0] === family) {
      const num = Number(node.tag.loop)
      if (Number.isFinite(num)) used.add(num)
    }
  }
  let candidate = 100
  while (used.has(candidate)) candidate++
  return String(candidate)
}

export function isDuplicateTag(doc: ProjectDoc, tag: Tag, excludeNodeId?: string): boolean {
  return doc.nodes.some(
    (node) =>
      node.id !== excludeNodeId &&
      node.tag !== undefined &&
      node.tag.letters === tag.letters &&
      node.tag.loop === tag.loop &&
      (node.tag.suffix ?? '') === (tag.suffix ?? ''),
  )
}
