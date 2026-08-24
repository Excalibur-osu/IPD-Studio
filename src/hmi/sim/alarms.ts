import type { TagDef } from './tags'
import type { Tags } from './engine'

export type AlarmLevel = 'LL' | 'L' | 'H' | 'HH'
/** ISA-18.2-flavored lifecycle: pending (on-delay running, never annunciated)
 *  -> active (unacked) -> acked; return-to-normal turns active into cleared
 *  (still listed until acked) and drops acked. */
export type AlarmPhase = 'pending' | 'active' | 'acked' | 'cleared'
export type AlarmPriority = 'high' | 'medium' | 'low'
/** Why an alarm is currently not annunciating. */
export type Suppression = 'shelved' | 'oos' | 'design'

export interface AlarmRecord {
  id: string
  tag: string
  level: AlarmLevel
  phase: AlarmPhase
  since: number
  /** Resolved priority — the per-tag override is applied at eval time so the
   *  UI never needs the TagDef. */
  priority: AlarmPriority
  /** PV at the moment the alarm tripped. */
  value?: number
  sup?: Suppression
}

/** Defaults: HH/LL high, H/L medium. A per-tag priority override moves the
 *  H/L pair; HH/LL always sit one step above it (never below medium). */
export function priorityOf(level: AlarmLevel, def?: Pick<TagDef, 'priority'>): AlarmPriority {
  const base = def?.priority ?? 'medium'
  if (level === 'HH' || level === 'LL') return base === 'low' ? 'medium' : 'high'
  return base
}

/** Operator/state-driven suppression, evaluated OUTSIDE the record list —
 *  records get recreated on re-violation, so a flag on them would evaporate. */
export interface SuppressionSets {
  shelvedIds?: ReadonlySet<string>
  oosTags?: ReadonlySet<string>
  sbdTags?: ReadonlySet<string>
}

/** Chronological journal entry: what happened to which alarm at sim time t. */
export interface AlarmEvent { t: number; tag: string; level: AlarmLevel; what: 'ALARM' | 'RTN' | 'ACK' }

/** Operator action: a Start/Stop, setpoint change, mode switch, shelve… The
 *  raw before/after values are kept so a slider burst can coalesce into one
 *  entry without losing where it started. */
export interface CommandEvent { t: number; tag: string; what: 'CMD'; sig: string; from: number; to: number }

/** The journal holds alarm history AND operator actions, newest first. */
export type JournalEntry = AlarmEvent | CommandEvent

/** Diff two alarm lists into journal events (raise / return-to-normal / ack).
 *  Suppressed and pending records are invisible here: entering or leaving
 *  suppression must not spam RTN/ALARM (the shelve/OOS command itself is
 *  journaled separately), and a pending alarm was never annunciated. */
export function alarmEvents(prev: AlarmRecord[], next: AlarmRecord[], t: number): AlarmEvent[] {
  const before = new Map(prev.map((a) => [a.id, a]))
  const out: AlarmEvent[] = []
  for (const a of next) {
    if (a.sup) continue
    const was = before.get(a.id)
    const wasAnnunciated = was !== undefined && !was.sup && was.phase !== 'pending'
    if (a.phase === 'active' && (!wasAnnunciated || was!.phase === 'cleared')) {
      out.push({ t, tag: a.tag, level: a.level, what: 'ALARM' })
    } else if (wasAnnunciated && a.phase === 'cleared' && was!.phase === 'active') {
      out.push({ t, tag: a.tag, level: a.level, what: 'RTN' })
    } else if (wasAnnunciated && a.phase === 'acked' && was!.phase !== 'acked') {
      out.push({ t, tag: a.tag, level: a.level, what: 'ACK' })
    }
  }
  for (const was of prev) {
    // an acked alarm silently dropped on return-to-normal, or a cleared one
    // removed by ack — record what physically happened
    if (was.sup || was.phase === 'pending') continue
    if (next.some((a) => a.id === was.id)) continue
    if (was.phase === 'acked') out.push({ t, tag: was.tag, level: was.level, what: 'RTN' })
    else if (was.phase === 'cleared') out.push({ t, tag: was.tag, level: was.level, what: 'ACK' })
  }
  return out
}

const isHighSide = (level: AlarmLevel) => level === 'H' || level === 'HH'

export function evalAlarms(
  defs: TagDef[],
  tags: Tags,
  prev: AlarmRecord[],
  t: number,
  sup: SuppressionSets = {},
): AlarmRecord[] {
  const byId = new Map(prev.map((a) => [a.id, a]))
  const out: AlarmRecord[] = []
  for (const d of defs) {
    if (!d.limits) continue
    const pv = tags[d.name]?.PV
    if (pv === undefined) continue
    const db = d.deadband ?? Math.abs(d.max - d.min) * 0.01
    const delay = d.alarmDelay ?? 0
    for (const level of ['LL', 'L', 'H', 'HH'] as AlarmLevel[]) {
      const limit = d.limits[level]
      if (limit === undefined) continue
      const id = `${d.name}:${level}`
      const existing = byId.get(id)
      const supKind: Suppression | undefined =
        sup.shelvedIds?.has(id) ? 'shelved'
        : sup.oosTags?.has(d.name) ? 'oos'
        : sup.sbdTags?.has(d.name) ? 'design'
        : undefined
      // hysteresis: once in alarm, the clear threshold moves out by the
      // deadband (default 1% of span) so a value sitting on the limit can't
      // chatter the annunciator
      const wasIn = existing !== undefined && existing.phase !== 'cleared'
      const isIn = wasIn
        ? (isHighSide(level) ? pv >= limit - db : pv <= limit + db)
        : (isHighSide(level) ? pv >= limit : pv <= limit)
      if (isIn) {
        let rec: AlarmRecord
        if (!existing || existing.phase === 'cleared') {
          rec = {
            id, tag: d.name, level, priority: priorityOf(level, d), value: pv,
            phase: delay > 0 ? 'pending' : 'active', since: t,
          }
        } else if (existing.phase === 'pending' && t - existing.since >= delay) {
          rec = { ...existing, phase: 'active', since: t, value: pv }
        } else {
          rec = existing
        }
        if ((rec.sup ?? undefined) !== supKind) {
          const { sup: _old, ...rest } = rec
          rec = supKind ? { ...rest, sup: supKind } : (rest as AlarmRecord)
        }
        out.push(rec)
      } else if (existing) {
        // suppressed or never-annunciated alarms leave silently
        if (supKind || existing.phase === 'pending') continue
        if (existing.phase === 'active') {
          const { sup: _s, ...rest } = existing
          out.push({ ...(rest as AlarmRecord), phase: 'cleared' })
        } else if (existing.phase === 'cleared') {
          out.push(existing)
        }
        // 'acked' + back to normal -> drop silently
      }
    }
  }
  return out
}

/** Ack one alarm (by id) or all: active -> acked, cleared -> removed.
 *  Suppressed alarms don't ack — they aren't annunciating. */
export function ackAlarms(alarms: AlarmRecord[], id?: string): AlarmRecord[] {
  return alarms.flatMap((a) => {
    if (id !== undefined && a.id !== id) return [a]
    if (a.sup) return [a]
    if (a.phase === 'active') return [{ ...a, phase: 'acked' as const }]
    if (a.phase === 'cleared') return []
    return [a]
  })
}
