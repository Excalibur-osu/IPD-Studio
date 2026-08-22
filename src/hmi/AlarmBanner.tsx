import { useSimStore } from './simStore'

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** Blinking active-alarm strip with per-row and ack-all, newest first. */
export default function AlarmBanner() {
  const alarms = useSimStore((s) => s.alarms)
  const ack = useSimStore((s) => s.ack)
  if (alarms.length === 0) return null
  const rows = [...alarms].sort((a, b) => b.since - a.since).slice(0, 5)
  return (
    <div className="hmi-alarms">
      {rows.map((a, i) => (
        <div key={a.id} className={`hmi-alarm-row ${a.phase}${a.phase !== 'acked' ? ' hmi-blink' : ''}`}>
          <span className="al-time">{mmss(a.since)}</span>
          <strong>{a.tag}</strong>
          <span className="al-level">{a.level}</span>
          <span className="al-phase">{a.phase.toUpperCase()}</span>
          <button data-testid={i === 0 ? 'alarm-ack' : undefined} onClick={() => ack(a.id)}>Ack</button>
        </div>
      ))}
      <button data-testid="alarm-ack-all" className="al-all" onClick={() => ack()}>Ack all</button>
    </div>
  )
}
