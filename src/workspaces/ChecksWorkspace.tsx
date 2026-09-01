// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { useStore } from '../store/store'
import { navigateWorkspace } from '../routes'
import { issuesFor } from '../validate/issues'
import { locateCell } from '../panels/ValidationPanel'
import { applyFix } from '../assist/fixes'
import type { Finding } from '../model/types'
import type { Suggestion } from '../validate/suggest'

const LABELS: Record<string, string> = {
  'duplicate-tag': 'Duplicate tags',
  'missing-tag': 'Missing tags',
  'invalid-letters': 'Invalid ISA letters',
  'dangling-end': 'Dangling line ends',
  'incompatible-connection': 'Incompatible connections',
  'duplicate-line-number': 'Duplicate line numbers',
  'unlinked-offpage': 'Unlinked off-page connectors',
  'broken-link': 'Broken off-page links',
  'no-receiver': 'Measurements without a receiver',
  'no-final-element': 'Controllers without a final element',
  'dead-end-instrument': 'Unconnected instruments',
  'needs-ip-converter': 'Signal chain: missing I/P converter',
  'no-relief': 'Vessels without relief',
  'no-fail-position': 'Valve failure positions',
  'valve-tag-on-bubble': 'Tag / symbol mismatches',
  'duplicate-line': 'Duplicate lines',
}

/**
 * The findings, full screen, grouped by what they mean rather than by which
 * function produced them. The drawer stays as the glance version while you
 * draw; this is the one you work through before issuing a drawing.
 *
 * Severity is still the binary the model can express today — a hard finding or
 * advice. The three-level engine with fixes, ignores and standards arrives in
 * v0.16; this screen is shaped to receive it.
 */
export default function ChecksWorkspace() {
  const doc = useStore((s) => s.doc)
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  const { findings, suggestions } = issuesFor(doc)

  const go = (item: Finding | Suggestion) => {
    if (item.sheetId) setActiveSheet(item.sheetId)
    navigateWorkspace('draw')
    setTimeout(() => locateCell(item.targetId), 60)
  }

  const group = <T extends Finding>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const i of items) {
      const list = map.get(i.checkId) ?? []
      list.push(i)
      map.set(i.checkId, list)
    }
    return [...map.entries()]
  }

  const clean = findings.length === 0 && suggestions.length === 0

  return (
    <div className="ws">
      <header className="ws-head">
        <h1>Checks</h1>
        <span className={`ws-tally${findings.length ? ' bad' : ' ok'}`} data-testid="checks-tally">
          {findings.length ? `${findings.length} finding${findings.length > 1 ? 's' : ''}` : 'No findings'}
        </span>
        {suggestions.length > 0 && (
          <span className="ws-tally soft">{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</span>
        )}
      </header>

      <div className="ws-body">
        {clean && (
          <p className="ws-empty">
            Nothing to fix — every tag parses, every line lands, and the instrumentation reads as complete.
          </p>
        )}

        {findings.length > 0 && (
          <section className="ws-sect">
            <h2 className="ws-sect-head bad">Findings <span>{findings.length}</span></h2>
            <p className="ws-sect-note">Errors in the drawing: these would stop it being issued.</p>
            {group(findings).map(([checkId, list]) => (
              <div key={checkId} className="ws-group">
                <div className="ws-group-head">{LABELS[checkId] ?? checkId} <span>{list.length}</span></div>
                {list.map((f) => (
                  <div key={f.id} className="ws-issue">
                    <button className="ws-issue-msg" onClick={() => go(f)}>{f.message}</button>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {suggestions.length > 0 && (
          <section className="ws-sect">
            <h2 className="ws-sect-head soft">Suggestions <span>{suggestions.length}</span></h2>
            <p className="ws-sect-note">Advice, never an error — an engineer may well have meant it this way.</p>
            {group(suggestions).map(([checkId, list]) => (
              <div key={checkId} className="ws-group">
                <div className="ws-group-head">{LABELS[checkId] ?? checkId} <span>{list.length}</span></div>
                {list.map((s) => (
                  <div key={s.id} className="ws-issue">
                    <button className="ws-issue-msg" onClick={() => go(s)}>{s.message}</button>
                    {s.fix && (
                      <button className="ws-issue-fix" title="Apply this fix" onClick={() => applyFix(s.fix!)}>
                        Fix
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
