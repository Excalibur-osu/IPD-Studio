import { activeSheet, useStore } from '../store/store'
import { useFindings } from './ValidationPanel'

// PWA update prompting lives in panels/UpdateToast.tsx (both workspaces).
// The budget chip moved to the toolbar (panels/BudgetDialog.tsx) — the running
// cost is something you steer by while drawing, not a status readout.

export default function StatusBar() {
  const dirty = useStore((s) => s.dirty)
  const selection = useStore((s) => s.selection)
  const nodes = useStore((s) => activeSheet(s).nodes.length)
  const findings = useFindings()
  return (
    <footer className="status">
      <span>{dirty ? '\u25cf Unsaved changes' : 'Saved'}</span>
      <span>{nodes} symbols</span>
      <span>{selection.length ? `${selection.length} selected` : ''}</span>
      <span className={findings.length ? 'status-warn' : ''}>
        {findings.length ? `\u26a0 ${findings.length} finding${findings.length > 1 ? 's' : ''}` : '\u2713 No findings'}
      </span>
    </footer>
  )
}
