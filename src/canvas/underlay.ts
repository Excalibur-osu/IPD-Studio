import type { dia } from '@joint/core'
import type { Sheet } from '../model/types'

const NS = 'http://www.w3.org/2000/svg'

/**
 * Render the sheet's DXF underlay as a locked light-gray group behind the
 * JointJS layers. Excluded from exports (class pid-underlay) and from
 * hit-testing (pointer-events none).
 */
export function renderUnderlay(paper: dia.Paper, sheet: Pick<Sheet, 'underlay'>): void {
  const svg = paper.svg
  svg.querySelector('.pid-underlay')?.remove()
  const underlay = sheet.underlay
  if (!underlay || underlay.polylines.length === 0) return
  const group = document.createElementNS(NS, 'g')
  group.setAttribute('class', 'pid-underlay')
  group.setAttribute('pointer-events', 'none')
  for (const line of underlay.polylines) {
    const poly = document.createElementNS(NS, 'polyline')
    poly.setAttribute('points', line.map((p) => `${p.x},${p.y}`).join(' '))
    poly.setAttribute('fill', 'none')
    poly.setAttribute('stroke', '#b8bec8')
    poly.setAttribute('stroke-width', '1')
    group.appendChild(poly)
  }
  // Inside .joint-layers so the trace pans and zooms with the drawing; just
  // after the sheet page, which is that group's first child.
  const layers = svg.querySelector('.joint-layers')
  if (!layers) return
  const sheetPage = layers.querySelector(':scope > .pid-sheet')
  if (sheetPage) sheetPage.after(group)
  else layers.insertBefore(group, layers.firstChild)
}
