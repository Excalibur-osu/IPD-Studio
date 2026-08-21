import type { Finding, ProjectDoc } from '../model/types'
import { isPortEnd } from '../model/types'
import { validateLetters } from '../isa/tag'
import { formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
import { canConnect } from '../canvas/connectionRules'
import type { PortKind } from '../symbols/types'

export function runChecks(doc: ProjectDoc): Finding[] {
  const findings: Finding[] = []
  const sheetIds = new Set(doc.sheets.map((sh) => sh.id))
  const nodeIndex = new Map(doc.sheets.flatMap((sh) => sh.nodes.map((n) => [n.id, n] as const)))

  // project-wide duplicate-tag detection
  const tagSeen = new Map<string, string>()

  for (const sheet of doc.sheets) {
    const add = (checkId: string, message: string, targetId?: string) =>
      findings.push({
        id: `${checkId}:${targetId ?? findings.length}`,
        checkId,
        message,
        ...(targetId ? { targetId } : {}),
        sheetId: sheet.id,
      })

    // 1. duplicate tags (across all sheets)
    for (const node of sheet.nodes) {
      if (!node.tag?.letters || !node.tag.loop) continue
      const key = formatTag(node.tag, '-')
      if (tagSeen.has(key)) add('duplicate-tag', `Tag ${key} appears more than once`, node.id)
      else tagSeen.set(key, node.id)
    }

    // 2. instruments without a tag
    for (const node of sheet.nodes) {
      if (node.kind === 'instrument' && (!node.tag || !node.tag.letters || !node.tag.loop)) {
        add('missing-tag', `${getSymbol(node.symbolId).name} has no tag`, node.id)
      }
    }

    // 3. invalid ISA letters
    for (const node of sheet.nodes) {
      if (!node.tag?.letters) continue
      const v = validateLetters(node.tag.letters)
      if (!v.ok) add('invalid-letters', `${node.tag.letters}: ${v.reason}`, node.id)
    }

    // 4. dangling free ends + 5. incompatible connections
    const nodeById = new Map(sheet.nodes.map((n) => [n.id, n]))
    const portKind = (end: { nodeId: string; portId: string }): PortKind | null => {
      const node = nodeById.get(end.nodeId)
      if (!node) return null
      return getSymbol(node.symbolId).ports.find((p) => p.id === end.portId)?.kind ?? null
    }
    for (const edge of sheet.edges) {
      for (const end of [edge.source, edge.target]) {
        if (!isPortEnd(end)) add('dangling-end', 'Line has an unterminated free end', edge.id)
      }
      if (isPortEnd(edge.source) && isPortEnd(edge.target)) {
        const src = portKind(edge.source)
        const tgt = portKind(edge.target)
        if (src && tgt && !canConnect(src, tgt, edge.lineClass)) {
          add('incompatible-connection', `${edge.lineClass} line connects incompatible ports`, edge.id)
        }
      }
    }

    // 7. off-page connector links (unlinked only matters once there are other sheets)
    for (const node of sheet.nodes) {
      if (node.symbolId !== 'ann.offpage') continue
      if (!node.link) {
        if (doc.sheets.length > 1) {
          add('unlinked-offpage', 'Off-page connector is not linked to another sheet', node.id)
        }
      } else if (!sheetIds.has(node.link.sheetId) || !nodeIndex.has(node.link.nodeId)) {
        add('broken-link', 'Off-page connector points at a missing sheet or connector', node.id)
      }
    }
  }

  // 6. duplicate line numbers (project-wide)
  const lnSeen = new Map<string, string>()
  for (const sheet of doc.sheets) {
    for (const edge of sheet.edges) {
      const ln = edge.lineNumber
      if (!ln || !(ln.size || ln.spec || ln.service || ln.seq)) continue
      const key = [ln.size, ln.spec, ln.service, ln.seq].join('-')
      if (lnSeen.has(key)) {
        findings.push({
          id: `duplicate-line-number:${edge.id}`,
          checkId: 'duplicate-line-number',
          message: `Line number ${key} appears more than once`,
          targetId: edge.id,
          sheetId: sheet.id,
        })
      } else lnSeen.set(key, edge.id)
    }
  }

  return findings
}
