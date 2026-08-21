import { describe, expect, it } from 'vitest'
import { deriveLoops } from '../../src/store/selectors'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantNode, Tag } from '../../src/model/types'

let n = 0
const node = (tag: Tag): PlantNode => ({ id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag })

function docWith(...tags: Tag[]) {
  const d = createEmptyDoc('t')
  d.nodes = tags.map(node)
  return d
}

describe('deriveLoops', () => {
  it('groups a complete loop without hints', () => {
    const loops = deriveLoops(docWith({ letters: 'FT', loop: '101' }, { letters: 'FIC', loop: '101' }, { letters: 'FV', loop: '101' }))
    expect(loops).toHaveLength(1)
    expect(loops[0]!.members).toHaveLength(3)
    expect(loops[0]!.hint).toBeUndefined()
  })
  it('hints when a controller loop lacks a final element', () => {
    const loops = deriveLoops(docWith({ letters: 'FT', loop: '102' }, { letters: 'FIC', loop: '102' }))
    expect(loops[0]!.hint).toMatch(/final/i)
  })
  it('suffixed members group together, families stay apart', () => {
    const loops = deriveLoops(docWith(
      { letters: 'FT', loop: '101', suffix: 'A' },
      { letters: 'FT', loop: '101', suffix: 'B' },
      { letters: 'PT', loop: '101' },
    ))
    expect(loops).toHaveLength(2)
    expect(loops.find((l) => l.family === 'F')!.members).toHaveLength(2)
  })
})
