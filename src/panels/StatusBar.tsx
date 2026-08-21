import { useEffect, useState } from 'react'
import { activeSheet, useStore } from '../store/store'
import { useFindings } from './ValidationPanel'

let updateSW: (() => Promise<void>) | null = null

function usePwaUpdate(): boolean {
  const [needsUpdate, setNeedsUpdate] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const update = registerSW({ onNeedRefresh: () => setNeedsUpdate(true) })
      updateSW = () => update(true)
    }).catch(() => undefined)
  }, [])
  return needsUpdate
}

export default function StatusBar() {
  const needsUpdate = usePwaUpdate()
  const dirty = useStore((s) => s.dirty)
  const selection = useStore((s) => s.selection)
  const nodes = useStore((s) => activeSheet(s).nodes.length)
  const findings = useFindings()
  return (
    <footer className="status">
      <span>{dirty ? '● Unsaved changes' : 'Saved'}</span>
      <span>{nodes} symbols</span>
      <span>{selection.length ? `${selection.length} selected` : ''}</span>
      {needsUpdate && (
        <button className="update-chip" onClick={() => void updateSW?.()}>
          ⟳ Update available — reload
        </button>
      )}
      <span className={findings.length ? 'status-warn' : ''}>
        {findings.length ? `⚠ ${findings.length} finding${findings.length > 1 ? 's' : ''}` : '✓ No findings'}
      </span>
    </footer>
  )
}
