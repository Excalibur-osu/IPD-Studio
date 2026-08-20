import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`

export const safetyDevices: SymbolDef[] = [
  {
    id: 'psv',
    name: 'Pressure Safety Valve',
    category: 'safety',
    gridSize: { w: 3, h: 5 },
    // Angle body: bottom inlet triangle, right outlet triangle, spring above the seat.
    render: () =>
      path('M4 40 L20 40 L12 24 Z') +
      path('M24 8 L24 24 L12 24 Z') +
      path('M12 22 l5 -3 l-10 -3 l10 -3 l-10 -3 l5 -3'),
    ports: [
      { id: 'in', x: 12, y: 40, kind: 'process' },
      { id: 'out', x: 24, y: 16, kind: 'process' },
    ],
    tagRule: 'valve',
    keywords: ['psv', 'relief', 'safety', 'prv', 'pressure'],
  },
  {
    id: 'pse',
    name: 'Rupture Disc',
    category: 'safety',
    gridSize: { w: 3, h: 2 },
    render: () => path('M0 12 H24 M8 4 V12 M16 4 V12') + path('M8 8 Q12 2 16 8'),
    ports: [
      { id: 'w', x: 0, y: 12, kind: 'process' },
      { id: 'e', x: 24, y: 12, kind: 'process' },
    ],
    tagRule: 'valve',
    keywords: ['rupture', 'disc', 'burst', 'pse'],
  },
  {
    id: 'pcv.self',
    name: 'Self-Acting Regulator',
    category: 'safety',
    gridSize: { w: 4, h: 5 },
    // Globe body with integral diaphragm and downstream sensing tap.
    render: () =>
      path('M6 8 a10 8 0 0 1 20 0 Z') +
      path('M16 8 V24') +
      `<g transform="translate(0 24)">` +
      path('M0 0 L0 16 L16 8 Z M32 0 L32 16 L16 8 Z') +
      `<circle cx="16" cy="8" r="4" fill="currentColor" stroke="none"/>` +
      `</g>` +
      path('M28 32 V12 H22'),
    ports: [
      { id: 'w', x: 0, y: 32, kind: 'process' },
      { id: 'e', x: 32, y: 32, kind: 'process' },
    ],
    tagRule: 'valve',
    keywords: ['regulator', 'pcv', 'self-acting', 'pressure reducing'],
  },
]
