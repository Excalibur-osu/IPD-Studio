import type { HmiWidget } from '../model'
import type { ThemeTokens } from '../theme'

export interface WidgetView {
  widget: HmiWidget
  theme: ThemeTokens
  /** Live values: own-tag signals ('PV','RUN','OP','OPEN','SP','MODE') plus any
   *  fully-qualified 'TAG.SIGNAL' keys a props.signal binding asks for. Empty in edit mode. */
  sim: Record<string, number>
  history?: number[]
  alarm?: 'none' | 'unacked' | 'acked'
}

export const fmt = (v: number | undefined, digits = 1): string =>
  v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits)

export const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
