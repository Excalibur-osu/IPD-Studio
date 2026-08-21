import type { SymbolDef } from '../types'

const S = 1.5

export const controlHardware: SymbolDef[] = [
  {
    id: 'ctl.interlock',
    name: 'Interlock',
    category: 'control',
    gridSize: { w: 3, h: 3 },
    render: () =>
      `<polygon points="12,0 24,12 12,24 0,12" fill="none" stroke="currentColor" stroke-width="${S}"/>` +
      `<text x="12" y="16" font-size="10" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">I</text>`,
    ports: [
      { id: 'w', x: 0, y: 12, kind: 'signal' },
      { id: 'e', x: 24, y: 12, kind: 'signal' },
      { id: 'n', x: 12, y: 0, kind: 'signal' },
      { id: 's', x: 12, y: 24, kind: 'signal' },
    ],
    tagRule: 'none',
    keywords: ['interlock', 'trip', 'logic', 'sis'],
  },
]
