import { useSimStore } from './simStore'

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** Docked alarm strip above the mimic: newest chips first, per-chip and
 *  ack-all, never covers the screen content. */
export default function AlarmBanner() {
  const alarms = useSimStore((s) => s.alarms)
  const ack = useSimStore((s) => s.ack)
  if (alarms.length === 0) return null
  const rows = [...alarms].sort((a, b) => b.since - a.since)
  const shown = rows.slice(0, 3)
  const unacked = rows.filter((a) => a.phase !== 'acked').length
  return (
    <div className="hmi-alarmbar" data-testid="alarm-bar">
      <span className={`al-count${unacked > 0 ? ' hmi-blink' : ''}`}>⚠ {rows.length}</span>
      {shown.map((a, i) => (
        <span key={a.id} className={`al-chip ${a.phase}${a.phase !== 'acked' ? ' hmi-blink' : ''}`}>
          <span className="al-time">{mmss(a.since)}</span>
          <strong>{a.tag}</strong>
          <span>{a.level}</span>
          <span className="al-phase">{a.phase.toUpperCase()}</span>
          <button data-testid={i === 0 ? 'alarm-ack' : undefined} onClick={() => ack(a.id)}>Ack</button>
        </span>
      ))}
      {rows.length > 3 && <span className="al-more">+{rows.length - 3} more</span>}
      <span style={{ flex: 1 }} />
      <button data-testid="alarm-ack-all" className="al-all" onClick={() => ack()}>Ack all</button>
    </div>
  )
}
