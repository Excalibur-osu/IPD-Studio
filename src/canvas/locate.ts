// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { ProjectDoc } from '../model/types'
import { useStore } from '../store/store'
import { canvasRef } from './paperSetup'

/** The sheet an id lives on, or null when nothing on any sheet wears it. */
function sheetOf(doc: ProjectDoc, id: string): string | null {
  for (const sheet of doc.sheets) {
    if (sheet.nodes.some((n) => n.id === id) || sheet.edges.some((e) => e.id === id)) return sheet.id
  }
  return null
}

/** Browsers get a real frame; the node test environment has no rAF. */
const nextFrame = (cb: () => void): void => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb)
  else setTimeout(cb, 16)
}

/** ~1/3 s at 60fps. Long enough for React to mount the canvas after a
 *  workspace switch, short enough that a dead id gives up quietly. */
const MAX_FRAMES = 20

/** A later jump wins: the frame loop of an earlier one stops when it sees the
 *  generation has moved on, so two quick jumps cannot fight over the viewport. */
let generation = 0

function centre(targetId: string, mine: number, frame: number): void {
  if (mine !== generation) return
  const { paper, graph } = canvasRef
  const cell = graph?.getCell(targetId)
  // No canvas yet — a jump from the Checks or Data workspace fires before
  // React has mounted it. Wait for it rather than making every caller guess a
  // timeout, which is what four of them used to do.
  if (!paper || !cell) {
    if (frame < MAX_FRAMES) nextFrame(() => centre(targetId, mine, frame + 1))
    return
  }
  const bbox = cell.getBBox()
  const scale = paper.scale().sx
  const size = paper.getComputedSize()
  paper.translate(
    size.width / 2 - (bbox.x + bbox.width / 2) * scale,
    size.height / 2 - (bbox.y + bbox.height / 2) * scale,
  )
}

/**
 * Select a cell and centre the canvas on it.
 *
 * The primitive behind every jump in the app — a QA finding, a report row, a
 * command-palette hit, a "where used" reference. It lived in ValidationPanel
 * back when the findings list was the only thing that jumped; it is a canvas
 * concern, so it lives here now.
 *
 * It resolves the sheet itself. Selection only ever holds ids on the active
 * sheet (see `setSelection`), so jumping to an object on another sheet without
 * switching first would select nothing at all — which is how a "where used"
 * reference to another sheet used to land on an empty inspector.
 */
export function locateCell(targetId: string | undefined, sheetId?: string): void {
  if (!targetId) return
  const s = useStore.getState()
  const sheet = sheetId ?? sheetOf(s.doc, targetId)
  if (sheet && sheet !== s.activeSheetId) s.setActiveSheet(sheet)
  useStore.getState().setSelection([targetId])
  centre(targetId, ++generation, 0)
}
