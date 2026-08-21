import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { dxfForSheet } from '../../src/export/dxf'
import { createEmptyDoc } from '../../src/model/doc'
import { sheetPx } from '../../src/model/doc'

function fixture() {
  const doc = createEmptyDoc('DXF Test')
  const sheet = doc.sheets[0]!
  sheet.nodes = [
    { id: 'p1', symbolId: 'pump.centrifugal', kind: 'equipment', x: 100, y: 200, rotation: 0, label: 'P-101' },
    { id: 'ft', symbolId: 'instr.bubble', kind: 'instrument', x: 300, y: 100, rotation: 0, tag: { letters: 'FT', loop: '101' } },
  ]
  sheet.edges = [
    {
      id: 'e1', lineClass: 'process.major',
      source: { x: 40, y: 40 }, target: { x: 200, y: 120 },
      vertices: [{ x: 120, y: 40 }],
    },
    { id: 'e2', lineClass: 'signal.electric', source: { x: 0, y: 0 }, target: { x: 50, y: 0 } },
  ]
  return doc
}

describe('dxfForSheet', () => {
  const doc = fixture()
  const dxf = dxfForSheet(doc, doc.sheets[0]!.id)
  const sheetH = sheetPx('A3').h

  it('has R12 structure and EOF', () => {
    expect(dxf.startsWith('999\n')).toBe(true)
    expect(dxf).toContain('0\nSECTION\n2\nTABLES')
    expect(dxf).toContain('0\nSECTION\n2\nENTITIES')
    expect(dxf.trimEnd().endsWith('0\nEOF')).toBe(true)
  })
  it('declares the five layers', () => {
    for (const layer of ['PROCESS', 'SIGNAL', 'SYMBOLS', 'TEXT', 'FRAME']) {
      expect(dxf).toContain(`2\n${layer}`)
    }
  })
  it('writes edge polylines with y flipped, on the right layer', () => {
    expect(dxf).toContain('0\nPOLYLINE\n8\nPROCESS')
    expect(dxf).toContain('0\nPOLYLINE\n8\nSIGNAL')
    // free-end source (40,40): dxf y = sheetH - 40
    expect(dxf).toContain(`10\n40\n20\n${Math.round((sheetH - 40) * 100) / 100}`)
    // 3 vertices for the process edge: source + 1 waypoint + target
    const processBlock = dxf.slice(dxf.indexOf('0\nPOLYLINE\n8\nPROCESS'))
    const upTo = processBlock.slice(0, processBlock.indexOf('SEQEND'))
    expect((upTo.match(/0\nVERTEX/g) ?? []).length).toBe(3)
  })
  it('renders symbol circles and tag text', () => {
    expect(dxf).toContain('0\nCIRCLE\n8\nSYMBOLS')
    expect(dxf).toContain('0\nTEXT\n8\nTEXT')
    expect(dxf).toContain('1\nFT-101')
    expect(dxf).toContain('1\nP-101')
  })
})
