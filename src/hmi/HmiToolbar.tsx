import { useStore } from '../store/store'

export default function HmiToolbar({ onExit }: { onExit(): void }) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const name = useStore((s) => s.doc.meta.name)
  return (
    <header className="hmi-toolbar">
      <strong>HMI Studio</strong>
      <span style={{ opacity: 0.7 }}>{name}</span>
      <button onClick={onExit} title="Back to the P&ID editor">⇄ P&ID</button>
      <span className="grow" />
      <button onClick={undo} title="Ctrl+Z">↩</button>
      <button onClick={redo} title="Ctrl+Y">↪</button>
      <span className="demo-note">Training / demo simulation — not for operations</span>
    </header>
  )
}
