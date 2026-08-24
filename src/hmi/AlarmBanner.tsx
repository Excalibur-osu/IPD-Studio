import { useState } from 'react'
import { useSimStore } from './simStore'
import { priorityOf } from './sim/alarms'
import type { AlarmRecord, JournalEntry } from './sim/alarms'
import { commandText } from './sim/commands'
import { useStore } from '../store/store'

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

const phaseRank = (p: AlarmRecord['phase']) => (p === 'active' ? 0 : p === 'cleared' ? 1 : 2)
const prioRank = (a: AlarmRecord) => (priorityOf(a.level) === 'high' ? 0 : 1)

/** ISA-18.2 style: critical (HH/LL) as a red square, warning (H/L) as an
 *  amber triangle — shape + color so priority survives color-blindness. */
function PrioIcon({ level }: { level: AlarmRecord['level'] }) {
  return priorityOf(level) === 'high'
    ? <span className="al-prio al-prio-high" aria-label="critical">■</span>
    : <span className="al-prio al-prio-warn" aria-label="warning">▲</span>
}

/** Docked alarm strip above the mimic + expandable summary/journal.
 *  Clicking a tag navigates to the screen that shows it. */
export default function AlarmBanner() {
  const alarms = useSimStore((s) => s.alarms)
  const journal = useSimStore((s) => s.journal)
  const ack = useSimStore((s) => s.ack)
  const screens = useStore((s) => s.doc.hmiScreens)
  const setActiveScreen = useStore((s) => s.setActiveScreen)
  const [open, setOpen] = useState<'none' | 'summary' | 'journal'>('none')
  const [jFilter, setJFilter] = useState<'all' | 'alarms' | 'commands'>('all')
  if (alarms.length === 0 && journal.length === 0) return null

  const journalShown = journal.filter((ev) =>
    jFilter === 'all' ? true : jFilter === 'commands' ? ev.what === 'CMD' : ev.what !== 'CMD')
  const journalLine = (ev: JournalEntry) =>
    `[${mmss(ev.t)}] ${ev.tag} ${ev.what === 'CMD' ? commandText(ev) : `${ev.what} ${ev.level}`}`
  const copyJournal = () => {
    void navigator.clipboard?.writeText(journalShown.map(journalLine).join('\n')).catch(() => {})
  }

  const rows = [...alarms].sort((a, b) =>
    phaseRank(a.phase) - phaseRank(b.phase) || prioRank(a) - prioRank(b) || b.since - a.since)
  const shown = rows.slice(0, 3)
  const unacked = rows.filter((a) => a.phase !== 'acked').length
  const nHigh = rows.filter((a) => prioRank(a) === 0 && a.phase !== 'acked').length

  const jumpTo = (tag: string) => {
    const sc = screens.find((s) => s.widgets.some((w) => w.tag === tag))
    if (sc) setActiveScreen(sc.id)
  }

  return (
    <div className="hmi-alarmwrap">
      <div className="hmi-alarmbar" data-testid="alarm-bar">
        <span className={`al-count${unacked > 0 ? ' hmi-blink' : ''}`}>⚠ {rows.length}</span>
        {nHigh > 0 && <span className="al-prio al-prio-high">■ {nHigh}</span>}
        {shown.map((a, i) => (
          <span key={a.id} className={`al-chip ${a.phase}${a.phase !== 'acked' ? ' hmi-blink' : ''}`}>
            <PrioIcon level={a.level} />
            <span className="al-time">{mmss(a.since)}</span>
            <button className="al-tag" title="Show this tag's screen" onClick={() => jumpTo(a.tag)}><strong>{a.tag}</strong></button>
            <span>{a.level}</span>
            <span className="al-phase">{a.phase.toUpperCase()}</span>
            <button data-testid={i === 0 ? 'alarm-ack' : undefined} onClick={() => ack(a.id)}>Ack</button>
          </span>
        ))}
        {rows.length > 3 && <span className="al-more">+{rows.length - 3} more</span>}
        <span style={{ flex: 1 }} />
        <button className="al-all" data-testid="alarm-summary-toggle"
          onClick={() => setOpen(open === 'summary' ? 'none' : 'summary')}>
          {open === 'summary' ? '▴ Summary' : '▾ Summary'}
        </button>
        <button className="al-all" onClick={() => setOpen(open === 'journal' ? 'none' : 'journal')}>
          {open === 'journal' ? '▴ Journal' : '▾ Journal'}
        </button>
        <button data-testid="alarm-ack-all" className="al-all" onClick={() => ack()}>Ack all</button>
      </div>
      {open === 'summary' && (
        <div className="hmi-alarmpanel" data-testid="alarm-summary">
          {rows.length === 0 && <p className="al-empty">No standing alarms.</p>}
          {rows.map((a) => (
            <div key={a.id} className={`al-row ${a.phase}`}>
              <PrioIcon level={a.level} />
              <span className="al-time">{mmss(a.since)}</span>
              <button className="al-tag" onClick={() => jumpTo(a.tag)}><strong>{a.tag}</strong></button>
              <span>{a.level}</span>
              <span className="al-phase">{a.phase.toUpperCase()}</span>
              <span style={{ flex: 1 }} />
              {a.phase !== 'acked' && <button onClick={() => ack(a.id)}>Ack</button>}
            </div>
          ))}
        </div>
      )}
      {open === 'journal' && (
        <div className="hmi-alarmpanel" data-testid="alarm-journal">
          <div className="al-row" style={{ borderBottom: '1px solid #ffffff2a' }}>
            {(['all', 'alarms', 'commands'] as const).map((f) => (
              <button key={f} className={`al-all${jFilter === f ? ' al-on' : ''}`}
                data-testid={`journal-${f}`} onClick={() => setJFilter(f)}>
                {f[0]!.toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button className="al-all" data-testid="journal-copy" title="Copy the visible journal lines"
              onClick={copyJournal}>⧉ Copy</button>
          </div>
          {journalShown.length === 0 && <p className="al-empty">No events yet.</p>}
          {journalShown.map((ev, i) => (
            <div key={i} className="al-row">
              <span className="al-time">{mmss(ev.t)}</span>
              <span className={`al-what al-what-${ev.what.toLowerCase()}`}>{ev.what}</span>
              <button className="al-tag" onClick={() => jumpTo(ev.tag)}><strong>{ev.tag}</strong></button>
              <span>{ev.what === 'CMD' ? commandText(ev) : ev.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
