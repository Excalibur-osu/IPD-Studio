import { useMemo } from 'react'
import { runChecks } from '../validate/checks'
import { useStore } from '../store/store'
import { canvasRef } from '../canvas/paperSetup'

const CHECK_LABELS: Record<string, string> = {
  'duplicate-tag': 'Duplicate tags',
  'missing-tag': 'Missing tags',
  'invalid-letters': 'Invalid ISA letters',
  'dangling-end': 'Dangling line ends',
  'incompatible-connection': 'Incompatible connections',
  'duplicate-line-number': 'Duplicate line numbers',
}

export function useFindings() {
  const doc = useStore((s) => s.doc)
  return useMemo(() => runChecks(doc), [doc])
}

export function locateCell(targetId: string | undefined) {
  if (!targetId) return
  useStore.getState().setSelection([targetId])
  const paper = canvasRef.paper
  const graph = canvasRef.graph
  const cell = graph?.getCell(targetId)
  if (!paper || !cell) return
  const bbox = cell.getBBox()
  const scale = paper.scale().sx
  const size = paper.getComputedSize()
  paper.translate(size.width / 2 - (bbox.x + bbox.width / 2) * scale, size.height / 2 - (bbox.y + bbox.height / 2) * scale)
}

export default function ValidationPanel() {
  const findings = useFindings()
  if (findings.length === 0) {
    return <div className="drawer-empty">No findings — drawing is clean.</div>
  }
  const grouped = new Map<string, typeof findings>()
  for (const f of findings) {
    const list = grouped.get(f.checkId) ?? []
    list.push(f)
    grouped.set(f.checkId, list)
  }
  return (
    <div className="drawer-list">
      {[...grouped.entries()].map(([checkId, list]) => (
        <section key={checkId}>
          <div className="drawer-group">{CHECK_LABELS[checkId] ?? checkId} ({list.length})</div>
          {list.map((f) => (
            <button key={f.id} className="drawer-item" onClick={() => locateCell(f.targetId)}>
              {f.message}
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
