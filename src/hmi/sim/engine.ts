import type { HmiScreen } from '../model'
import type { TagDef } from './tags'
import { buildTagDefs } from './tags'
import type { Branch, FlowNetwork } from './network'
import { buildNetwork } from './network'

export interface ControllerSpec {
  tag: string
  pvTag: string
  outTag?: string
  /** +1 = reverse-acting (valve feeds the tank: open on low PV); -1 = direct
   *  (valve drains the tank: close on low PV). Derived from the flow network. */
  action?: 1 | -1
}
export interface SimModel { defs: TagDef[]; net: FlowNetwork; controllers: ControllerSpec[] }
export type Tags = Record<string, Record<string, number>>

const PUMP_RATED = 10
/** Tank-sourced branch with no pump: modest gravity drain. */
const GRAVITY = 4
const KP = 1.5
const KI = 0.4

/** Compile one screen — or the whole plant (every screen) so RUN keeps
 *  simulating while the operator navigates between pages. Tag defs merge
 *  globally; flow networks stay per-screen (pipe coordinates are page-local),
 *  branch ids are re-namespaced so concatenation cannot collide. */
export function buildSimModel(screens: HmiScreen | HmiScreen[]): SimModel {
  const list = Array.isArray(screens) ? screens : [screens]
  const defs = buildTagDefs(list)
  const branches = list.flatMap((sc, i) =>
    buildNetwork(sc).branches.map((b) => ({ ...b, id: `S${i}:${b.id}` })),
  )
  const net: FlowNetwork = { branches }
  const controllers = wireControllers(defs).map((c) => ({ ...c, action: controllerAction(c, defs, net) }))
  return { defs, net, controllers }
}

/** A level controller whose valve sits on the measured tank's OUTLET must be
 *  direct-acting (low level -> close the drain), not reverse-acting. */
function controllerAction(c: ControllerSpec, defs: TagDef[], net: FlowNetwork): 1 | -1 {
  if (!c.outTag) return 1
  const pvDef = defs.find((d) => d.name === c.pvTag)
  const tank = pvDef?.kind === 'tank' ? pvDef.name : pvDef?.bindTank
  if (!tank) return 1
  const br = net.branches.find((b) => b.valves.includes(c.outTag!))
  return br && br.from.kind === 'tank' && br.from.tag === tank ? -1 : 1
}

/** Family+loop matching: LIC-101 pairs with LT-101 (PV) and LV-101 (OP target). */
export function wireControllers(defs: TagDef[]): ControllerSpec[] {
  const out: ControllerSpec[] = []
  const parse = (name: string) => /^([A-Z])[A-Z]*-?(\w+)$/.exec(name)
  for (const c of defs) {
    if (c.kind !== 'controller') continue
    const m = parse(c.name)
    if (!m) continue
    const [, family, loop] = m
    const partner = (pred: (d: TagDef) => boolean) =>
      defs.find((d) => {
        const pm = parse(d.name)
        return !!pm && pm[1] === family && pm[2] === loop && pred(d)
      })
    const pv = partner((d) => d.kind === 'display' || d.kind === 'tank')
    const valve = partner((d) => d.kind === 'valve')
    // PV-only wiring is valid: the controller tracks its measurement even
    // when no throttling valve shares the loop (its PI just has no output).
    if (pv) out.push(valve ? { tag: c.name, pvTag: pv.name, outTag: valve.name } : { tag: c.name, pvTag: pv.name })
  }
  return out
}

