import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { deserializeDoc, serializeDoc } from '../../src/persist/file'
import { createEmptyDoc } from '../../src/model/doc'
import { DocError } from '../../src/model/migrate'

describe('doc serialization', () => {
  it('round-trips a populated doc', () => {
    const doc = createEmptyDoc('Round Trip')
    doc.sheets[0]!.nodes.push({ id: 'a', symbolId: 'pump.centrifugal', kind: 'equipment', x: 8, y: 16, rotation: 90, tag: { letters: 'P', loop: '101' } })
    doc.sheets[0]!.edges.push({ id: 'e', lineClass: 'process.major', source: { nodeId: 'a', portId: 'discharge' }, target: { x: 100, y: 16 } })
    expect(deserializeDoc(serializeDoc(doc))).toEqual(doc)
  })
  it('rejects corrupt payloads', () => {
    expect(() => deserializeDoc('{"schemaVersion":42}')).toThrow(DocError)
    expect(() => deserializeDoc('not json')).toThrow()
  })
})
