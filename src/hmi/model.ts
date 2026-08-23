import { ulid } from 'ulid'

export type HmiTheme = 'classic' | 'hp'

export type WidgetType =
  | 'tank' | 'pump' | 'valve' | 'display' | 'gauge' | 'trend'
  | 'lamp' | 'button' | 'switch' | 'label' | 'symbol'
  | 'bar' | 'panel' | 'nav'

export interface HmiWidget {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  rotation?: 0 | 90 | 180 | 270
  /** Primary tag, e.g. 'LT-101' or 'P-101'. Widgets read derived signals (.PV/.RUN/.OP). */
  tag?: string
  label?: string
  /**
   * Per-type extras. Keys used by the sim/import (all optional):
   * capacity, level0, throttle, LL, L, H, HH, unit, min, max, base, bindTank,
   * bindPipe, controller, symbolId, signal, writeValue, onLabel, offLabel,
   * screen (nav target id).
   */
  props?: Record<string, string | number | boolean>
}

export interface HmiPipe {
  id: string
  /** Drawn/imported upstream -> downstream. */
  points: { x: number; y: number }[]
  /** P&ID edge id when imported (informational). */
  flowRef?: string
  width?: number
}

export interface HmiScreen {
  id: string
  name: string
  theme: HmiTheme
  widgets: HmiWidget[]
  pipes: HmiPipe[]
  /** Source sheet when created via import; enables Re-import. */
  fromSheetId?: string
}

/** Logical canvas size; the SVG scales to fit its container. */
export const HMI_WORLD = { w: 1600, h: 1000 }

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  tank: { w: 96, h: 128 },
  pump: { w: 56, h: 56 },
  valve: { w: 48, h: 32 },
  display: { w: 96, h: 40 },
  gauge: { w: 96, h: 96 },
  trend: { w: 192, h: 96 },
  lamp: { w: 32, h: 32 },
  button: { w: 80, h: 32 },
  switch: { w: 64, h: 32 },
  label: { w: 96, h: 24 },
  symbol: { w: 64, h: 64 },
  bar: { w: 56, h: 144 },
  panel: { w: 320, h: 208 },
  nav: { w: 120, h: 32 },
}

export function createScreen(number: number): HmiScreen {
  return { id: ulid(), name: `Screen ${number}`, theme: 'classic', widgets: [], pipes: [] }
}
