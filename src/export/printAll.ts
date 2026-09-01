// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { SHEET_SIZES_MM } from '../model/doc'
import type { ProjectDoc } from '../model/types'
import { exportSvg } from './svg'
import { useStore } from '../store/store'

export function allSheetSvgs(doc: ProjectDoc): string[] {
  return doc.sheets.map((sheet) => exportSvg(doc, sheet))
}

/**
 * Print every sheet as one document; each sheet gets its own correctly
 * sized page. NOTE: the canvas only renders the active sheet, so exportSvg
 * reads the live paper — printing all sheets briefly switches through them.
 */
export async function printAllSheets(): Promise<void> {
  const store = useStore.getState()
  const originalSheet = store.activeSheetId
  const doc = store.doc
  const pages: string[] = []
  for (const sheet of doc.sheets) {
    useStore.getState().setActiveSheet(sheet.id)
    // allow reconciler + async paper to render the switched sheet
    await new Promise((r) => setTimeout(r, 120))
    pages.push(
      `<div class="page" style="width:${SHEET_SIZES_MM[sheet.sheetSize].w}mm;height:${SHEET_SIZES_MM[sheet.sheetSize].h}mm">` +
        exportSvg(doc, sheet) +
        `</div>`,
    )
  }
  useStore.getState().setActiveSheet(originalSheet)

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const idoc = iframe.contentDocument
  if (!idoc) return
  idoc.open()
  idoc.write(
    `<!doctype html><html><head><title>${doc.meta.name}</title><style>` +
      `@page { size: auto; margin: 0; }` +
      `html, body { margin: 0; padding: 0; }` +
      `.page { page-break-after: always; overflow: hidden; }` +
      `.page svg { display: block; width: 100%; height: 100%; }` +
      `</style></head><body>${pages.join('')}</body></html>`,
  )
  idoc.close()
  const win = iframe.contentWindow
  if (!win) return
  win.onafterprint = () => iframe.remove()
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => iframe.remove(), 60_000)
  }, 150)
}
