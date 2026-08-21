import { describe, expect, it } from 'vitest'
import { createEmptyDoc } from '../../src/model/doc'
import { isDuplicateTag, nextLoopNumber } from '../../src/isa/autonumber'
import type { PlantNode, ProjectDoc, Tag } from '../../src/model/types'

let n = 0
function nodeWithTag(tag: Tag): PlantNode {
  return { id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag }
}
function docWith(...tags: Tag[]): ProjectDoc {
  const doc = createEmptyDoc('t')
  doc.sheets[0]!.nodes = tags.map(nodeWithTag)
  return doc
}

describe('nextLoopNumber', () => {
  it('starts at 100 on an empty doc', () => {
    expect(nextLoopNumber(createEmptyDoc('t'), 'FT')).toBe('100')
  })
  it('returns next free number within the letter family', () => {
    const doc = docWith({ letters: 'FT', loop: '100' }, { letters: 'FIC', loop: '101' })
    expect(nextLoopNumber(doc, 'FV')).toBe('102')
  })
  it('fills gaps', () => {
    const doc = docWith({ letters: 'FT', loop: '100' }, { letters: 'FT', loop: '102' })
    expect(nextLoopNumber(doc, 'FT')).toBe('101')
  })
  it('families are independent by first letter', () => {
    const doc = docWith({ letters: 'FT', loop: '100' })
    expect(nextLoopNumber(doc, 'PT')).toBe('100')
  })
})

describe('isDuplicateTag', () => {
  it('detects exact duplicates', () => {
    const doc = docWith({ letters: 'FT', loop: '101' })
    expect(isDuplicateTag(doc, { letters: 'FT', loop: '101' })).toBe(true)
  })
  it('suffix distinguishes tags', () => {
    const doc = docWith({ letters: 'FT', loop: '101', suffix: 'A' })
    expect(isDuplicateTag(doc, { letters: 'FT', loop: '101', suffix: 'B' })).toBe(false)
  })
  it('can exclude the node being edited', () => {
    const doc = docWith({ letters: 'FT', loop: '101' })
    const id = doc.sheets[0]!.nodes[0]!.id
    expect(isDuplicateTag(doc, { letters: 'FT', loop: '101' }, id)).toBe(false)
  })
})

import { nextLineSeq } from '../../src/isa/autonumber'

describe('nextLineSeq', () => {
  it('starts at 001 and continues max+1 without gap filling', () => {
    const doc = createEmptyDoc('t')
    expect(nextLineSeq(doc)).toBe('001')
    doc.sheets[0]!.edges = [
      { id: 'e1', lineClass: 'process.major', source: { x: 0, y: 0 }, target: { x: 8, y: 0 }, lineNumber: { size: '2"', spec: 'CS', service: 'P', seq: '001' } },
      { id: 'e2', lineClass: 'process.major', source: { x: 0, y: 8 }, target: { x: 8, y: 8 }, lineNumber: { size: '2"', spec: 'CS', service: 'P', seq: '003' } },
    ]
    expect(nextLineSeq(doc)).toBe('004')
  })
})
