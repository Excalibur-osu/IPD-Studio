import type { HmiPipe, HmiScreen, HmiWidget } from '../model'

export type EndRef = { kind: 'source' } | { kind: 'sink' } | { kind: 'tank'; tag: string }

/** One flow PATH from a source terminal to a sink/tank terminal. Fan-out at a
 *  pump or junction yields one branch per downstream leg; the shared pump's
 *  rating is split across them by conductance in solveFlows. */
export interface Branch {
  id: string
  from: EndRef
  to: EndRef
  /** For tank-sourced branches: does the pipe leave the tank's bottom half?
   *  Only bottom connections gravity-drain; a top (vent/relief/overflow)
   *  line must not siphon the liquid out. */
  fromBottom?: boolean
  pumps: string[]
  valves: string[]
  pipeIds: string[]
}

export interface FlowNetwork { branches: Branch[] }

/** A pipe endpoint attaches to a widget when it lies within the widget rect inflated by this. */
const ATTACH = 14
/** Runaway guards for pathological drawings. */
const MAX_PATH = 32
const MAX_BRANCHES = 128

function hitInflated(w: HmiWidget, p: { x: number; y: number }): boolean {
  return p.x >= w.x - ATTACH && p.x <= w.x + w.w + ATTACH && p.y >= w.y - ATTACH && p.y <= w.y + w.h + ATTACH
}

function widgetAt(screen: HmiScreen, p: { x: number; y: number }): HmiWidget | null {
  for (let i = screen.widgets.length - 1; i >= 0; i--) {
    const w = screen.widgets[i]!
    if (w.type !== 'tank' && w.type !== 'pump' && w.type !== 'valve' && w.type !== 'symbol') continue
    if (hitInflated(w, p)) return w
  }
  return null
}

