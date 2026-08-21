import { dia, shapes } from '@joint/core'
import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import { getSymbol } from '../symbols/registry'
import { strokeFor } from './lineStyle'
import { parseSvgToMarkup, type MarkupNode } from './markupParser'

/**
 * Each port renders as a small always-visible dot (the connection point the
 * user aims for) under a larger invisible halo that is the actual magnet, so
 * starting a link doesn't demand pixel-perfect clicks. Styling lives in
 * app.css (.pid-port-*); exports strip both by joint-selector.
 */
const PORT_MARKUP = [
  {
    tagName: 'circle',
    selector: 'portDot',
    className: 'pid-port-dot',
    attributes: { r: 3, 'pointer-events': 'none' },
  },
  {
    tagName: 'circle',
    selector: 'portBody',
    className: 'pid-port-hit',
    attributes: { r: 8, fill: 'transparent', stroke: 'transparent', magnet: 'true', cursor: 'crosshair' },
  },
]

/** Divide stroke widths by the node scale so drawn line weight stays constant. */
function normalizeStrokes(nodes: (MarkupNode | string)[], s: number): void {
  for (const mk of nodes) {
    if (typeof mk === 'string') continue
    const sw = mk.attributes?.['stroke-width']
    if (sw && !Number.isNaN(Number(sw))) mk.attributes!['stroke-width'] = String(Number(sw) / s)
    if (mk.children) normalizeStrokes(mk.children, s)
  }
}

function markupFor(node: PlantNode): (MarkupNode | string)[] {
  const def = getSymbol(node.symbolId)
  const svg = def.render(node.config ?? def.defaultConfig ?? {})
  const sym = parseSvgToMarkup(svg)
  const s = node.scale ?? 1
  if (s !== 1) normalizeStrokes(sym, s)
  return [
    // Transparent body so the whole symbol (not just its hairline strokes)
    // accepts clicks and drags.
    {
      tagName: 'rect',
      selector: 'hit',
      attributes: {
        width: String(def.gridSize.w * 8),
        height: String(def.gridSize.h * 8),
        fill: 'transparent',
        stroke: 'none',
        cursor: 'move',
      },
    },
    { tagName: 'g', selector: 'sym', children: sym },
    { tagName: 'text', selector: 'tagL' },
    { tagName: 'text', selector: 'tagN' },
    { tagName: 'text', selector: 'lbl' },
  ]
}

/** Scaled pixel dims for a node (scale defaults to 1). */
function dimsFor(node: PlantNode): { w: number; h: number; s: number } {
  const def = getSymbol(node.symbolId)
  const s = node.scale ?? 1
  return { w: def.gridSize.w * 8 * s, h: def.gridSize.h * 8 * s, s }
}

function tagAttrs(node: PlantNode): Record<string, Record<string, unknown>> {
  const def = getSymbol(node.symbolId)
  const { w, h } = dimsFor(node)
  const inside = def.tagRule === 'isa-instrument' && node.symbolId === 'instr.bubble'
  const base = {
    fontFamily: 'sans-serif',
    fontSize: 11,
    textAnchor: 'middle',
    fill: '#111',
    stroke: '#fff',
    strokeWidth: 3,
    paintOrder: 'stroke',
    pointerEvents: 'none',
  }
  return {
    tagL: {
      ...base,
      text: node.tag?.letters ?? '',
      x: w / 2,
      y: inside ? h / 2 - 3 : -14,
    },
    tagN: {
      ...base,
      text: node.tag ? node.tag.loop + (node.tag.suffix ?? '') : '',
      x: w / 2,
      y: inside ? h / 2 + 9 : -3,
    },
    lbl: {
      ...base,
      fontSize: 10,
      text: node.label ?? '',
      x: w / 2,
      y: h + 12,
    },
  }
}

/** Full attrs bundle: symbol color/scale transform, hit body size, tag texts. */
function baseAttrs(node: PlantNode): Record<string, Record<string, unknown>> {
  const { w, h, s } = dimsFor(node)
  return {
    sym: { color: '#111', transform: `scale(${s})` },
    hit: { width: w, height: h },
    ...tagAttrs(node),
  }
}

function portItems(node: PlantNode) {
  const def = getSymbol(node.symbolId)
  const s = node.scale ?? 1
  return def.ports.map((p) => ({
    id: p.id,
    group: 'p',
    args: { x: p.x * s, y: p.y * s },
  }))
}

export function makeElement(node: PlantNode): dia.Element {
  const def = getSymbol(node.symbolId)
  const { w, h } = dimsFor(node)
  const el = new dia.Element(<dia.Element.Attributes>{
    id: node.id,
    type: 'pid.Symbol',
    position: { x: node.x, y: node.y },
    size: { width: w, height: h },
    angle: node.rotation,
    markup: markupFor(node) as unknown as dia.MarkupJSON,
    attrs: baseAttrs(node),
    ports: {
      groups: {
        p: { position: { name: 'absolute' }, markup: PORT_MARKUP },
      },
      items: portItems(node),
    },
    data: { symbolId: node.symbolId, kind: node.kind, portKinds: Object.fromEntries(def.ports.map((p) => [p.id, p.kind])) },
  })
  return el
}

