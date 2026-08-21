import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { instrumentIndexCsv, lineListCsv } from '../../src/export/csv'
import { createEmptyDoc } from '../../src/model/doc'

function fixture() {
  const doc = createEmptyDoc('Fixture')
  doc.sheets[0]!.nodes = [
    { id: 'ft', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters: 'FT', loop: '101' } },
    { id: 'fic', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters: 'FIC', loop: '101' }, label: 'Feed, "main" line' },
    { id: 'pump', symbolId: 'pump.centrifugal', kind: 'equipment', x: 0, y: 0, rotation: 0, label: 'P-101' },
  ]
  doc.sheets[0]!.edges = [
    { id: 'e1', lineClass: 'signal.electric', source: { nodeId: 'ft', portId: 'e' }, target: { nodeId: 'fic', portId: 'w' } },
    { id: 'e2', lineClass: 'process.major', source: { nodeId: 'pump', portId: 'discharge' }, target: { x: 10, y: 10 }, lineNumber: { size: '2"', spec: 'CS150', service: 'P', seq: '001' } },
  ]
  return doc
}

describe('instrumentIndexCsv', () => {
  it('produces one row per tagged instrument with expansion and connections', () => {
    const csv = instrumentIndexCsv(fixture())
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('Tag,Description,Loop,Symbol,Sheet,Connected To,Notes')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('FT-101')
    expect(lines[1]).toContain('Flow Transmitter')
    expect(lines[1]).toContain('FIC-101')
  })
  it('quotes fields containing commas and quotes', () => {
    const csv = instrumentIndexCsv(fixture())
    expect(csv).toContain('"Feed, ""main"" line"')
  })
})

describe('lineListCsv', () => {
  it('lists numbered lines with endpoints', () => {
    const csv = lineListCsv(fixture())
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('Line Number,Class,Size,Spec,Service,Seq,Sheet,From,To')
    expect(lines[1]).toContain('"2""-CS150-P-001"')
    expect(lines[1]).toContain('P-101')
    expect(lines[1]).toContain('free end')
  })
})