export function initTags(model: SimModel): Tags {
  // Calm start: a professional screen comes up with nothing moving and no
  // alarms until an operator (or a live control loop) acts. Every hand valve
  // that actually sits in a flow path starts CLOSED (lining up the valves IS
  // the operator's job — and an open drain stub or transfer line would
  // silently empty its tank before anyone touched a thing); a throttling
  // valve no controller drives starts at 0%. Unpiped decorative valves stay
  // open so they don't read as faults.
  const piped = new Set(model.net.branches.flatMap((b) => b.valves))
  const driven = new Set(model.controllers.map((c) => c.outTag).filter(Boolean))
  const tags: Tags = {}
  for (const d of model.defs) {
    switch (d.kind) {
      case 'tank': tags[d.name] = { PV: d.level0 ?? 40 }; break
      case 'motor': tags[d.name] = { RUN: 0 }; break
      case 'valve': tags[d.name] = { OP: driven.has(d.name) ? 40 : 0 }; break
      case 'valveOnOff': tags[d.name] = { OPEN: piped.has(d.name) ? 0 : 1 }; break
      case 'display': tags[d.name] = { PV: d.base ?? (d.min + d.max) / 2 }; break
      case 'controller': tags[d.name] = { PV: 0, SP: 50, OP: 40, MODE: 1, I: 0 }; break
    }
  }
  return tags
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function branchFlow(b: Branch, tags: Tags, tankLevel: (t: string) => number): number {
  // Calm-start physics: free-end sources are PASSIVE — flow needs a running
  // pump on the branch. Only tank-sourced branches move without one (gravity),
  // and gravity to a dead end needs a valve in the path: an unvalved stub
  // (a line ending in an off-page arrow) must not drain a tank forever with
  // no way for the operator to stop it.
  let driver: number
  if (b.pumps.length > 0) driver = b.pumps.every((p) => (tags[p]?.RUN ?? 0) >= 0.5) ? PUMP_RATED : 0
  else if (b.from.kind === 'tank') {
    const uncontrollableStub = b.to.kind === 'sink' && b.valves.length === 0
    driver = b.fromBottom && !uncontrollableStub ? GRAVITY : 0 // top lines (vent/relief) don't siphon liquid
  }
  else driver = 0
  for (const v of b.valves) {
    const t = tags[v]
    const frac = t?.OP !== undefined ? clamp(t.OP / 100, 0, 1) : (t?.OPEN ?? 1) >= 0.5 ? 1 : 0
    driver *= frac
  }
  if (b.from.kind === 'tank' && tankLevel(b.from.tag) <= 0.5) return 0
  if (b.to.kind === 'tank' && tankLevel(b.to.tag) >= 99.5) return 0
  return driver
}

/** One simulation step. Pure: never mutates its inputs. */
export function tick(model: SimModel, prev: Tags, dt: number, rng: () => number): { tags: Tags; branchFlows: Record<string, number> } {
  const tags: Tags = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v }]))

  // 1) controllers drive their valve OP: PI in AUTO, operator OP pass-through in MAN
  for (const c of model.controllers) {
    const t = tags[c.tag]
    if (!t) continue
    const pv = tags[c.pvTag]?.PV ?? 0
    t.PV = pv
    if (!c.outTag) continue // PV-only controller: nothing to drive
    if ((t.MODE ?? 0) < 0.5) {
      const manValve = tags[c.outTag]
      if (manValve && manValve.OP !== undefined) manValve.OP = t.OP ?? manValve.OP
      continue
    }
    const e = ((t.SP ?? 50) - pv) * (c.action ?? 1)
    // conditional integration (anti-windup): freeze I while the output is
    // saturated in the error's direction, else overshoot on big transitions
    let I = t.I ?? 0
    let op = clamp(KP * e + I, 0, 100)
    if (!((op >= 100 && e > 0) || (op <= 0 && e < 0))) {
      I = clamp(I + KI * e * dt, -100, 100)
      op = clamp(KP * e + I, 0, 100)
    }
    t.I = I
    t.OP = op
    const valve = tags[c.outTag]
    if (valve && valve.OP !== undefined) valve.OP = op
  }

  // 2) branch flows from the previous tick's levels
  const level = (tag: string) => prev[tag]?.PV ?? 0
  const branchFlows: Record<string, number> = {}
  for (const b of model.net.branches) branchFlows[b.id] = branchFlow(b, tags, level)

  // 3) integrate tanks
  for (const d of model.defs) {
    if (d.kind !== 'tank') continue
    let net = 0
    for (const b of model.net.branches) {
      if (b.to.kind === 'tank' && b.to.tag === d.name) net += branchFlows[b.id]!
      if (b.from.kind === 'tank' && b.from.tag === d.name) net -= branchFlows[b.id]!
    }
    const t = tags[d.name]!
    t.PV = clamp(t.PV! + (net / (d.capacity ?? 100)) * 100 * dt, 0, 100)
  }

  // 4) measurement displays
  for (const d of model.defs) {
    if (d.kind !== 'display') continue
    const t = tags[d.name]!
    if (d.bindTank) {
      t.PV = clamp((tags[d.bindTank]?.PV ?? 0) + (rng() - 0.5) * 0.8, 0, 100)
    } else if (d.bindPipe) {
      const b = model.net.branches.find((br) => br.pipeIds.includes(d.bindPipe!))
      t.PV = b ? branchFlows[b.id]! : 0
    } else {
      const base = d.base ?? (d.min + d.max) / 2
      const wander = (rng() - 0.5) * (d.max - d.min) * 0.01
      t.PV = clamp((t.PV ?? base) + wander + (base - (t.PV ?? base)) * 0.02, d.min, d.max)
    }
  }
  return { tags, branchFlows }
}
