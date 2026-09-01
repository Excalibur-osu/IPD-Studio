// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { SHEET_SIZES_MM } from '../model/doc'
import { exportSvg } from './svg'
import { activeSheet, useStore } from '../store/store'

/**
 * Print the sheet at true size through a hidden iframe; the browser's
 * "Save as PDF" destination produces the PDF deliverable.
 */
export function printPdf(): void {
  const state = useStore.getState()
  const sheet = activeSheet(state)
  const doc = state.doc
  const svg = exportSvg(doc, sheet)
  const mm = SHEET_SIZES_MM[sheet.sheetSize]
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const idoc = iframe.contentDocument
  if (!idoc) return
  idoc.open()
  idoc.write(
    `<!doctype html><html><head><title>${doc.meta.name}</title><style>` +
      `@page { size: ${mm.w}mm ${mm.h}mm; margin: 0; }` +
      `html, body { margin: 0; padding: 0; }` +
      `svg { display: block; width: ${mm.w}mm; height: ${mm.h}mm; }` +
      `</style></head><body>${svg}</body></html>`,
  )
  idoc.close()
  const win = iframe.contentWindow
  if (!win) return
  win.onafterprint = () => iframe.remove()
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => iframe.remove(), 60_000)
  }, 100)
}
