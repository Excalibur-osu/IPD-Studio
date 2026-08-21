import { dia, shapes } from '@joint/core'
import { sheetPx } from '../model/doc'
import type { SheetSize } from '../model/types'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4

export function createPaper(el: HTMLElement, sheetSize: SheetSize): { paper: dia.Paper; graph: dia.Graph } {
  const graph = new dia.Graph({}, { cellNamespace: shapes })
  const { w, h } = sheetPx(sheetSize)
  const paper = new dia.Paper({
    el,
    model: graph,
    width: w,
    height: h,
    gridSize: 8,
    drawGrid: { name: 'dot', args: { color: '#c9c9d4', thickness: 1 } },
    background: { color: '#ffffff' },
    async: true,
    sorting: dia.Paper.sorting.APPROX,
    interactive: { linkMove: false, labelMove: false },
    linkPinning: true,
    snapLinks: { radius: 24 },
    markAvailable: true,
  })
  return { paper, graph }
}

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

/** Zoom the paper about a client-space point, clamped to [MIN_ZOOM, MAX_ZOOM]. */
export function zoomAt(paper: dia.Paper, clientX: number, clientY: number, factor: number): void {
  const current = paper.scale().sx
  const next = clampZoom(current * factor)
  if (next === current) return
  const local = paper.clientToLocalPoint({ x: clientX, y: clientY })
  paper.scale(next, next)
  const after = paper.localToClientPoint(local)
  const t = paper.translate()
  paper.translate(t.tx + (clientX - after.x), t.ty + (clientY - after.y))
}

/** Module-scope handle so panels/exports can reach the live paper. */
export const canvasRef: { paper?: dia.Paper; graph?: dia.Graph } = {}
