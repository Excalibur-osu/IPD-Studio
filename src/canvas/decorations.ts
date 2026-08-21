import type { dia, g } from '@joint/core'
import type { LineClass } from '../model/types'
import { GLYPHS, glyphPointsForRoute } from './glyphs'

/**
 * Ride ISA glyphs (pneumatic slashes, data circles, ...) along every link's
 * resolved route. Idempotent: re-running with an unchanged route is a no-op,
 * and label writes are flagged so callers can ignore the resulting events.
 */
export function decorateLinks(paper: dia.Paper): void {
  for (const link of paper.model.getLinks()) {
    decorateLink(paper, link)
  }
}

function decorateLink(paper: dia.Paper, link: dia.Link): void {
  const lineClass = (link.get('data') as { lineClass?: LineClass } | undefined)?.lineClass
  const spec = lineClass ? GLYPHS[lineClass] : null
  const current = link.labels()
  if (!spec) {
    if (current.length > 0) link.labels([], { decoration: true })
    return
  }
  const view = link.findView(paper) as dia.LinkView | null
  if (!view) return
  const connection = view.getConnection()
  if (!connection) return
  const polylines = connection.toPolylines()
  if (!polylines) return
  const route = polylines
    .flatMap((poly: g.Polyline) => poly.points)
    .map((p: g.Point) => ({ x: p.x, y: p.y }))
  const stations = glyphPointsForRoute(route, spec.spacing)
  if (
    current.length === stations.length &&
    current.every((l, i) => {
      const pos = l.position as { distance?: number } | undefined
      return typeof pos === 'object' && pos?.distance === stations[i]!.distance
    })
  ) {
    return
  }
  link.labels(
    stations.map((s) => ({
      markup: spec.markup,
      position: { distance: s.distance, args: { keepGradient: true, absoluteDistance: true } },
    })),
    { decoration: true },
  )
}
