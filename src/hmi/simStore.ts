import { create } from 'zustand'
import { useEffect } from 'react'
import type { HmiScreen } from './model'
import type { SimModel, Tags } from './sim/engine'
import { buildSimModel, initTags, tick } from './sim/engine'
import type { AlarmEvent, AlarmRecord } from './sim/alarms'
import { ackAlarms, alarmEvents, evalAlarms } from './sim/alarms'
import { pipeFlowMap } from './sim/network'
import { makeRng } from './sim/noise'

const HISTORY_CAP = 600
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
  alarms: AlarmRecord[]
  /** Newest-first alarm journal (raise / return / ack), capped. */
  journal: AlarmEvent[]
  history: Record<string, number[]>
  /** Pass every screen for a plant-wide run (navigation keeps simulating). */
  enterRun(screens: HmiScreen | HmiScreen[]): void
  exitRun(): void
  playPause(): void
  setSpeed(s: 1 | 5): void
  reset(): void
  tickOnce(dt: number): void
  writeTag(tag: string, signal: string, value: number): void
  ack(id?: string): void
}

export const useSimStore = create<SimStoreState>()((set, get) => ({
  mode: 'edit', playing: false, speed: 1, t: 0,
  tags: {}, pipeFlows: {}, alarms: [], journal: [], history: {},

  enterRun: (screens) => {
    model = buildSimModel(screens)
    rng = makeRng(SEED)
    set({ mode: 'run', playing: true, t: 0, tags: initTags(model), pipeFlows: {}, alarms: [], journal: [], history: {} })
  },
  exitRun: () => {
    model = null
    set({ mode: 'edit', playing: false, t: 0, tags: {}, pipeFlows: {}, alarms: [], journal: [], history: {} })
  },
  playPause: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  reset: () => {
    if (!model) return
    rng = makeRng(SEED)
    set({ t: 0, tags: initTags(model), pipeFlows: {}, alarms: [], journal: [], history: {}, playing: true })
  },
  tickOnce: (dt) => {
    if (!model) return
    const s = get()
    const { tags, branchFlows } = tick(model, s.tags, dt, rng)
    const t = s.t + dt
    const history: Record<string, number[]> = { ...s.history }
    for (const d of model.defs) {
      const pv = tags[d.name]?.PV
      if (pv === undefined) continue
      history[d.name] = [...(history[d.name] ?? []), pv].slice(-HISTORY_CAP)
    }
    const alarms = evalAlarms(model.defs, tags, s.alarms, t)
    const journal = [...alarmEvents(s.alarms, alarms, t).reverse(), ...s.journal].slice(0, JOURNAL_CAP)
    set({ t, tags, pipeFlows: pipeFlowMap(model.net, branchFlows), alarms, journal, history })
  },
  writeTag: (tag, signal, value) => {
    let tg = tag, sig = signal
    if (sig === '') {
      const i = tag.lastIndexOf('.')
      if (i < 0) return
      tg = tag.slice(0, i)
      sig = tag.slice(i + 1)
    }
    set((s) => ({ tags: { ...s.tags, [tg]: { ...s.tags[tg], [sig]: value } } }))
  },
  ack: (id) =>
    set((s) => {
      const alarms = ackAlarms(s.alarms, id)
      return { alarms, journal: [...alarmEvents(s.alarms, alarms, s.t).reverse(), ...s.journal].slice(0, JOURNAL_CAP) }
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
