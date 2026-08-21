import { dia, shapes } from '@joint/core'
import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import { getSymbol } from '../symbols/registry'
import { strokeFor } from './lineStyle'
import { parseSvgToMarkup, type MarkupNode } from './markupParser'

const PORT_MARKUP = [
  {
    tagName: 'circle',
    selector: 'portBody',
    attributes: { r: 4, fill: 'transparent', stroke: 'transparent', magnet: 'true' },
  },
]

function markupFor(node: PlantNode): (MarkupNode | string)[] {
  const def = getSymbol(node.symbolId)
  const svg = def.render(node.config ?? def.defaultConfig ?? {})
  return [
    { tagName: 'g', selector: 'sym', children: parseSvgToMarkup(svg) },
    { tagName: 'text', selector: 'tagL' },
    { tagName: 'text', selector: 'tagN' },
    { tagName: 'text', selector: 'lbl' },
  ]
}

function tagAttrs(node: PlantNode): Record<string, Record<string, unknown>> {
  const def = getSymbol(node.symbolId)
  const w = def.gridSize.w * 8
  const h = def.gridSize.h * 8
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

export function makeElement(node: PlantNode): dia.Element {
  const def = getSymbol(node.symbolId)
  const el = new dia.Element(<dia.Element.Attributes>{
    id: node.id,
    type: 'pid.Symbol',
    position: { x: node.x, y: node.y },
    size: { width: def.gridSize.w * 8, height: def.gridSize.h * 8 },
    angle: node.rotation,
    markup: markupFor(node) as unknown as dia.MarkupJSON,
    attrs: { sym: { color: '#111' }, ...tagAttrs(node) },
    ports: {
      groups: {
        p: { position: { name: 'absolute' }, markup: PORT_MARKUP },
      },
      items: def.ports.map((p) => ({
        id: p.id,
        group: 'p',
        args: { x: p.x, y: p.y },
      })),
    },
    data: { symbolId: node.symbolId, kind: node.kind, portKinds: Object.fromEntries(def.ports.map((p) => [p.id, p.kind])) },
  })
  return el
}

export function updateElement(cell: dia.Element, node: PlantNode, prev: PlantNode): void {
  if (node.x !== prev.x || node.y !== prev.y) cell.set('position', { x: node.x, y: node.y })
  if (node.rotation !== prev.rotation) cell.set('angle', node.rotation)
  if (node.config !== prev.config) cell.set('markup', markupFor(node) as unknown as dia.MarkupJSON)
  if (node.tag !== prev.tag || node.label !== prev.label || node.config !== prev.config) {
    cell.set('attrs', { sym: { color: '#111' }, ...tagAttrs(node) })
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
    return distance <= 8 ? dir : null
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
