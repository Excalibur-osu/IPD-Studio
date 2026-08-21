import { describe, expect, it } from 'vitest'
import { findTag } from '../../src/search/findTag'
import { createEmptyDoc, createSheet } from '../../src/model/doc'

function fixture() {
  const doc = createEmptyDoc('t')
  doc.sheets[0]!.nodes = [
    { id: 'a', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters: 'FIC', loop: '101' } },
    { id: 'b', symbolId: 'vessel.tank', kind: 'equipment', x: 0, y: 0, rotation: 0, label: 'TK-101 Feed Tank' },
  ]
  const sheet2 = createSheet(2)
  sheet2.nodes = [
    { id: 'c', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters: 'PT', loop: '205', suffix: 'A' } },
  ]
  doc.sheets.push(sheet2)
  return doc
}

describe('findTag', () => {
  const doc = fixture()
  it('matches formatted tags case-insensitively', () => {
    expect(findTag(doc, 'fic').map((r) => r.nodeId)).toEqual(['a'])
    expect(findTag(doc, 'FIC-101')).toHaveLength(1)
  })
  it('matches loop digits and suffix across sheets', () => {
    const r = findTag(doc, '205a')
    expect(r).toHaveLength(1)
    expect(r[0]!.sheetId).toBe(doc.sheets[1]!.id)
  })
  it('matches labels', () => {
    expect(findTag(doc, 'feed tank').map((r) => r.nodeId)).toEqual(['b'])
  })
  it('empty query returns nothing; results carry display text', () => {
    expect(findTag(doc, '  ')).toEqual([])
    expect(findTag(doc, '101').map((r) => r.display).sort()).toEqual(['FIC-101', 'TK-101 Feed Tank'])
  })
})
