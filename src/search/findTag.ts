// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { ProjectDoc } from '../model/types'
import { formatTag } from '../isa/tag'

export interface TagHit {
  sheetId: string
  sheetName: string
  nodeId: string
  display: string
}

/** Case-insensitive substring search over formatted tags and labels, all sheets. */
export function findTag(doc: ProjectDoc, query: string): TagHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: TagHit[] = []
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) {
      const tagText = node.tag ? formatTag(node.tag, '-') : ''
      const label = node.label ?? ''
      const haystack = `${tagText} ${label}`.toLowerCase().replace(/-/g, '')
      const needle = q.replace(/-/g, '')
      if (haystack.includes(needle)) {
        hits.push({
          sheetId: sheet.id,
          sheetName: sheet.name,
          nodeId: node.id,
          display: tagText || label,
        })
      }
    }
  }
  return hits
}
