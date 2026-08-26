import type { PlantEdge, PlantNode, ProjectDoc } from '../model/types'
import { isPortEnd } from '../model/types'
import { sheetPx } from '../model/doc'
import { formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
import { scalesOf } from '../canvas/alignment'
import { parseSvgToMarkup, type MarkupNode } from '../canvas/markupParser'
import { isProcessClass } from '../canvas/lineStyle'
import { activeSheet, useStore } from '../store/store'

/**
 * AutoCAD R12 ASCII DXF export. Model-only geometry: edge routes are the
 * straight source→vertices→target polyline (the on-screen manhattan route is
 * a view construct); path arcs are tessellated. Y is flipped (DXF is y-up).
 */

const pair = (code: number, value: string | number) => `${code}\n${value}\n`

const LAYERS = ['PROCESS', 'SIGNAL', 'SYMBOLS', 'TEXT', 'FRAME'] as const
type Layer = (typeof LAYERS)[number]

function header(): string {
  let out = pair(999, 'IPD Studio DXF export — model geometry; signal decorations and manhattan routing simplified')
  out += pair(0, 'SECTION') + pair(2, 'TABLES')
  out += pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length)
  for (const name of LAYERS) {
    out += pair(0, 'LAYER') + pair(2, name) + pair(70, 0) + pair(62, 7) + pair(6, 'CONTINUOUS')
  }
  out += pair(0, 'ENDTAB') + pair(0, 'ENDSEC')
  return out
}

function polyline(layer: Layer, pts: { x: number; y: number }[]): string {
  let out = pair(0, 'POLYLINE') + pair(8, layer) + pair(66, 1) + pair(70, 0)
  for (const p of pts) {
    out += pair(0, 'VERTEX') + pair(8, layer) + pair(10, round(p.x)) + pair(20, round(p.y)) + pair(30, 0)
  }
  out += pair(0, 'SEQEND')
  return out
}

function circleEnt(layer: Layer, cx: number, cy: number, r: number): string {
  return pair(0, 'CIRCLE') + pair(8, layer) + pair(10, round(cx)) + pair(20, round(cy)) + pair(30, 0) + pair(40, round(r))
}

function textEnt(layer: Layer, x: number, y: number, height: number, value: string): string {
  return (
    pair(0, 'TEXT') + pair(8, layer) + pair(10, round(x)) + pair(20, round(y)) + pair(30, 0) + pair(40, height) + pair(1, value)
  )
}

const round = (v: number) => Math.round(v * 100) / 100

interface Xform {
  nx: number
  ny: number
  rotation: number
  w: number
  h: number
  sx: number
  sy: number
  flipY: (y: number) => number
}

/** Local symbol point -> sheet DXF point (scale, rotation about center, y-flip). */
function tx(p: { x: number; y: number }, t: Xform): { x: number; y: number } {
  const cx = (t.w * t.sx) / 2
  const cy = (t.h * t.sy) / 2
  let dx = p.x * t.sx - cx
  let dy = p.y * t.sy - cy
  const turns = ((t.rotation % 360) + 360) % 360
  for (let i = 0; i < turns / 90; i++) {
    const nd = { x: -dy, y: dx }
    dx = nd.x
    dy = nd.y
  }
  return { x: t.nx + cx + dx, y: t.flipY(t.ny + cy + dy) }
}

