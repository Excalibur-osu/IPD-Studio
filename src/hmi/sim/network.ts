import type { HmiPipe, HmiScreen, HmiWidget } from '../model'

export type EndRef = { kind: 'source' } | { kind: 'sink' } | { kind: 'tank'; tag: string }

export interface Branch {
  id: string
  from: EndRef
  to: EndRef
  pumps: string[]
  valves: string[]
  pipeIds: string[]
}

export interface FlowNetwork { branches: Branch[] }

/** A pipe endpoint attaches to a widget when it lies within the widget rect inflated by this. */
const ATTACH = 14

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
  const start = new Map<string, HmiPipe[]>()
  const ends = new Map<HmiPipe, { a: HmiWidget | null; b: HmiWidget | null }>()
  for (const p of screen.pipes) {
    if (p.points.length < 2) continue
    const a = widgetAt(screen, p.points[0]!)
    const b = widgetAt(screen, p.points[p.points.length - 1]!)
    ends.set(p, { a, b })
    if (a) start.set(a.id, [...(start.get(a.id) ?? []), p])
  }
  const inline = (w: HmiWidget | null): w is HmiWidget =>
    !!w && (w.type === 'pump' || w.type === 'valve' || w.type === 'symbol')

  const used = new Set<string>()
  const branches: Branch[] = []
  let n = 0

  for (const p of screen.pipes) {
    if (!ends.has(p) || used.has(p.id)) continue
    const { a } = ends.get(p)!
    // only begin a branch at a non-inline start (tank / free end), or an inline
    // element nothing flows into (dangling chain head)
    if (inline(a) && screen.pipes.some((q) => q !== p && !used.has(q.id) && ends.get(q)?.b?.id === a.id)) continue

    const branch: Branch = {
      id: `B${++n}`,
      from: a && a.type === 'tank' && a.tag ? { kind: 'tank', tag: a.tag } : { kind: 'source' },
      to: { kind: 'sink' },
      pumps: [], valves: [], pipeIds: [],
    }
    if (inline(a)) {
      if (a.type === 'pump' && a.tag) branch.pumps.push(a.tag)
      if (a.type === 'valve' && a.tag) branch.valves.push(a.tag)
    }
    let cur: HmiPipe | undefined = p
    while (cur && !used.has(cur.id)) {
      used.add(cur.id)
      branch.pipeIds.push(cur.id)
      const tail: HmiWidget | null = ends.get(cur)!.b
      if (!tail) { branch.to = { kind: 'sink' }; break }
      if (tail.type === 'tank' && tail.tag) { branch.to = { kind: 'tank', tag: tail.tag }; break }
      if (tail.type === 'pump' && tail.tag) branch.pumps.push(tail.tag)
      if (tail.type === 'valve' && tail.tag) branch.valves.push(tail.tag)
      cur = (start.get(tail.id) ?? []).find((q) => !used.has(q.id))
      if (!cur) { branch.to = { kind: 'sink' }; break }
    }
    branches.push(branch)
  }
  return { branches }
}

/** Expand per-branch flows to per-pipe flows for the canvas animation. */
export function pipeFlowMap(net: FlowNetwork, branchFlows: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of net.branches) for (const id of b.pipeIds) out[id] = branchFlows[b.id] ?? 0
  return out
}
