import { useSimStore } from './simStore'
import type { HmiWidget } from './model'

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ margin: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>{label}</span><span>{value.toFixed(1)}</span></div>
      <div style={{ height: 8, background: '#0004', borderRadius: 4 }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

/** DCS-style operate popup: pump start/stop, valve position, controller PV/SP/OP. */
export default function Faceplate({ widget, onClose }: { widget: HmiWidget; onClose(): void }) {
  const tag = widget.tag ?? ''
  const t = useSimStore((s) => s.tags[tag]) ?? {}
  const write = useSimStore((s) => s.writeTag)
  const isController = widget.props?.controller === true
  const auto = (t.MODE ?? 1) >= 0.5

  return (
    <div className="hmi-faceplate" data-testid="faceplate">
      <header>
        <strong>{tag}</strong> <span style={{ opacity: 0.7 }}>{widget.label ?? widget.type}</span>
        <button data-testid="fp-close" onClick={onClose} style={{ marginLeft: 'auto', flex: '0 0 auto' }}>×</button>
      </header>

      {widget.type === 'pump' && (
        <>
          <p className="fp-state">{(t.RUN ?? 0) >= 0.5 ? 'RUNNING' : 'STOPPED'}</p>
          <div className="fp-row">
            <button data-testid="fp-start" onClick={() => write(tag, 'RUN', 1)}>Start</button>
            <button data-testid="fp-stop" onClick={() => write(tag, 'RUN', 0)}>Stop</button>
          </div>
        </>
      )}

      {widget.type === 'valve' && widget.props?.throttle === true && (
        <>
          <Bar label="Position %" value={t.OP ?? 0} color="#26c281" />
          <input data-testid="fp-op" type="range" min={0} max={100} value={t.OP ?? 0}
            onChange={(e) => write(tag, 'OP', Number(e.target.value))} style={{ width: '100%' }} />
          <div className="fp-row">
            <button onClick={() => write(tag, 'OP', 100)}>Open</button>
            <button onClick={() => write(tag, 'OP', 0)}>Close</button>
          </div>
        </>
      )}

      {widget.type === 'valve' && widget.props?.throttle !== true && (
        <>
          <p className="fp-state">{(t.OPEN ?? 0) >= 0.5 ? 'OPEN' : 'CLOSED'}</p>
          <div className="fp-row">
            <button data-testid="fp-open" onClick={() => write(tag, 'OPEN', 1)}>Open</button>
            <button data-testid="fp-shut" onClick={() => write(tag, 'OPEN', 0)}>Close</button>
          </div>
        </>
      )}

      {isController && (
        <>
          <Bar label="PV" value={t.PV ?? 0} color="#38a8e8" />
          <Bar label="SP" value={t.SP ?? 0} color="#ffd166" />
          <Bar label="OP" value={t.OP ?? 0} color="#9b8cff" />
          <div className="fp-row">
            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center' }}>SP
              <input data-testid="fp-sp" type="number" style={{ width: 64, marginLeft: 6 }} value={Math.round((t.SP ?? 50) * 10) / 10}
                onChange={(e) => write(tag, 'SP', Number(e.target.value))} />
            </label>
            <button data-testid="fp-auto" className={auto ? 'active' : ''} onClick={() => write(tag, 'MODE', 1)}>AUTO</button>
            <button data-testid="fp-man" className={auto ? '' : 'active'} onClick={() => write(tag, 'MODE', 0)}>MAN</button>
          </div>
          <input data-testid="fp-op" type="range" min={0} max={100} value={t.OP ?? 0} disabled={auto}
            onChange={(e) => write(tag, 'OP', Number(e.target.value))} style={{ width: '100%' }} />
        </>
      )}

      {(widget.type === 'tank' || (widget.type === 'display' && !isController) || widget.type === 'gauge' || widget.type === 'trend') && (
        <Bar label="PV" value={t.PV ?? 0} color="#38a8e8" />
      )}
    </div>
  )
}