/** Sample an SVG path's line/arc commands into polyline points (subset emitted by our renderers). */
function pathToPolylines(d: string): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  let pos = { x: 0, y: 0 }
  let start = { x: 0, y: 0 }
  const push = () => {
    if (current.length > 1) out.push(current)
    current = []
  }
  const tokens = d.match(/[MLHVAQCZmlhvaqcz]|-?[\d.]+/g) ?? []
  let i = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const cmd = tokens[i++]!
    switch (cmd) {
      case 'M': push(); pos = { x: num(), y: num() }; start = pos; current = [pos]; break
      case 'm': push(); pos = { x: pos.x + num(), y: pos.y + num() }; start = pos; current = [pos]; break
      case 'L': pos = { x: num(), y: num() }; current.push(pos); break
      case 'l': pos = { x: pos.x + num(), y: pos.y + num() }; current.push(pos); break
      case 'H': pos = { x: num(), y: pos.y }; current.push(pos); break
      case 'h': pos = { x: pos.x + num(), y: pos.y }; current.push(pos); break
      case 'V': pos = { x: pos.x, y: num() }; current.push(pos); break
      case 'v': pos = { x: pos.x, y: pos.y + num() }; current.push(pos); break
      case 'A': case 'a': {
        // rx ry rot large sweep x y — approximate with a 6-point sweep by lerp
        num(); num(); num(); num(); num()
        const end = cmd === 'A' ? { x: num(), y: num() } : { x: pos.x + num(), y: pos.y + num() }
        const mid = { x: (pos.x + end.x) / 2, y: (pos.y + end.y) / 2 }
        // bow the midpoint perpendicular to the chord for a visible arc hint
        const dx = end.x - pos.x
        const dy = end.y - pos.y
        const len = Math.hypot(dx, dy) || 1
        current.push({ x: mid.x - (dy / len) * len * 0.3, y: mid.y + (dx / len) * len * 0.3 }, end)
        pos = end
        break
      }
      case 'Q': case 'q': {
        const c = cmd === 'Q' ? { x: num(), y: num() } : { x: pos.x + num(), y: pos.y + num() }
        const end = cmd === 'Q' ? { x: num(), y: num() } : { x: pos.x + num(), y: pos.y + num() }
        current.push({ x: (pos.x + 2 * c.x + end.x) / 4, y: (pos.y + 2 * c.y + end.y) / 4 }, end)
        pos = end
        break
      }
      case 'Z': case 'z': current.push(start); pos = start; break
      default: break // stray number — skip
    }
  }
  push()
  return out
}

function nodeEntities(node: PlantNode, flipY: (y: number) => number): string {
  let out = ''
  let def
  try {
    def = getSymbol(node.symbolId)
  } catch {
    return ''
  }
  const t: Xform = {
    nx: node.x, ny: node.y, rotation: node.rotation,
    w: def.gridSize.w * 8, h: def.gridSize.h * 8, ...scalesOf(node), flipY,
  }
  const walk = (nodes: (MarkupNode | string)[]) => {
    for (const mk of nodes) {
      if (typeof mk === 'string') continue
      const a = mk.attributes ?? {}
      switch (mk.tagName) {
        case 'path':
          for (const line of pathToPolylines(a.d ?? '')) out += polyline('SYMBOLS', line.map((p) => tx(p, t)))
          break
        case 'circle': {
          const c = tx({ x: Number(a.cx), y: Number(a.cy) }, t)
          out += circleEnt('SYMBOLS', c.x, c.y, Number(a.r) * ((t.sx + t.sy) / 2))
          break
        }
        case 'rect': {
          const x = Number(a.x ?? 0)
          const y = Number(a.y ?? 0)
          const w = Number(a.width)
          const h = Number(a.height)
          out += polyline('SYMBOLS', [
            tx({ x, y }, t), tx({ x: x + w, y }, t), tx({ x: x + w, y: y + h }, t), tx({ x, y: y + h }, t), tx({ x, y }, t),
          ])
          break
        }
        case 'polygon': {
          const pts = (a.points ?? '').split(/[ ,]+/).map(Number)
          const poly: { x: number; y: number }[] = []
          for (let k = 0; k + 1 < pts.length; k += 2) poly.push(tx({ x: pts[k]!, y: pts[k + 1]! }, t))
          if (poly.length) out += polyline('SYMBOLS', [...poly, poly[0]!])
          break
        }
        case 'line': {
          out += polyline('SYMBOLS', [
            tx({ x: Number(a.x1), y: Number(a.y1) }, t),
            tx({ x: Number(a.x2), y: Number(a.y2) }, t),
          ])
          break
        }
        case 'g':
          walk(mk.children ?? [])
          break
        default:
          break
      }
    }
  }
  const cfg = node.config ?? def.defaultConfig ?? {}
  walk(parseSvgToMarkup(def.render(cfg)))

  const w = def.gridSize.w * 8 * t.sx
  if (node.tag) {
    out += textEnt('TEXT', node.x + w / 2 - 12, flipY(node.y - 8), 8, formatTag(node.tag, '-'))
  }
  if (node.label) {
    if (node.labelPos === 'center') {
      const h = def.gridSize.h * 8 * t.sy
      out += textEnt('TEXT', node.x + w / 2 - node.label.length * 2.2, flipY(node.y + h / 2 + 3), 8, node.label)
    } else {
      out += textEnt('TEXT', node.x, flipY(node.y + def.gridSize.h * 8 * t.sy + 14), 8, node.label)
    }
  }
  return out
}