export function buildNetwork(screen: HmiScreen): FlowNetwork {
  const heads = new Map<string, HmiPipe[]>() // widget id -> pipes leaving it
  const ends = new Map<HmiPipe, { a: HmiWidget | null; b: HmiWidget | null }>()
  const hasInflow = new Set<string>()
  for (const p of screen.pipes) {
    if (p.points.length < 2) continue
    const a = widgetAt(screen, p.points[0]!)
    const b = widgetAt(screen, p.points[p.points.length - 1]!)
    ends.set(p, { a, b })
    if (a) heads.set(a.id, [...(heads.get(a.id) ?? []), p])
    if (b) hasInflow.add(b.id)
  }
  const inline = (w: HmiWidget | null): w is HmiWidget =>
    !!w && (w.type === 'pump' || w.type === 'valve' || w.type === 'symbol')

  const branches: Branch[] = []
  let n = 0

  const emit = (path: HmiPipe[], from: EndRef, fromBottom: boolean | undefined, to: EndRef) => {
    if (branches.length >= MAX_BRANCHES) return
    const branch: Branch = {
      id: `B${++n}`, from, to,
      ...(fromBottom !== undefined ? { fromBottom } : {}),
      pumps: [], valves: [], pipeIds: path.map((p) => p.id),
    }
    // inline devices sit at the head of every pipe after the first (and at
    // the first pipe's head for a dangling chain start)
    path.forEach((p, i) => {
      const w = ends.get(p)!.a
      if (i === 0 && !inline(w)) return
      if (!w) return
      if (w.type === 'pump' && w.tag) branch.pumps.push(w.tag)
      if (w.type === 'valve' && w.tag) branch.valves.push(w.tag)
    })
    branches.push(branch)
  }

  const walk = (cur: HmiPipe, path: HmiPipe[], from: EndRef, fromBottom: boolean | undefined) => {
    if (path.includes(cur) || path.length >= MAX_PATH || branches.length >= MAX_BRANCHES) return
    const next = [...path, cur]
    const tail = ends.get(cur)!.b
    if (!tail) return emit(next, from, fromBottom, { kind: 'sink' })
    if (tail.type === 'tank' && tail.tag) return emit(next, from, fromBottom, { kind: 'tank', tag: tail.tag })
    // inline device: continue down EVERY outgoing pipe — this is the fan-out
    // the v1 chain walker dropped (its global used-set ate sibling legs)
    const outs = (heads.get(tail.id) ?? []).filter((q) => !next.includes(q))
    if (outs.length === 0) return emit(next, from, fromBottom, { kind: 'sink' })
    for (const q of outs) walk(q, next, from, fromBottom)
  }

  for (const p of screen.pipes) {
    if (!ends.has(p)) continue
    const { a } = ends.get(p)!
    // roots: free ends, tanks, or a dangling inline head nothing flows into
    if (inline(a) && hasInflow.has(a.id)) continue
    const fromTank = !!a && a.type === 'tank' && a.tag !== undefined
    const from: EndRef = fromTank ? { kind: 'tank', tag: a.tag! } : { kind: 'source' }
    const fromBottom = fromTank ? p.points[0]!.y > a.y + a.h * 0.55 : undefined
    walk(p, [], from, fromBottom)
  }
  return { branches }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Flow per branch. Conductance = product of valve fractions (× any pipe
 * factors, e.g. a plugged line); a pump's rating splits across the branches
 * that share it, proportional to conductance — an honest approximation, not
 * a pressure solve, and documented as such. Gravity branches don't split.
 */
export function solveFlows(
  net: FlowNetwork,
  frac: (valveTag: string) => number,
  pumpOn: (pumpTag: string) => number,
  tankLevel: (tag: string) => number,
  pipeFactor: ((pipeId: string) => number) | undefined,
  rating: { rated: number; gravity: number },
): Record<string, number> {
  const g: Record<string, number> = {}
  const driver: Record<string, number> = {}
  for (const b of net.branches) {
    let cond = 1
    for (const v of b.valves) cond *= clamp01(frac(v))
    if (pipeFactor) for (const id of b.pipeIds) cond *= clamp01(pipeFactor(id))
    if (b.from.kind === 'tank' && tankLevel(b.from.tag) <= 0.5) cond = 0
    if (b.to.kind === 'tank' && tankLevel(b.to.tag) >= 99.5) cond = 0
    g[b.id] = cond
    if (b.pumps.length > 0) {
      // calm-start doctrine holds: every pump on the path must be driving
      const ramp = Math.min(...b.pumps.map((p) => clamp01(pumpOn(p))))
      driver[b.id] = ramp > 0 ? rating.rated * ramp : 0
    } else if (b.from.kind === 'tank') {
      const uncontrollableStub = b.to.kind === 'sink' && b.valves.length === 0
      driver[b.id] = b.fromBottom && !uncontrollableStub ? rating.gravity : 0
    } else {
      driver[b.id] = 0 // free-end sources are passive without a pump
    }
  }

  const byPump = new Map<string, string[]>()
  for (const b of net.branches) for (const p of b.pumps) byPump.set(p, [...(byPump.get(p) ?? []), b.id])

  const flows: Record<string, number> = {}
  for (const b of net.branches) {
    const cond = g[b.id]!
    const drive = driver[b.id]!
    if (cond === 0 || drive === 0) { flows[b.id] = 0; continue }
    if (b.pumps.length === 0) { flows[b.id] = drive * cond; continue }
    let f = Infinity
    for (const p of b.pumps) {
      // max(1, Σg): a single restricted leg still feels its valve (drive × g,
      // the v1 behavior); only genuinely competing open legs split the rating
      const total = Math.max(1, byPump.get(p)!.reduce((s, id) => s + g[id]!, 0))
      f = Math.min(f, drive * (cond / total))
    }
    flows[b.id] = f
  }
  return flows
}

/** Expand per-branch flows to per-pipe flows for the canvas animation.
 *  Branches share header pipes, so flows SUM. */
export function pipeFlowMap(net: FlowNetwork, branchFlows: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of net.branches) for (const id of b.pipeIds) out[id] = (out[id] ?? 0) + (branchFlows[b.id] ?? 0)
  return out
}
