// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { Finding, ProjectDoc } from '../model/types'
import { runChecks } from './checks'
import { runSuggestions, type Suggestion } from './suggest'

export interface Issues {
  /** Hard findings — duplicate tags, illegal letters, dangling ends. */
  findings: Finding[]
  /** Advice — severity 'suggestion', never an error. */
  suggestions: Suggestion[]
  /** Everything, for the count on the rail and the status bar. */
  total: number
}

/**
 * One pass per document, however many panels ask.
 *
 * The status bar, the drawer and the validation panel each used to call
 * `useMemo(() => runChecks(doc), [doc])` separately, so every keystroke ran the
 * checks three times and the suggestions twice — each walking every sheet and
 * rebuilding its own maps. Memoising on document identity here collapses that
 * to one, and guarantees two panels can never disagree about what is wrong.
 *
 * A single-entry cache is enough: the store holds exactly one document, and a
 * new one replaces the old by identity on every edit.
 */
let cache: { doc: ProjectDoc; value: Issues } | null = null

export function issuesFor(doc: ProjectDoc): Issues {
  if (cache && cache.doc === doc) return cache.value
  const findings = runChecks(doc)
  const suggestions = runSuggestions(doc)
  const value: Issues = { findings, suggestions, total: findings.length + suggestions.length }
  cache = { doc, value }
  return value
}

/** Test seam — the cache would otherwise leak between cases. */
export function resetIssuesCache(): void {
  cache = null
}
