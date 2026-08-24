import { create } from 'zustand'
import { useEffect } from 'react'
import type { HmiScreen } from './model'
import type { SimModel } from './sim/engine'
import { buildSimModel, initTags, tick } from './sim/engine'
import type { AlarmRecord, JournalEntry, SuppressionSets } from './sim/alarms'
import type { Tags } from './sim/engine'
import { ackAlarms, alarmEvents, evalAlarms } from './sim/alarms'
import { pushCommand } from './sim/commands'
import { pipeFlowMap } from './sim/network'
import { makeRng } from './sim/noise'
import { parseSignalRef } from './tagIndex'

const HISTORY_CAP = 1200 // 4 min at 1×, 20 min at 5×
const JOURNAL_CAP = 200
const SEED = 1234
let model: SimModel | null = null
let rng = makeRng(SEED)

/**
 * Runtime state lives OUTSIDE the doc store on purpose: sim ticks and operator
 * actions must never enter drawing undo history or autosave churn.
 */
interface SimStoreState {
  mode: 'edit' | 'run'
  playing: boolean
  speed: 1 | 5
  t: number
  tags: Tags
  pipeFlows: Record<string, number>
  /** Live flow through each pump/valve tag — faceplate readout. */
  equipFlows: Record<string, number>
  alarms: AlarmRecord[]
  /** Newest-first journal: alarm lifecycle AND operator commands, capped. */
  journal: JournalEntry[]
  /** Sample series keyed 'TAG.SIGNAL' (PV for every tag, SP/OP for
   *  controllers), index-aligned with historyT (the shared time axis). */
  history: Record<string, number[]>
  historyT: number[]
  /** ISA-18.2 suppression the operator controls: shelved alarm id -> the sim
   *  time it un-shelves; tags taken out of service. */
  shelved: Record<string, number>
  oos: Record<string, true>
  /** Pass every screen for a plant-wide run (navigation keeps simulating). */
  enterRun(screens: HmiScreen | HmiScreen[]): void
  exitRun(): void
  playPause(): void
  setSpeed(s: 1 | 5): void
  reset(): void
  tickOnce(dt: number): void
  writeTag(tag: string, signal: string, value: number): void
  ack(id?: string): void
  shelve(id: string, minutes: number): void
  unshelve(id: string): void
  toggleOos(tag: string): void
}

/** Suppressed-by-design: a flow measurement whose branch has pumps that are
 *  all commanded off is EXPECTED to read nothing — its low alarms are noise. */
function sbdSet(tags: Tags): Set<string> {
  const out = new Set<string>()
  if (!model) return out
  for (const d of model.defs) {
    if (!d.bindPipe) continue
    const br = model.net.branches.find((b) => b.pipeIds.includes(d.bindPipe!))
    if (br && br.pumps.length > 0 && br.pumps.every((p) => (tags[p]?.RUN ?? 0) < 0.5)) out.add(d.name)
  }
  return out
}

function supSets(shelved: Record<string, number>, oos: Record<string, true>, tags: Tags): SuppressionSets {
  return { shelvedIds: new Set(Object.keys(shelved)), oosTags: new Set(Object.keys(oos)), sbdTags: sbdSet(tags) }
}

