import type { HmiPipe, HmiScreen, HmiWidget } from './model'

export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const snap8 = (v: number): number => Math.round(v / 8) * 8 || 0 // || 0 normalizes -0

export const widgetRect = (w: HmiWidget): Rect => ({ x: w.x, y: w.y, w: w.w, h: w.h })

const inRect = (pt: { x: number; y: number }, r: Rect): boolean =>
  pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h

/** Panels are grouping frames: grab them by the title strip or a border band
 *  so the widgets inside stay clickable. */
function hitsPanelChrome(w: HmiWidget, pt: { x: number; y: number }): boolean {
  if (!inRect(pt, widgetRect(w))) return false
  if (pt.y <= w.y + 24) return true // title strip
  const band = 8
  return pt.x <= w.x + band || pt.x >= w.x + w.w - band || pt.y >= w.y + w.h - band
}

export function hitWidget(
  screen: HmiScreen,
  pt: { x: number; y: number },
  opts?: { operate?: boolean },
): HmiWidget | null {
  for (let i = screen.widgets.length - 1; i >= 0; i--) {
    const w = screen.widgets[i]!
    if (opts?.operate && (w.type === 'panel' || w.type === 'label')) continue
    if (w.type === 'panel' && !opts?.operate) {
      if (hitsPanelChrome(w, pt)) return w
      continue
    }
    if (inRect(pt, widgetRect(w))) return w
  }
  return null
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
  (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)

function segsIntersect(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): boolean {
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
}

function segInRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): boolean {
  if (inRect(a, r) || inRect(b, r)) return true
  const c1 = { x: r.x, y: r.y }, c2 = { x: r.x + r.w, y: r.y }
  const c3 = { x: r.x + r.w, y: r.y + r.h }, c4 = { x: r.x, y: r.y + r.h }
  return segsIntersect(a, b, c1, c2) || segsIntersect(a, b, c2, c3) || segsIntersect(a, b, c3, c4) || segsIntersect(a, b, c4, c1)
}

/** Everything a rubber-band rectangle catches: widgets by box overlap, pipes
 *  by any segment crossing the band. */
export function marqueeHits(screen: HmiScreen, r: Rect): string[] {
  const ids: string[] = []
  for (const w of screen.widgets) if (rectsOverlap(widgetRect(w), r)) ids.push(w.id)
  for (const p of screen.pipes) {
    for (let k = 0; k + 1 < p.points.length; k++) {
      if (segInRect(p.points[k]!, p.points[k + 1]!, r)) { ids.push(p.id); break }
    }
  }
  return ids
}

export const normRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y),
})

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
