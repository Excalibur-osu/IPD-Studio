import { ulid } from 'ulid'
import type { PlantEdge, PlantNode, ProjectDoc, Sheet, SheetSize } from './types'
import { checkWidgetProps } from '../hmi/model'

export class DocError extends Error {}

interface V1Doc {
  schemaVersion: 1
  meta: {
    name: string
    drawingNumber: string
    revision: string
    author: string
    sheetSize: SheetSize
    created: string
    modified: string
  }
  settings: { gridPx: number; tagSeparator: '-' | '' }
  nodes: PlantNode[]
  edges: PlantEdge[]
}

function migrateV1(v1: V1Doc): ProjectDoc {
  const sheet: Sheet = {
    id: ulid(),
    name: 'Sheet 1',
    drawingNumber: v1.meta.drawingNumber,
    revision: v1.meta.revision,
    sheetSize: v1.meta.sheetSize,
    nodes: v1.nodes,
    edges: v1.edges,
  }
  return {
    schemaVersion: 4,
    meta: { name: v1.meta.name, author: v1.meta.author, created: v1.meta.created, modified: v1.meta.modified },
    settings: v1.settings,
    sheets: [sheet],
    hmiScreens: [],
  }
}

/** Parse + validate + migrate a raw JSON payload into the current schema. */
export function loadDoc(raw: unknown): ProjectDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new DocError('Not a IPD Studio document')
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (version === 1) {
    const v1 = raw as Partial<V1Doc>
    if (!Array.isArray(v1.nodes) || !Array.isArray(v1.edges)) throw new DocError('Document is missing nodes/edges')
    if (typeof v1.meta !== 'object' || v1.meta === null || typeof v1.meta.name !== 'string') {
      throw new DocError('Document is missing metadata')
    }
    if (typeof v1.settings !== 'object' || v1.settings === null) throw new DocError('Document is missing settings')
    return migrateV1(v1 as V1Doc)
  }
  if (version === 2 || version === 3 || version === 4) {
    const doc = raw as Partial<ProjectDoc>
    if (!Array.isArray(doc.sheets) || doc.sheets.length === 0) throw new DocError('Document has no sheets')
    for (const sheet of doc.sheets) {
      if (!Array.isArray(sheet.nodes) || !Array.isArray(sheet.edges) || typeof sheet.id !== 'string') {
        throw new DocError('Sheet is malformed')
      }
    }
    if (typeof doc.meta !== 'object' || doc.meta === null || typeof doc.meta.name !== 'string') {
      throw new DocError('Document is missing metadata')
    }
    if (typeof doc.settings !== 'object' || doc.settings === null) throw new DocError('Document is missing settings')
    if (doc.customSymbols !== undefined && !Array.isArray(doc.customSymbols)) {
      throw new DocError('customSymbols is malformed')
    }
    if (doc.hmiScreens !== undefined && !Array.isArray(doc.hmiScreens)) {
      throw new DocError('hmiScreens is malformed')
    }
    if (Array.isArray(doc.hmiScreens)) {
      for (const s of doc.hmiScreens) {
        if (typeof s.id !== 'string' || !Array.isArray(s.widgets) || !Array.isArray(s.pipes)) {
          throw new DocError('hmiScreens is malformed')
        }
        // warn-only: unknown props usually mean the doc came from a NEWER
        // build — keep them intact so nothing is lost on a round-trip
        for (const w of s.widgets) {
          const unknown = checkWidgetProps(w)
          if (unknown.length > 0) {
            console.warn(`HMI widget ${w.tag ?? w.id} (${w.type}) carries unknown props: ${unknown.join(', ')}`)
          }
        }
      }
    }
    return { ...doc, schemaVersion: 4, hmiScreens: doc.hmiScreens ?? [] } as ProjectDoc
  }
  throw new DocError(`Unsupported schema version: ${String(version)}`)
}
