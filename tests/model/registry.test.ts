import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import type { PlantEdge, PlantNode } from '../../src/model/types'
import {
  fieldValue,
  keyOfEdge,
  keyOfNode,
  kindOfNode,
  liveKeys,
  retagRegistry,
  type Registry,
} from '../../src/model/registry'

let n = 0
const node = (p: Partial<PlantNode> = {}): PlantNode => ({
  id: `n${n++}`, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, ...p,
})
const edge = (p: Partial<PlantEdge> = {}): PlantEdge => ({
  id: `e${n++}`, lineClass: 'process.major', source: { x: 0, y: 0 }, target: { x: 1, y: 1 }, ...p,
})
const reg = (...keys: string[]): Registry =>
  Object.fromEntries(keys.map((k) => [k, { key: k, kind: 'instrument' as const, fields: { 'signal.range': k } }]))

describe('keys', () => {
  it('keys a node by its formatted tag', () => {
    expect(keyOfNode(node({ tag: { letters: 'FT', loop: '101' } }))).toBe('FT-101')
    expect(keyOfNode(node({ tag: { letters: 'FT', loop: '101', suffix: 'A' } }))).toBe('FT-101A')
  })

  it('gives no key to an untagged or annotation node', () => {
    expect(keyOfNode(node())).toBeNull()
    expect(keyOfNode(node({ symbolId: 'ann.text', kind: 'annotation' }))).toBeNull()
    // a half-typed tag is not an identity
    expect(keyOfNode(node({ tag: { letters: 'FT', loop: '' } }))).toBeNull()
  })

  it('keys a line by its line number, matching the line list', () => {
    expect(keyOfEdge(edge({ lineNumber: { size: '6"', spec: 'CS', service: 'CW', seq: '001' } }))).toBe('6"-CS-CW-001')
    expect(keyOfEdge(edge())).toBeNull()
    expect(keyOfEdge(edge({ lineNumber: { size: '', spec: '', service: '', seq: '' } }))).toBeNull()
  })

  it('classifies valves apart from other equipment', () => {
    expect(kindOfNode(node({ kind: 'instrument' }))).toBe('instrument')
    expect(kindOfNode(node({ symbolId: 'valve.gate', kind: 'valve' }))).toBe('valve')
    expect(kindOfNode(node({ symbolId: 'pump.centrifugal', kind: 'equipment' }))).toBe('equipment')
    expect(kindOfNode(node({ symbolId: 'ann.text', kind: 'annotation' }))).toBeNull()
  })
})

describe('retagRegistry — a rename must never lose engineering data', () => {
  it('MOVES the record when the old tag is retired', () => {
    const { registry, collision } = retagRegistry(reg('FT-101'), 'FT-101', 'FT-102', { oldKeyStillUsed: false })
    expect(collision).toBe(false)
    expect(registry!['FT-102']).toMatchObject({ key: 'FT-102', fields: { 'signal.range': 'FT-101' } })
    expect(registry!['FT-101']).toBeUndefined()
  })

  it('COPIES when another symbol still wears the old tag', () => {
    const { registry } = retagRegistry(reg('FT-101'), 'FT-101', 'FT-102', { oldKeyStillUsed: true })
    expect(registry!['FT-101']).toBeDefined()
    expect(registry!['FT-102']).toBeDefined()
  })

  it('REFUSES to merge onto an existing record, and reports the collision', () => {
    const before = reg('FT-101', 'FT-102')
    const { registry, collision } = retagRegistry(before, 'FT-101', 'FT-102', { oldKeyStillUsed: false })
    expect(collision).toBe(true)
    // both records survive untouched — merging two specs is unrecoverable
    expect(registry!['FT-101']!.fields['signal.range']).toBe('FT-101')
    expect(registry!['FT-102']!.fields['signal.range']).toBe('FT-102')
  })

  it('is a no-op when there is nothing to carry', () => {
    expect(retagRegistry(undefined, 'A', 'B', { oldKeyStillUsed: false }).registry).toBeUndefined()
    expect(retagRegistry(reg('A'), null, 'B', { oldKeyStillUsed: false }).registry!['A']).toBeDefined()
    expect(retagRegistry(reg('A'), 'A', 'A', { oldKeyStillUsed: false }).registry!['A']).toBeDefined()
    // renaming something that never had a record must not invent one
    expect(retagRegistry(reg('A'), 'ZZ-9', 'B', { oldKeyStillUsed: false }).registry!['B']).toBeUndefined()
  })
})

describe('liveKeys', () => {
  it('collects every tag and line number currently drawn', () => {
    const keys = liveKeys([
      {
        nodes: [node({ tag: { letters: 'FT', loop: '101' } }), node()],
        edges: [edge({ lineNumber: { size: '6"', spec: '', service: 'CW', seq: '001' } })],
      },
    ])
    expect([...keys].sort()).toEqual(['6"-CW-001', 'FT-101'])
  })
})

describe('fieldValue — the read-fallback that makes the migration non-destructive', () => {
  const tagged = node({ tag: { letters: 'FT', loop: '101' }, datasheet: { 'signal.range': '0-100' } })

  it('prefers the record', () => {
    const registry: Registry = { 'FT-101': { key: 'FT-101', kind: 'instrument', fields: { 'signal.range': '0-150' } } }
    expect(fieldValue(registry, tagged, 'signal.range')).toBe('0-150')
  })

  it('falls back to the legacy per-node datasheet', () => {
    expect(fieldValue(undefined, tagged, 'signal.range')).toBe('0-100')
    expect(fieldValue({}, tagged, 'signal.range')).toBe('0-100')
  })

  it('returns empty rather than undefined for an unknown field', () => {
    expect(fieldValue({}, tagged, 'nope')).toBe('')
  })
})
