import './hmi.css'
import { useEffect, useState } from 'react'
import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore, useSimEngine } from './simStore'
import HmiToolbar from './HmiToolbar'
import ScreenTabs from './ScreenTabs'
import HmiPalette from './HmiPalette'
import HmiCanvas from './HmiCanvas'
import HmiPropertyPanel from './HmiPropertyPanel'
import Faceplate from './Faceplate'

export default function HmiWorkspace({ onExit }: { onExit(): void }) {
  const screen = useStore(activeHmiScreen)
  const activeScreenId = useStore((s) => s.activeScreenId)
  const addScreen = useStore((s) => s.addScreen)
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState<'select' | 'pipe'>('select')
  const [faceplate, setFaceplate] = useState<string | null>(null)

  useSimEngine()
  const mode = useSimStore((s) => s.mode)
  const simTags = useSimStore((s) => s.tags)
  const pipeFlows = useSimStore((s) => s.pipeFlows)
  const alarms = useSimStore((s) => s.alarms)
  const history = useSimStore((s) => s.history)

  useEffect(() => { setSelection([]); setTool('select'); setFaceplate(null) }, [activeScreenId])
  useEffect(() => { setFaceplate(null) }, [mode])
  // leaving the workspace (unmount) stops any running simulation
  useEffect(() => () => useSimStore.getState().exitRun(), [])

  return (
    <div className={`hmi${mode === 'run' ? ' run-mode' : ''}`}>
      <HmiToolbar onExit={onExit} tool={tool} setTool={setTool} />
      <div className="hmi-side"><HmiPalette /></div>
      <div className="hmi-center">
        {screen ? (
          <>
            <div className="hmi-canvas-wrap">
              <HmiCanvas
                screen={screen}
                selection={selection}
                onSelect={setSelection}
                mode={mode}
                tool={tool}
                onToolDone={() => setTool('select')}
                sim={mode === 'run' ? simTags : undefined}
                flows={mode === 'run' ? pipeFlows : undefined}
                history={mode === 'run' ? history : undefined}
                alarms={mode === 'run' ? alarms : undefined}
                onWidgetClick={(w) => setFaceplate(w.id)}
              />
            </div>
            {mode === 'run' && faceplate && (() => {
              const w = screen.widgets.find((x) => x.id === faceplate)
              return w ? <Faceplate widget={w} onClose={() => setFaceplate(null)} /> : null
            })()}
            <ScreenTabs />
          </>
        ) : (
          <div className="hmi-empty">
            <p>No HMI screens yet.</p>
            <button onClick={addScreen}>New screen</button>
            <button disabled title="Coming soon">Build from P&ID sheet…</button>
          </div>
        )}
      </div>
      <div className="hmi-props"><HmiPropertyPanel selection={selection} /></div>
      <div className="hmi-status">
        <span>HMI workspace</span>
        {mode === 'run' && <span>RUNNING — click equipment to operate</span>}
      </div>
    </div>
  )
}
