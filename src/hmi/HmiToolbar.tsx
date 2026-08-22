import { useStore } from '../store/store'

export default function HmiToolbar({ onExit, tool, setTool }: {
  onExit(): void
  tool: 'select' | 'pipe'
  setTool(t: 'select' | 'pipe'): void
}) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const name = useStore((s) => s.doc.meta.name)
  return (
    <header className="hmi-toolbar">
      <strong>HMI Studio</strong>
      <span style={{ opacity: 0.7 }}>{name}</span>
      <button onClick={onExit} title="Back to the P&ID editor">⇄ P&ID</button>
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
      <span className="grow" />
      <span className="demo-note">Training / demo simulation — not for operations</span>
    </header>
  )
}
