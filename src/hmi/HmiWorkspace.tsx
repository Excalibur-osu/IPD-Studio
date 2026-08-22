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
import AlarmBanner from './AlarmBanner'

export default function HmiWorkspace({ onExit }: { onExit(): void }) {
  const screen = useStore(activeHmiScreen)
  const activeScreenId = useStore((s) => s.activeScreenId)
  const addScreen = useStore((s) => s.addScreen)

  /** Build a new HMI screen from a P&ID sheet (prompted pick when several). */
  const runImport = async () => {
    const s = useStore.getState()
    const { importSheet } = await import('./importFromPid')
    let sheet = s.doc.sheets[0]!
    if (s.doc.sheets.length > 1) {
      const pick = window.prompt(
        `Build HMI from which sheet?\n${s.doc.sheets.map((sh, i) => `${i + 1}: ${sh.name}`).join('\n')}`,
        '1',
      )
      if (!pick) return
      const idx = Number(pick) - 1
      if (Number.isNaN(idx) || !s.doc.sheets[idx]) return
      sheet = s.doc.sheets[idx]!
    }
    s.addImportedScreen(importSheet(s.doc, sheet.id))
  }
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState<'select' | 'pipe'>('select')
  const [faceplate, setFaceplate] = useState<string | null>(null)

  useSimEngine()
  const mode = useSimStore((s) => s.mode)
  const simTags = useSimStore((s) => s.tags)
  const pipeFlows = useSimStore((s) => s.pipeFlows)
  const alarms = useSimStore((s) => s.alarms)
  const history = useSimStore((s) => s.history)

  useEffect(() => {
    setSelection([])
    setTool('select')
    setFaceplate(null)
    // switching screens mid-RUN would leave the sim ticking a stale model
    useSimStore.getState().exitRun()
  }, [activeScreenId])
  useEffect(() => { setFaceplate(null) }, [mode])
  // leaving the workspace (unmount) stops any running simulation
  useEffect(() => () => useSimStore.getState().exitRun(), [])
  // the P&ID canvas owns these shortcuts normally; it is unmounted here
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) useStore.getState().redo(); else useStore.getState().undo() }
      else if (k === 'y') { e.preventDefault(); useStore.getState().redo() }
      else if (k === 's') { e.preventDefault(); void import('../persist/file').then((m) => m.saveFile()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`hmi${mode === 'run' ? ' run-mode' : ''}`}>
      <HmiToolbar onExit={onExit} tool={tool} setTool={setTool} onImport={() => void runImport()} />
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
            {mode === 'run' && <AlarmBanner />}
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
            <button data-testid="hmi-import-empty" onClick={() => void runImport()}>Build from P&ID sheet…</button>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Tip: load the “HMI demo” template from the P&ID toolbar, then come back here and press RUN.</p>
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
