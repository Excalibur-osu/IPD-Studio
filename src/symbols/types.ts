export type SymbolCategory =
  | 'instruments'
  | 'valves'
  | 'control-valves'
  | 'safety'
  | 'flow-elements'
  | 'accessories'
  | 'rotating'
  | 'vessels'
  | 'heat'
  | 'inline'
  | 'control'
  | 'annotation'
  | 'custom'

export type PortKind = 'process' | 'signal' | 'both'

export interface PortDef {
  id: string
  x: number
  y: number
  kind: PortKind
}

export interface SymbolDef {
  id: string
  name: string
  category: SymbolCategory
  /** Size in 8px grid units. */
  gridSize: { w: number; h: number }
  /** Inner SVG markup in local px space (gridSize * 8), stroke currentColor. */
  render: (cfg: Record<string, string>) => string
  ports: PortDef[]
  tagRule: 'isa-instrument' | 'valve' | 'equipment' | 'none'
  defaultConfig?: Record<string, string>
  /** Config keys -> allowed values, drives the property panel selects. */
  configOptions?: Record<string, string[]>
  keywords: string[]
}
