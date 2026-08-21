import { describe, expect, it } from 'vitest'
import { parseDxfUnderlay } from '../../src/import/dxfUnderlay'

const MINI_DXF = [
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '100', '21', '50',
  '0', 'CIRCLE', '8', '0', '10', '50', '20', '50', '40', '25',
  '0', 'POINT', '8', '0', '10', '1', '20', '1',
  '0', 'ENDSEC', '0', 'EOF', '',
].join('\n')

describe('parseDxfUnderlay', () => {
  it('flattens LINE and CIRCLE to polylines, warns on unsupported', () => {
    const { polylines, warnings } = parseDxfUnderlay(MINI_DXF, { w: 1000, h: 700 })
    expect(polylines.length).toBe(2)
    const line = polylines.find((p) => p.length === 2)!
    expect(line).toBeDefined()
    const circle = polylines.find((p) => p.length > 10)!
    expect(circle).toBeDefined()
    expect(warnings.some((w) => w.includes('POINT'))).toBe(true)
  })
  it('scales into the sheet with margin, preserving aspect', () => {
    const { polylines } = parseDxfUnderlay(MINI_DXF, { w: 1000, h: 700 })
    const all = polylines.flat()
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(24)
    expect(Math.max(...xs)).toBeLessThanOrEqual(1000 - 24)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(24)
    expect(Math.max(...ys)).toBeLessThanOrEqual(700 - 24)
  })
  it('throws on garbage', () => {
    expect(() => parseDxfUnderlay('hello world', { w: 100, h: 100 })).toThrow()
  })
})
