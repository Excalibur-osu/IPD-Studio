import type { CustomSymbolDef, ProjectDoc } from '../model/types'
import { SYMBOLS } from './registry'
import type { SymbolDef } from './types'

function toSymbolDef(def: CustomSymbolDef): SymbolDef {
  return {
    id: def.id,
    name: def.name,
    category: 'custom' as SymbolDef['category'],
    gridSize: def.gridSize,
    render: () => def.svg,
    ports: def.ports,
    tagRule: def.tagRule,
    keywords: def.keywords,
  }
}

/** (Re)register the document's custom symbols into the live registry. */
export function registerCustomSymbols(doc: ProjectDoc): void {
  // drop stale custom entries, then add current
  for (const id of [...SYMBOLS.keys()]) {
    if (id.startsWith('custom.')) SYMBOLS.delete(id)
  }
  for (const def of doc.customSymbols ?? []) {
    SYMBOLS.set(def.id, toSymbolDef(def))
  }
}