export const useSimStore = create<SimStoreState>()((set, get) => ({
  mode: 'edit', playing: false, speed: 1, t: 0,
  tags: {}, pipeFlows: {}, equipFlows: {}, alarms: [], journal: [], history: {}, historyT: [], shelved: {}, oos: {},

  enterRun: (screens) => {
    model = buildSimModel(screens)
    rng = makeRng(SEED)
    set({ mode: 'run', playing: true, t: 0, tags: initTags(model), pipeFlows: {}, equipFlows: {}, alarms: [], journal: [], history: {}, historyT: [], shelved: {}, oos: {} })
  },
  exitRun: () => {
    model = null
    set({ mode: 'edit', playing: false, t: 0, tags: {}, pipeFlows: {}, equipFlows: {}, alarms: [], journal: [], history: {}, historyT: [], shelved: {}, oos: {} })
  },
  playPause: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  reset: () => {
    if (!model) return
    rng = makeRng(SEED)
    set({ t: 0, tags: initTags(model), pipeFlows: {}, equipFlows: {}, alarms: [], journal: [], history: {}, historyT: [], shelved: {}, oos: {}, playing: true })
  },
  tickOnce: (dt) => {
    if (!model) return
    const s = get()
    const { tags, branchFlows } = tick(model, s.tags, dt, rng)
    const t = s.t + dt
    const history: Record<string, number[]> = { ...s.history }
    const historyT = [...s.historyT, t].slice(-HISTORY_CAP)
    const record = (name: string, sig: string) => {
      const v = tags[name]?.[sig]
      if (v === undefined) return
      const key = `${name}.${sig}`
      history[key] = [...(history[key] ?? []), v].slice(-HISTORY_CAP)
    }
    for (const d of model.defs) {
      record(d.name, 'PV')
      if (d.kind === 'controller') {
        record(d.name, 'SP')
        record(d.name, 'OP')
      }
    }
    // shelf expiry: shelved alarms come back on their own — that's the point
    let shelved = s.shelved
    let journal0 = s.journal
    for (const [id, until] of Object.entries(s.shelved)) {
      if (t < until) continue
      if (shelved === s.shelved) shelved = { ...s.shelved }
      delete shelved[id]
      journal0 = pushCommand(journal0, { t, tag: id.split(':')[0]!, what: 'CMD', sig: 'SHELVE', from: 1, to: 0 }, JOURNAL_CAP)
    }
    const alarms = evalAlarms(model.defs, tags, s.alarms, t, supSets(shelved, s.oos, tags))
    const journal = [...alarmEvents(s.alarms, alarms, t).reverse(), ...journal0].slice(0, JOURNAL_CAP)
    const equipFlows: Record<string, number> = {}
    for (const b of model.net.branches) {
      const f = branchFlows[b.id]!
      for (const p of b.pumps) equipFlows[p] = Math.max(equipFlows[p] ?? 0, f)
      for (const v of b.valves) equipFlows[v] = Math.max(equipFlows[v] ?? 0, f)
    }
    set({ t, tags, pipeFlows: pipeFlowMap(model.net, branchFlows), equipFlows, alarms, journal, history, historyT, shelved })
  },
  writeTag: (tag, signal, value) => {
    let tg = tag, sig = signal
    if (sig === '') {
      const ref = parseSignalRef(tag)
      if (!ref) return
      tg = ref.tag
      sig = ref.signal
    }
    set((s) => {
      const from = s.tags[tg]?.[sig] ?? 0
      // every operator action lands in the journal (a repeated no-op doesn't)
      const journal = from === value ? s.journal
        : pushCommand(s.journal, { t: s.t, tag: tg, what: 'CMD', sig, from, to: value }, JOURNAL_CAP)
      return { tags: { ...s.tags, [tg]: { ...s.tags[tg], [sig]: value } }, journal }
    })
  },
  ack: (id) =>
    set((s) => {
      const alarms = ackAlarms(s.alarms, id)
      return { alarms, journal: [...alarmEvents(s.alarms, alarms, s.t).reverse(), ...s.journal].slice(0, JOURNAL_CAP) }
    }),
  // suppression actions re-stamp the records immediately so the banner and
  // summary react even while the sim is paused
  shelve: (id, minutes) =>
    set((s) => {
      const shelved = { ...s.shelved, [id]: s.t + minutes * 60 }
      const alarms = model ? evalAlarms(model.defs, s.tags, s.alarms, s.t, supSets(shelved, s.oos, s.tags)) : s.alarms
      return {
        shelved, alarms,
        journal: pushCommand(s.journal, { t: s.t, tag: id.split(':')[0]!, what: 'CMD', sig: 'SHELVE', from: 0, to: minutes }, JOURNAL_CAP),
      }
    }),
  unshelve: (id) =>
    set((s) => {
      if (!(id in s.shelved)) return s
      const shelved = { ...s.shelved }
      delete shelved[id]
      const alarms = model ? evalAlarms(model.defs, s.tags, s.alarms, s.t, supSets(shelved, s.oos, s.tags)) : s.alarms
      return {
        shelved, alarms,
        journal: pushCommand(s.journal, { t: s.t, tag: id.split(':')[0]!, what: 'CMD', sig: 'SHELVE', from: 1, to: 0 }, JOURNAL_CAP),
      }
    }),
  toggleOos: (tag) =>
    set((s) => {
      const oos = { ...s.oos }
      const on = !(tag in oos)
      if (on) oos[tag] = true
      else delete oos[tag]
      const alarms = model ? evalAlarms(model.defs, s.tags, s.alarms, s.t, supSets(s.shelved, oos, s.tags)) : s.alarms
      return {
        oos, alarms,
        journal: pushCommand(s.journal, { t: s.t, tag, what: 'CMD', sig: 'OOS', from: on ? 0 : 1, to: on ? 1 : 0 }, JOURNAL_CAP),
      }
    }),
}))

/** Drives the sim while mounted: 5 Hz wall clock, dt scaled by speed. */
export function useSimEngine(): void {
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  useEffect(() => {
    if (mode !== 'run' || !playing) return
    const h = setInterval(() => useSimStore.getState().tickOnce(0.2 * speed), 200)
    return () => clearInterval(h)
  }, [mode, playing, speed])
}
