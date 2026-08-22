import { useStore, activeHmiScreen } from '../store/store'
import type { HmiWidget } from './model'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', fontSize: 12, gap: 6 }}>
      <span>{label}</span>{children}
    </label>
  )
}

function NumProp({ w, k, label }: { w: HmiWidget; k: string; label: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  const v = w.props?.[k]
  return (
    <Row label={label}>
      <input type="number" style={{ width: 70 }} value={typeof v === 'number' ? v : ''} placeholder="auto"
        onChange={(e) => {
          const props = { ...w.props }
          if (e.target.value === '') delete props[k]
          else props[k] = Number(e.target.value)
          updateWidget(w.id, { props })
        }} />
    </Row>
  )
}

function StrProp({ w, k, label, placeholder }: { w: HmiWidget; k: string; label: string; placeholder?: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  return (
    <Row label={label}>
      <input style={{ width: 110 }} value={typeof w.props?.[k] === 'string' ? String(w.props[k]) : ''} placeholder={placeholder}
        onChange={(e) => updateWidget(w.id, { props: { ...w.props, [k]: e.target.value } })} />
    </Row>
  )
}

export default function HmiPropertyPanel({ selection }: { selection: string[] }) {
  const screen = useStore(activeHmiScreen)
  const updateWidget = useStore((s) => s.updateWidget)
  const updateHmiPipe = useStore((s) => s.updateHmiPipe)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  if (!screen) return <div />
  const w = selection.length === 1 ? screen.widgets.find((x) => x.id === selection[0]) : undefined
  const pipe = !w && selection.length === 1 ? screen.pipes.find((p) => p.id === selection[0]) : undefined

  if (pipe) {
    return (
      <div>
        <h4>Pipe</h4>
        <Row label="Width">
          <input type="number" style={{ width: 70 }} value={pipe.width ?? 4}
            onChange={(e) => updateHmiPipe(pipe.id, { width: Number(e.target.value) || 4 })} />
        </Row>
      </div>
    )
  }

  if (!w) {
    return (
      <div>
        <h4>Screen</h4>
        <Row label="Theme">
          <select value={screen.theme} onChange={(e) => setScreenTheme(screen.id, e.target.value as 'classic' | 'hp')}>
            <option value="classic">classic</option>
            <option value="hp">hp (ISA-101 gray)</option>
          </select>
        </Row>
        <p style={{ fontSize: 11, color: '#667' }}>Select a widget to edit its bindings.</p>
      </div>
    )
  }

  const geom = (k: 'x' | 'y' | 'w' | 'h') => (
    <input key={k} type="number" style={{ width: 56 }} value={w[k]}
      onChange={(e) => updateWidget(w.id, { [k]: Number(e.target.value) || 0 })} />
  )

  return (
    <div>
      <h4>{w.type}</h4>
      <Row label="Tag">
        <input style={{ width: 110 }} value={w.tag ?? ''} placeholder="e.g. LT-101"
          onChange={(e) => updateWidget(w.id, { tag: e.target.value || undefined })} />
      </Row>
      <Row label="Label">
        <input style={{ width: 110 }} value={w.label ?? ''}
          onChange={(e) => updateWidget(w.id, { label: e.target.value || undefined })} />
      </Row>
      <Row label="X / Y">{geom('x')}{geom('y')}</Row>
      <Row label="W / H">{geom('w')}{geom('h')}</Row>
      {w.type === 'tank' && (<><NumProp w={w} k="capacity" label="Capacity" /><NumProp w={w} k="level0" label="Start level %" /></>)}
      {(w.type === 'tank' || w.type === 'display' || w.type === 'gauge') && (
        <>
          <h5 style={{ margin: '10px 0 2px' }}>Alarm limits</h5>
          <NumProp w={w} k="LL" label="LL" /><NumProp w={w} k="L" label="L" />
          <NumProp w={w} k="H" label="H" /><NumProp w={w} k="HH" label="HH" />
        </>
      )}
      {(w.type === 'display' || w.type === 'gauge' || w.type === 'trend') && (
        <><StrProp w={w} k="unit" label="Unit" placeholder="%" /><NumProp w={w} k="min" label="Min" /><NumProp w={w} k="max" label="Max" /></>
      )}
      {w.type === 'valve' && (
        <Row label="Throttling">
          <input type="checkbox" checked={w.props?.throttle === true}
            onChange={(e) => updateWidget(w.id, { props: { ...w.props, throttle: e.target.checked } })} />
        </Row>
      )}
      {(w.type === 'lamp' || w.type === 'switch' || w.type === 'button') && (
        <StrProp w={w} k="signal" label="Signal" placeholder="P-101.RUN" />
      )}
      {w.type === 'button' && <NumProp w={w} k="writeValue" label="Write value" />}
      {w.type === 'switch' && (<><StrProp w={w} k="onLabel" label="On label" /><StrProp w={w} k="offLabel" label="Off label" /></>)}
      {w.type === 'symbol' && <StrProp w={w} k="symbolId" label="Symbol id" placeholder="valve.gate" />}
    </div>
  )
}
