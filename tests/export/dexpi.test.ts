import { describe, expect, it } from 'vitest'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import '../../src/symbols/lib/index'
import { dexpiXml } from '../../src/export/dexpi'
import { componentClassFor } from '../../src/export/componentClass'
import { createEmptyDoc } from '../../src/model/doc'

function fixture() {
  const doc = createEmptyDoc('DEXPI <Fixture> & Co')
  const sheet = doc.sheets[0]!
  sheet.drawingNumber = 'PID-42'
  sheet.nodes = [
    { id: 'pump1', symbolId: 'pump.centrifugal', kind: 'equipment', x: 100, y: 200, rotation: 0, label: 'P-101 "main"' },
    { id: 'ft1', symbolId: 'instr.bubble', kind: 'instrument', x: 300, y: 100, rotation: 0, tag: { letters: 'FT', loop: '101' } },
    { id: 'valve1', symbolId: 'valve.gate', kind: 'valve', x: 400, y: 200, rotation: 90 },
  ]
  sheet.edges = [
    {
      id: 'p1', lineClass: 'process.major',
      source: { nodeId: 'pump1', portId: 'discharge' }, target: { nodeId: 'valve1', portId: 'w' },
      vertices: [{ x: 250, y: 208 }],
      lineNumber: { size: '2"', spec: 'CS150', service: 'P', seq: '001' },
    },
    { id: 's1', lineClass: 'signal.electric', source: { nodeId: 'ft1', portId: 'e' }, target: { x: 500, y: 100 } },
  ]
  return doc
}

describe('componentClassFor', () => {
  it('maps known symbols and defaults to PlantItem', () => {
    expect(componentClassFor('pump.centrifugal')).toBe('CentrifugalPump')
    expect(componentClassFor('valve.gate')).toBe('GateValve')
    expect(componentClassFor('instr.bubble')).toBe('ProcessInstrument')
    expect(componentClassFor('ann.cloud')).toBe('PlantItem')
  })
})

describe('dexpiXml', () => {
  const doc = fixture()
  const xml = dexpiXml(doc, doc.sheets[0]!.id)

  it('is well-formed XML with a PlantModel root and PlantInformation', () => {
    expect(XMLValidator.validate(xml)).toBe(true)
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml)
    expect(parsed.PlantModel).toBeDefined()
    expect(parsed.PlantModel.PlantInformation['@_Application']).toBe('PID Studio')
    expect(parsed.PlantModel.Drawing['@_Name']).toBe('Sheet 1')
  })

  it('exports equipment, instruments, piping, and signals', () => {
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml)
    const pm = parsed.PlantModel
    const equipment = [pm.Equipment].flat()
    expect(equipment).toHaveLength(2)
    expect(equipment[0]['@_ID']).toBe('pump1')
    expect(equipment[0]['@_ComponentClass']).toBe('CentrifugalPump')
    expect(equipment[0].Position.Location['@_X']).toBe('100')
    expect(pm.ProcessInstrument['@_TagName']).toBe('FT-101')
    const seg = pm.PipingNetworkSystem.PipingNetworkSegment
    expect(seg.Connection['@_FromID']).toBe('pump1')
    expect(seg.Connection['@_ToID']).toBe('valve1')
    expect(pm.InformationFlow['@_ID']).toBe('s1')
  })

  it('escapes special characters', () => {
    expect(xml).toContain('P-101 &quot;main&quot;')
    expect(xml).not.toContain('DEXPI <Fixture>')
  })
})
