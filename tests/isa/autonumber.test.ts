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

describe('nextLoopNumber (per component type)', () => {
  it('starts at 100 on an empty doc', () => {
    expect(nextLoopNumber(createEmptyDoc('t'), 'FT')).toBe('100')
  })
  it('every letter combination counts on its own sequence', () => {
    // TT-100 exists; the first TIC still starts at 100, the second TT is 101
    const doc = docWith({ letters: 'TT', loop: '100' })
    expect(nextLoopNumber(doc, 'TIC')).toBe('100')
    expect(nextLoopNumber(doc, 'TT')).toBe('101')
  })
  it('fills gaps within one type', () => {
    const doc = docWith({ letters: 'FT', loop: '100' }, { letters: 'FT', loop: '102' })
    expect(nextLoopNumber(doc, 'FT')).toBe('101')
  })
  it('honors the 001 numbering preference with padding', () => {
    const doc = docWith({ letters: 'TT', loop: '001' })
    doc.settings.numberStart = 1
    expect(nextLoopNumber(doc, 'TT')).toBe('002')
    expect(nextLoopNumber(doc, 'TIC')).toBe('001')
  })
})

import { sharedLoopNumber, suggestLoop } from '../../src/isa/autonumber'

describe('sharedLoopNumber', () => {
  it('picks the lowest number free for every member type', () => {
    const doc = docWith({ letters: 'FT', loop: '100' }, { letters: 'FIC', loop: '101' })
    expect(sharedLoopNumber(doc, ['FT', 'FIC', 'FY', 'FV'])).toBe('102')
  })
  it('starts at the base on an empty doc', () => {
    expect(sharedLoopNumber(createEmptyDoc('t'), ['LT', 'LIC'])).toBe('100')
  })
})

describe('suggestLoop', () => {
  it('inherits the loop of a connected same-family instrument', () => {
    const doc = docWith({ letters: 'TT', loop: '100' })
    const tt = doc.sheets[0]!.nodes[0]!
    const tic: PlantNode = { id: 'tic1', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 96, rotation: 0 }
    doc.sheets[0]!.nodes.push(tic)
    doc.sheets[0]!.edges = [{
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: tt.id, portId: 's' }, target: { nodeId: 'tic1', portId: 'n' },
    }]
    expect(suggestLoop(doc, 'tic1', 'TIC')).toBe('100')
  })
  it('falls back to the per-type sequence when inheritance would duplicate', () => {
    const doc = docWith({ letters: 'TT', loop: '100' }, { letters: 'TIC', loop: '100' })
    const tt = doc.sheets[0]!.nodes[0]!
    const tic: PlantNode = { id: 'tic2', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 96, rotation: 0 }
    doc.sheets[0]!.nodes.push(tic)
    doc.sheets[0]!.edges = [{
      id: 'e1', lineClass: 'signal.electric',
      source: { nodeId: tt.id, portId: 's' }, target: { nodeId: 'tic2', portId: 'n' },
    }]
    expect(suggestLoop(doc, 'tic2', 'TIC')).toBe('101')
  })
  it('uses the per-type sequence for standalone nodes', () => {
    const doc = docWith({ letters: 'PT', loop: '100' })
    const pt: PlantNode = { id: 'p2', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 }
    doc.sheets[0]!.nodes.push(pt)
    expect(suggestLoop(doc, 'p2', 'PT')).toBe('101')
    expect(suggestLoop(doc, 'p2', 'PIC')).toBe('100')
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
