import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`
const circle = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="${S}"/>`
const text = (x: number, y: number, t: string, size = 10) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">${t}</text>`

export const rotating: SymbolDef[] = [
  {
    id: 'pump.centrifugal',
    name: 'Centrifugal Pump',
    category: 'rotating',
    gridSize: { w: 6, h: 6 },
    render: () =>
      circle(20, 28, 14) +
      path('M28 16 H44 M28 24 H44 M44 16 V24') +
      path('M0 28 H6'),
    ports: [
      { id: 'suction', x: 0, y: 28, kind: 'process' },
      { id: 'discharge', x: 44, y: 20, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['pump', 'centrifugal'],
  },
  {
    id: 'pump.gear',
    name: 'PD Pump (Gear/Screw)',
    category: 'rotating',
    gridSize: { w: 4, h: 4 },
    render: () => circle(16, 16, 14) + circle(16, 11, 5) + circle(16, 21, 5) + path('M0 16 H2 M30 16 H32'),
    ports: [
      { id: 'w', x: 0, y: 16, kind: 'process' },
      { id: 'e', x: 32, y: 16, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['pump', 'gear', 'screw', 'positive displacement', 'pd'],
  },
  {
    id: 'pump.diaphragm',
    name: 'Diaphragm/Metering Pump',
    category: 'rotating',
    gridSize: { w: 4, h: 4 },
    render: () => circle(16, 16, 14) + path('M6 16 a10 10 0 0 1 20 0') + path('M16 6 V2') + path('M0 16 H2 M30 16 H32'),
    ports: [
      { id: 'w', x: 0, y: 16, kind: 'process' },
      { id: 'e', x: 32, y: 16, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['pump', 'diaphragm', 'metering', 'dosing'],
  },
  {
    id: 'ejector',
    name: 'Ejector / Eductor',
    category: 'rotating',
    gridSize: { w: 6, h: 2 },
    render: () => path('M0 4 L20 7 L48 2 M0 12 L20 9 L48 14 M12 0 V6'),
    ports: [
      { id: 'w', x: 0, y: 8, kind: 'process' },
      { id: 'e', x: 48, y: 8, kind: 'process' },
      { id: 'n', x: 12, y: 0, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['ejector', 'eductor', 'jet', 'vacuum'],
  },
  {
    id: 'comp.centrifugal',
    name: 'Compressor',
    category: 'rotating',
    gridSize: { w: 6, h: 4 },
    render: () => path('M4 12 L44 4 L44 28 L4 20 Z'),
    ports: [
      { id: 'w', x: 4, y: 16, kind: 'process' },
      { id: 'e', x: 44, y: 16, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['compressor', 'centrifugal', 'gas'],
  },
  {
    id: 'blower',
    name: 'Blower / Fan',
    category: 'rotating',
    gridSize: { w: 4, h: 4 },
    render: () =>
      circle(16, 16, 14) +
      path('M16 16 L26 8 M16 16 L26 24 M16 16 L6 16') +
      path('M0 16 H2 M30 16 H32'),
    ports: [
      { id: 'w', x: 0, y: 16, kind: 'process' },
      { id: 'e', x: 32, y: 16, kind: 'process' },
    ],
    tagRule: 'equipment',
    keywords: ['blower', 'fan', 'air'],
  },
  {
    id: 'motor',
    name: 'Motor',
    category: 'rotating',
    gridSize: { w: 4, h: 4 },
    render: () => circle(16, 16, 12) + text(16, 20, 'M'),
    ports: [
      { id: 'n', x: 16, y: 4, kind: 'both' },
      { id: 's', x: 16, y: 28, kind: 'both' },
    ],
    tagRule: 'equipment',
    keywords: ['motor', 'electric', 'driver'],
  },
  {
    id: 'agitator',
    name: 'Agitator / Mixer',
    category: 'rotating',
    gridSize: { w: 4, h: 6 },
    render: () =>
      path('M10 0 h12 v10 h-12 Z') +
      path('M16 10 V40') +
      path('M8 44 L16 36 L24 44'),
    ports: [{ id: 'n', x: 16, y: 0, kind: 'signal' }],
    tagRule: 'equipment',
    keywords: ['agitator', 'mixer', 'stirrer', 'impeller'],
  },
]
