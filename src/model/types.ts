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
  flipH?: boolean
  config?: Record<string, string>
  tag?: Tag
  label?: string
  attrs?: Record<string, string>
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
  drawingNumber: string
  revision: string
  author: string
  sheetSize: SheetSize
  created: string
  modified: string
}

export interface ProjectDoc {
  schemaVersion: 1
  meta: ProjectMeta
  settings: { gridPx: number; tagSeparator: '-' | '' }
  nodes: PlantNode[]
  edges: PlantEdge[]
}

/** A validation finding surfaced in the validation panel. */
export interface Finding {
  id: string
  checkId: string
  message: string
  targetId?: string
}
