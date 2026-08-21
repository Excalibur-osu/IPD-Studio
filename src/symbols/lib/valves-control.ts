import type { SymbolDef } from '../types'
import { BOWTIE } from './valves-manual'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`
const text = (x: number, y: number, t: string) =>
  `<text x="${x}" y="${y}" font-size="10" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">${t}</text>`

/**
 * Control valve: 32x40. Actuator zone y0..12, stem y12..24, body y24..40.
 * cfg.actuator: diaphragm | piston | motor | solenoid | manual
 * cfg.fail: none | fc | fo | fl
 */
function actuatorGlyph(actuator: string): string {
  switch (actuator) {
    case 'piston':
      return path('M8 2 h16 v10 h-16 Z M8 7 h16')
    case 'motor':
      return `<circle cx="16" cy="6" r="6" fill="none" stroke="currentColor" stroke-width="${S}"/>` + text(16, 9.5, 'M')
    case 'solenoid':
      return path('M10 0 h12 v12 h-12 Z') + text(16, 9.5, 'S')
    case 'manual':
      return path('M6 4 H26 M16 4 V12')
    case 'digital':
      return path('M10 0 h12 v12 h-12 Z') + text(16, 9.5, 'D')
    case 'electro-hydraulic':
      return path('M6 0 h20 v12 h-20 Z') + text(16, 9.5, 'EH')
    default: // spring diaphragm
      return path('M6 12 a10 8 0 0 1 20 0 Z')
  }
}

function failMark(fail: string): string {
  switch (fail) {
    case 'fc':
      return path('M26 14 V22 M23 19 L26 22 L29 19')
    case 'fo':
      return path('M26 22 V14 M23 17 L26 14 L29 17')
    case 'fl':
      return path('M22 18 H30')
    default:
      return ''
  }
}

function bodyAt(bodyMarkup: string): string {
  // Body drawn in a group translated to y24.
  return `<g transform="translate(0 24)">${bodyMarkup}</g>`
}

const CV_BODIES: Record<string, { name: string; markup: string; keywords: string[] }> = {
  'cv.globe': {
    name: 'Control Valve (Globe)',
    markup: path(BOWTIE) + `<circle cx="16" cy="8" r="4" fill="currentColor" stroke="none"/>`,
    keywords: ['control valve', 'globe', 'fv', 'pv', 'tv', 'lv', 'throttling'],
  },
  'cv.butterfly': {
    name: 'Control Valve (Butterfly)',
    markup:
      path('M0 0 L0 16 M32 0 L32 16 M4 14 L28 2') +
      `<circle cx="16" cy="8" r="2" fill="currentColor" stroke="none"/>`,
    keywords: ['control valve', 'butterfly'],
  },
  'cv.ball': {
    name: 'Control Valve (Ball)',
    markup: path(BOWTIE) + `<circle cx="16" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="${S}"/>`,
    keywords: ['control valve', 'ball', 'on-off', 'xv'],
  },
}

export const controlValves: SymbolDef[] = Object.entries(CV_BODIES).map(([id, body]) => ({
  id,
  name: body.name,
  category: 'control-valves',
  gridSize: { w: 4, h: 5 },
  render: (cfg) =>
    actuatorGlyph(cfg.actuator ?? 'diaphragm') +
    path('M16 12 V24') +
    failMark(cfg.fail ?? 'none') +
    bodyAt(body.markup),
  ports: [
    { id: 'w', x: 0, y: 32, kind: 'process' },
    { id: 'e', x: 32, y: 32, kind: 'process' },
    { id: 'sig', x: 16, y: 0, kind: 'signal' },
  ],
  tagRule: 'valve',
  defaultConfig: { actuator: 'diaphragm', fail: 'none' },
  configOptions: {
    actuator: ['diaphragm', 'piston', 'motor', 'solenoid', 'manual', 'digital', 'electro-hydraulic'],
    fail: ['none', 'fc', 'fo', 'fl'],
  },
  keywords: body.keywords,
}))
