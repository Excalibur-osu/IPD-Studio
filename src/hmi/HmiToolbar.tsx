import { useState } from 'react'
import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore } from './simStore'
import Modal from '../panels/Modal'

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export default function HmiToolbar({ onExit, tool, setTool, onImport, onUndo, onRedo, zoomed, onFit }: {
  onExit(): void
  tool: 'select' | 'pipe'
  setTool(t: 'select' | 'pipe'): void
  onImport(): void
  /** Workspace-provided undo/redo (adds the shared-history notice). */
  onUndo?(): void
  onRedo?(): void
  zoomed?: boolean
  onFit?(): void
}) {
  const storeUndo = useStore((s) => s.undo)
  const storeRedo = useStore((s) => s.redo)
  const undo = onUndo ?? storeUndo
  const redo = onRedo ?? storeRedo
  const name = useStore((s) => s.doc.meta.name)
  const doc = useStore((s) => s.doc)
  const screen = useStore(activeHmiScreen)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  const replaceScreen = useStore((s) => s.replaceScreen)

  const [confirmReimport, setConfirmReimport] = useState(false)
  const reimport = async () => {
    if (!screen?.fromSheetId) return
    const { importSheet } = await import('./importFromPid')
    replaceScreen({ ...importSheet(doc, screen.fromSheetId), id: screen.id, name: screen.name, theme: screen.theme })
    setConfirmReimport(false)
  }
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const sim = useSimStore.getState
  const toggleRun = () => {
    if (!screen) return
    if (mode === 'run') return sim().exitRun()
    // plant-wide: every screen compiles into one model, so navigating
    // between pages while running keeps the same live plant
    sim().enterRun(doc.hmiScreens)
    // an operator station comes up on its home page
    const home = doc.hmiScreens.find((sc) => sc.home)
    if (home) useStore.getState().setActiveScreen(home.id)
  }
  const t = useSimStore((s) => s.t)
  const alarms = useSimStore((s) => s.alarms)
  const live = alarms.filter((a) => !a.sup && a.phase !== 'pending' && a.phase !== 'acked')
  const nBy = (p: 'high' | 'medium' | 'low') => live.filter((a) => a.priority === p).length
  const home = doc.hmiScreens.find((sc) => sc.home)
  return (
    <header className="hmi-toolbar">
      <strong>HMI Studio</strong>
      <span style={{ opacity: 0.7 }}>{name}</span>
      <button onClick={onExit} title="Back to the P&ID editor">⇄ P&ID</button>
      {screen && (
        <button data-testid="hmi-run-toggle" className={mode === 'run' ? 'active' : ''} onClick={toggleRun}>
          {mode === 'run' ? '■ Stop (edit)' : '▶ RUN'}
        </button>
      )}
      {mode === 'run' ? (
        <>
          <span data-testid="run-title" style={{ fontSize: 14, fontWeight: 700, marginLeft: 6 }}>{screen?.name}</span>
          <span style={{ opacity: 0.8 }}>⏱ {mmss(t)}</span>
          {nBy('high') > 0 && <span className="al-prio al-prio-high">■ {nBy('high')}</span>}
          {nBy('medium') > 0 && <span className="al-prio al-prio-medium">▲ {nBy('medium')}</span>}
          {nBy('low') > 0 && <span className="al-prio al-prio-low">● {nBy('low')}</span>}
          {home && (
            <button data-testid="run-home" title="Home screen" disabled={home.id === screen?.id}
              onClick={() => useStore.getState().setActiveScreen(home.id)}>⌂ {home.name}</button>
          )}
          <button data-testid="hmi-play" onClick={() => sim().playPause()}>{playing ? 'Pause' : 'Play'}</button>
          <button data-testid="hmi-speed" onClick={() => sim().setSpeed(speed === 1 ? 5 : 1)}>{speed}×</button>
          <button data-testid="hmi-reset" onClick={() => sim().reset()}>Reset</button>
        </>
      ) : (
        <>
          <button
            className={tool === 'pipe' ? 'active' : ''}
            data-testid="hmi-pipe-tool"
            onClick={() => setTool(tool === 'pipe' ? 'select' : 'pipe')}
            title="Draw a pipe: click points, double-click or Enter to finish, Esc to cancel"
          >
            Pipe
          </button>
          <button onClick={undo} title="Ctrl+Z">↩</button>
          <button onClick={redo} title="Ctrl+Y">↪</button>
          <button data-testid="hmi-fit" className={zoomed ? 'active' : ''} onClick={onFit}
            title="Fit view (Ctrl+0) — wheel zooms, Space/middle-drag pans">⛶</button>
          <button data-testid="hmi-import" onClick={onImport} title="Build an HMI screen from a P&ID sheet">From P&ID…</button>
          {screen?.fromSheetId && doc.sheets.some((sh) => sh.id === screen.fromSheetId) && (
            <button data-testid="hmi-reimport" onClick={() => setConfirmReimport(true)} title="Rebuild this screen from its source sheet">Re-import</button>
          )}
        </>
      )}
      {screen && (
        <button data-testid="hmi-theme" onClick={() => setScreenTheme(screen.id, screen.theme === 'classic' ? 'hp' : 'classic')}
          title="Toggle classic / ISA-101 high-performance theme">{screen.theme === 'classic' ? 'Classic' : 'ISA-101'}</button>
      )}
      <span className="grow" />
      <span className="demo-note">Training / demo simulation — not for operations</span>
      {confirmReimport && screen && (
        <Modal title="Re-import screen" onClose={() => setConfirmReimport(false)}>
          <p style={{ margin: '4px 0 12px' }}>
            Rebuild <strong>{screen.name}</strong> from its P&ID sheet? Your HMI edits to this screen are replaced (Ctrl+Z undoes).
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmReimport(false)}>Cancel</button>
            <button data-testid="reimport-confirm" style={{ background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px' }}
              onClick={() => void reimport()}>Re-import</button>
          </div>
        </Modal>
      )}
    </header>
  )
}
