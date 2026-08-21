import { describe, expect, it, vi } from 'vitest'
import '../../src/symbols/lib/index'
import { createEmptyDoc, createSheet } from '../../src/model/doc'

vi.mock('../../src/export/svg', () => ({
  exportSvg: (_doc: unknown, sheet: { name: string }) => `<svg data-sheet="${sheet.name}"></svg>`,
}))

import { allSheetSvgs } from '../../src/export/printAll'

describe('allSheetSvgs', () => {
  it('produces one svg per sheet in order', () => {
    const doc = createEmptyDoc('t')
    doc.sheets.push(createSheet(2), createSheet(3))
    const svgs = allSheetSvgs(doc)
    expect(svgs).toHaveLength(3)
    expect(svgs[0]).toContain('Sheet 1')
    expect(svgs[2]).toContain('Sheet 3')
  })
})
