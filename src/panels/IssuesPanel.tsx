// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { useStore } from '../store/store'
import { issuesFor } from '../validate/issues'
import { locateCell } from './ValidationPanel'
import { applyFix } from '../assist/fixes'
import { navigateWorkspace } from '../routes'

/**
 * The glance version of the findings, while you draw.
 *
 * Validation and Advisor used to be two drawer tabs, which meant two lists to
 * check and an implicit severity flag deciding which one you were reading.
 * They are one engine, so they are one list — errors first, advice under it —
 * with the full report a click away in the Checks workspace.
 */
export default function IssuesPanel() {
  const doc = useStore((s) => s.doc)
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  const { findings, suggestions } = issuesFor(doc)

  const go = (sheetId: string | undefined, targetId: string | undefined) => {
    if (sheetId) setActiveSheet(sheetId)
    setTimeout(() => locateCell(targetId), 50)
  }

  if (findings.length === 0 && suggestions.length === 0) {
    return <div className="drawer-empty">No findings — the drawing is clean.</div>
  }

  return (
    <div className="drawer-list">
      {findings.length > 0 && (
        <section>
          <div className="drawer-group">Findings ({findings.length})</div>
          {findings.map((f) => (
            <button key={f.id} className="drawer-item" onClick={() => go(f.sheetId, f.targetId)}>
              {f.message}
            </button>
          ))}
        </section>
      )}
      {suggestions.length > 0 && (
        <section>
          <div className="drawer-group">Suggestions ({suggestions.length})</div>
          {suggestions.map((s) => (
            <div key={s.id} className="advisor-row">
              <button className="drawer-item" onClick={() => go(s.sheetId, s.targetId)}>💡 {s.message}</button>
              {s.fix && (
                <button className="advisor-fix" title="Apply this fix" onClick={() => applyFix(s.fix!)}>Fix</button>
              )}
            </div>
          ))}
        </section>
      )}
      <button className="drawer-more" onClick={() => navigateWorkspace('checks')}>
        Open the full report in Checks →
      </button>
    </div>
  )
}
