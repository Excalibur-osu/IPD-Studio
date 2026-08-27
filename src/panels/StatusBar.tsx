import { useState } from 'react'
import { activeSheet, useStore } from '../store/store'
import { useFindings } from './ValidationPanel'
import { fmtMoney, projectCost } from '../model/costs'
import BudgetDialog from './BudgetDialog'

// PWA update prompting lives in panels/UpdateToast.tsx (both workspaces).

function BudgetChip() {
  const doc = useStore((s) => s.doc)
  const [open, setOpen] = useState(false)
  const { total } = projectCost(doc)
  const budget = doc.budget
  const cur = budget?.currency ?? '$'
  const over = budget?.total !== undefined && total > budget.total
  if (total === 0 && budget?.total === undefined) {
    return (
      <>
        <button className="budget-chip" data-testid="budget-chip" title="Set a project budget" onClick={() => setOpen(true)}>💰 Budget…</button>
        {open && <BudgetDialog onClose={() => setOpen(false)} />}
      </>
    )
  }
  return (
    <>
      <button
        className={`budget-chip${over ? ' budget-over' : ''}`}
        data-testid="budget-chip"
        title={over ? 'Over budget — click for the breakdown' : 'Estimated project cost — click for the breakdown'}
        onClick={() => setOpen(true)}
      >
        💰 {cur}{fmtMoney(total)}{budget?.total !== undefined ? ` / ${cur}${fmtMoney(budget.total)}` : ''}
      </button>
      {open && <BudgetDialog onClose={() => setOpen(false)} />}
    </>
  )
}

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
      <BudgetChip />
      <span className={findings.length ? 'status-warn' : ''}>
        {findings.length ? `⚠ ${findings.length} finding${findings.length > 1 ? 's' : ''}` : '✓ No findings'}
      </span>
    </footer>
  )
}
