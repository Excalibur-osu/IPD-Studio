import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`
const text = (x: number, y: number, t: string, size = 8) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">${t}</text>`

function inline(
  id: string,
  name: string,
  w: number,
  h: number,
  y: number,
  render: SymbolDef['render'],
  keywords: string[],
  tagRule: SymbolDef['tagRule'] = 'none',
): SymbolDef {
  return {
    id,
    name,
    category: 'inline',
    gridSize: { w: w / 8, h: h / 8 },
    render,
    ports: [
      { id: 'w', x: 0, y, kind: 'process' },
      { id: 'e', x: w, y, kind: 'process' },
    ],
    tagRule,
    keywords,
  }
}

export const inlineItems: SymbolDef[] = [
  inline('strainer.y', 'Y-Strainer', 32, 24, 4,
    () => path('M0 4 H32') + path('M12 4 L20 20 L28 12'),
    ['strainer', 'y-strainer', 'filter']),

  {
    id: 'filter.cartridge',
    name: 'Filter',
    category: 'inline',
    gridSize: { w: 4, h: 6 },
    render: () =>
      path('M4 4 h24 v40 h-24 Z') +
      `<path d="M16 8 V40" fill="none" stroke="currentColor" stroke-width="${S}" stroke-dasharray="2 2"/>`,
    ports: [
      { id: 'n', x: 16, y: 4, kind: 'process' },
      { id: 's', x: 16, y: 44, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['filter', 'cartridge', 'bag'],
  },

  inline('fit.reducer', 'Reducer', 24, 16, 8,
    () => path('M0 0 L24 4 V12 L0 16 Z'),
    ['reducer', 'expander', 'concentric']),

  inline('fit.flanges', 'Flange Pair', 16, 16, 8,
    () => path('M0 8 H16') + path('M6 0 V16 M10 0 V16'),
    ['flange', 'joint', 'breakout']),

  inline('fit.spectacle', 'Spectacle Blind', 24, 16, 8,
    () =>
      `<circle cx="6" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="${S}"/>` +
      `<circle cx="18" cy="8" r="5" fill="currentColor" stroke="currentColor" stroke-width="${S}"/>` +
      path('M0 8 H1 M23 8 H24'),
    ['spectacle', 'blind', 'spade', 'spacer']),

  inline('fit.steam-trap', 'Steam Trap', 24, 24, 12,
    () =>
      `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="${S}"/>` +
      text(12, 16, 'T', 10) +
      path('M0 12 H2 M22 12 H24'),
    ['steam trap', 'trap', 'condensate']),

  {
    id: 'fit.sample',
    name: 'Sample Point',
    category: 'inline',
    gridSize: { w: 2, h: 3 },
    render: () =>
      path('M8 0 V8') +
      path('M2 8 L2 16 L8 12 Z M14 8 L14 16 L8 12 Z') +
      text(8, 24, 'SP'),
    ports: [{ id: 'n', x: 8, y: 0, kind: 'process' }],
    tagRule: 'none',
    keywords: ['sample', 'sp', 'sampling'],
  },

  {
    id: 'fit.drain',
    name: 'Drain',
    category: 'inline',
    gridSize: { w: 2, h: 2 },
    render: () => path('M8 0 V6') + path('M2 6 H14 M2 6 L8 14 L14 6'),
    ports: [{ id: 'n', x: 8, y: 0, kind: 'process' }],
    tagRule: 'none',
    keywords: ['drain', 'low point'],
  },

  {
    id: 'fit.vent',
    name: 'Vent',
    category: 'inline',
    gridSize: { w: 2, h: 2 },
    render: () => path('M8 16 V10') + path('M2 10 H14 M2 10 L8 2 L14 10'),
    ports: [{ id: 's', x: 8, y: 16, kind: 'process' }],
    tagRule: 'none',
    keywords: ['vent', 'atmosphere', 'high point'],
  },

  inline('fit.specbreak', 'Spec Break', 16, 24, 12,
    () => path('M2 20 L8 4 M8 20 L14 4'),
    ['spec break', 'specification', 'class change']),
]
