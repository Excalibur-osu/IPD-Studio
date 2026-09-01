// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { HMI_WORLD } from './model'

/** Canvas view: world-space center + zoom factor. null = fit (whole world). */
export interface View { cx: number; cy: number; k: number }
export interface ViewBox { x: number; y: number; w: number; h: number }

export const K_MIN = 0.5
export const K_MAX = 4

export function viewBoxOf(view: View | null): ViewBox {
  if (!view) return { x: 0, y: 0, w: HMI_WORLD.w, h: HMI_WORLD.h }
  const w = HMI_WORLD.w / view.k
  const h = HMI_WORLD.h / view.k
  return { x: view.cx - w / 2, y: view.cy - h / 2, w, h }
}

export const effectiveK = (view: View | null): number => view?.k ?? 1

const FIT: View = { cx: HMI_WORLD.w / 2, cy: HMI_WORLD.h / 2, k: 1 }

const isFit = (v: View): boolean =>
  v.k === 1 && Math.abs(v.cx - FIT.cx) < 0.001 && Math.abs(v.cy - FIT.cy) < 0.001

/** Zoom about a world-space anchor so the point under the cursor stays put. */
export function zoomAt(view: View | null, anchor: { x: number; y: number }, factor: number): View | null {
  const base = view ?? FIT
  const k = Math.min(K_MAX, Math.max(K_MIN, base.k * factor))
  const next: View = {
    cx: anchor.x - (anchor.x - base.cx) * (base.k / k),
    cy: anchor.y - (anchor.y - base.cy) * (base.k / k),
    k,
  }
  return isFit(next) ? null : next
}

/** Pan by world-space deltas (positive dx pans the view right). */
export function panBy(view: View | null, dx: number, dy: number): View {
  const base = view ?? FIT
  return { cx: base.cx + dx, cy: base.cy + dy, k: base.k }
}
