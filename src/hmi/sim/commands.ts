import type { CommandEvent, JournalEntry } from './alarms'

const fmt = (v: number) => (Math.round(v * 10) / 10).toString()

/** Operator-language rendering of a command event. */
export function commandText(ev: CommandEvent): string {
  switch (ev.sig) {
    case 'RUN': return ev.to >= 0.5 ? 'START' : 'STOP'
    case 'OPEN': return ev.to >= 0.5 ? 'OPEN' : 'CLOSE'
    case 'MODE': return ev.to >= 0.5 ? 'AUTO' : 'MAN'
    case 'SP':
    case 'OP': return `${ev.sig} ${fmt(ev.from)} → ${fmt(ev.to)}`
    case 'SHELVE': return ev.to > 0 ? `SHELVED ${fmt(ev.to)} min` : 'UNSHELVED'
    case 'OOS': return ev.to >= 0.5 ? 'OUT OF SERVICE' : 'BACK IN SERVICE'
    case 'FAULT': return ev.to >= 0.5 ? 'TRIPPED' : 'FAULT RESET'
    case 'STUCK': return ev.to >= 0.5 ? 'STUCK' : 'FREED'
    case 'FROZEN': return ev.to >= 0.5 ? 'SIGNAL FROZEN' : 'SIGNAL LIVE'
    case 'PLUG': return ev.to >= 0.5 ? 'LINE PLUGGED' : 'LINES CLEARED'
    default: return `${ev.sig} = ${fmt(ev.to)}`
  }
}

/** Window inside which repeated writes to the same tag+signal (a slider or
 *  stepper burst) merge into one journal entry. */
const COALESCE_S = 2
/** Only continuous entries coalesce — a trip followed by its reset must stay
 *  two journal lines, never merge into a net no-op. */
const CONTINUOUS = new Set(['SP', 'OP', 'PV'])

/** Prepend a command to the newest-first journal, coalescing bursts and
 *  enforcing the cap. Returns a new array. */
export function pushCommand(journal: JournalEntry[], ev: CommandEvent, cap: number): JournalEntry[] {
  const top = journal[0]
  if (
    top && top.what === 'CMD' && top.tag === ev.tag && top.sig === ev.sig &&
    CONTINUOUS.has(ev.sig) && ev.t - top.t < COALESCE_S
  ) {
    return [{ ...ev, from: top.from }, ...journal.slice(1)].slice(0, cap)
  }
  return [ev, ...journal].slice(0, cap)
}
