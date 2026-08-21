import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { DATASHEET_SECTIONS, fieldsFor } from '../../src/model/datasheet'
import { datasheetMatrixCsv } from '../../src/export/csv'
import { createEmptyDoc } from '../../src/model/doc'

describe('datasheet model', () => {
  it('has stable sections with keyed fields', () => {
    expect(Object.keys(DATASHEET_SECTIONS)).toEqual(['general', 'process', 'element', 'signal'])
    expect(DATASHEET_SECTIONS.process.some((f) => f.key === 'process.fluid')).toBe(true)
  })
  it('prunes process rows for hand switches', () => {
    const hs = fieldsFor('HS')
    expect(hs.process).toEqual([])
    expect(fieldsFor('FT').process.length).toBeGreaterThan(0)
  })
})

describe('datasheetMatrixCsv', () => {
  it('one row per instrument, columns only for populated keys', () => {
    const doc = createEmptyDoc('t')
    doc.sheets[0]!.nodes = [
      {
        id: 'a', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0,
        tag: { letters: 'FT', loop: '101' },
        datasheet: { 'process.fluid': 'Cooling water', 'process.flow.norm': '120 m3/h' },
      },
      { id: 'b', symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters: 'PT', loop: '102' } },
      { id: 'c', symbolId: 'pump.centrifugal', kind: 'equipment', x: 0, y: 0, rotation: 0 },
    ]
    const csv = datasheetMatrixCsv(doc)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // header + 2 instruments
    expect(lines[0]).toContain('process.fluid')
    expect(lines[0]).not.toContain('element.material')
    expect(lines[1]).toContain('Cooling water')
  })
})
