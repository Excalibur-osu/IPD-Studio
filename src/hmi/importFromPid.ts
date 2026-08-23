import { ulid } from 'ulid'
import type { PlantEdge, PlantNode, ProjectDoc, Sheet } from '../model/types'
import { isPortEnd } from '../model/types'
import { portWorld } from '../canvas/alignment'
import type { HmiPipe, HmiScreen, HmiWidget, WidgetType } from './model'
import { HMI_WORLD, WIDGET_DEFAULT_SIZE } from './model'
import { formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
// side-effect: fill the symbol registry (same import the catalog tests use)
import '../symbols/lib/index'

export interface ImportCtx { nameOf: Map<string, string> }

const AUTO_PREFIX: Partial<Record<WidgetType, string>> = {
  tank: 'TK', pump: 'P', valve: 'V', display: 'XI', symbol: 'X',
}

function categoryOf(node: PlantNode): string {
  try { return getSymbol(node.symbolId).category } catch { return 'custom' }
}

function widgetTypeFor(node: PlantNode, category: string): { type: WidgetType; props: HmiWidget['props'] } | null {
  if (node.kind === 'annotation') return null
  const letters = node.tag?.letters ?? ''
  if (node.kind === 'equipment' && category === 'vessels') return { type: 'tank', props: undefined }
  if (category === 'rotating') return { type: 'pump', props: undefined }
  if (category === 'control-valves') return { type: 'valve', props: { throttle: true } }
  if (category === 'safety') return { type: 'symbol', props: { symbolId: node.symbolId } }
  if (node.kind === 'valve') return { type: 'valve', props: undefined }
  if (node.kind === 'instrument') {
    if (letters.endsWith('T')) return { type: 'display', props: undefined }
    if (letters.includes('C') && !letters.endsWith('V')) return { type: 'display', props: { controller: true } }
    return { type: 'display', props: undefined }
  }
  return { type: 'symbol', props: { symbolId: node.symbolId } }
}

/** Map a sheet's nodes to HMI widgets (positions raw; importSheet rescales). */
export function mapNodes(sheet: Sheet, separator: '-' | ''): { widgets: HmiWidget[]; ctx: ImportCtx } {
  const widgets: HmiWidget[] = []
  const nameOf = new Map<string, string>()
  const counters = new Map<string, number>()
  const used = new Set<string>()

  for (const node of sheet.nodes) {
    const category = categoryOf(node)
    const mapped = widgetTypeFor(node, category)
    if (!mapped) continue
    let name = node.tag ? formatTag(node.tag, separator) : (node.label?.trim() || '')
    if (!name || used.has(name)) {
      const prefix = AUTO_PREFIX[mapped.type] ?? 'X'
      let n = (counters.get(prefix) ?? 0) + 1
      while (used.has(`${prefix}-${n}`)) n++
      counters.set(prefix, n)
      name = `${prefix}-${n}`
    }
    used.add(name)
    nameOf.set(node.id, name)

    let w: number, h: number
    if (mapped.type === 'display') {
      ;({ w, h } = WIDGET_DEFAULT_SIZE.display)
    } else {
      const scale = node.scale ?? 1
      try {
        const g = getSymbol(node.symbolId).gridSize
        w = g.w * 8 * scale
        h = g.h * 8 * scale
      } catch {
        ;({ w, h } = WIDGET_DEFAULT_SIZE[mapped.type])
      }
      if (mapped.type === 'tank') { w = Math.max(w, 64); h = Math.max(h, 80) }
    }
    widgets.push({
      id: `imp-${node.id}`,
      type: mapped.type, x: node.x, y: node.y, w, h,
      tag: name, label: node.label, props: mapped.props,
    })
  }
  return { widgets, ctx: { nameOf } }
}

const isProcess = (lc: PlantEdge['lineClass']) => lc.startsWith('process') || lc.startsWith('pipe.')

/** Edges that become HMI pipes: process/pipe runs, but NOT impulse tubing —
 *  an imported impulse stub would read as a free-ended flow source. */
const isPipeWorthy = (lc: PlantEdge['lineClass']) => isProcess(lc) && lc !== 'process.impulse'

function nodeSize(node: PlantNode): { w: number; h: number } {
  const scale = node.scale ?? 1
  try {
    const g = getSymbol(node.symbolId).gridSize
    return { w: g.w * 8 * scale, h: g.h * 8 * scale }
  } catch {
    return { w: 32, h: 32 }
  }
}

function endPoint(end: PlantEdge['source'], nodes: Map<string, PlantNode>): { x: number; y: number } {
  if (!isPortEnd(end)) return { x: end.x, y: end.y }
  const node = nodes.get(end.nodeId)
  if (!node) return { x: 0, y: 0 }
  const p = portWorld(node, end.portId)
  if (p) return p
  const { w, h } = nodeSize(node)
  return { x: node.x + w / 2, y: node.y + h / 2 }
}

/** ≤2-hop neighborhood walk from an instrument node over ALL edges: first
 *  vessel found wins as bindTank; else the first process edge as bindPipe. */
function findBinding(sheet: Sheet, nodeId: string, ctx: ImportCtx): { bindTank?: string; bindPipe?: string } {
  const nodesById = new Map(sheet.nodes.map((n) => [n.id, n]))
  let frontier = [nodeId]
  const seen = new Set(frontier)
  let processEdge: string | undefined
  for (let hop = 0; hop < 2; hop++) {
    const next: string[] = []
    for (const edge of sheet.edges) {
      const ids = [edge.source, edge.target].filter(isPortEnd).map((e) => e.nodeId)
      if (!ids.some((id) => frontier.includes(id))) continue
      if (isProcess(edge.lineClass) && !processEdge) processEdge = edge.id
      for (const id of ids) {
        if (seen.has(id)) continue
        seen.add(id)
        const n = nodesById.get(id)
        if (n && n.kind === 'equipment' && categoryOf(n) === 'vessels') {
          const tank = ctx.nameOf.get(id)
          if (tank) return { bindTank: tank }
        }
        next.push(id)
      }
    }
    frontier = next
  }
  return processEdge ? { bindPipe: processEdge } : {}
}

/** Full import: widgets + pipes + measurement bindings, scaled into HMI_WORLD. */
export function importSheet(doc: ProjectDoc, sheetId: string): HmiScreen {
  const sheet = doc.sheets.find((s) => s.id === sheetId)
  if (!sheet) throw new Error(`No sheet ${sheetId}`)
  const { widgets, ctx } = mapNodes(sheet, doc.settings.tagSeparator)
  const nodesById = new Map(sheet.nodes.map((n) => [n.id, n]))

  // transmitter bindings
  for (const node of sheet.nodes) {
    if (node.kind !== 'instrument' || !(node.tag?.letters ?? '').endsWith('T')) continue
    const name = ctx.nameOf.get(node.id)
    const widget = widgets.find((w) => w.tag === name)
    if (!widget) continue
    const binding = findBinding(sheet, node.id, ctx)
    if (binding.bindTank ?? binding.bindPipe) widget.props = { ...widget.props, ...binding }
  }

  const pipes: HmiPipe[] = sheet.edges.filter((e) => isPipeWorthy(e.lineClass)).map((e) => ({
    id: ulid(),
    flowRef: e.id,
    points: [endPoint(e.source, nodesById), ...(e.vertices ?? []), endPoint(e.target, nodesById)],
  }))

  // bindPipe references P&ID edge ids -> retarget to the imported pipe id
  const pipeByEdge = new Map(pipes.map((p) => [p.flowRef!, p.id]))
  for (const w of widgets) {
    if (typeof w.props?.bindPipe === 'string') {
      const pid = pipeByEdge.get(w.props.bindPipe)
      if (pid) w.props = { ...w.props, bindPipe: pid }
      else {
        const props = { ...w.props }
        delete props.bindPipe
        w.props = props
      }
    }
  }

  // orthogonalize: a diagonal segment reads as sloppy on an HMI — insert an
  // elbow (horizontal-first) so imported runs look drawn, not rubber-banded
  for (const p of pipes) {
    const out: { x: number; y: number }[] = [p.points[0]!]
    for (let i = 1; i < p.points.length; i++) {
      const a = out[out.length - 1]!, b = p.points[i]!
      if (Math.abs(b.x - a.x) > 6 && Math.abs(b.y - a.y) > 6) out.push({ x: b.x, y: a.y })
      out.push(b)
    }
    p.points = out
  }

  // uniform scale-to-fit with a 40px margin (never upscales)
  const xs = [...widgets.flatMap((w) => [w.x, w.x + w.w]), ...pipes.flatMap((p) => p.points.map((q) => q.x))]
  const ys = [...widgets.flatMap((w) => [w.y, w.y + w.h]), ...pipes.flatMap((p) => p.points.map((q) => q.y))]
  if (xs.length > 0) {
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const k = Math.min(1, (HMI_WORLD.w - 80) / Math.max(1, maxX - minX), (HMI_WORLD.h - 80) / Math.max(1, maxY - minY))
    const tx = (v: number) => 40 + (v - minX) * k
    const ty = (v: number) => 40 + (v - minY) * k
    for (const w of widgets) { w.x = tx(w.x); w.y = ty(w.y); w.w *= k; w.h *= k }
    for (const p of pipes) p.points = p.points.map((q) => ({ x: tx(q.x), y: ty(q.y) }))
  }

  deoverlap(widgets)

  return { id: ulid(), name: `${sheet.name} HMI`, theme: 'classic', widgets, pipes, fromSheetId: sheetId }
}

const MOVABLE = new Set<string>(['display', 'gauge', 'trend', 'lamp', 'button', 'switch'])
const MARGIN = 8

function intersects(a: HmiWidget, b: HmiWidget): boolean {
  return a.x < b.x + b.w + MARGIN && a.x + a.w + MARGIN > b.x && a.y < b.y + b.h + MARGIN && a.y + a.h + MARGIN > b.y
}

/** Imported instrument boxes land at bubble positions and pile onto equipment
 *  and each other; nudge each movable widget to the nearest free spot. */
export function deoverlap(widgets: HmiWidget[]): void {
  const placed: HmiWidget[] = widgets.filter((w) => !MOVABLE.has(w.type))
  for (const w of widgets) {
    if (!MOVABLE.has(w.type)) continue
    const collides = (cand: HmiWidget) => placed.some((o) => intersects(cand, o))
    if (collides(w)) {
      outer: for (let r = 1; r <= 15; r++) {
        const step = r * 16
        for (const [dx, dy] of [[step, 0], [-step, 0], [0, -step], [0, step], [step, -step], [step, step], [-step, -step], [-step, step]] as const) {
          const cand = { ...w, x: w.x + dx, y: w.y + dy }
          if (cand.x < 0 || cand.y < 0 || cand.x + cand.w > HMI_WORLD.w || cand.y + cand.h > HMI_WORLD.h) continue
          if (!collides(cand)) { w.x = cand.x; w.y = cand.y; break outer }
        }
      }
    }
    placed.push(w)
  }
}
