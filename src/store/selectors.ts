import type { ProjectDoc, Tag } from '../model/types'

export interface Loop {
  family: string
  loop: string
  members: { nodeId: string; tag: Tag }[]
  hint?: string
}

/** Group tagged nodes into control loops by first letter + loop number (all sheets). */
export function deriveLoops(doc: ProjectDoc): Loop[] {
  const map = new Map<string, Loop>()
  for (const node of doc.sheets.flatMap((sh) => sh.nodes)) {
    if (!node.tag?.letters || !node.tag.loop) continue
    const family = node.tag.letters[0]!
    const key = `${family}-${node.tag.loop}`
    const loop = map.get(key) ?? { family, loop: node.tag.loop, members: [] }
    loop.members.push({ nodeId: node.id, tag: node.tag })
    map.set(key, loop)
  }
  for (const loop of map.values()) {
    const letterSets = loop.members.map((m) => m.tag.letters)
    const hasMeasure = letterSets.some((l) => l.includes('T') || l.includes('E'))
    const hasController = letterSets.some((l) => l.includes('C') && !l.endsWith('V'))
    const hasFinal = letterSets.some((l) => l.endsWith('V') || l.endsWith('Z'))
    if (hasMeasure && hasController && !hasFinal) loop.hint = 'No final control element in this loop'
  }
  return [...map.values()].sort((a, b) => (a.family + a.loop).localeCompare(b.family + b.loop))
}
