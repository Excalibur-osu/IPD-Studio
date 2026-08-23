import { useStore, activeHmiScreen, pauseHistory, resumeHistory } from '../store/store'
import type { HmiWidget } from './model'
import type { AlignMode } from './align'
import { alignPatches, distributePatches, duplicateWidgets } from './align'

/** Group a typing burst into one undo step (same pattern as the P&ID panels). */
const burst = (apply: () => void) => { apply(); pauseHistory() }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', fontSize: 12, gap: 6 }}>
      <span>{label}</span>{children}
    </label>
  )
}

function BtnRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 4, margin: '6px 0', flexWrap: 'wrap' }}>{children}</div>
}

const btnStyle: React.CSSProperties = {
  flex: '1 0 auto', fontSize: 11, padding: '3px 6px', background: '#fff',
  border: '1px solid #c8ccd4', borderRadius: 4, cursor: 'pointer',
}

function NumProp({ w, k, label }: { w: HmiWidget; k: string; label: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  const v = w.props?.[k]
  return (
    <Row label={label}>
      <input type="number" style={{ width: 70 }} value={typeof v === 'number' ? v : ''} placeholder="auto"
        onBlur={resumeHistory}
        onChange={(e) => burst(() => {
          const props = { ...w.props }
          if (e.target.value === '') delete props[k]
          else props[k] = Number(e.target.value)
          updateWidget(w.id, { props })
        })} />
    </Row>
  )
}

function StrProp({ w, k, label, placeholder }: { w: HmiWidget; k: string; label: string; placeholder?: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  return (
    <Row label={label}>
      <input style={{ width: 110 }} value={typeof w.props?.[k] === 'string' ? String(w.props[k]) : ''} placeholder={placeholder}
        onBlur={resumeHistory}
        onChange={(e) => burst(() => updateWidget(w.id, { props: { ...w.props, [k]: e.target.value } }))} />
    </Row>
  )
}

/** Arrange tools shared by single and multi selection. */
function ArrangeTools({ ids, onSelect }: { ids: string[]; onSelect?(ids: string[]): void }) {
  const screen = useStore(activeHmiScreen)
  const reorderWidgets = useStore((s) => s.reorderWidgets)
  const addWidgets = useStore((s) => s.addWidgets)
  const deleteHmiIds = useStore((s) => s.deleteHmiIds)
  if (!screen) return null
  const widgets = screen.widgets.filter((w) => ids.includes(w.id))
  return (
    <>
      <BtnRow>
        <button style={btnStyle} title="Bring to front" onClick={() => reorderWidgets(ids, 'front')}>⬆ Front</button>
        <button style={btnStyle} title="Send to back" onClick={() => reorderWidgets(ids, 'back')}>⬇ Back</button>
        <button style={btnStyle} title="Duplicate (Ctrl+D)"
          onClick={() => { const nids = addWidgets(duplicateWidgets(widgets)); onSelect?.(nids) }}>⧉ Duplicate</button>
        <button style={btnStyle} title="Delete (Del)" onClick={() => { deleteHmiIds(ids); onSelect?.([]) }}>✕ Delete</button>
      </BtnRow>
    </>
  )
}

function AlignTools({ ids }: { ids: string[] }) {
  const screen = useStore(activeHmiScreen)
  const updateWidgets = useStore((s) => s.updateWidgets)
  if (!screen) return null
  const widgets = screen.widgets.filter((w) => ids.includes(w.id))
  const align = (mode: AlignMode) => updateWidgets(alignPatches(widgets, mode))
  const distribute = (axis: 'h' | 'v') => updateWidgets(distributePatches(widgets, axis))
  const modes: [AlignMode, string, string][] = [
    ['left', '⇤', 'Align left'], ['centerX', '↔', 'Align centers'], ['right', '⇥', 'Align right'],
    ['top', '⤒', 'Align top'], ['middleY', '↕', 'Align middles'], ['bottom', '⤓', 'Align bottom'],
  ]
  return (
    <>
      <h5 style={{ margin: '10px 0 2px' }}>Align</h5>
      <BtnRow>
        {modes.map(([m, icon, tip]) => (
          <button key={m} style={btnStyle} title={tip} disabled={widgets.length < 2} onClick={() => align(m)}>{icon}</button>
        ))}
      </BtnRow>
      {widgets.length >= 3 && (
        <BtnRow>
          <button style={btnStyle} title="Equal horizontal gaps" onClick={() => distribute('h')}>⇹ Spread H</button>
          <button style={btnStyle} title="Equal vertical gaps" onClick={() => distribute('v')}>⇳ Spread V</button>
        </BtnRow>
      )}
    </>
  )
}

export default function HmiPropertyPanel({ selection, onSelect }: { selection: string[]; onSelect?(ids: string[]): void }) {
  const screen = useStore(activeHmiScreen)
  const screens = useStore((s) => s.doc.hmiScreens)
  const updateWidget = useStore((s) => s.updateWidget)
  const updateHmiPipe = useStore((s) => s.updateHmiPipe)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  if (!screen) return <div />
  const w = selection.length === 1 ? screen.widgets.find((x) => x.id === selection[0]) : undefined
  const pipe = !w && selection.length === 1 ? screen.pipes.find((p) => p.id === selection[0]) : undefined
  const selectedWidgets = screen.widgets.filter((x) => selection.includes(x.id))

  if (selection.length > 1) {
    return (
      <div>
        <h4>{selection.length} selected</h4>
        <p style={{ fontSize: 11, color: '#667', margin: '4px 0' }}>
          {selectedWidgets.length} widget{selectedWidgets.length === 1 ? '' : 's'}, {selection.length - selectedWidgets.length} pipe{selection.length - selectedWidgets.length === 1 ? '' : 's'}
        </p>
        {selectedWidgets.length > 0 && <ArrangeTools ids={selectedWidgets.map((x) => x.id)} onSelect={onSelect} />}
        <AlignTools ids={selectedWidgets.map((x) => x.id)} />
      </div>
    )
  }

  if (pipe) {
    return (
      <div>
        <h4>Pipe</h4>
        <Row label="Width">
          <input type="number" style={{ width: 70 }} value={pipe.width ?? 4}
            onChange={(e) => updateHmiPipe(pipe.id, { width: Number(e.target.value) || 4 })} />
        </Row>
        <p style={{ fontSize: 11, color: '#667' }}>Drag the round handles on the canvas to adjust the run.</p>
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
        <p style={{ fontSize: 11, color: '#667' }}>
          Select a widget to edit its bindings. Drag on empty canvas to rubber-band select; Shift+click adds; Ctrl+A selects all; Ctrl+D duplicates.
        </p>
      </div>
    )
  }

  const geom = (k: 'x' | 'y' | 'w' | 'h') => (
    <input key={k} type="number" style={{ width: 56 }} value={w[k]}
      onBlur={resumeHistory}
      onChange={(e) => burst(() => updateWidget(w.id, { [k]: Number(e.target.value) || 0 }))} />
  )

  return (
    <div>
      <h4>{w.type}</h4>
      {w.type !== 'nav' && w.type !== 'panel' && w.type !== 'label' && (
        <Row label="Tag">
          <input style={{ width: 110 }} value={w.tag ?? ''} placeholder="e.g. LT-101"
            onBlur={resumeHistory}
            onChange={(e) => burst(() => updateWidget(w.id, { tag: e.target.value || undefined }))} />
        </Row>
      )}
      <Row label={w.type === 'panel' ? 'Title' : 'Label'}>
        <input style={{ width: 110 }} value={w.label ?? ''}
          onBlur={resumeHistory}
          onChange={(e) => burst(() => updateWidget(w.id, { label: e.target.value || undefined }))} />
      </Row>
      <Row label="X / Y">{geom('x')}{geom('y')}</Row>
      <Row label="W / H">{geom('w')}{geom('h')}</Row>
      <ArrangeTools ids={[w.id]} onSelect={onSelect} />
      {w.type === 'nav' && (
        <Row label="Go to">
          <select
            value={typeof w.props?.screen === 'string' ? w.props.screen : ''}
            onChange={(e) => {
              const target = screens.find((sc) => sc.id === e.target.value)
              updateWidget(w.id, {
                props: { ...w.props, screen: e.target.value },
                // keep the button text in sync unless the user typed their own
                ...(target && (!w.label || screens.some((sc) => sc.name === w.label)) ? { label: target.name } : {}),
              })
            }}
          >
            <option value="">— pick screen —</option>
            {screens.filter((sc) => sc.id !== screen.id).map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>
        </Row>
      )}
      {w.type === 'tank' && (<><NumProp w={w} k="capacity" label="Capacity" /><NumProp w={w} k="level0" label="Start level %" /></>)}
      {(w.type === 'tank' || w.type === 'display' || w.type === 'gauge' || w.type === 'bar' || w.type === 'trend') && (
        <>
          <h5 style={{ margin: '10px 0 2px' }}>Alarm limits</h5>
          <NumProp w={w} k="LL" label="LL" /><NumProp w={w} k="L" label="L" />
          <NumProp w={w} k="H" label="H" /><NumProp w={w} k="HH" label="HH" />
        </>
      )}
      {(w.type === 'display' || w.type === 'gauge' || w.type === 'trend' || w.type === 'bar') && (
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
