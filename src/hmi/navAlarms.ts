import type { HmiScreen } from './model'
import type { AlarmPriority, AlarmRecord } from './sim/alarms'

const rank: Record<AlarmPriority, number> = { high: 0, medium: 1, low: 2 }

/** Worst standing-alarm priority per screen — nav buttons wear it as a dot,
 *  the ISA-101 "you can see trouble from anywhere" pattern. */
export function worstAlarmByScreen(screens: HmiScreen[], alarms: AlarmRecord[]): Record<string, AlarmPriority> {
  const standing = alarms.filter((a) => !a.sup && a.phase !== 'pending')
  if (standing.length === 0) return {}
  const out: Record<string, AlarmPriority> = {}
  for (const sc of screens) {
    const tags = new Set(sc.widgets.map((w) => w.tag).filter(Boolean))
    let worst: AlarmPriority | undefined
    for (const a of standing) {
      if (!tags.has(a.tag)) continue
      if (!worst || rank[a.priority] < rank[worst]) worst = a.priority
    }
    if (worst) out[sc.id] = worst
  }
  return out
}
