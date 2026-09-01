// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { sheetPx } from '../model/doc'
import { exportSvg } from './svg'
import { activeSheet, useStore } from '../store/store'

/** Rasterize the active sheet to a PNG download at the given scale. */
export function exportPng(scale = 2): void {
  const state = useStore.getState()
  const sheet = activeSheet(state)
  const svg = exportSvg(state.doc, sheet)
  const { w, h } = sheetPx(sheet.sheetSize)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${state.doc.meta.name || 'diagram'}-${sheet.name.replace(/\s+/g, '')}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }
  img.src = url
}
