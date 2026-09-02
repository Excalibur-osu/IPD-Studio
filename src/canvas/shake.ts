// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * Shake-to-undo, the gesture every phone has taught people: waggle the thing
 * you are dragging and the last thing that happened to it comes off again.
 * Here it cuts the line a drag just docked, so a wrong connection is undone
 * without letting go of the symbol.
 *
 * A shake is direction reversals: back, forth, back — each leg long enough to
 * be deliberate, all of them inside one short window so a slow change of mind
 * while routing a symbol across the sheet never reads as one.
 */

/** How far the pointer must travel one way before a turn counts as a leg. */
const LEG_PX = 14
/** All the reversals have to land inside this window. A real waggle turns
 *  every 100-150ms; re-aiming a symbol across the sheet is far slower. */
const WINDOW_MS = 600
/** Reversals that make a shake. Three means back-forth-back. */
const REVERSALS = 3

interface Axis {
  dir: -1 | 0 | 1
  travel: number
  at: number
  seeded: boolean
  flips: number[]
}

const newAxis = (): Axis => ({ dir: 0, travel: 0, at: 0, seeded: false, flips: [] })

function step(a: Axis, v: number, now: number): void {
  if (!a.seeded) {
    a.seeded = true
    a.at = v
    return
  }
  const d = v - a.at
  a.at = v
  if (Math.abs(d) < 1) return
  const s = d > 0 ? 1 : -1
  if (a.dir === 0) {
    a.dir = s
    a.travel = Math.abs(d)
    return
  }
  if (s === a.dir) {
    a.travel += Math.abs(d)
    return
  }
  // Turned around: the leg just finished only counts if it was a real one.
  if (a.travel >= LEG_PX) a.flips.push(now)
  a.dir = s
  a.travel = Math.abs(d)
}

function shaken(a: Axis, now: number): boolean {
  a.flips = a.flips.filter((t) => now - t <= WINDOW_MS)
  return a.flips.length >= REVERSALS
}

export interface ShakeDetector {
  /** Feed a pointer sample (screen px). True the moment it reads as a shake. */
  push(x: number, y: number, now: number): boolean
  /** Forget the gesture so far — after acting on a shake, or on a new drag. */
  reset(): void
}

export function createShakeDetector(): ShakeDetector {
  let ax = newAxis()
  let ay = newAxis()
  return {
    push(x, y, now) {
      step(ax, x, now)
      step(ay, y, now)
      // Either axis on its own is a shake: people waggle sideways, but a
      // symbol pinned against the edge of the sheet gets waggled vertically.
      if (shaken(ax, now) || shaken(ay, now)) {
        return true
      }
      return false
    },
    reset() {
      ax = newAxis()
      ay = newAxis()
    },
  }
}
