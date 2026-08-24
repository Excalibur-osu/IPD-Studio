import type { HmiWidget } from './model'

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom'
export interface WidgetPatch { id: string; patch: { x?: number; y?: number } }

/** Align 2+ widgets to the group's own extents (no snapping — alignment is exact). */
export function alignPatches(widgets: HmiWidget[], mode: AlignMode): WidgetPatch[] {
  if (widgets.length < 2) return []
  const left = Math.min(...widgets.map((w) => w.x))
  const right = Math.max(...widgets.map((w) => w.x + w.w))
  const top = Math.min(...widgets.map((w) => w.y))
  const bottom = Math.max(...widgets.map((w) => w.y + w.h))
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  return widgets.map((w) => {
    switch (mode) {
      case 'left': return { id: w.id, patch: { x: left } }
      case 'right': return { id: w.id, patch: { x: right - w.w } }
      case 'centerX': return { id: w.id, patch: { x: Math.round(cx - w.w / 2) } }
      case 'top': return { id: w.id, patch: { y: top } }
      case 'bottom': return { id: w.id, patch: { y: bottom - w.h } }
      case 'middleY': return { id: w.id, patch: { y: Math.round(cy - w.h / 2) } }
    }
  })
}

/** Even gaps between 3+ widgets along one axis; the outermost two stay put. */
export function distributePatches(widgets: HmiWidget[], axis: 'h' | 'v'): WidgetPatch[] {
  if (widgets.length < 3) return []
  const sorted = [...widgets].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y))
  const first = sorted[0]!, last = sorted[sorted.length - 1]!
  const span = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y
  const content = sorted.reduce((s, w) => s + (axis === 'h' ? w.w : w.h), 0)
  const gap = (span - content) / (sorted.length - 1)
  const out: WidgetPatch[] = []
  let cursor = axis === 'h' ? first.x : first.y
  for (const w of sorted) {
    const pos = Math.round(cursor)
    if (axis === 'h') { if (pos !== w.x) out.push({ id: w.id, patch: { x: pos } }) }
    else if (pos !== w.y) out.push({ id: w.id, patch: { y: pos } })
    cursor += (axis === 'h' ? w.w : w.h) + gap
  }
  return out
}

/** Clones for paste/duplicate: same geometry, nudged, fresh ids added by the
 *  store. Deep copy — props objects and pens arrays must never be shared
 *  between the clone and the original. */
export function duplicateWidgets(widgets: HmiWidget[], offset = 16): Omit<HmiWidget, 'id'>[] {
  return widgets.map(({ id: _id, ...w }) => ({
    ...structuredClone(w),
    x: w.x + offset,
    y: w.y + offset,
  }))
}
