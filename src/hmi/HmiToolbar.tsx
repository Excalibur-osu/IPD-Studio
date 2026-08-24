import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore } from './simStore'

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

  const reimport = async () => {
    if (!screen?.fromSheetId) return
    if (!window.confirm('Replace this screen from the P&ID sheet? Your HMI edits to it are lost.')) return
    const { importSheet } = await import('./importFromPid')
    replaceScreen({ ...importSheet(doc, screen.fromSheetId), id: screen.id, name: screen.name, theme: screen.theme })
  }
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const sim = useSimStore.getState
  const toggleRun = () => {
    if (!screen) return
    if (mode === 'run') sim().exitRun()
    // plant-wide: every screen compiles into one model, so navigating
    // between pages while running keeps the same live plant
    else sim().enterRun(doc.hmiScreens)
  }
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
            <button data-testid="hmi-reimport" onClick={() => void reimport()} title="Rebuild this screen from its source sheet">Re-import</button>
          )}
        </>
      )}
      {screen && (
        <button data-testid="hmi-theme" onClick={() => setScreenTheme(screen.id, screen.theme === 'classic' ? 'hp' : 'classic')}
          title="Toggle classic / ISA-101 high-performance theme">{screen.theme === 'classic' ? 'Classic' : 'ISA-101'}</button>
      )}
      <span className="grow" />
      <span className="demo-note">Training / demo simulation — not for operations</span>
    </header>
  )
}
