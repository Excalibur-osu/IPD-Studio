import type { HmiScreen } from '../model'
import type { TagDef } from './tags'
import { buildTagDefs } from './tags'
import type { Branch, FlowNetwork } from './network'
import { buildNetwork } from './network'

export interface ControllerSpec { tag: string; pvTag: string; outTag: string }
export interface SimModel { defs: TagDef[]; net: FlowNetwork; controllers: ControllerSpec[] }
export type Tags = Record<string, Record<string, number>>

const PUMP_RATED = 10
const SOURCE_HEAD = 6
const KP = 1.5
const KI = 0.4

export function buildSimModel(screen: HmiScreen): SimModel {
  const defs = buildTagDefs(screen)
  return { defs, net: buildNetwork(screen), controllers: wireControllers(defs) }
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
    if (pv && valve) out.push({ tag: c.name, pvTag: pv.name, outTag: valve.name })
  }
  return out
}

export function initTags(model: SimModel): Tags {
  const tags: Tags = {}
  for (const d of model.defs) {
    switch (d.kind) {
      case 'tank': tags[d.name] = { PV: d.level0 ?? 40 }; break
      case 'motor': tags[d.name] = { RUN: 0 }; break
      case 'valve': tags[d.name] = { OP: 40 }; break
      case 'valveOnOff': tags[d.name] = { OPEN: 1 }; break
      case 'display': tags[d.name] = { PV: d.base ?? (d.min + d.max) / 2 }; break
      case 'controller': tags[d.name] = { PV: 0, SP: 50, OP: 40, MODE: 1, I: 0 }; break
    }
  }
  return tags
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function branchFlow(b: Branch, tags: Tags, tankLevel: (t: string) => number): number {
  let driver = b.pumps.length > 0
    ? (b.pumps.every((p) => (tags[p]?.RUN ?? 0) >= 0.5) ? PUMP_RATED : 0)
    : SOURCE_HEAD
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
    if ((t.MODE ?? 0) < 0.5) {
      const manValve = tags[c.outTag]
      if (manValve && manValve.OP !== undefined) manValve.OP = t.OP ?? manValve.OP
      continue
    }
    const e = (t.SP ?? 50) - pv
    t.I = clamp((t.I ?? 0) + KI * e * dt, -100, 100)
    const op = clamp(KP * e + t.I, 0, 100)
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
