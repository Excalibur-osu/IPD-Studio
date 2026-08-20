import { describe, expect, it } from 'vitest'
import '../../src/symbols/lib/index'
import { getSymbol } from '../../src/symbols/registry'

const bubble = () => getSymbol('instr.bubble')
const displays = ['discrete', 'shared', 'computer', 'plc'] as const
const locations = ['field', 'control-room', 'behind-panel', 'local-panel'] as const

describe('instrument bubble', () => {
  it('registers with 4 both-kind ports on the grid', () => {
    const def = bubble()
    expect(def.gridSize).toEqual({ w: 5, h: 5 })
    expect(def.ports).toHaveLength(4)
    expect(def.ports.every((p) => p.kind === 'both')).toBe(true)
    expect(def.ports.every((p) => p.x % 4 === 0 && p.y % 4 === 0)).toBe(true)
  })

  it('renders all 16 display x location variants distinctly', () => {
    const seen = new Set<string>()
    for (const display of displays) {
      for (const location of locations) {
        const svg = bubble().render({ display, location })
        expect(seen.has(svg)).toBe(false)
        seen.add(svg)
      }
    }
    expect(seen.size).toBe(16)
  })

  it('discrete/field is a plain circle', () => {
    const svg = bubble().render({ display: 'discrete', location: 'field' })
    expect(svg).toContain('<circle')
    expect(svg).not.toContain('<rect')
    expect(svg).not.toContain('<polygon')
    expect(svg).not.toContain('<line')
  })

  it('shared adds a square, computer a hexagon, plc a diamond in square', () => {
    expect(bubble().render({ display: 'shared', location: 'field' })).toContain('<rect')
    expect(bubble().render({ display: 'computer', location: 'field' })).toContain('<polygon')
    const plc = bubble().render({ display: 'plc', location: 'field' })
    expect(plc).toContain('<rect')
    expect(plc).toContain('<polygon')
  })

  it('location renders the ISA panel-access line', () => {
    const cr = bubble().render({ display: 'discrete', location: 'control-room' })
    expect(cr).toMatch(/<line[^>]*y1="20"[^>]*y2="20"/)
    expect(cr).not.toContain('dasharray')
    const bp = bubble().render({ display: 'discrete', location: 'behind-panel' })
    expect(bp).toContain('stroke-dasharray')
    const lp = bubble().render({ display: 'discrete', location: 'local-panel' })
    expect((lp.match(/<line/g) ?? []).length).toBe(2)
  })
})
