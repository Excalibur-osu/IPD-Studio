import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore } from './simStore'

export default function HmiToolbar({ onExit, tool, setTool }: {
  onExit(): void
  tool: 'select' | 'pipe'
  setTool(t: 'select' | 'pipe'): void
}) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const name = useStore((s) => s.doc.meta.name)
  const screen = useStore(activeHmiScreen)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const sim = useSimStore.getState
  const toggleRun = () => {
    if (!screen) return
    if (mode === 'run') sim().exitRun()
    else sim().enterRun(screen)
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
