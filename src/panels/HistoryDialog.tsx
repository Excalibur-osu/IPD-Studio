import { useEffect, useState } from 'react'
import { listHistory, restoreSnapshot, type Snapshot } from '../persist/autosave'
import { useStore } from '../store/store'

/** Automatic snapshots (one per ~2 min of editing, last 10 kept) to go back to. */
export default function HistoryDialog({ onClose }: { onClose: () => void }) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)
  const dirty = useStore((s) => s.dirty)

  useEffect(() => {
    void listHistory().then(setSnaps)
  }, [])

  const restore = (snap: Snapshot) => {
    if (dirty && !window.confirm('Restore this snapshot? Current unsaved changes will be lost.')) return
    try {
      restoreSnapshot(snap)
      onClose()
    } catch {
      window.alert('This snapshot could not be read.')
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="datasheet-box" onClick={(e) => e.stopPropagation()}>
        <div className="datasheet-head">
          <b>File history</b>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="datasheet-body">
          <p className="prop-hint">Automatic snapshots of your work, newest first.</p>
          {snaps === null && <div className="drawer-empty">Loading…</div>}
          {snaps?.length === 0 && <div className="drawer-empty">No snapshots yet — they appear as you draw.</div>}
          {snaps?.map((s) => (
            <button key={s.ts} className="history-row" onClick={() => restore(s)}>
              <b>{s.name}</b>
              <span>{new Date(s.ts).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
