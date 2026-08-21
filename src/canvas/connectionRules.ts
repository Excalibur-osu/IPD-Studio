import type { LineClass } from '../model/types'
import type { PortKind } from '../symbols/types'

const processOk = (k: PortKind) => k === 'process' || k === 'both'
const signalOk = (k: PortKind) => k === 'signal' || k === 'both'

export function canConnect(source: PortKind, target: PortKind, lineClass: LineClass): boolean {
  if (lineClass.startsWith('process')) return processOk(source) && processOk(target)
  return signalOk(source) && signalOk(target)
}
