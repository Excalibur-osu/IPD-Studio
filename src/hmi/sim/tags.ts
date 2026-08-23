import type { HmiScreen, HmiWidget } from '../model'

export type TagKind = 'tank' | 'motor' | 'valve' | 'valveOnOff' | 'display' | 'controller'

export interface TagDef {
  name: string
  kind: TagKind
  unit?: string
  min: number
  max: number
  limits?: { LL?: number; L?: number; H?: number; HH?: number }
  capacity?: number
  level0?: number
  bindTank?: string
  bindPipe?: string
  base?: number
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function defFor(w: HmiWidget): TagDef | null {
  if (!w.tag) return null
  const p = w.props ?? {}
  switch (w.type) {
    case 'tank':
      return {
        name: w.tag, kind: 'tank', unit: '%', min: 0, max: 100,
        capacity: num(p.capacity) ?? (w.w * w.h) / 40,
        level0: num(p.level0) ?? 40,
        limits: { LL: num(p.LL) ?? 5, L: num(p.L) ?? 10, H: num(p.H) ?? 90, HH: num(p.HH) ?? 95 },
      }
    case 'pump':
      return { name: w.tag, kind: 'motor', min: 0, max: 1 }
    case 'valve':
      return { name: w.tag, kind: p.throttle === true ? 'valve' : 'valveOnOff', min: 0, max: 100 }
    case 'display':
    case 'gauge':
    case 'bar':
    case 'trend': {
      const limits = [p.LL, p.L, p.H, p.HH].some((v) => num(v) !== undefined)
        ? { LL: num(p.LL), L: num(p.L), H: num(p.H), HH: num(p.HH) }
        : undefined
      return {
        name: w.tag, kind: p.controller === true ? 'controller' : 'display',
        unit: typeof p.unit === 'string' ? p.unit : undefined,
        min: num(p.min) ?? 0, max: num(p.max) ?? 100, limits,
        bindTank: typeof p.bindTank === 'string' ? p.bindTank : undefined,
        bindPipe: typeof p.bindPipe === 'string' ? p.bindPipe : undefined,
        base: num(p.base),
      }
    }
    default:
      return null
  }
}

/** One TagDef per distinct widget tag. Physical kinds (tank/motor/valve/
 *  controller) outrank plain displays, so a Trend placed before its Tank
 *  cannot demote the tag to a drifting display. Accepts one screen or the
 *  whole plant (all screens) — tags are global across screens. */
export function buildTagDefs(screens: Pick<HmiScreen, 'widgets'> | Pick<HmiScreen, 'widgets'>[]): TagDef[] {
  const list = Array.isArray(screens) ? screens : [screens]
  const rank = (k: TagKind) => (k === 'display' ? 1 : 2)
  const out = new Map<string, TagDef>()
  for (const screen of list) {
    for (const w of screen.widgets) {
      const d = defFor(w)
      if (!d) continue
      const existing = out.get(d.name)
      if (!existing || rank(d.kind) > rank(existing.kind)) out.set(d.name, d)
    }
  }
  return [...out.values()]
}
