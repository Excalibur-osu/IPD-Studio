import type { SymbolDef } from '../types'
import { BOWTIE } from './valves-manual'

const S = 1.5
const path = (d: string, fill = 'none') =>
  `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="${S}" stroke-linejoin="round"/>`
const text = (x: number, y: number, t: string) =>
  `<text x="${x}" y="${y}" font-size="10" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">${t}</text>`

/**
 * Control valve: 48x40 — wider than the manual valves so the body carries
 * pipe stubs on both ends (line—bowtie—line, like the standard drawings) and
 * the positioner bosses stay clear of the process ports' click halos.
 * Actuator zone y0..12 centered on x24, stem x24 y12..24, body y24..40
 * (32-wide bowtie centered, stubs 0..8 and 40..48).
 * cfg.actuator: diaphragm | piston | motor | solenoid | manual | digital |
 * electro-hydraulic · cfg.fail: none | fc | fo | fl · cfg.positioner:
 * none | yes
 */
function actuatorGlyph(actuator: string): string {
  switch (actuator) {
    case 'piston':
      return path('M16 2 h16 v10 h-16 Z M16 7 h16')
    case 'motor':
      return `<circle cx="24" cy="6" r="6" fill="none" stroke="currentColor" stroke-width="${S}"/>` + text(24, 9.5, 'M')
    case 'solenoid':
      return path('M18 0 h12 v12 h-12 Z') + text(24, 9.5, 'S')
    case 'manual':
      return path('M14 4 H34 M24 4 V12')
    case 'digital':
      return path('M18 0 h12 v12 h-12 Z') + text(24, 9.5, 'D')
    case 'electro-hydraulic':
      return path('M14 0 h20 v12 h-20 Z') + text(24, 9.5, 'EH')
    default: // spring diaphragm
      return path('M14 12 a10 8 0 0 1 20 0 Z')
  }
}

/** Fail-action arrow beside the stem; shifts to the left flank when the
 *  positioner box occupies the right. */
function failMark(fail: string, x = 34): string {
  switch (fail) {
    case 'fc':
      return path(`M${x} 14 V22 M${x - 3} 19 L${x} 22 L${x + 3} 19`)
    case 'fo':
      return path(`M${x} 22 V14 M${x - 3} 17 L${x} 14 L${x + 3} 17`)
    case 'fl':
      return path(`M${x - 4} 18 H${x + 4}`)
    default:
      return ''
  }
}

/**
 * Valve positioner, per the user's reference drawing: the box hangs on the
 * RIGHT side of the stem (its left edge on the stem line, stem visible above
 * and below, running through to the body crossing), with three connection
 * bosses drawn as circles inside — the sw/se/sb ports sit on the box's right
 * edge in line with them, so signal/air lines land one per boss.
 */
function positionerGlyph(): string {
  const boss = (cy: number) =>
    `<circle cx="34" cy="${cy}" r="1.6" fill="none" stroke="currentColor" stroke-width="1.1"/>`
  return path('M24 14 h16 v12 h-16 Z') + boss(16) + boss(20) + boss(24)
}

function bodyAt(bodyMarkup: string): string {
  // 32-wide body drawn centered in the 48 frame, with pipe stubs both sides.
  return `<g transform="translate(8 24)">${bodyMarkup}</g>` + path('M0 32 H8 M40 32 H48')
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
  gridSize: { w: 6, h: 5 },
  render: (cfg) => {
    const pos = cfg.positioner === 'yes'
    return (
      actuatorGlyph(cfg.actuator ?? 'diaphragm') +
      // with a positioner the stem runs through to the body crossing
      (pos ? path('M24 12 V32') + positionerGlyph() : path('M24 12 V24')) +
      failMark(cfg.fail ?? 'none', pos ? 14 : 34) +
      bodyAt(body.markup)
    )
  },
  ports: [
    { id: 'w', x: 0, y: 32, kind: 'process' },
    { id: 'e', x: 48, y: 32, kind: 'process' },
    { id: 'sig', x: 24, y: 0, kind: 'signal' },
    // Positioner bosses: one port per connection circle on the box's right
    // edge (harmless stem-side points when no positioner is drawn).
    { id: 'sw', x: 40, y: 16, kind: 'signal', hit: 3 },
    { id: 'se', x: 40, y: 20, kind: 'signal', hit: 3 },
    { id: 'sb', x: 40, y: 24, kind: 'signal', hit: 3 },
  ],
  tagRule: 'valve',
  defaultConfig: { actuator: 'diaphragm', fail: 'none', positioner: 'none' },
  configOptions: {
    actuator: ['diaphragm', 'piston', 'motor', 'solenoid', 'manual', 'digital', 'electro-hydraulic'],
    fail: ['none', 'fc', 'fo', 'fl'],
    positioner: ['none', 'yes'],
  },
  keywords: body.keywords,
}))
