import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`
const circle = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="${S}"/>`

export const heat: SymbolDef[] = [
  {
    id: 'hx.shell-tube',
    name: 'Shell & Tube Exchanger',
    category: 'heat',
    gridSize: { w: 6, h: 4 },
    render: () => circle(24, 16, 14) + path('M0 16 H48') + path('M24 2 V0 M24 30 V32'),
    ports: [
      { id: 'w', x: 0, y: 16, kind: 'process' },
      { id: 'e', x: 48, y: 16, kind: 'process' },
      { id: 'n', x: 24, y: 0, kind: 'process' },
      { id: 's', x: 24, y: 32, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['exchanger', 'shell', 'tube', 'cooler', 'heater', 'hx'],
  },
  {
    id: 'hx.plate',
    name: 'Plate Exchanger',
    category: 'heat',
    gridSize: { w: 4, h: 4 },
    render: () =>
      path('M2 2 h28 v28 h-28 Z') +
      path('M10 2 V30 M16 2 V30 M22 2 V30') +
      path('M0 4 H2 M0 28 H2 M30 4 H32 M30 28 H32'),
    ports: [
      { id: 'w1', x: 0, y: 4, kind: 'process' },
      { id: 'w2', x: 0, y: 28, kind: 'process' },
      { id: 'e1', x: 32, y: 4, kind: 'process' },
      { id: 'e2', x: 32, y: 28, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['exchanger', 'plate', 'phe', 'gasketed'],
  },
  {
    id: 'hx.air-cooler',
    name: 'Air Cooler (Fin-Fan)',
    category: 'heat',
    gridSize: { w: 8, h: 4 },
    render: () =>
      path('M0 8 h64 v24 h-64 Z') +
      circle(32, 20, 8) +
      path('M32 20 L38 14 M32 20 L26 14'),
    ports: [
      { id: 'w', x: 0, y: 20, kind: 'process' },
      { id: 'e', x: 64, y: 20, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['air cooler', 'fin fan', 'exchanger'],
  },
]
