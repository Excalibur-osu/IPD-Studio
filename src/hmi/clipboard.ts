// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { HmiPipe, HmiScreen, HmiWidget } from './model'
import { snap8 } from './editGeometry'

/**
 * Module-level clipboard: survives screen switches (cross-screen paste) but
 * not reloads — deliberately not the OS clipboard, so no permissions and no
 * accidental leakage of other apps' content into the doc.
 */
interface Clip {
  widgets: HmiWidget[]
  pipes: HmiPipe[]
  center: { x: number; y: number }
  pastes: number
}

let clip: Clip | null = null

export const hasClipboard = (): boolean => clip !== null
export const clearClipboard = (): void => { clip = null }

/** Deep-copy the selected widgets/pipes. Returns false for an empty grab. */
export function copySelection(screen: HmiScreen, ids: string[]): boolean {
  const idSet = new Set(ids)
  const widgets = screen.widgets.filter((w) => idSet.has(w.id))
  const pipes = screen.pipes.filter((p) => idSet.has(p.id))
  if (widgets.length + pipes.length === 0) {
    clip = null
    return false
  }
  const xs = [...widgets.flatMap((w) => [w.x, w.x + w.w]), ...pipes.flatMap((p) => p.points.map((q) => q.x))]
  const ys = [...widgets.flatMap((w) => [w.y, w.y + w.h]), ...pipes.flatMap((p) => p.points.map((q) => q.y))]
  clip = {
    widgets: structuredClone(widgets),
    pipes: structuredClone(pipes),
    center: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
    pastes: 0,
  }
  return true
}

/** Content centered at the cursor (grid-preserving delta), staggering repeat
 *  pastes so copies never land exactly on top of each other. Ids stripped —
 *  the store assigns fresh ones. */
export function pastePayload(at: { x: number; y: number }): {
  widgets: Omit<HmiWidget, 'id'>[]
  pipes: Omit<HmiPipe, 'id'>[]
} | null {
  if (!clip) return null
  const stagger = clip.pastes * 16
  clip.pastes++
  const dx = snap8(at.x - clip.center.x) + stagger
  const dy = snap8(at.y - clip.center.y) + stagger
  const widgets = structuredClone(clip.widgets).map(({ id: _id, ...w }) => ({ ...w, x: w.x + dx, y: w.y + dy }))
  const pipes = structuredClone(clip.pipes).map(({ id: _id, ...p }) => ({
    ...p,
    points: p.points.map((q) => ({ x: q.x + dx, y: q.y + dy })),
  }))
  return { widgets, pipes }
}
