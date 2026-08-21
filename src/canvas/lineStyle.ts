import type { LineClass } from '../model/types'

export interface LineStroke {
  width: number
  dasharray?: string
  /** Rendered as a double (jacketed) line. */
  double?: boolean
}

export const LINE_STROKES: Record<LineClass, LineStroke> = {
  'process.major': { width: 2.5 },
  'process.minor': { width: 1.25 },
  'process.impulse': { width: 1 },
  'signal.electric': { width: 1.25, dasharray: '4 3' },
  'signal.pneumatic': { width: 1.25 },
  'signal.hydraulic': { width: 1.25 },
  'signal.capillary': { width: 1.25 },
  'signal.data': { width: 1.25 },
  'signal.software': { width: 1.25, dasharray: '4 3' },
  'link.internal': { width: 1, dasharray: '2 2' },
  'signal.em': { width: 1.25 },
  'pipe.jacketed': { width: 2.5, double: true },
  'pipe.traced': { width: 1.25, dasharray: '8 3 2 3 2 3' },
  'pipe.existing': { width: 0.75 },
  'pipe.underground': { width: 1.25, dasharray: '12 6' },
  'pipe.battery-limit': { width: 2.5, dasharray: '12 4 3 4' },
}

/** True for classes that carry process fluid (process.* and pipe.*). */
export function isProcessClass(lineClass: LineClass): boolean {
  return lineClass.startsWith('process') || lineClass.startsWith('pipe')
}

export function strokeFor(lineClass: LineClass): LineStroke {
  return LINE_STROKES[lineClass]
}

/** Human labels for the property panel / toolbar picker. */
export const LINE_CLASS_LABELS: Record<LineClass, string> = {
  'process.major': 'Process (major)',
  'process.minor': 'Process (minor)',
  'process.impulse': 'Instrument impulse',
  'signal.electric': 'Electric signal',
  'signal.pneumatic': 'Pneumatic signal',
  'signal.hydraulic': 'Hydraulic signal',
  'signal.capillary': 'Capillary',
  'signal.data': 'Data link',
  'signal.software': 'Software link',
  'link.internal': 'Internal system link',
  'signal.em': 'Electromagnetic/sonic signal',
  'pipe.jacketed': 'Jacketed pipe',
  'pipe.traced': 'Heat-traced pipe',
  'pipe.existing': 'Existing pipe',
  'pipe.underground': 'Underground pipe',
  'pipe.battery-limit': 'Battery limit',
}
