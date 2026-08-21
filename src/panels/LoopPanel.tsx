import { useMemo } from 'react'
import { deriveLoops } from '../store/selectors'
import { formatTag } from '../isa/tag'
import { printLoopDiagram } from '../export/loopDiagram'
import { useStore } from '../store/store'

export default function LoopPanel() {
  const doc = useStore((s) => s.doc)
  const setSelection = useStore((s) => s.setSelection)
  const loops = useMemo(() => deriveLoops(doc), [doc])
  if (loops.length === 0) return <div className="drawer-empty">No tagged instruments yet.</div>
  return (
    <div className="drawer-list">
      {loops.map((loop) => (
        <div key={`${loop.family}-${loop.loop}`} className="loop-row">
          <button
            className="drawer-item"
            onClick={() => setSelection(loop.members.map((m) => m.nodeId))}
          >
            <b>Loop {loop.family}-{loop.loop}</b>{' '}
            {loop.members.map((m) => formatTag(m.tag, '-')).join(', ')}
            {loop.hint && <span className="loop-hint"> — {loop.hint}</span>}
          </button>
          <button
            className="loop-diagram-btn"
            title="Generate ISA-5.4-style loop diagram"
            onClick={() => printLoopDiagram(doc, loop.family, loop.loop)}
          >
            Diagram
          </button>
        </div>
      ))}
    </div>
  )
}
