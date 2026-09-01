import { describe, expect, it } from 'vitest'
import { MAX_DOC_BYTES, buildPayload, formatBytes, tooLargeMessage } from '../../src/cloud/sync'
import { createEmptyDoc } from '../../src/model/doc'
import { deserializeDoc } from '../../src/persist/file'

describe('buildPayload', () => {
  it('round-trips a document through the stored string unchanged', () => {
    const doc = createEmptyDoc('Unit 400')
    const payload = buildPayload(doc, doc.meta.name)
    expect(deserializeDoc(payload.doc)).toEqual(doc)
    expect(payload.sheetCount).toBe(doc.sheets.length)
  })

  // The whole reason `doc` is a string field: Firestore rejects nested arrays,
  // and underlay.polylines is an array of arrays. Stored as a map this throws
  // at runtime the moment a drawing carries a DXF underlay.
  it('preserves a DXF underlay, whose polylines are a nested array', () => {
    const doc = createEmptyDoc('With underlay')
    doc.sheets[0]!.underlay = {
      name: 'plot-plan.dxf',
      polylines: [
        [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        [{ x: 2, y: 2 }],
      ],
    }
    const payload = buildPayload(doc, doc.meta.name)
    expect(typeof payload.doc).toBe('string')
    expect(deserializeDoc(payload.doc).sheets[0]!.underlay).toEqual(doc.sheets[0]!.underlay)
  })

  it('measures size in UTF-8 bytes, not characters', () => {
    const doc = createEmptyDoc('Réacteur — 高温')
    const payload = buildPayload(doc, doc.meta.name)
    // every multi-byte character costs more than the one unit .length counts
    expect(payload.sizeBytes).toBeGreaterThan(payload.doc.length)
  })

  it('never sends a name the security rules would reject', () => {
    const doc = createEmptyDoc('x')
    expect(buildPayload(doc, '   ').name).toBe('Untitled')
    expect(buildPayload(doc, '').name).toBe('Untitled')
    expect(buildPayload(doc, 'A'.repeat(500)).name).toHaveLength(200)
  })
})

describe('tooLargeMessage', () => {
  it('names the underlay, which is almost always the cause', () => {
    const msg = tooLargeMessage(MAX_DOC_BYTES + 1)
    expect(msg).toMatch(/underlay/i)
    expect(msg).toMatch(/\.pnid|computer/i)
  })
})

describe('formatBytes', () => {
  it('scales the unit to the size', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 kB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
