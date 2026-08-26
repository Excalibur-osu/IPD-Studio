import type { PlantEdge, PlantNode, ProjectDoc, Sheet } from '../model/types'
import { isPortEnd } from '../model/types'
import { sheetPx } from '../model/doc'
import { formatTag } from '../isa/tag'
import { isProcessClass } from '../canvas/lineStyle'
import { componentClassFor } from './componentClass'
import { activeSheet, useStore } from '../store/store'

/**
 * DEXPI-oriented export in the Proteus Schema 4.2 shape.
 * See docs/DEXPI-MAPPING.md — this is interoperability-oriented, not certified.
 */

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function el(tag: string, attrs: Record<string, string | number>, children: string[] = []): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
    .join('')
  if (children.length === 0) return `<${tag}${attrStr}/>`
  return `<${tag}${attrStr}>${children.join('')}</${tag}>`
}

function genericAttrs(pairs: [string, string][]): string {
  return el(
    'GenericAttributes',
    { Set: 'PIDStudio' },
    pairs.map(([name, value]) => el('GenericAttribute', { Name: name, Value: value })),
  )
}

function nodeXml(node: PlantNode): string {
  const isInstrument = node.kind === 'instrument'
  const tagName = node.tag ? formatTag(node.tag, '-') : (node.label ?? '')
  const attrs: [string, string][] = [
    ['SymbolId', node.symbolId],
    ['Rotation', String(node.rotation)],
  ]
  if (node.tag) {
    attrs.push(['TagLetters', node.tag.letters], ['TagLoop', node.tag.loop])
    if (node.tag.suffix) attrs.push(['TagSuffix', node.tag.suffix])
  }
  if (node.label) attrs.push(['Label', node.label])
  for (const [key, value] of Object.entries(node.config ?? {})) {
    attrs.push([`Config.${key}`, value])
  }
  return el(
    isInstrument ? 'ProcessInstrument' : 'Equipment',
    { ID: node.id, TagName: tagName, ComponentClass: componentClassFor(node.symbolId) },
    [
      el('Position', {}, [el('Location', { X: node.x, Y: node.y })]),
      genericAttrs(attrs),
    ],
  )
}

function connectionXml(edge: PlantEdge): string {
  const attrs: Record<string, string> = {}
  if (isPortEnd(edge.source)) {
    attrs.FromID = edge.source.nodeId
    attrs.FromNode = edge.source.portId
  }
  if (isPortEnd(edge.target)) {
    attrs.ToID = edge.target.nodeId
    attrs.ToNode = edge.target.portId
  }
  return el('Connection', attrs)
}

function centerLineXml(edge: PlantEdge): string {
  const coords: string[] = []
  if (!isPortEnd(edge.source)) coords.push(el('Coordinate', { X: edge.source.x, Y: edge.source.y }))
  for (const v of edge.vertices ?? []) coords.push(el('Coordinate', { X: v.x, Y: v.y }))
  if (!isPortEnd(edge.target)) coords.push(el('Coordinate', { X: edge.target.x, Y: edge.target.y }))
  return coords.length ? el('CenterLine', {}, coords) : ''
}

function edgeAttrs(edge: PlantEdge): string {
  const pairs: [string, string][] = [['LineClass', edge.lineClass]]
  const ln = edge.lineNumber
  if (ln && (ln.size || ln.spec || ln.service || ln.seq)) {
    pairs.push(['LineSize', ln.size], ['LineSpec', ln.spec], ['LineService', ln.service], ['LineSequence', ln.seq])
  }
  return genericAttrs(pairs)
}

function processEdgeXml(edge: PlantEdge, index: number): string {
  return el('PipingNetworkSystem', { ID: `pns-${index}` }, [
    el('PipingNetworkSegment', { ID: edge.id }, [connectionXml(edge), centerLineXml(edge), edgeAttrs(edge)].filter(Boolean)),
  ])
}

function signalEdgeXml(edge: PlantEdge): string {
  return el('InformationFlow', { ID: edge.id }, [connectionXml(edge), centerLineXml(edge), edgeAttrs(edge)].filter(Boolean))
}

export function dexpiXml(doc: ProjectDoc, sheetId: string): string {
  const sheet: Sheet | undefined = doc.sheets.find((sh) => sh.id === sheetId)
  if (!sheet) throw new Error(`Unknown sheet: ${sheetId}`)
  const { w, h } = sheetPx(sheet.sheetSize)
  const body: string[] = [
    el('PlantInformation', {
      Application: 'IPD Studio',
      ApplicationVersion: '0.2.0',
      OriginatingSystem: 'IPD Studio',
      Date: new Date().toISOString(),
      Units: 'px',
      SchemaVersion: '4.2.0',
      ProjectName: doc.meta.name,
      DrawingNumber: sheet.drawingNumber,
    }),
    el('Drawing', { Name: sheet.name, Type: 'PID' }, [
      el('Extent', {}, [el('Min', { X: 0, Y: 0 }), el('Max', { X: Math.round(w), Y: Math.round(h) })]),
    ]),
    ...sheet.nodes.map(nodeXml),
    ...sheet.edges.filter((e) => isProcessClass(e.lineClass)).map(processEdgeXml),
    ...sheet.edges.filter((e) => !isProcessClass(e.lineClass)).map(signalEdgeXml),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + el('PlantModel', {}, body)
}

export function downloadDexpi(): void {
  const state = useStore.getState()
  const sheet = activeSheet(state)
  const xml = dexpiXml(state.doc, sheet.id)
  const blob = new Blob([xml], { type: 'application/xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${state.doc.meta.name || 'diagram'}-${sheet.name.replace(/\s+/g, '')}.dexpi.xml`
  a.click()
  URL.revokeObjectURL(a.href)
}
