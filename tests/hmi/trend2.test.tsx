import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Trend, { PEN_COLORS, trendWindow } from '../../src/hmi/widgets/trend'
import { THEMES } from '../../src/hmi/theme'
import type { HmiWidget } from '../../src/hmi/model'

describe('trendWindow', () => {
  const ts = [0, 1, 2, 3, 10, 11, 12] // non-uniform: a speed change happened
  it('windows by time, not by sample count', () => {
    expect(trendWindow(ts, 3, 12)).toBe(4) // [9..12] -> first t >= 9 is ts[4]=10
    expect(trendWindow(ts, 100, 12)).toBe(0)
    expect(trendWindow(ts, 0.5, 12)).toBe(6)
  })
  it('empty history yields an empty window', () => {
    expect(trendWindow([], 60, 0)).toBe(0)
  })
})

const widget: HmiWidget = {
  id: 't1', type: 'trend', x: 0, y: 0, w: 192, h: 96, tag: 'FT-1',
  props: { min: 0, max: 100, span: 60 },
  pens: [{ ref: 'LIC-1.SP' }],
}

const hist = {
  t: [0, 0.2, 0.4, 0.6],
  series: {
    'FT-1.PV': [10, 20, 30, 40],
    'LIC-1.SP': [50, 50, 55, 55],
  },
}

describe('multi-pen trend', () => {
  const html = renderToStaticMarkup(
    <svg>{<Trend widget={widget} theme={THEMES.classic} sim={{ PV: 40 }} hist={hist} />}</svg>,
  )
  it('draws one polyline per pen in distinct colors', () => {
    expect(html.match(/<polyline/g)!.length).toBe(2)
    expect(html).toContain(PEN_COLORS[0]!)
    expect(html).toContain(PEN_COLORS[1]!)
  })
  it('legend names both pens (PV suffix trimmed) with live values', () => {
    expect(html).toContain('FT-1 40')
    expect(html).toContain('LIC-1.SP 55')
  })
  it('renders a time axis in mm:ss', () => {
    expect(html).toContain('00:00')
  })
  it('a pen with no recorded series simply draws nothing', () => {
    const w2: HmiWidget = { ...widget, pens: [{ ref: 'GHOST.OP' }] }
    const h2 = renderToStaticMarkup(
      <svg>{<Trend widget={w2} theme={THEMES.classic} sim={{ PV: 40 }} hist={hist} />}</svg>,
    )
    expect(h2.match(/<polyline/g)!.length).toBe(1)
  })
})

describe('display sparkline', () => {
  it('renders when props.spark is on and history exists', async () => {
    const { default: Display } = await import('../../src/hmi/widgets/display')
    const w: HmiWidget = { id: 'd', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'FT-1', props: { spark: true } }
    const html = renderToStaticMarkup(
      <svg>{<Display widget={w} theme={THEMES.classic} sim={{ PV: 40 }} hist={hist} />}</svg>,
    )
    expect(html).toContain('data-spark')
    const off = renderToStaticMarkup(
      <svg>{<Display widget={{ ...w, props: {} }} theme={THEMES.classic} sim={{ PV: 40 }} hist={hist} />}</svg>,
    )
    expect(off).not.toContain('data-spark')
  })
})
