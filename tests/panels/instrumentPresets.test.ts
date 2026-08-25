import { describe, expect, it } from 'vitest'
import { INSTRUMENT_PRESETS, TOP_PRESET_LETTERS, searchPalette } from '../../src/panels/instrumentPresets'
import '../../src/symbols/lib/index'

describe('instrument preset table', () => {
  it('covers the full measurement families', () => {
    const groups = new Set(INSTRUMENT_PRESETS.map((p) => p.group))
    for (const g of ['Flow', 'Pressure', 'Level', 'Temperature', 'Analysis', 'Other']) {
      expect([...groups], g).toContain(g)
    }
    // element, transmitter, indicator, controller, converter, switches per main family
    for (const fam of ['F', 'P', 'L', 'T']) {
      const letters = INSTRUMENT_PRESETS.filter((p) => p.letters.startsWith(fam)).map((p) => p.letters)
      for (const suffix of ['T', 'IT', 'I', 'IC', 'Y', 'SH', 'SL']) {
        expect(letters, `${fam}${suffix}`).toContain(`${fam}${suffix}`)
      }
    }
    expect(INSTRUMENT_PRESETS.map((p) => p.letters)).toContain('FE')
    expect(INSTRUMENT_PRESETS.map((p) => p.letters)).toContain('TE')
  })

  it('letters are valid unique ISA tags and every preset has a full name', () => {
    const seen = new Set<string>()
    for (const p of INSTRUMENT_PRESETS) {
      expect(p.letters, p.letters).toMatch(/^[A-Z]{2,4}$/)
      expect(seen.has(p.letters), `duplicate ${p.letters}`).toBe(false)
      seen.add(p.letters)
      expect(p.name.length, p.letters).toBeGreaterThan(3)
    }
  })

  it('the quick row exists in the table and stays small', () => {
    expect(TOP_PRESET_LETTERS.length).toBeGreaterThanOrEqual(5)
    expect(TOP_PRESET_LETTERS.length).toBeLessThanOrEqual(10)
    const all = new Set(INSTRUMENT_PRESETS.map((p) => p.letters))
    for (const l of TOP_PRESET_LETTERS) expect(all.has(l), l).toBe(true)
  })
})

describe('searchPalette', () => {
  it('shortcut letters rank the preset first', () => {
    const hits = searchPalette('FT')
    expect(hits[0]).toMatchObject({ symbolId: 'instr.bubble', presetLetters: 'FT' })
    // prefix matches follow the exact one: FI finds FI, then FIC/FIT
    const fi = searchPalette('FI')
    expect(fi[0]).toMatchObject({ presetLetters: 'FI' })
    expect(fi.slice(1, 4).map((h) => h.presetLetters)).toContain('FIT')
    expect(fi.slice(1, 4).map((h) => h.presetLetters)).toContain('FIC')
  })

  it('full instrument names are searchable', () => {
    const hits = searchPalette('flow transmitter')
    expect(hits[0]).toMatchObject({ presetLetters: 'FT' })
    expect(searchPalette('pressure indicating controller')[0]).toMatchObject({ presetLetters: 'PIC' })
    expect(searchPalette('level switch high')[0]).toMatchObject({ presetLetters: 'LSH' })
  })

  it('still finds plain symbols by name, keyword, and id', () => {
    expect(searchPalette('gate').some((h) => h.symbolId === 'valve.gate')).toBe(true)
    expect(searchPalette('stirrer').some((h) => h.symbolId === 'agitator')).toBe(true)
    expect(searchPalette('hx.plate').some((h) => h.symbolId === 'hx.plate')).toBe(true)
  })

  it('case-insensitive and trimmed', () => {
    expect(searchPalette('  tic ')[0]).toMatchObject({ presetLetters: 'TIC' })
  })
})
