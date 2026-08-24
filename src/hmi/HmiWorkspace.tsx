import './hmi.css'
import { useEffect, useRef, useState } from 'react'
import { THEMES } from './theme'
import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore, useSimEngine } from './simStore'
import HmiToolbar from './HmiToolbar'
import ScreenTabs from './ScreenTabs'
import HmiPalette from './HmiPalette'
import HmiCanvas from './HmiCanvas'
import HmiPropertyPanel from './HmiPropertyPanel'
import type { ArmedPick } from './HmiPropertyPanel'
import Faceplate from './Faceplate'
import AlarmBanner from './AlarmBanner'

// The sim store rides the lazy HMI chunk, so the dev/e2e hook gains it here,
// not in main.tsx (which must not pull sim code into the eager bundle).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as unknown as { __pid?: Record<string, unknown> }
  w.__pid = { ...w.__pid, useSimStore }
}

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
  const [armedPick, setArmedPick] = useState<ArmedPick | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotice = (msg: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(null), 2600)
  }
  /** Undo/redo with a heads-up when the step belonged to the P&ID side — the
   *  two workspaces share one history stack and that surprises people. */
  const undoRedo = (dir: 'undo' | 'redo') => {
    const before = useStore.getState().doc
    useStore.getState()[dir]()
    const after = useStore.getState().doc
    if (after !== before && after.hmiScreens === before.hmiScreens) {
      showNotice(`${dir === 'undo' ? 'Undid' : 'Redid'} a P&ID-side change (shared history)`)
    }
  }

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
    setArmedPick(null)
    // In RUN the sim is compiled plant-wide (every screen), so switching
    // screens is navigation, not a model change — keep simulating.
  }, [activeScreenId])
  useEffect(() => { setFaceplate(null); setArmedPick(null) }, [mode])
  // leaving the workspace (unmount) stops any running simulation
  useEffect(() => () => useSimStore.getState().exitRun(), [])
  // the P&ID canvas owns these shortcuts normally; it is unmounted here
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc cancels an armed binding pick from anywhere (the arming button
      // usually still holds focus, so the canvas handler never sees the key)
      if (e.key === 'Escape') { setArmedPick(null); return }
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); undoRedo(e.shiftKey ? 'redo' : 'undo') }
      else if (k === 'y') { e.preventDefault(); undoRedo('redo') }
      else if (k === 's') { e.preventDefault(); void import('../persist/file').then((m) => m.saveFile()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`hmi${mode === 'run' ? ' run-mode' : ''}`}>
      <HmiToolbar onExit={onExit} tool={tool} setTool={setTool} onImport={() => void runImport()}
        onUndo={() => undoRedo('undo')} onRedo={() => undoRedo('redo')} />
      <div className="hmi-side"><HmiPalette /></div>
      <div className="hmi-center">
        {screen ? (
          <>
            {mode === 'run' && <AlarmBanner />}
            <div className="hmi-canvas-wrap" style={{ background: THEMES[screen.theme].bg }}>
              <HmiCanvas
                screen={screen}
                selection={selection}
                onSelect={setSelection}
                mode={mode}
                tool={tool}
                onToolDone={() => setTool('select')}
                armedPick={armedPick}
                onPicked={() => setArmedPick(null)}
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
            <button data-testid="hmi-import-empty" onClick={() => void runImport()}>Build from P&ID sheet…</button>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Tip: load the “HMI demo” template from the P&ID toolbar, then come back here and press RUN.</p>
          </div>
        )}
      </div>
      <div className="hmi-props">
        <HmiPropertyPanel selection={selection} onSelect={setSelection} armedPick={armedPick} onArmPick={setArmedPick} />
      </div>
      <StatusBar screenName={screen?.name} selection={selection.length}
        notice={armedPick ? `Click a ${armedPick.kind === 'tank' ? 'tank widget' : 'pipe'} on the canvas to bind — Esc cancels` : notice} />
    </div>
  )
}

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

function StatusBar({ screenName, selection, notice }: { screenName?: string; selection: number; notice?: string | null }) {
  const mode = useSimStore((s) => s.mode)
  const t = useSimStore((s) => s.t)
  const playing = useSimStore((s) => s.playing)
  const alarms = useSimStore((s) => s.alarms)
  const unacked = alarms.filter((a) => a.phase !== 'acked').length
  return (
    <div className="hmi-status">
      <span>HMI workspace</span>
      {screenName && <span>· {screenName}</span>}
      {notice && <span className="hmi-notice" data-testid="hmi-notice">{notice}</span>}
      {mode === 'run' ? (
        <>
          <span data-testid="sim-clock">⏱ {mmss(t)}{playing ? '' : ' (paused)'}</span>
          <span>{unacked > 0 ? `⚠ ${unacked} unacked alarm${unacked === 1 ? '' : 's'}` : 'no unacked alarms'}</span>
          <span style={{ marginLeft: 'auto' }}>RUNNING plant-wide — tabs navigate, click equipment to operate</span>
        </>
      ) : (
        screenName && (
          <>
            {selection > 0 && <span>{selection} selected</span>}
            <span style={{ marginLeft: 'auto' }}>EDIT — preview values shown; press ▶ RUN to simulate</span>
          </>
        )
      )}
    </div>
  )
}
