/** Core document types — the single source of truth for a P&ID drawing. */

export type SheetSize = 'A4' | 'A3' | 'A2' | 'A1' | 'ANSI_B' | 'ANSI_D'

export type NodeKind = 'equipment' | 'instrument' | 'valve' | 'fitting' | 'annotation'

export type LineClass =
  | 'process.major'
  | 'process.minor'
  | 'process.impulse'
  | 'signal.electric'
  | 'signal.pneumatic'
  | 'signal.hydraulic'
  | 'signal.capillary'
  | 'signal.data'
  | 'signal.software'
  | 'signal.em'
  | 'link.internal'
  | 'pipe.jacketed'
  | 'pipe.traced'
  | 'pipe.existing'
  | 'pipe.underground'
  | 'pipe.battery-limit'

/** ISA tag: FT-101A -> { letters: 'FT', loop: '101', suffix: 'A' } */
export interface Tag {
  letters: string
  loop: string
  suffix?: string
}

export interface LineNumber {
  size: string
  spec: string
  service: string
  seq: string
}

export interface PlantNode {
  id: string
  symbolId: string
  kind: NodeKind
  x: number
  y: number
  rotation: 0 | 90 | 180 | 270
  /** Uniform display scale (1 = catalog size). Ports and glyph scale with it. */
  scale?: number
  flipH?: boolean
  config?: Record<string, string>
  tag?: Tag
  label?: string
  attrs?: Record<string, string>
  /** Off-page connector pairing to a connector on another sheet. */
  link?: { sheetId: string; nodeId: string }
  /** ISA-20-style datasheet values, keyed by datasheet field key. */
  datasheet?: Record<string, string>
}

export type EdgeEnd = { nodeId: string; portId: string } | { x: number; y: number }

export function isPortEnd(end: EdgeEnd): end is { nodeId: string; portId: string } {
  return 'nodeId' in end
}

export interface PlantEdge {
  id: string
  lineClass: LineClass
  source: EdgeEnd
  target: EdgeEnd
  vertices?: { x: number; y: number }[]
  lineNumber?: LineNumber
  arrow?: 'none' | 'flow'
}

export interface ProjectMeta {
  name: string
  author: string
  created: string
  modified: string
}

export interface Sheet {
  id: string
  name: string
  drawingNumber: string
  revision: string
  sheetSize: SheetSize
  nodes: PlantNode[]
  edges: PlantEdge[]
  /** Locked background trace-over underlay imported from DXF. */
  underlay?: { name: string; polylines: { x: number; y: number }[][] }
}

/** The node/edge slice reconcilers and exports operate on. */
export interface SheetContent {
  nodes: PlantNode[]
  edges: PlantEdge[]
}

export interface CustomSymbolDef {
  id: string
  name: string
  /** Sanitized inner SVG markup (see src/import/svgSymbol.ts). */
  svg: string
  gridSize: { w: number; h: number }
  ports: { id: string; x: number; y: number; kind: 'process' | 'signal' | 'both' }[]
  tagRule: 'isa-instrument' | 'valve' | 'equipment' | 'none'
  keywords: string[]
}

export interface ProjectDoc {
  schemaVersion: 3
  meta: ProjectMeta
  settings: { gridPx: number; tagSeparator: '-' | '' }
  sheets: Sheet[]
  customSymbols?: CustomSymbolDef[]
}

/** A validation finding surfaced in the validation panel. */
export interface Finding {
  id: string
  checkId: string
  message: string
  targetId?: string
  sheetId?: string
}
