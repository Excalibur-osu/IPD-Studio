// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { issuesFor } from '../validate/issues'
import { applyFix } from '../assist/fixes'
import { useStore } from '../store/store'
import { locateCell } from './ValidationPanel'

const RULE_LABELS: Record<string, string> = {
  'no-receiver': 'Measurements without a receiver',
  'no-final-element': 'Controllers without a final element',
  'dead-end-instrument': 'Unconnected instruments',
  'needs-ip-converter': 'Signal chain: missing I/P converter',
  'no-relief': 'Vessels without relief',
  'no-fail-position': 'Valve failure positions',
  'valve-tag-on-bubble': 'Tag / symbol mismatches',
  'duplicate-line': 'Duplicate lines',
}

export function useSuggestions() {
  return issuesFor(useStore((s) => s.doc)).suggestions
}

export default function AdvisorPanel() {
  const suggestions = useSuggestions()
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  if (suggestions.length === 0) {
    return <div className="drawer-empty">No suggestions — the instrumentation looks complete.</div>
  }
  const grouped = new Map<string, typeof suggestions>()
  for (const s of suggestions) {
    const list = grouped.get(s.checkId) ?? []
    list.push(s)
    grouped.set(s.checkId, list)
  }
  const go = (s: (typeof suggestions)[number]) => {
    if (s.sheetId) setActiveSheet(s.sheetId)
    setTimeout(() => locateCell(s.targetId), 50)
  }
  return (
    <div className="drawer-list">
      {[...grouped.entries()].map(([checkId, list]) => (
        <section key={checkId}>
          <div className="drawer-group">{RULE_LABELS[checkId] ?? checkId} ({list.length})</div>
          {list.map((s) => (
            <div key={s.id} className="advisor-row">
              <button className="drawer-item" onClick={() => go(s)}>💡 {s.message}</button>
              {s.fix && (
                <button className="advisor-fix" title="Apply this fix" onClick={() => applyFix(s.fix!)}>
                  Fix
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
