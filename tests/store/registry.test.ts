import { beforeEach, describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

function fresh() {
  useStore.getState().loadIntoStore(createEmptyDoc('t'))
  return useStore.getState()
}
const doc = () => useStore.getState().doc
const nodes = () => doc().sheets[0]!.nodes

beforeEach(() => { fresh() })

describe('a record follows its object', () => {
  it('survives a rename', () => {
    const s = fresh()
    const id = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    useStore.getState().setTag(id, { letters: 'FT', loop: '101' })
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', '0-100 m3/h')

    useStore.getState().setTag(id, { letters: 'FT', loop: '102' })

    expect(doc().registry?.['FT-102']?.fields['signal.range']).toBe('0-100 m3/h')
    expect(doc().registry?.['FT-101']).toBeUndefined()
  })

  // The bug tag-keying exists to prevent: node ids do not survive a redraw.
  it('survives delete-and-redraw of the symbol', () => {
    const s = fresh()
    const id = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    useStore.getState().setTag(id, { letters: 'PT', loop: '200' })
    useStore.getState().setRecordField('PT-200', 'instrument', 'signal.range', '0-10 bar')

    useStore.getState().deleteIds([id])
    expect(nodes()).toHaveLength(0)
    // the record is deliberately still there
    expect(doc().registry?.['PT-200']?.fields['signal.range']).toBe('0-10 bar')

    const again = useStore.getState().addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 9, y: 9, rotation: 0 })
    useStore.getState().setTag(again, { letters: 'PT', loop: '200' })
    expect(doc().registry?.['PT-200']?.fields['signal.range']).toBe('0-10 bar')
  })

  it('refuses to merge two records when a rename collides', () => {
    const s = fresh()
    const a = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    const b = useStore.getState().addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 40, y: 0, rotation: 0 })
    useStore.getState().setTag(a, { letters: 'FT', loop: '101' })
    useStore.getState().setTag(b, { letters: 'FT', loop: '102' })
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', 'A')
    useStore.getState().setRecordField('FT-102', 'instrument', 'signal.range', 'B')

    useStore.getState().setTag(a, { letters: 'FT', loop: '102' })

    expect(doc().registry?.['FT-101']?.fields['signal.range']).toBe('A')
    expect(doc().registry?.['FT-102']?.fields['signal.range']).toBe('B')
  })

  it('carries a line record across a renumber', () => {
    const s = fresh()
    const id = s.addEdge({
      lineClass: 'process.major',
      source: { x: 0, y: 0 },
      target: { x: 50, y: 0 },
      lineNumber: { size: '6"', spec: 'CS', service: 'CW', seq: '001' },
    })
    useStore.getState().setRecordField('6"-CS-CW-001', 'line', 'spec.material', 'CS')
    useStore.getState().setEdge(id, { lineNumber: { size: '8"', spec: 'CS', service: 'CW', seq: '001' } })
    expect(doc().registry?.['8"-CS-CW-001']?.fields['spec.material']).toBe('CS')
    expect(doc().registry?.['6"-CS-CW-001']).toBeUndefined()
  })

  it('does not copy a record onto a pasted symbol', () => {
    const s = fresh()
    const id = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    useStore.getState().setTag(id, { letters: 'FT', loop: '101' })
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', '0-100')

    const original = nodes()[0]!
    useStore.getState().pasteNodes([original], [])
    // a pasted symbol arrives untagged, so it is a new object needing its own spec
    expect(nodes()).toHaveLength(2)
    expect(nodes()[1]!.tag).toBeUndefined()
    expect(Object.keys(doc().registry ?? {})).toEqual(['FT-101'])
  })
})

describe('pending line endpoints', () => {
  it('closes a free endpoint when a matching tagged device is added', () => {
    const s = fresh()
    const source = s.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 0, y: 0, rotation: 0 })
    const edgeId = useStore.getState().addEdge({
      lineClass: 'process.major',
      source: { nodeId: source, portId: 'e' },
      target: { x: 80, y: 8, pendingTag: 'TK-101' },
      lineNumber: { size: '2"', spec: 'CS', service: 'FW', seq: '001' },
    })
    const device = useStore.getState().addNode({ symbolId: 'valve.gate', kind: 'valve', x: 80, y: 0, rotation: 0 })
    useStore.getState().setTag(device, { letters: 'TK', loop: '101' })
    const edge = useStore.getState().doc.sheets[0]!.edges.find((e) => e.id === edgeId)!
    expect(edge.target).toEqual({ nodeId: device, portId: 'w' })
    expect(edge.lineNumber?.service).toBe('FW')
  })
})

describe('sheet copies', () => {
  it('clones nodes and remaps connected edge endpoints', () => {
    const s = fresh()
    const source = s.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 0, y: 0, rotation: 0 })
    const target = s.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 80, y: 0, rotation: 0 })
    const edge = s.addEdge({
      lineClass: 'process.major',
      source: { nodeId: source, portId: 'e' },
      target: { nodeId: target, portId: 'w' },
    })
    const original = doc().sheets[0]!
    const copy = s.duplicateSheet(original.id, '吹扫方案')!
    const copied = doc().sheets.find((sh) => sh.id === copy.sheetId)!

    expect(copied.name).toBe('吹扫方案')
    expect(copied.nodes.map((n) => n.id)).not.toContain(source)
    expect(copied.nodes).toHaveLength(2)
    expect(copied.edges).toHaveLength(1)
    expect(copied.edges[0]!.id).not.toBe(edge)
    expect(copied.edges[0]!.source).toEqual({ nodeId: copy.nodeIdMap[source], portId: 'e' })
    expect(copied.edges[0]!.target).toEqual({ nodeId: copy.nodeIdMap[target], portId: 'w' })
  })
})

describe('record edits are undoable', () => {
  it('undo restores the previous field value', () => {
    const s = fresh()
    const id = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    useStore.getState().setTag(id, { letters: 'FT', loop: '101' })
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', 'first')
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', 'second')
    expect(doc().registry?.['FT-101']?.fields['signal.range']).toBe('second')

    useStore.getState().undo()
    expect(doc().registry?.['FT-101']?.fields['signal.range']).toBe('first')
  })

  it('purge removes a record outright', () => {
    const s = fresh()
    const id = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0 })
    useStore.getState().setTag(id, { letters: 'FT', loop: '101' })
    useStore.getState().setRecordField('FT-101', 'instrument', 'signal.range', 'x')
    useStore.getState().purgeRecord('FT-101')
    expect(doc().registry?.['FT-101']).toBeUndefined()
  })
})
