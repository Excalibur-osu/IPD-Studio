import { describe, expect, it } from 'vitest'
import { parseSvgToMarkup } from '../../src/canvas/markupParser'

describe('parseSvgToMarkup', () => {
  it('parses flat shapes with attributes', () => {
    const out = parseSvgToMarkup('<circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ tagName: 'circle', attributes: { cx: '20', r: '18' } })
  })
  it('parses siblings', () => {
    const out = parseSvgToMarkup('<path d="M0 0"/><rect x="1" y="2" width="3" height="4"/>')
    expect(out.map((n) => (typeof n === 'string' ? n : n.tagName))).toEqual(['path', 'rect'])
  })
  it('parses nested groups with transforms', () => {
    const out = parseSvgToMarkup('<g transform="translate(0 24)"><path d="M0 0"/><circle cx="16" cy="8" r="4"/></g>')
    const g = out[0]!
    expect(typeof g).not.toBe('string')
    if (typeof g !== 'string') {
      expect(g.tagName).toBe('g')
      expect(g.attributes?.transform).toBe('translate(0 24)')
      expect(g.children).toHaveLength(2)
    }
  })
  it('parses text content', () => {
    const out = parseSvgToMarkup('<text x="16" y="9.5" font-size="10">M</text>')
    const t = out[0]!
    if (typeof t !== 'string') {
      expect(t.tagName).toBe('text')
      expect(t.children).toEqual(['M'])
    }
  })
  it('every registered symbol parses cleanly', async () => {
    await import('../../src/symbols/lib/index')
    const { SYMBOLS } = await import('../../src/symbols/registry')
    for (const def of SYMBOLS.values()) {
      const svg = def.render(def.defaultConfig ?? {})
      expect(() => parseSvgToMarkup(svg), def.id).not.toThrow()
    }
  })
})