export function updateElement(cell: dia.Element, node: PlantNode, prev: PlantNode): void {
  if (node.x !== prev.x || node.y !== prev.y) cell.set('position', { x: node.x, y: node.y })
  if (node.rotation !== prev.rotation) cell.set('angle', node.rotation)
  if (node.config !== prev.config) cell.set('markup', markupFor(node) as unknown as dia.MarkupJSON)
  const rescaled = (node.scale ?? 1) !== (prev.scale ?? 1)
  if (rescaled) {
    const { w, h } = dimsFor(node)
    cell.resize(w, h)
    cell.prop('ports/items', portItems(node))
    // markup carries scale-normalized stroke widths, so rebuild it too
    if (node.config === prev.config) cell.set('markup', markupFor(node) as unknown as dia.MarkupJSON)
  }
  if (node.tag !== prev.tag || node.label !== prev.label || node.config !== prev.config || rescaled) {
    cell.set('attrs', baseAttrs(node))
  }
}

function toEnd(end: PlantEdge['source']): dia.Link.EndJSON {
  return isPortEnd(end) ? { id: end.nodeId, port: end.portId } : { x: end.x, y: end.y }
}

type Direction = 'left' | 'right' | 'top' | 'bottom'

/** Which way a link should leave a port, from the port's place on its symbol. */
export function portDirection(symbolId: string, portId: string): Direction | null {
  try {
    const def = getSymbol(symbolId)
    const port = def.ports.find((p) => p.id === portId)
    if (!port) return null
    const w = def.gridSize.w * 8
    const h = def.gridSize.h * 8
    const candidates: [Direction, number][] = [
      ['left', port.x],
      ['right', w - port.x],
      ['top', port.y],
      ['bottom', h - port.y],
    ]
    candidates.sort((a, b) => a[1] - b[1])
    const [dir, distance] = candidates[0]!
    // 10px slack covers nozzle ports that sit slightly inside a dished head.
    return distance <= 10 ? dir : null
  } catch {
    return null
  }
}

function routerFor(edge: PlantEdge, nodes?: Map<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = { step: 8, padding: 16 }
  if (nodes) {
    if (isPortEnd(edge.source)) {
      const symbolId = nodes.get(edge.source.nodeId)
      const dir = symbolId ? portDirection(symbolId, edge.source.portId) : null
      if (dir) args.startDirections = [dir]
    }
    if (isPortEnd(edge.target)) {
      const symbolId = nodes.get(edge.target.nodeId)
      const dir = symbolId ? portDirection(symbolId, edge.target.portId) : null
      if (dir) args.endDirections = [dir]
    }
  }
  return { name: 'manhattan', args }
}

const LINK_MARKUP = [
  { tagName: 'path', selector: 'wrapper', attributes: { fill: 'none', cursor: 'pointer', stroke: 'transparent' } },
  { tagName: 'path', selector: 'outline', attributes: { fill: 'none', 'pointer-events': 'none' } },
  { tagName: 'path', selector: 'line', attributes: { fill: 'none', 'pointer-events': 'none' } },
]

function lineAttrs(edge: PlantEdge): Record<string, Record<string, unknown>> {
  const stroke = strokeFor(edge.lineClass)
  const marker =
    edge.arrow === 'flow'
      ? { type: 'path', d: 'M 10 -4 0 0 10 4 Z', fill: '#111' }
      : { type: 'none' }
  const line: Record<string, unknown> = {
    connection: true,
    fill: 'none',
    stroke: stroke.double ? '#fff' : '#111',
    strokeWidth: stroke.width,
    targetMarker: stroke.double ? { type: 'none' } : marker,
  }
  if (stroke.dasharray) line.strokeDasharray = stroke.dasharray
  const outline: Record<string, unknown> = stroke.double
    ? { connection: true, fill: 'none', stroke: '#111', strokeWidth: stroke.width + 3, targetMarker: marker }
    : { connection: true, fill: 'none', stroke: 'none', strokeWidth: 0, targetMarker: { type: 'none' } }
  return {
    line,
    outline,
    wrapper: { connection: true, strokeWidth: 12, stroke: 'transparent', fill: 'none' },
  }
}

export function makeLink(edge: PlantEdge, nodeSymbols?: Map<string, string>): dia.Link {
  const link = new shapes.standard.Link({
    id: edge.id,
    source: toEnd(edge.source),
    target: toEnd(edge.target),
    vertices: edge.vertices ?? [],
    router: routerFor(edge, nodeSymbols),
    connector: { name: 'normal' },
    markup: LINK_MARKUP,
    data: { lineClass: edge.lineClass },
  })
  link.attr(lineAttrs(edge))
  return link
}

export function updateLink(cell: dia.Link, edge: PlantEdge, prev: PlantEdge, nodeSymbols?: Map<string, string>): void {
  if (edge.source !== prev.source || edge.target !== prev.target) {
    cell.source(toEnd(edge.source))
    cell.target(toEnd(edge.target))
    cell.router(routerFor(edge, nodeSymbols) as never)
  }
  if (edge.vertices !== prev.vertices) cell.vertices(edge.vertices ?? [])
  if (edge.lineClass !== prev.lineClass || edge.arrow !== prev.arrow) {
    cell.removeAttr('line/strokeDasharray')
    cell.attr(lineAttrs(edge))
    cell.set('data', { lineClass: edge.lineClass })
  }
}
