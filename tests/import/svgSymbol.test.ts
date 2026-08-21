import { describe, expect, it } from 'vitest'
import { sanitizeSvg, SvgImportError } from '../../src/import/svgSymbol'

describe('sanitizeSvg', () => {
  it('strips scripts, event handlers, and external refs but keeps geometry', () => {
    const raw = `<svg viewBox="0 0 100 50">
      <script>alert(1)</script>
      <circle cx="20" cy="20" r="10" onclick="evil()" fill="red"/>
      <image href="https://evil.example/x.png"/>
      <path d="M0 0 L100 50" stroke="black"/>
      <foreignObject><div>html</div></foreignObject>
    </svg>`
    const { svg, warnings } = sanitizeSvg(raw)
    expect(svg).toContain('<circle')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('script')
    expect(svg).not.toContain('onclick')
    expect(svg).not.toContain('image')
    expect(svg).not.toContain('foreignObject')
    expect(warnings.length).toBeGreaterThan(0)
  })
  it('scales the viewBox into grid units with the major side <= 96px', () => {
    const { gridSize } = sanitizeSvg('<svg viewBox="0 0 200 100"><rect x="0" y="0" width="200" height="100"/></svg>')
    expect(gridSize).toEqual({ w: 12, h: 6 })
  })
  it('handles svg without viewBox via width/height attributes', () => {
    const { gridSize } = sanitizeSvg('<svg width="50" height="50"><circle cx="25" cy="25" r="20"/></svg>')
    expect(gridSize.w).toBeGreaterThan(0)
  })
  it('throws when nothing drawable remains', () => {
    expect(() => sanitizeSvg('<svg viewBox="0 0 10 10"><script>x</script></svg>')).toThrow(SvgImportError)
    expect(() => sanitizeSvg('not svg at all')).toThrow(SvgImportError)
  })
  it('normalizes stroke color to currentColor', () => {
    const { svg } = sanitizeSvg('<svg viewBox="0 0 40 40"><path d="M0 0 L40 40" stroke="#ff0000"/></svg>')
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).not.toContain('#ff0000')
  })
})

import { registerCustomSymbols } from '../../src/symbols/custom'
import { getSymbol, SYMBOLS } from '../../src/symbols/registry'
import { createEmptyDoc } from '../../src/model/doc'
import { deserializeDoc, serializeDoc } from '../../src/persist/file'

describe('custom symbol round-trip', () => {
  it('registers, serializes, and re-registers through save/load', async () => {
    await import('../../src/symbols/lib/index')
    const doc = createEmptyDoc('t')
    doc.customSymbols = [{
      id: 'custom.test1', name: 'My Widget', svg: '<circle cx="16" cy="16" r="14" stroke="currentColor" fill="none"/>',
      gridSize: { w: 4, h: 4 }, ports: [{ id: 'p1', x: 0, y: 16, kind: 'process' }], tagRule: 'equipment', keywords: ['custom'],
    }]
    registerCustomSymbols(doc)
    expect(getSymbol('custom.test1').name).toBe('My Widget')
    const loaded = deserializeDoc(serializeDoc(doc))
    expect(loaded.customSymbols).toHaveLength(1)
    registerCustomSymbols(createEmptyDoc('empty'))
    expect(SYMBOLS.has('custom.test1')).toBe(false)
    registerCustomSymbols(loaded)
    expect(SYMBOLS.has('custom.test1')).toBe(true)
  })
})
