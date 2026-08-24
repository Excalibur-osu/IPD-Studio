export interface Pt { x: number; y: number }

const snap8 = (v: number) => Math.round(v / 8) * 8 || 0

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
}

/**
 * Tidy a link's dragged vertices at gesture end:
 *  - snap to the 8px grid,
 *  - then ADOPT a neighbor's axis when within tolerance — ports sit off-grid
 *    (a 40px bubble and 48px vessel can never share a grid center), so pure
 *    grid snapping would leave every run 1–4px kinked forever,
 *  - drop vertices that no longer bend the line (drag a bend back onto the
 *    axis and the line heals straight),
 *  - drop duplicates and vertices sitting on an anchor.
 * Neighbors are the link's end anchors and the adjacent vertices.
 */
export function cleanVertices(
  raw: Pt[],
  src: Pt | null,
  tgt: Pt | null,
  axisTol = 6,
  lineTol = 3,
): Pt[] {
  let pts = raw.map((p) => ({ x: snap8(p.x), y: snap8(p.y) }))

  // two passes so adoption can chain along a run of vertices
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, i) => {
      const refs = [i === 0 ? src : pts[i - 1]!, i === pts.length - 1 ? tgt : pts[i + 1]!]
      let { x, y } = p
      for (const r of refs) {
        if (!r) continue
        if (Math.abs(x - r.x) <= axisTol) x = r.x
        if (Math.abs(y - r.y) <= axisTol) y = r.y
      }
      return { x, y }
    })
  }

  // remove anything that stopped being a bend
  let removed = true
  while (removed) {
    removed = false
    for (let i = 0; i < pts.length; i++) {
      const prev = i === 0 ? src : pts[i - 1]!
      const next = i === pts.length - 1 ? tgt : pts[i + 1]!
      const v = pts[i]!
      const onAnchor =
        (prev && prev.x === v.x && prev.y === v.y) || (next && next.x === v.x && next.y === v.y)
      const collinear = prev && next && segDist(v, prev, next) <= lineTol
      if (onAnchor || collinear) {
        pts.splice(i, 1)
        removed = true
        break
      }
    }
  }
  return pts
}
