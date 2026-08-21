import type { Finding, ProjectDoc } from '../model/types'
import { isPortEnd } from '../model/types'
import { validateLetters } from '../isa/tag'
import { formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
import { canConnect } from '../canvas/connectionRules'
import type { PortKind } from '../symbols/types'

export function runChecks(doc: ProjectDoc): Finding[] {
  const findings: Finding[] = []
  const add = (checkId: string, message: string, targetId?: string) =>
    findings.push({ id: `${checkId}:${targetId ?? findings.length}`, checkId, message, ...(targetId ? { targetId } : {}) })

  // 1. duplicate tags
  const tagSeen = new Map<string, string>()
  for (const node of doc.nodes) {
    if (!node.tag?.letters || !node.tag.loop) continue
    const key = formatTag(node.tag, '-')
    const firstId = tagSeen.get(key)
    if (firstId) add('duplicate-tag', `Tag ${key} appears more than once`, node.id)
    else tagSeen.set(key, node.id)
  }

  // 2. instruments without a tag
  for (const node of doc.nodes) {
    if (node.kind === 'instrument' && (!node.tag || !node.tag.letters || !node.tag.loop)) {
      add('missing-tag', `${getSymbol(node.symbolId).name} has no tag`, node.id)
    }
  }

  // 3. invalid ISA letters
  for (const node of doc.nodes) {
    if (!node.tag?.letters) continue
    const v = validateLetters(node.tag.letters)
    if (!v.ok) add('invalid-letters', `${node.tag.letters}: ${v.reason}`, node.id)
  }

  // 4. dangling free ends (allowed only on off-page connectors) + 5. incompatible connections
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  const portKind = (end: { nodeId: string; portId: string }): PortKind | null => {
    const node = nodeById.get(end.nodeId)
    if (!node) return null
    return getSymbol(node.symbolId).ports.find((p) => p.id === end.portId)?.kind ?? null
  }
  for (const edge of doc.edges) {
    const ends = [edge.source, edge.target]
    for (const end of ends) {
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

  // 6. duplicate line numbers
  const lnSeen = new Map<string, string>()
  for (const edge of doc.edges) {
    const ln = edge.lineNumber
    if (!ln || !(ln.size || ln.spec || ln.service || ln.seq)) continue
    const key = [ln.size, ln.spec, ln.service, ln.seq].join('-')
    if (lnSeen.has(key)) add('duplicate-line-number', `Line number ${key} appears more than once`, edge.id)
    else lnSeen.set(key, edge.id)
  }

  return findings
}
