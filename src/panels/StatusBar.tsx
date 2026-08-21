import { activeSheet, useStore } from '../store/store'
import { useFindings } from './ValidationPanel'

export default function StatusBar() {
  const dirty = useStore((s) => s.dirty)
  const selection = useStore((s) => s.selection)
  const nodes = useStore((s) => activeSheet(s).nodes.length)
  const findings = useFindings()
  return (
    <footer className="status">
      <span>{dirty ? '● Unsaved changes' : 'Saved'}</span>
      <span>{nodes} symbols</span>
      <span>{selection.length ? `${selection.length} selected` : ''}</span>
      <span className={findings.length ? 'status-warn' : ''}>
        {findings.length ? `⚠ ${findings.length} finding${findings.length > 1 ? 's' : ''}` : '✓ No findings'}
      </span>
    </footer>
  )
}
