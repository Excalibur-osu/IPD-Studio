import { describe, expect, it } from 'vitest'
import type { PlantNode, ProjectDoc, Sheet } from '../../src/model/types'
import { createEmptyDoc } from '../../src/model/doc'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'
import { listPlantTags, listSignalRefs, parseSignalRef, signalsFor } from '../../src/hmi/tagIndex'
// fill the symbol registry so category classification works
import '../../src/symbols/lib/index'

const N = (id: string, symbolId: string, kind: PlantNode['kind'], extra?: Partial<PlantNode>): PlantNode =>
  ({ id, symbolId, kind, x: 0, y: 0, rotation: 0, ...extra })

const VESSEL = 'vessel.tank', PUMP = 'pump.centrifugal', CV = 'cv.globe', GV = 'valve.gate', BUBBLE = 'instr.bubble'

function docWith(nodes: PlantNode[], more?: PlantNode[]): ProjectDoc {
  const doc = createEmptyDoc()
  doc.sheets[0] = { ...doc.sheets[0]!, nodes }
  if (more) {
    const s2: Sheet = { ...doc.sheets[0]!, id: 'sh2', name: 'Sheet 2', nodes: more }
    doc.sheets.push(s2)
  }
  return doc
}

const W = (type: HmiWidget['type'], tag?: string, props?: HmiWidget['props']): Omit<HmiWidget, 'id'> & { id: string } =>
  ({ id: `w-${type}-${tag ?? 'x'}`, type, x: 0, y: 0, w: 40, h: 40, tag, props })

const screenWith = (widgets: HmiWidget[]): HmiScreen =>
  ({ id: 's1', name: 'S1', theme: 'classic', widgets, pipes: [] })

describe('listPlantTags', () => {
  it('classifies nodes into HMI roles by tag letters and category', () => {
    const tags = listPlantTags(docWith([
      N('1', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '101' } }),
      N('2', BUBBLE, 'instrument', { tag: { letters: 'LIC', loop: '200' } }),
      N('3', PUMP, 'equipment', { tag: { letters: 'P', loop: '101' } }),
      N('4', VESSEL, 'equipment', { tag: { letters: 'TK', loop: '1' } }),
      N('5', CV, 'valve', { tag: { letters: 'LV', loop: '200' } }),
    ]))
    const by = Object.fromEntries(tags.map((t) => [t.display, t]))
    expect(by['FT-101']!.role).toBe('measurement')
    expect(by['FT-101']!.description).toContain('Flow')
    expect(by['LIC-200']!.role).toBe('controller')
    expect(by['P-101']!.role).toBe('motor')
    expect(by['TK-1']!.role).toBe('equipment')
    expect(by['LV-200']!.role).toBe('valve')
  })

  it('skips unbindable nodes: annotations, …Y hardware, unnamed valves', () => {
    const tags = listPlantTags(docWith([
      N('1', 'ann.note', 'annotation', { label: 'note' }),
      N('2', BUBBLE, 'instrument', { tag: { letters: 'FY', loop: '101' } }),
      N('3', GV, 'valve'), // no tag, no label
      N('4', BUBBLE, 'instrument'), // untagged bubble
    ]))
    expect(tags).toHaveLength(0)
  })

  it('includes labeled-but-untagged equipment by label', () => {
    const tags = listPlantTags(docWith([N('1', VESSEL, 'equipment', { label: 'Feed Drum' })]))
    expect(tags).toHaveLength(1)
    expect(tags[0]).toMatchObject({ display: 'Feed Drum', role: 'equipment', letters: '' })
  })

  it('dedupes across sheets keeping the first hit, and honors the separator', () => {
    const doc = docWith(
      [N('1', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '101' } })],
      [N('9', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '101' } })],
    )
    const tags = listPlantTags(doc)
    expect(tags).toHaveLength(1)
    expect(tags[0]!.sheetId).toBe(doc.sheets[0]!.id)

    doc.settings.tagSeparator = ''
    expect(listPlantTags(doc)[0]!.display).toBe('FT101')
  })

  it('sorts numerically within names', () => {
    const tags = listPlantTags(docWith([
      N('1', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '10' } }),
      N('2', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '2' } }),
    ]))
    expect(tags.map((t) => t.display)).toEqual(['FT-2', 'FT-10'])
  })
})

describe('signalsFor / parseSignalRef', () => {
  it('maps roles to their runtime signals', () => {
    expect(signalsFor('measurement')).toEqual(['PV'])
    expect(signalsFor('controller')).toEqual(['PV', 'SP', 'OP', 'MODE'])
    expect(signalsFor('motor')).toEqual(['RUN'])
    expect(signalsFor('valve')).toEqual(['OP', 'OPEN'])
    expect(signalsFor('equipment')).toEqual(['PV'])
  })

  it('splits TAG.SIGNAL at the last dot only', () => {
    expect(parseSignalRef('P-101.RUN')).toEqual({ tag: 'P-101', signal: 'RUN' })
    expect(parseSignalRef('A.B.C')).toEqual({ tag: 'A.B', signal: 'C' })
    expect(parseSignalRef('nodot')).toBeNull()
    expect(parseSignalRef('.RUN')).toBeNull()
    expect(parseSignalRef('P-101.')).toBeNull()
  })
})

describe('listSignalRefs', () => {
  it('unions widget-derived signals with plant tags, widgets first', () => {
    const doc = docWith([
      N('1', PUMP, 'equipment', { tag: { letters: 'P', loop: '101' } }),
      N('2', BUBBLE, 'instrument', { tag: { letters: 'FT', loop: '5' } }),
    ])
    doc.hmiScreens = [screenWith([
      W('pump', 'P-9'),
      W('pump', 'P-101'), // overlaps the plant tag
      W('valve', 'HV-1'),
      W('display', 'XI-1'),
    ])]
    const refs = listSignalRefs(doc)
    const by = Object.fromEntries(refs.map((r) => [r.ref, r]))
    expect(by['P-9.RUN']!.source).toBe('hmi')
    expect(by['HV-1.OPEN']!.source).toBe('hmi') // on/off valve exposes OPEN
    expect(by['XI-1.PV']!.source).toBe('hmi')
    expect(by['FT-5.PV']!.source).toBe('pid')
    // overlap resolves to the widget entry, not a duplicate
    expect(refs.filter((r) => r.ref === 'P-101.RUN')).toHaveLength(1)
    expect(by['P-101.RUN']!.source).toBe('hmi')
  })
})
