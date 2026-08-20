import { describe, expect, it } from 'vitest'
import { expandLetters, formatTag, parseTag, validateLetters } from '../../src/isa/tag'

describe('parseTag', () => {
  it('parses letters-loop-suffix with separator', () => {
    expect(parseTag('FIC-101A')).toEqual({ letters: 'FIC', loop: '101', suffix: 'A' })
  })
  it('parses without separator and without suffix', () => {
    expect(parseTag('PT205')).toEqual({ letters: 'PT', loop: '205' })
  })
  it('normalizes lowercase input', () => {
    expect(parseTag('fic-101')).toEqual({ letters: 'FIC', loop: '101' })
  })
  it('rejects garbage', () => {
    expect(parseTag('101-FIC')).toBeNull()
    expect(parseTag('')).toBeNull()
    expect(parseTag('FIC-')).toBeNull()
  })
})

describe('formatTag', () => {
  it('formats with and without separator', () => {
    expect(formatTag({ letters: 'FT', loop: '101', suffix: 'B' }, '-')).toBe('FT-101B')
    expect(formatTag({ letters: 'FT', loop: '101' }, '')).toBe('FT101')
  })
})

describe('validateLetters — valid combinations', () => {
  const valid = [
    'FT', 'FE', 'FI', 'FIC', 'FIT', 'FQI', 'FQIC', 'FFIC', 'FV', 'FCV', 'FO',
    'PT', 'PI', 'PIT', 'PIC', 'PG', 'PDT', 'PDI', 'PDIC', 'PSV', 'PSE', 'PCV', 'PSH', 'PSL', 'PAHH',
    'LT', 'LIT', 'LIC', 'LG', 'LSHH', 'LSLL', 'LAH', 'LV', 'LCV',
    'TT', 'TIT', 'TIC', 'TE', 'TW', 'TI', 'TAH', 'TSV', 'TCV', 'TDT',
    'AT', 'AIT', 'AE', 'HS', 'HV', 'XV', 'ZSC', 'ZSO', 'ZT', 'SC', 'SIC', 'ST',
    'WT', 'WIT', 'VT', 'UY', 'YIC', 'IT', 'JI', 'KIC', 'BE', 'RE', 'EIT', 'QIT', 'GT', 'MT', 'NT', 'OT', 'CT', 'DT',
  ]
  for (const letters of valid) {
    it(`accepts ${letters}`, () => {
      const r = validateLetters(letters)
      expect(r.ok, r.ok ? '' : r.reason).toBe(true)
    })
  }
})

describe('validateLetters — invalid combinations', () => {
  const invalid: [string, RegExp][] = [
    ['', /empty/i],
    ['F', /at least two/i],
    ['FICALT', /at most five/i],
    ['Fic', /uppercase/i],
    ['F1C', /uppercase letters only/i],
    ['FZZ', /Z/],
    ['FHC', /H/],
    ['FCH2', /uppercase letters only/i],
  ]
  for (const [letters, re] of invalid) {
    it(`rejects "${letters}"`, () => {
      const r = validateLetters(letters)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(re)
    })
  }
})

describe('validateLetters — part roles', () => {
  it('marks PD as measured+modifier', () => {
    const r = validateLetters('PDT')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.parts.map((p) => p.role)).toEqual(['measured', 'modifier', 'function'])
  })
  it('treats S as Safety only before V/E', () => {
    const psv = validateLetters('PSV')
    if (psv.ok) expect(psv.parts[1]?.role).toBe('modifier')
    const psh = validateLetters('PSH')
    if (psh.ok) expect(psh.parts[1]?.role).toBe('function')
  })
  it('flags user-choice letters as such', () => {
    const r = validateLetters('CT')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.parts[0]?.word).toMatch(/user/i)
  })
})

describe('expandLetters', () => {
  const cases: [string, string][] = [
    ['FIC', 'Flow Indicating Controller'],
    ['PDT', 'Pressure Differential Transmitter'],
    ['LSHH', 'Level Switch High-High'],
    ['ZSO', 'Position Switch Open'],
    ['PSV', 'Pressure Safety Valve'],
    ['PCV', 'Pressure Control Valve'],
    ['FT', 'Flow Transmitter'],
    ['TE', 'Temperature Element'],
    ['TW', 'Temperature Well'],
    ['PG', 'Pressure Gauge'],
    ['HS', 'Hand Switch'],
    ['FQI', 'Flow Totalizing Indicator'],
    ['TAH', 'Temperature Alarm High'],
    ['FRC', 'Flow Recording Controller'],
  ]
  for (const [letters, words] of cases) {
    it(`${letters} -> ${words}`, () => {
      expect(expandLetters(letters)).toBe(words)
    })
  }
  it('best-effort expands invalid letters', () => {
    expect(expandLetters('FZZ')).toContain('Flow')
  })
})
