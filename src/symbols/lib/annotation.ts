import type { SymbolDef } from '../types'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`

export const annotations: SymbolDef[] = [
  {
    id: 'ann.offpage',
    name: 'Off-Page Connector',
    category: 'annotation',
    gridSize: { w: 6, h: 3 },
    render: () => path('M0 0 H36 L48 12 L36 24 H0 Z'),
    ports: [{ id: 'w', x: 0, y: 12, kind: 'both' }],
    tagRule: 'none',
    keywords: ['off-page', 'connector', 'continuation', 'to sheet'],
  },
  {
    id: 'ann.arrow',
    name: 'Flow Arrow',
    category: 'annotation',
    gridSize: { w: 3, h: 2 },
    render: () => path('M0 2 L20 8 L0 14 Z', 'currentColor'),
    ports: [
      { id: 'w', x: 0, y: 8, kind: 'both' },
      { id: 'e', x: 24, y: 8, kind: 'both' },
    ],
    tagRule: 'none',
    keywords: ['arrow', 'flow', 'direction'],
  },
  {
    id: 'ann.text',
    name: 'Text Note',
    category: 'annotation',
    gridSize: { w: 8, h: 2 },
    render: () => '',
    ports: [],
    tagRule: 'none',
    keywords: ['text', 'note', 'label', 'comment'],
  },
  {
    id: 'ann.noteflag',
    name: 'Note Flag',
    category: 'annotation',
    gridSize: { w: 3, h: 3 },
    render: () => `<polygon points="12,0 22,6 22,18 12,24 2,18 2,6" fill="none" stroke="currentColor" stroke-width="${S}"/>`,
    ports: [],
    tagRule: 'none',
    keywords: ['note', 'flag', 'reference'],
  },
  {
    id: 'ann.cloud',
    name: 'Revision Cloud',
    category: 'annotation',
    gridSize: { w: 8, h: 4 },
    render: () =>
      path(
        'M8 24 a8 6 0 1 1 6 -14 a8 6 0 1 1 14 -4 a8 6 0 1 1 14 4 a8 6 0 1 1 6 14 a8 6 0 1 1 -10 6 a8 6 0 1 1 -20 0 a8 6 0 1 1 -10 -6 Z',
      ),
    ports: [],
    tagRule: 'none',
    keywords: ['revision', 'cloud', 'markup', 'change'],
  },
]
