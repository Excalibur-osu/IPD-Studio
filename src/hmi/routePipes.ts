/**
 * Orthogonal pipe router for P&ID -> HMI import.
 *
 * The P&ID canvas gets its clean runs from JointJS's manhattan router at
 * render time (port exit directions, obstacle padding 8) — none of that
 * geometry is stored on the doc, so an import that just connects port to
 * port draws lines through equipment. This reimplements the same routing
 * rules DOM-free: exit stubs along the port direction, a Dijkstra search
 * over the orthogonal visibility grid with a bend penalty, and the P&ID's
 * facing-ports-route-straight special case.
 */

export type Dir = 'left' | 'right' | 'top' | 'bottom'
export interface Rect { x: number; y: number; w: number; h: number }
export interface RouteEnd { x: number; y: number; dir?: Dir | null }
type Pt = { x: number; y: number }

/** Obstacle padding — matches the P&ID manhattan router's `padding: 8`. */
const PAD = 8
/** Minimum port exit stub before the first bend is allowed. */
const STUB = 12
/** Extra cost per 90° turn, in px-equivalents: prefers straight runs. */
const BEND = 48
const EPS = 0.01

const DX: Record<Dir, number> = { left: -1, right: 1, top: 0, bottom: 0 }
const DY: Record<Dir, number> = { left: 0, right: 0, top: -1, bottom: 1 }
const OPP: Record<Dir, Dir> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
const DIRS: Dir[] = ['left', 'right', 'top', 'bottom']

const inflate = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by })
const containsPt = (r: Rect, p: Pt): boolean => p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS

/** Strict-interior overlap of an orthogonal segment with a rect (touching a
 *  boundary is allowed — that IS the hug line the router travels on). */
export function segCrossesRect(a: Pt, b: Pt, r: Rect): boolean {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  return x0 < r.x + r.w - EPS && x1 > r.x + EPS && y0 < r.y + r.h - EPS && y1 > r.y + EPS
}

/** Drop duplicate and collinear interior points. */
function collapse(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) continue
    out.push({ x: p.x, y: p.y })
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1]!, b = out[i]!, c = out[i + 1]!
    if ((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS) || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS)) out.splice(i, 1)
  }
  return out
}

/** Walk out of the port along its exit direction until clear of every
 *  blocking rect (the own symbol's footprint first among them). */
function stubOut(end: RouteEnd, blocks: Rect[]): Pt {
  if (!end.dir) return { x: end.x, y: end.y }
  let x = end.x + DX[end.dir] * STUB
  let y = end.y + DY[end.dir] * STUB
  for (let i = 0; i < 15 && blocks.some((r) => containsPt(r, { x, y })); i++) {
    x += DX[end.dir] * 8
    y += DY[end.dir] * 8
  }
  return { x, y }
}

function sortedUnique(vals: number[]): number[] {
  const s = [...vals].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of s) if (out.length === 0 || v - out[out.length - 1]! > EPS) out.push(v)
  return out
}

/** Small binary min-heap on parallel arrays. */
class Heap {
  keys: number[] = []
  vals: number[] = []
  push(key: number, val: number): void {
    const k = this.keys, v = this.vals
    k.push(key); v.push(val)
    let i = k.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p]! <= k[i]!) break
      ;[k[p], k[i]] = [k[i]!, k[p]!]; [v[p], v[i]] = [v[i]!, v[p]!]
      i = p
    }
  }
  pop(): number | undefined {
    const k = this.keys, v = this.vals
    if (k.length === 0) return undefined
    const top = v[0]
    const lk = k.pop()!, lv = v.pop()!
    if (k.length > 0) {
      k[0] = lk; v[0] = lv
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < k.length && k[l]! < k[m]!) m = l
        if (r < k.length && k[r]! < k[m]!) m = r
        if (m === i) break
        ;[k[m], k[i]] = [k[i]!, k[m]!]; [v[m], v[i]] = [v[i]!, v[m]!]
        i = m
      }
    }
    return top
  }
  get size(): number { return this.keys.length }
}

