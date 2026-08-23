import type { Finding, PlantEdge, PlantNode, ProjectDoc, Sheet } from '../model/types'
import { isPortEnd } from '../model/types'
import { formatTag } from '../isa/tag'

/** A Fix the Advisor can apply for the user. */
export type FixSpec = { kind: 'insert-ip'; sheetId: string; edgeId: string }

export interface Suggestion extends Finding {
  fix?: FixSpec
}

const RELIEF_SYMBOLS = new Set(['psv', 'pse', 'pvsv', 'psv.pilot', 'vacuum-breaker', 'breather', 'flame-arrestor'])
/** Actuators that need a pneumatic signal, not a milliamp loop. */
const PNEUMATIC_ACTUATORS = new Set(['diaphragm', 'piston'])

const tagOf = (n: PlantNode) => (n.tag ? formatTag(n.tag, '-') : null)

function nodeEnds(sheet: Sheet, nodeId: string): PlantEdge[] {
  return sheet.edges.filter(
    (e) =>
      (isPortEnd(e.source) && e.source.nodeId === nodeId) ||
      (isPortEnd(e.target) && e.target.nodeId === nodeId),
  )
}

function neighborIds(sheet: Sheet, nodeId: string): string[] {
  const out: string[] = []
  for (const e of nodeEnds(sheet, nodeId)) {
    for (const end of [e.source, e.target]) {
      if (isPortEnd(end) && end.nodeId !== nodeId) out.push(end.nodeId)
    }
  }
  return out
}

/** Instruments reachable over signal-family lines within `hops`. */
function signalReach(sheet: Sheet, startId: string, hops: number): Set<string> {
  const seen = new Set<string>([startId])
  let frontier = [startId]
  for (let i = 0; i < hops; i++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of nodeEnds(sheet, id)) {
        if (!e.lineClass.startsWith('signal') && e.lineClass !== 'link.internal') continue
        for (const end of [e.source, e.target]) {
          if (isPortEnd(end) && !seen.has(end.nodeId)) {
            seen.add(end.nodeId)
            next.push(end.nodeId)
          }
        }
      }
    }
    frontier = next
  }
  seen.delete(startId)
  return seen
}

/**
 * Domain advice: reads the drawing the way an instrument engineer would and
 * suggests completions/corrections. Everything here is severity 'suggestion'
 * — advice, never an error.
 */
export function runSuggestions(doc: ProjectDoc): Suggestion[] {
  const out: Suggestion[] = []
  const allTagged: { node: PlantNode; sheet: Sheet }[] = []
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) if (node.tag?.letters && node.tag.loop) allTagged.push({ node, sheet })
  }
  const add = (checkId: string, sheet: Sheet, message: string, targetId?: string, fix?: FixSpec) =>
    out.push({
      id: `${checkId}:${targetId ?? out.length}`,
      checkId,
      message,
      severity: 'suggestion',
      sheetId: sheet.id,
      ...(targetId ? { targetId } : {}),
      ...(fix ? { fix } : {}),
    })

  for (const sheet of doc.sheets) {
    const byId = new Map(sheet.nodes.map((n) => [n.id, n]))

    for (const node of sheet.nodes) {
      const t = node.tag

      // 1. transmitter with no receiver in its loop (project-wide search)
      if (t && node.kind === 'instrument' && t.letters.length >= 2 && t.letters.endsWith('T')) {
        const family = t.letters[0]
        const hasReceiver = allTagged.some(({ node: o }) => {
          if (o.id === node.id || !o.tag) return false
          if (o.tag.letters[0] !== family || o.tag.loop !== t.loop) return false
          return /[ICR]/.test(o.tag.letters.slice(1))
        })
        if (!hasReceiver) {
          add('no-receiver', sheet, `${tagOf(node)} measures but nothing receives it — add an indicator or controller?`, node.id)
        }
      }

      // 2. controller with no final control element
      if (t && node.kind === 'instrument' && t.letters.includes('C') && !t.letters.endsWith('V')) {
        const family = t.letters[0]
        const taggedFinal = allTagged.some(
          ({ node: o }) => o.kind === 'valve' && o.tag!.loop === t.loop && o.tag!.letters[0] === family,
        )
        const wiredFinal = [...signalReach(sheet, node.id, 3)].some((id) => byId.get(id)?.kind === 'valve')
        if (!taggedFinal && !wiredFinal) {
          add('no-final-element', sheet, `${tagOf(node)} controls nothing — where is its valve?`, node.id)
        }
      }

      // 3. tagged instrument connected to nothing at all
      if (t && node.kind === 'instrument' && nodeEnds(sheet, node.id).length === 0) {
        add('dead-end-instrument', sheet, `${tagOf(node)} is not connected to anything`, node.id)
      }

      // 5. vessel with process connections but no relief device attached
      if (node.symbolId.startsWith('vessel.')) {
        const hasProcess = nodeEnds(sheet, node.id).some((e) => e.lineClass.startsWith('process') || e.lineClass.startsWith('pipe'))
        const hasRelief = neighborIds(sheet, node.id).some((id) => RELIEF_SYMBOLS.has(byId.get(id)?.symbolId ?? ''))
        if (hasProcess && !hasRelief) {
          const name = node.label || tagOf(node) || 'Vessel'
          add('no-relief', sheet, `${name} has no relief device connected — intended?`, node.id)
        }
      }

      // 6. control valve without a declared failure position
      if (node.symbolId.startsWith('cv.') && (node.config?.fail ?? 'none') === 'none') {
        add('no-fail-position', sheet, `${tagOf(node) ?? 'Control valve'} has no failure position (FC/FO/FL)`, node.id)
      }

      // 7. valve letters on an instrument bubble
      if (node.symbolId === 'instr.bubble' && t && t.letters.endsWith('V') && t.letters.length >= 2) {
        add('valve-tag-on-bubble', sheet, `${tagOf(node)} is a valve tag on an instrument bubble — did you mean the valve symbol?`, node.id)
      }
    }

    // 8. two lines connecting exactly the same two points
    const pairSeen = new Set<string>()
    for (const e of sheet.edges) {
      if (!isPortEnd(e.source) || !isPortEnd(e.target)) continue
      const key = [`${e.source.nodeId}:${e.source.portId}`, `${e.target.nodeId}:${e.target.portId}`].sort().join('|')
      if (pairSeen.has(key)) {
        add('duplicate-line', sheet, 'Two identical lines connect the same two points — delete one?', e.id)
      } else pairSeen.add(key)
    }

    // 4. electric signal straight into a pneumatic actuator — offer the I/P fix
    for (const e of sheet.edges) {
      if (e.lineClass !== 'signal.electric') continue
      if (!isPortEnd(e.source) || !isPortEnd(e.target)) continue
      const ends = [
        { end: e.source, other: e.target },
        { end: e.target, other: e.source },
      ]
      for (const { end, other } of ends) {
        const valve = byId.get(end.nodeId)
        const sender = byId.get(other.nodeId)
        if (!valve || !sender) continue
        if (!valve.symbolId.startsWith('cv.') || end.portId !== 'sig') continue
        if (!PNEUMATIC_ACTUATORS.has(valve.config?.actuator ?? 'diaphragm')) continue
        if (sender.symbolId === 'instr.converter') continue
        add(
          'needs-ip-converter',
          sheet,
          `Electric signal drives ${tagOf(valve) ?? 'a control valve'} with a pneumatic actuator — insert an I/P converter`,
          e.id,
          { kind: 'insert-ip', sheetId: sheet.id, edgeId: e.id },
        )
      }
    }
  }
  return out
}
