import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { ulid } from 'ulid'
import type { LineClass, PlantEdge, PlantNode, Sheet } from '../model/types'
import { createSheet } from '../model/doc'
import { parseTag } from '../isa/tag'
import { symbolForComponentClass } from '../export/componentClass'
import { SYMBOLS } from '../symbols/registry'
import { LINE_STROKES } from '../canvas/lineStyle'

export class DexpiImportError extends Error {}

type XmlNode = Record<string, unknown>

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function genericAttrs(el: XmlNode): Record<string, string> {
  const out: Record<string, string> = {}
  for (const set of asArray(el.GenericAttributes as XmlNode | XmlNode[])) {
    for (const attr of asArray(set.GenericAttribute as XmlNode | XmlNode[])) {
      const name = attr['@_Name']
      const value = attr['@_Value']
      if (typeof name === 'string' && typeof value === 'string') out[name] = value
    }
  }
  return out
}

function position(el: XmlNode): { x: number; y: number } {
  const loc = (el.Position as XmlNode | undefined)?.Location as XmlNode | undefined
  return { x: Number(loc?.['@_X'] ?? 0), y: Number(loc?.['@_Y'] ?? 0) }
}

function importNode(el: XmlNode, kind: PlantNode['kind'], warnings: string[]): PlantNode {
  const attrs = genericAttrs(el)
  const cls = String(el['@_ComponentClass'] ?? 'PlantItem')
  let symbolId = attrs.SymbolId
  if (!symbolId || !SYMBOLS.has(symbolId)) {
    symbolId = symbolForComponentClass(cls) ?? ''
    if (!symbolId) {
      warnings.push(`Unknown ComponentClass "${cls}" — imported as text note`)
      symbolId = 'ann.text'
      kind = 'annotation'
    }
  }
  const { x, y } = position(el)
  const rotationNum = Number(attrs.Rotation ?? 0)
  const rotation = ([0, 90, 180, 270] as const).includes(rotationNum as 0 | 90 | 180 | 270)
    ? (rotationNum as 0 | 90 | 180 | 270)
    : 0
  const node: PlantNode = { id: String(el['@_ID'] ?? ulid()), symbolId, kind, x, y, rotation }
  if (attrs.TagLetters && attrs.TagLoop) {
    node.tag = { letters: attrs.TagLetters, loop: attrs.TagLoop, ...(attrs.TagSuffix ? { suffix: attrs.TagSuffix } : {}) }
  } else {
    const tagName = el['@_TagName']
    if (typeof tagName === 'string' && tagName) {
      const parsed = parseTag(tagName)
      if (parsed && kind === 'instrument') node.tag = parsed
      else node.label = tagName
    }
  }
  if (attrs.Label) node.label = attrs.Label
  // reconstruct symbol config from generic attrs (exported flat as Config.<key>)
  const config: Record<string, string> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('Config.')) config[k.slice(7)] = v
  }
  if (Object.keys(config).length) node.config = config
  return node
}

function importEdge(el: XmlNode, fallbackClass: LineClass, warnings: string[]): PlantEdge | null {
  const attrs = genericAttrs(el)
  let lineClass = (attrs.LineClass ?? fallbackClass) as LineClass
  if (!(lineClass in LINE_STROKES)) {
    warnings.push(`Unknown line class "${lineClass}" — using ${fallbackClass}`)
    lineClass = fallbackClass
  }
  const conn = (el.Connection ?? {}) as XmlNode
  const coords = asArray((el.CenterLine as XmlNode | undefined)?.Coordinate as XmlNode | XmlNode[]).map((c) => ({
    x: Number(c['@_X'] ?? 0),
    y: Number(c['@_Y'] ?? 0),
  }))
  const fromId = conn['@_FromID']
  const toId = conn['@_ToID']
  const source: PlantEdge['source'] =
    typeof fromId === 'string'
      ? { nodeId: fromId, portId: String(conn['@_FromNode'] ?? 'w') }
      : coords[0] ?? { x: 0, y: 0 }
  const target: PlantEdge['target'] =
    typeof toId === 'string'
      ? { nodeId: toId, portId: String(conn['@_ToNode'] ?? 'e') }
      : coords[coords.length - 1] ?? { x: 40, y: 0 }
  const edge: PlantEdge = { id: String(el['@_ID'] ?? ulid()), lineClass, source, target }
  if (attrs.LineSize || attrs.LineSpec || attrs.LineService || attrs.LineSequence) {
    edge.lineNumber = {
      size: attrs.LineSize ?? '',
      spec: attrs.LineSpec ?? '',
      service: attrs.LineService ?? '',
      seq: attrs.LineSequence ?? '',
    }
  }
  return edge
}

/** Parse a Proteus/DEXPI-shaped XML document into a single Sheet. */
export function importDexpi(xml: string): { sheet: Sheet; warnings: string[] } {
  if (XMLValidator.validate(xml) !== true) throw new DexpiImportError('Not well-formed XML')
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as XmlNode
  const pm = parsed.PlantModel as XmlNode | undefined
  if (!pm) throw new DexpiImportError('No <PlantModel> root — not a DEXPI/Proteus file')

  const warnings: string[] = []
  const sheet = createSheet(1)
  const drawing = pm.Drawing as XmlNode | undefined
  if (drawing && typeof drawing['@_Name'] === 'string') sheet.name = drawing['@_Name']
  const info = pm.PlantInformation as XmlNode | undefined
  if (info && typeof info['@_DrawingNumber'] === 'string') sheet.drawingNumber = info['@_DrawingNumber']

  for (const el of asArray(pm.Equipment as XmlNode | XmlNode[])) {
    sheet.nodes.push(importNode(el, 'equipment', warnings))
  }
  for (const el of asArray(pm.ProcessInstrument as XmlNode | XmlNode[])) {
    sheet.nodes.push(importNode(el, 'instrument', warnings))
  }
  for (const sys of asArray(pm.PipingNetworkSystem as XmlNode | XmlNode[])) {
    for (const seg of asArray(sys.PipingNetworkSegment as XmlNode | XmlNode[])) {
      const edge = importEdge(seg, 'process.major', warnings)
      if (edge) sheet.edges.push(edge)
    }
  }
  for (const flow of asArray(pm.InformationFlow as XmlNode | XmlNode[])) {
    const edge = importEdge(flow, 'signal.electric', warnings)
    if (edge) sheet.edges.push(edge)
  }
  return { sheet, warnings }
}
