import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { dexpiXml } from '../../src/export/dexpi'
import { DexpiImportError, importDexpi } from '../../src/import/dexpi'
import { createEmptyDoc } from '../../src/model/doc'

function fixture() {
  const doc = createEmptyDoc('RT')
  const sheet = doc.sheets[0]!
  sheet.nodes = [
    { id: 'p1', symbolId: 'pump.centrifugal', kind: 'equipment', x: 96, y: 200, rotation: 90, label: 'P-1' },
    { id: 'ft', symbolId: 'instr.bubble', kind: 'instrument', x: 296, y: 96, rotation: 0, config: { display: 'shared', location: 'control-room' }, tag: { letters: 'FT', loop: '101', suffix: 'A' } },
  ]
  sheet.edges = [
    { id: 'e1', lineClass: 'process.major', source: { nodeId: 'p1', portId: 'discharge' }, target: { x: 400, y: 200 }, lineNumber: { size: '2"', spec: 'CS', service: 'P', seq: '001' } },
    { id: 's1', lineClass: 'signal.pneumatic', source: { nodeId: 'ft', portId: 'e' }, target: { x: 480, y: 96 } },
  ]
  return doc
}

describe('importDexpi round-trip', () => {
  it('restores PID Studio exports (symbols, tags, positions, line classes)', () => {
    const doc = fixture()
    const xml = dexpiXml(doc, doc.sheets[0]!.id)
    const { sheet, warnings } = importDexpi(xml)
    expect(warnings).toEqual([])
    expect(sheet.nodes).toHaveLength(2)
    const pump = sheet.nodes.find((n) => n.symbolId === 'pump.centrifugal')!
    expect(pump.x).toBe(96)
    expect(pump.rotation).toBe(90)
    const ft = sheet.nodes.find((n) => n.symbolId === 'instr.bubble')!
    expect(ft.tag).toEqual({ letters: 'FT', loop: '101', suffix: 'A' })
    expect(ft.config).toEqual({ display: 'shared', location: 'control-room' })
    expect(ft.kind).toBe('instrument')
    const proc = sheet.edges.find((e) => e.lineClass === 'process.major')!
    expect('nodeId' in proc.source && proc.source.portId).toBe('discharge')
    expect(sheet.edges.find((e) => e.lineClass === 'signal.pneumatic')).toBeDefined()
  })
  it('imports foreign files via ComponentClass with warnings', () => {
    const foreign = `<?xml version="1.0"?><PlantModel>
      <PlantInformation Application="OtherTool"/>
      <Equipment ID="x1" TagName="P-9" ComponentClass="CentrifugalPump">
        <Position><Location X="50" Y="60"/></Position>
      </Equipment>
      <Equipment ID="x2" TagName="Mystery" ComponentClass="FluxCapacitor">
        <Position><Location X="10" Y="10"/></Position>
      </Equipment>
    </PlantModel>`
    const { sheet, warnings } = importDexpi(foreign)
    expect(sheet.nodes.find((n) => n.id === 'x1')!.symbolId).toBe('pump.centrifugal')
    expect(warnings.some((w) => w.includes('FluxCapacitor'))).toBe(true)
  })
  it('throws typed errors on malformed input', () => {
    expect(() => importDexpi('not xml <<')).toThrow(DexpiImportError)
    expect(() => importDexpi('<Other/>')).toThrow(DexpiImportError)
  })
})