/** Dijkstra over the orthogonal visibility grid. Returns null when no path. */
function gridRoute(a: RouteEnd, b: RouteEnd, blocks: Rect[]): Pt[] | null {
  const sa = stubOut(a, blocks)
  const sb = stubOut(b, blocks)

  const xs: number[] = [sa.x, sb.x, a.x, b.x, (sa.x + sb.x) / 2]
  const ys: number[] = [sa.y, sb.y, a.y, b.y, (sa.y + sb.y) / 2]
  for (const r of blocks) { xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h) }
  const X = sortedUnique(xs), Y = sortedUnique(ys)
  if (X.length * Y.length > 40000) return null

  const idx = (vals: number[], v: number): number => {
    for (let i = 0; i < vals.length; i++) if (Math.abs(vals[i]! - v) < EPS) return i
    return -1
  }
  const si = idx(X, sa.x), sj = idx(Y, sa.y), ti = idx(X, sb.x), tj = idx(Y, sb.y)
  if (si < 0 || sj < 0 || ti < 0 || tj < 0) return null

  // gap blocking: every blocking rect's boundaries are grid lines, so a gap
  // between adjacent coords is either fully inside a rect or fully outside
  const vBlocked: boolean[][] = X.map((x) => Y.map((_, j) =>
    j + 1 < Y.length && blocks.some((r) => x > r.x + EPS && x < r.x + r.w - EPS && Y[j]! >= r.y - EPS && Y[j + 1]! <= r.y + r.h + EPS)))
  const hBlocked: boolean[][] = Y.map((y) => X.map((_, i) =>
    i + 1 < X.length && blocks.some((r) => y > r.y + EPS && y < r.y + r.h - EPS && X[i]! >= r.x - EPS && X[i + 1]! <= r.x + r.w + EPS)))

  // state = ((i * ny + j) * 4 + dirIndex)
  const ny = Y.length
  const stateOf = (i: number, j: number, d: number): number => (i * ny + j) * 4 + d
  const dist = new Map<number, number>()
  const prev = new Map<number, number>()
  const heap = new Heap()

  const seed = a.dir ? [DIRS.indexOf(a.dir)] : [0, 1, 2, 3]
  for (const d of seed) {
    const s = stateOf(si, sj, d)
    dist.set(s, 0)
    heap.push(0, s)
  }

  const forbiddenArrival = b.dir ? DIRS.indexOf(b.dir) : -1
  let goal = -1
  while (heap.size > 0) {
    const s = heap.pop()!
    const dCur = dist.get(s)!
    const dIdx = s % 4
    const j = ((s - dIdx) / 4) % ny
    const i = ((s - dIdx) / 4 - j) / ny
    if (i === ti && j === tj) {
      if (dIdx === forbiddenArrival && dist.size > seed.length) continue
      goal = s
      break
    }
    for (let nd = 0; nd < 4; nd++) {
      const dir = DIRS[nd]!
      if (dir === OPP[DIRS[dIdx]!]) continue // no doubling back on the same line
      let ni = i, nj = j, step = 0
      if (dir === 'left') { if (i === 0 || hBlocked[j]![i - 1]) continue; ni = i - 1; step = X[i]! - X[ni]! }
      else if (dir === 'right') { if (i === X.length - 1 || hBlocked[j]![i]) continue; ni = i + 1; step = X[ni]! - X[i]! }
      else if (dir === 'top') { if (j === 0 || vBlocked[i]![j - 1]) continue; nj = j - 1; step = Y[j]! - Y[nj]! }
      else { if (j === Y.length - 1 || vBlocked[i]![j]) continue; nj = j + 1; step = Y[nj]! - Y[j]! }
      const cost = dCur + step + (nd === dIdx ? 0 : BEND)
      const nState = stateOf(ni, nj, nd)
      if (cost < (dist.get(nState) ?? Infinity)) {
        dist.set(nState, cost)
        prev.set(nState, s)
        heap.push(cost, nState)
      }
    }
  }
  if (goal < 0) return null

  const path: Pt[] = []
  for (let s: number | undefined = goal; s !== undefined; s = prev.get(s)) {
    const dIdx = s % 4
    const j = ((s - dIdx) / 4) % ny
    const i = ((s - dIdx) / 4 - j) / ny
    path.unshift({ x: X[i]!, y: Y[j]! })
  }
  return [{ x: a.x, y: a.y }, sa, ...path, sb, { x: b.x, y: b.y }]
}

/**
 * Route one pipe from `a` to `b`.
 * `others`: footprints of every OTHER solid widget (inflated by PAD here).
 * `own`: the two end symbols' own footprints — they block at zero inflation
 * (a run may hug them, never cut through) and never block the port stubs.
 */
export function routePipe(a: RouteEnd, b: RouteEnd, others: Rect[], own: Rect[]): Pt[] {
  // P&ID parity: facing collinear ports at close range route straight,
  // obstacles ignored (the 'normal'-router special case in shapes.ts)
  if (a.dir && b.dir && b.dir === OPP[a.dir]) {
    const horiz = a.dir === 'left' || a.dir === 'right'
    const off = horiz ? Math.abs(a.y - b.y) : Math.abs(a.x - b.x)
    const toward = horiz ? Math.sign(b.x - a.x) === DX[a.dir] : Math.sign(b.y - a.y) === DY[a.dir]
    const span = horiz ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
    if (off <= 1 && toward && span <= 120) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]
    // nozzles a few px out of line must not jog mid-run: hide the offset in
    // a bend right at the source stub, then run dead straight on b's axis
    if (off > 1 && off <= 8 && toward && span > STUB * 2) {
      const j1 = horiz ? { x: a.x + DX[a.dir] * STUB, y: a.y } : { x: a.x, y: a.y + DY[a.dir] * STUB }
      const j2 = horiz ? { x: j1.x, y: b.y } : { x: b.x, y: j1.y }
      const lane = others.map((r) => inflate(r, PAD))
      const clear = ![[j1, j2], [j2, { x: b.x, y: b.y }]].some(([p, q]) => lane.some((r) => segCrossesRect(p!, q!, r)))
      if (clear) return collapse([{ x: a.x, y: a.y }, j1, j2, { x: b.x, y: b.y }])
    }
  }
  const blocks = [...others.map((r) => inflate(r, PAD)), ...own]
  const routed = gridRoute(a, b, blocks)
  if (routed) return collapse(routed)
  return collapse([{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }])
}

/** Orthogonalize a user-bent run (vertices kept): insert the elbow order
 *  that avoids equipment where one of the two options does. */
export function orthogonalizeVia(points: Pt[], obstacles: Rect[]): Pt[] {
  const blocks = obstacles.map((r) => inflate(r, PAD))
  const out: Pt[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1]!, b = points[i]!
    if (Math.abs(b.x - a.x) > 6 && Math.abs(b.y - a.y) > 6) {
      const hFirst: Pt = { x: b.x, y: a.y }
      const vFirst: Pt = { x: a.x, y: b.y }
      const clear = (mid: Pt) => !blocks.some((r) => segCrossesRect(a, mid, r) || segCrossesRect(mid, b, r))
      out.push(clear(hFirst) || !clear(vFirst) ? hFirst : vFirst)
    }
    out.push(b)
  }
  return collapse(out)
}
