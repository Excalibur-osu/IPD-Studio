import type { TagDef } from './tags'
import type { Tags } from './engine'

export type AlarmLevel = 'LL' | 'L' | 'H' | 'HH'
/** ISA-18.2-flavored lifecycle: active (unacked) -> acked; return-to-normal
 *  turns active into cleared (still listed until acked) and drops acked. */
export type AlarmPhase = 'active' | 'acked' | 'cleared'
export interface AlarmRecord { id: string; tag: string; level: AlarmLevel; phase: AlarmPhase; since: number }

/** HH/LL trip limits are critical; H/L are warnings. */
export type AlarmPriority = 'high' | 'warn'
export const priorityOf = (level: AlarmLevel): AlarmPriority =>
  level === 'HH' || level === 'LL' ? 'high' : 'warn'

/** Chronological journal entry: what happened to which alarm at sim time t. */
export interface AlarmEvent { t: number; tag: string; level: AlarmLevel; what: 'ALARM' | 'RTN' | 'ACK' }

/** Diff two alarm lists into journal events (raise / return-to-normal / ack). */
export function alarmEvents(prev: AlarmRecord[], next: AlarmRecord[], t: number): AlarmEvent[] {
  const before = new Map(prev.map((a) => [a.id, a]))
  const out: AlarmEvent[] = []
  for (const a of next) {
    const was = before.get(a.id)
    if (a.phase === 'active' && (!was || was.phase === 'cleared')) out.push({ t, tag: a.tag, level: a.level, what: 'ALARM' })
    else if (was && a.phase === 'cleared' && was.phase === 'active') out.push({ t, tag: a.tag, level: a.level, what: 'RTN' })
    else if (was && a.phase === 'acked' && was.phase !== 'acked') out.push({ t, tag: a.tag, level: a.level, what: 'ACK' })
  }
  for (const was of prev) {
    // an acked alarm silently dropped on return-to-normal, or a cleared one
    // removed by ack — record what physically happened
    if (next.some((a) => a.id === was.id)) continue
    if (was.phase === 'acked') out.push({ t, tag: was.tag, level: was.level, what: 'RTN' })
    else if (was.phase === 'cleared') out.push({ t, tag: was.tag, level: was.level, what: 'ACK' })
  }
  return out
}

function violated(level: AlarmLevel, limit: number, pv: number): boolean {
  return level === 'H' || level === 'HH' ? pv >= limit : pv <= limit
}

export function evalAlarms(defs: TagDef[], tags: Tags, prev: AlarmRecord[], t: number): AlarmRecord[] {
  const byId = new Map(prev.map((a) => [a.id, a]))
  const out: AlarmRecord[] = []
  for (const d of defs) {
    if (!d.limits) continue
    const pv = tags[d.name]?.PV
    if (pv === undefined) continue
    for (const level of ['LL', 'L', 'H', 'HH'] as AlarmLevel[]) {
      const limit = d.limits[level]
      if (limit === undefined) continue
      const id = `${d.name}:${level}`
      const existing = byId.get(id)
      if (violated(level, limit, pv)) {
        out.push(
          existing && existing.phase !== 'cleared'
            ? existing
            : { id, tag: d.name, level, phase: 'active', since: existing?.phase === 'cleared' ? t : existing?.since ?? t },
        )
      } else if (existing) {
        if (existing.phase === 'active') out.push({ ...existing, phase: 'cleared' })
        else if (existing.phase === 'cleared') out.push(existing)
        // 'acked' + back to normal -> drop silently
      }
    }
  }
  return out
}

/** Ack one alarm (by id) or all: active -> acked, cleared -> removed. */
export function ackAlarms(alarms: AlarmRecord[], id?: string): AlarmRecord[] {
  return alarms.flatMap((a) => {
    if (id !== undefined && a.id !== id) return [a]
    if (a.phase === 'active') return [{ ...a, phase: 'acked' as const }]
    if (a.phase === 'cleared') return []
    return [a]
  })
}
