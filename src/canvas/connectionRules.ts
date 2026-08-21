import type { LineClass } from '../model/types'
import type { PortKind } from '../symbols/types'
import { isProcessClass } from './lineStyle'

const processOk = (k: PortKind) => k === 'process' || k === 'both'
const signalOk = (k: PortKind) => k === 'signal' || k === 'both'

export function canConnect(source: PortKind, target: PortKind, lineClass: LineClass): boolean {
  if (isProcessClass(lineClass)) return processOk(source) && processOk(target)
  return signalOk(source) && signalOk(target)
}

/** True when SOME line class could legally join these two port kinds. */
export function compatibleKinds(source: PortKind, target: PortKind): boolean {
  return (processOk(source) && processOk(target)) || (signalOk(source) && signalOk(target))
}

/**
 * Line class for a freshly drawn connection. Honors the toolbar's active class
 * when it fits the ports; otherwise falls back to the obvious family default so
 * a controller-to-valve drag "just works" without touching the line picker.
 * Ends without a port (free ends) pass null and put no constraint on the pick.
 */
export function pickLineClass(
  source: PortKind | null,
  target: PortKind | null,
  active: LineClass,
): LineClass {
  const kinds = [source, target].filter((k): k is PortKind => k !== null)
  const allProcess = kinds.every(processOk)
  const allSignal = kinds.every(signalOk)
  if (isProcessClass(active) ? allProcess : allSignal) return active
  // A strictly-signal port forces the signal family; otherwise prefer process.
  if (allSignal && kinds.some((k) => k === 'signal')) return 'signal.electric'
  if (allProcess) return 'process.major'
  return allSignal ? 'signal.electric' : active
}
