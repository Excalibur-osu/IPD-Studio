import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`

export const accessories: SymbolDef[] = [
  {
    id: 'acc.thermowell',
    name: 'Thermowell',
    category: 'accessories',
    gridSize: { w: 2, h: 3 },
    render: () => path('M4 0 H12') + path('M8 0 V16') + path('M6 16 L8 22 L10 16 Z'),
    ports: [{ id: 'n', x: 8, y: 0, kind: 'both' }],
    tagRule: 'isa-instrument',
    keywords: ['thermowell', 'temperature', 'well', 'tw'],
  },
  {
    id: 'acc.pg',
    name: 'Pressure Gauge',
    category: 'accessories',
    gridSize: { w: 2, h: 3 },
    render: () =>
      `<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="${S}"/>` +
      path('M8 8 L12 4') +
      path('M8 15 V24'),
    ports: [{ id: 's', x: 8, y: 24, kind: 'process' }],
    tagRule: 'isa-instrument',
    keywords: ['gauge', 'pressure', 'dial', 'pg', 'pi'],
  },
  {
    id: 'acc.lg',
    name: 'Gauge Glass',
    category: 'accessories',
    gridSize: { w: 2, h: 5 },
    render: () => path('M0 8 H6 M0 32 H6') + path('M6 4 h4 v32 h-4 Z'),
    ports: [
      { id: 'w1', x: 0, y: 8, kind: 'process' },
      { id: 'w2', x: 0, y: 32, kind: 'process' },
    ],
    tagRule: 'isa-instrument',
    keywords: ['gauge glass', 'level', 'sight', 'lg'],
  },
]
