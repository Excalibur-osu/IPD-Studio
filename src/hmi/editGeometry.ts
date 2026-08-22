import type { HmiPipe, HmiScreen, HmiWidget } from './model'

export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const snap8 = (v: number): number => Math.round(v / 8) * 8 || 0 // || 0 normalizes -0

export const widgetRect = (w: HmiWidget): Rect => ({ x: w.x, y: w.y, w: w.w, h: w.h })

export function hitWidget(screen: HmiScreen, pt: { x: number; y: number }): HmiWidget | null {
  for (let i = screen.widgets.length - 1; i >= 0; i--) {
    const w = screen.widgets[i]!
    if (pt.x >= w.x && pt.x <= w.x + w.w && pt.y >= w.y && pt.y <= w.y + w.h) return w
  }
  return null
}

function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const px = a.x + t * dx - p.x, py = a.y + t * dy - p.y
  return Math.hypot(px, py)
}

export function hitPipe(screen: HmiScreen, pt: { x: number; y: number }, tol = 6): HmiPipe | null {
  for (let i = screen.pipes.length - 1; i >= 0; i--) {
    const p = screen.pipes[i]!
    for (let k = 0; k + 1 < p.points.length; k++) {
      if (segDist(pt, p.points[k]!, p.points[k + 1]!) <= tol) return p
    }
  }
  return null
}

export function handlePoint(r: Rect, h: Handle): { x: number; y: number } {
  const mx = r.x + r.w / 2, my = r.y + r.h / 2
  switch (h) {
    case 'nw': return { x: r.x, y: r.y }
    case 'n': return { x: mx, y: r.y }
    case 'ne': return { x: r.x + r.w, y: r.y }
    case 'e': return { x: r.x + r.w, y: my }
    case 'se': return { x: r.x + r.w, y: r.y + r.h }
    case 's': return { x: mx, y: r.y + r.h }
    case 'sw': return { x: r.x, y: r.y + r.h }
    case 'w': return { x: r.x, y: my }
  }
}

export function resizeRect(r: Rect, h: Handle, dx: number, dy: number, min = 16): Rect {
  let { x, y, w, h: hh } = r
  const west = h.includes('w'), east = h.includes('e')
  const north = h.startsWith('n'), south = h.startsWith('s')
  if (east) w = Math.max(min, r.w + dx)
  if (south) hh = Math.max(min, r.h + dy)
  if (west) { const nw = Math.max(min, r.w - dx); x = r.x + (r.w - nw); w = nw }
  if (north) { const nh = Math.max(min, r.h - dy); y = r.y + (r.h - nh); hh = nh }
  return { x, y, w, h: hh }
}
