import type { ProjectDoc } from './types'

export class DocError extends Error {}

/** Parse + validate + migrate a raw JSON payload into the current schema. */
export function loadDoc(raw: unknown): ProjectDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new DocError('Not a PID Studio document')
  }
  const doc = raw as Partial<ProjectDoc>
  if (doc.schemaVersion !== 1) {
    throw new DocError(`Unsupported schema version: ${String(doc.schemaVersion)}`)
  }
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new DocError('Document is missing nodes/edges')
  }
  if (typeof doc.meta !== 'object' || doc.meta === null || typeof doc.meta.name !== 'string') {
    throw new DocError('Document is missing metadata')
  }
  if (typeof doc.settings !== 'object' || doc.settings === null) {
    throw new DocError('Document is missing settings')
  }
  return doc as ProjectDoc
}