function edgeEntities(edge: PlantEdge, nodes: Map<string, PlantNode>, flipY: (y: number) => number): string {
  const endPoint = (end: PlantEdge['source']): { x: number; y: number } | null => {
    if (!isPortEnd(end)) return { x: end.x, y: end.y }
    const node = nodes.get(end.nodeId)
    if (!node) return null
    try {
      const def = getSymbol(node.symbolId)
      const port = def.ports.find((p) => p.id === end.portId)
      if (!port) return { x: node.x, y: node.y }
      const t: Xform = {
        nx: node.x, ny: node.y, rotation: node.rotation,
        w: def.gridSize.w * 8, h: def.gridSize.h * 8, ...scalesOf(node), flipY: (y) => y,
      }
      return tx({ x: port.x, y: port.y }, t)
    } catch {
      return { x: node.x, y: node.y }
    }
  }
  const src = endPoint(edge.source)
  const tgt = endPoint(edge.target)
  if (!src || !tgt) return ''
  const pts = [src, ...(edge.vertices ?? []), tgt].map((p) => ({ x: p.x, y: flipY(p.y) }))
  return polyline(isProcessClass(edge.lineClass) ? 'PROCESS' : 'SIGNAL', pts)
}

export function dxfForSheet(doc: ProjectDoc, sheetId: string): string {
  const sheet = doc.sheets.find((sh) => sh.id === sheetId)
  if (!sheet) throw new Error(`Unknown sheet: ${sheetId}`)
  const { w, h } = sheetPx(sheet.sheetSize)
  const flipY = (y: number) => round(h - y)
  const nodeMap = new Map(sheet.nodes.map((n) => [n.id, n]))

  let entities = ''
  // sheet frame
  entities += polyline('FRAME', [
    { x: 24, y: flipY(24) }, { x: w - 24, y: flipY(24) }, { x: w - 24, y: flipY(h - 24) }, { x: 24, y: flipY(h - 24) }, { x: 24, y: flipY(24) },
  ])
  entities += textEnt('FRAME', w - 420, 32, 12, `${doc.meta.name} — ${sheet.name}`)
  for (const node of sheet.nodes) entities += nodeEntities(node, flipY)
  for (const edge of sheet.edges) entities += edgeEntities(edge, nodeMap, flipY)

  return (
    header() +
    pair(0, 'SECTION') + pair(2, 'ENTITIES') +
    entities +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF')
  )
}

export function downloadDxf(): void {
  const state = useStore.getState()
  const sheet = activeSheet(state)
  const dxf = dxfForSheet(state.doc, sheet.id)
  const blob = new Blob([dxf], { type: 'application/dxf' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${state.doc.meta.name || 'diagram'}-${sheet.name.replace(/\s+/g, '')}.dxf`
  a.click()
  URL.revokeObjectURL(a.href)
}
