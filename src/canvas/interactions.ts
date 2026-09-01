// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { canvasRef, fitView, zoomActual } from './paperSetup'
import { dia, g, highlighters, linkTools } from '@joint/core'
import { ulid } from 'ulid'
import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import type { PortKind } from '../symbols/types'
import { compatibleKinds, pickLineClass } from './connectionRules'
import { alignNodes, distributeNodes, localPortPoint, portWorld, snapGuides } from './alignment'
import { cleanVertices } from './vertexClean'
import { makeLink } from './shapes'
import { getSymbol } from '../symbols/registry'
import { activeSheet, resumeHistory, useStore } from '../store/store'

const snap8 = (v: number) => Math.round(v / 8) * 8

type PortKinds = Record<string, PortKind>

function kindFromCell(cell: dia.Cell | undefined, portId: string | null | undefined): PortKind | null {
  if (!cell || !portId) return null
  const kinds = (cell.get('data') as { portKinds?: PortKinds } | undefined)?.portKinds
  return kinds?.[portId] ?? null
}

function portKindOf(cellView: dia.CellView, magnet: SVGElement | undefined): PortKind | null {
  // The port id may sit on the magnet itself or on the port's container group.
  const portId = magnet?.getAttribute('port') ?? magnet?.closest('[port]')?.getAttribute('port')
  return kindFromCell(cellView.model, portId)
}

export function attachInteractions(paper: dia.Paper, graph: dia.Graph): () => void {
  const store = () => useStore.getState()
  let clipboard: { nodes: PlantNode[]; edges: PlantEdge[] } | null = null

  // --- link drawing -------------------------------------------------------
  paper.options.defaultLink = () =>
    makeLink({
      id: `draft-${Date.now()}`,
      lineClass: store().activeLineClass,
      source: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
    })

  // While a pin placement is armed, port halos must not swallow the click by
  // starting a link — the click is aimed at the symbol surface.
  paper.options.validateMagnet = () => !store().armPin

  // Any port pairing that some line class could join is allowed; the class
  // itself is picked at commit time so users never have to pre-select it.
  paper.options.validateConnection = (srcView, srcMagnet, tgtView, tgtMagnet) => {
    const src = portKindOf(srcView as dia.CellView, srcMagnet as SVGElement)
    const tgt = portKindOf(tgtView as dia.CellView, tgtMagnet as SVGElement)
    if (!src || !tgt) return false
    if (srcView === tgtView) return false
    return compatibleKinds(src, tgt)
  }

  /** Sheet-local position of an edge end, for the accidental-stub check. */
  const endPoint = (e: dia.Link.EndJSON): { x: number; y: number } | null => {
    if (e.id) {
      const cell = graph.getCell(e.id)
      if (!cell || !cell.isElement() || !e.port) return null
      const rel = (cell as dia.Element).getPortsPositions('p')[String(e.port)]
      const pos = (cell as dia.Element).position()
      return rel ? { x: pos.x + rel.x, y: pos.y + rel.y } : pos
    }
    if (typeof e.x === 'number' && typeof e.y === 'number') return { x: e.x, y: e.y }
    return null
  }

  /** Find a committed line under a sheet point (for branch taps). */
  const pipeAt = (pt: { x: number; y: number }): { edge: PlantEdge; point: { x: number; y: number } } | null => {
    const sheet = activeSheet(store())
    for (const e of sheet.edges) {
      const cell = graph.getCell(e.id) as dia.Link | undefined
      const view = cell ? (cell.findView(paper) as dia.LinkView | null) : null
      const conn = view?.getConnection()
      if (!conn) continue
      const cp = conn.closestPoint(new g.Point(pt.x, pt.y))
      if (cp && Math.hypot(cp.x - pt.x, cp.y - pt.y) <= 10) {
        return { edge: e, point: { x: cp.x, y: cp.y } }
      }
    }
    return null
  }

  /**
   * Dropping a line onto an existing pipe taps into it: a junction dot is
   * inserted at the drop point, the pipe splits into two halves through it,
   * and the new line lands on the junction — all as one undo step. The
   * branch inherits the tapped line's class.
   */
  const commitBranchTap = (
    portEnd: PlantEdge['source'],
    tap: { edge: PlantEdge; point: { x: number; y: number } },
  ): void => {
    const sheet = activeSheet(store())
    const tapped = tap.edge
    const resolve = (end: PlantEdge['source']): { x: number; y: number } | null => {
      if (!isPortEnd(end)) return { x: end.x, y: end.y }
      const n = sheet.nodes.find((nd) => nd.id === end.nodeId)
      return n ? portWorld(n, end.portId) : null
    }
    const a = resolve(tapped.source)
    const b = resolve(tapped.target)
    if (!a || !b) return
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
    // snap along the pipe only; stay exactly ON the line across it
    const px = horizontal ? snap8(tap.point.x) : Math.round(tap.point.x)
    const py = horizontal ? Math.round(tap.point.y) : snap8(tap.point.y)
    const jx = px - 4
    const jy = py - 4
    const jn: PlantNode = {
      id: ulid(),
      symbolId: 'fit.junction',
      kind: 'fitting',
      x: jx,
      y: jy,
      rotation: 0,
    }
    const inPort = horizontal ? (a.x <= b.x ? 'w' : 'e') : a.y <= b.y ? 'n' : 's'
    const outPort = horizontal ? (a.x <= b.x ? 'e' : 'w') : a.y <= b.y ? 's' : 'n'
    // branch takes the perpendicular side nearest the drawn line's start
    const other = resolve(portEnd)
    const branchPort = horizontal
      ? (other?.y ?? 0) < tap.point.y ? 'n' : 's'
      : (other?.x ?? 0) < tap.point.x ? 'w' : 'e'
    const half1: PlantEdge = {
      id: ulid(),
      lineClass: tapped.lineClass,
      source: tapped.source,
      target: { nodeId: jn.id, portId: inPort },
      ...(tapped.lineNumber ? { lineNumber: tapped.lineNumber } : {}),
    }
    const half2: PlantEdge = {
      id: ulid(),
      lineClass: tapped.lineClass,
      source: { nodeId: jn.id, portId: outPort },
      target: tapped.target,
      ...(tapped.arrow ? { arrow: tapped.arrow } : {}),
    }
    const branch: PlantEdge = {
      id: ulid(),
      lineClass: tapped.lineClass,
      source: portEnd,
      target: { nodeId: jn.id, portId: branchPort },
    }
    store().addBatch([jn], [half1, half2, branch], [tapped.id])
  }

  const commitDraft = (link: dia.Link) => {
    if (!String(link.id).startsWith('draft-')) return
    const src = link.source()
    const tgt = link.target()
    const toEnd = (e: dia.Link.EndJSON): PlantEdge['source'] | null => {
      if (e.id) {
        if (!e.port) return null
        return { nodeId: String(e.id), portId: String(e.port) }
      }
      if (typeof e.x === 'number' && typeof e.y === 'number') return { x: snap8(e.x), y: snap8(e.y) }
      return null
    }
    const source = toEnd(src)
    const target = toEnd(tgt)
    const srcKind = src.id ? kindFromCell(graph.getCell(src.id), src.port ? String(src.port) : null) : null
    const tgtKind = tgt.id ? kindFromCell(graph.getCell(tgt.id), tgt.port ? String(tgt.port) : null) : null
    const a = endPoint(src)
    const b = endPoint(tgt)
    link.remove()
    // Refuse fully dangling scribbles; allow one free end (vents, off-page).
    if (!source || !target) return
    if (!isPortEnd(source) && !isPortEnd(target)) return
    // A free-ended stub shorter than ~3 grid squares is a failed drag near a
    // port, not a drawing intention — dropping it prevents ghost lines.
    if ((!isPortEnd(source) || !isPortEnd(target)) && a && b && Math.hypot(a.x - b.x, a.y - b.y) < 24) return
    // A free end dropped onto an existing line becomes a branch tap.
    if (isPortEnd(source) && !isPortEnd(target)) {
      const tap = pipeAt(target)
      if (tap) return commitBranchTap(source, tap)
    } else if (isPortEnd(target) && !isPortEnd(source)) {
      const tap = pipeAt(source)
      if (tap) return commitBranchTap(target, tap)
    }
    const id = store().addEdge({
      lineClass: pickLineClass(srcKind, tgtKind, store().activeLineClass),
      source,
      target,
    })
    straightenNewEdge(source, target)
    store().setSelection([id])
  }

  /**
   * If a freshly drawn port-to-port line is a few px off collinear, nudge the
   * lighter node (instrument/valve over equipment) into exact alignment so
   * the line renders straight instead of with a one-grid jog. Symbols of
   * different widths can never both center on the 8px grid, so this nudge —
   * not grid discipline — is what makes in-line hookups come out straight.
   */
  const straightenNewEdge = (source: PlantEdge['source'], target: PlantEdge['target']) => {
    if (!isPortEnd(source) || !isPortEnd(target)) return
    const sheet = activeSheet(store())
    const na = sheet.nodes.find((n) => n.id === source.nodeId)
    const nb = sheet.nodes.find((n) => n.id === target.nodeId)
    if (!na || !nb) return
    const pa = portWorld(na, source.portId)
    const pb = portWorld(nb, target.portId)
    if (!pa || !pb) return
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const mover = na.kind !== 'equipment' ? na : nb.kind !== 'equipment' ? nb : na
    const sign = mover === na ? 1 : -1
    // Run length only needs to dominate the cross offset — side-by-side
    // symbols connect over runs far shorter than a couple of grid squares.
    if (dx !== 0 && Math.abs(dx) <= 6 && Math.abs(dy) > 8 && Math.abs(dy) >= 2 * Math.abs(dx)) {
      store().setNodePos(mover.id, mover.x + sign * dx, mover.y)
    } else if (dy !== 0 && Math.abs(dy) <= 6 && Math.abs(dx) > 8 && Math.abs(dx) >= 2 * Math.abs(dy)) {
      store().setNodePos(mover.id, mover.x, mover.y + sign * dy)
    }
  }

  /** Commit an arrowhead-tool re-attach: sync the moved model ends to the doc. */
  const syncMovedEnds = (link: dia.Link) => {
    const id = String(link.id)
    if (id.startsWith('draft-')) return
    const sheet = activeSheet(store())
    const edge = sheet.edges.find((e) => e.id === id)
    if (!edge) return
    const toDocEnd = (e: dia.Link.EndJSON): PlantEdge['source'] | null => {
      if (e.id) return e.port ? { nodeId: String(e.id), portId: String(e.port) } : null
      if (typeof e.x === 'number' && typeof e.y === 'number') return { x: snap8(e.x), y: snap8(e.y) }
      return null
    }
    const src = toDocEnd(link.source())
    const tgt = toDocEnd(link.target())
    const revert = () => {
      const asEnd = (end: PlantEdge['source']): dia.Link.EndJSON =>
        isPortEnd(end) ? { id: end.nodeId, port: end.portId } : { x: end.x, y: end.y }
      link.source(asEnd(edge.source))
      link.target(asEnd(edge.target))
    }
    // A re-attach must keep at least one port end; otherwise snap back.
    if (!src || !tgt || (!isPortEnd(src) && !isPortEnd(tgt))) return revert()
    const same = (a: PlantEdge['source'], b: PlantEdge['source']) => JSON.stringify(a) === JSON.stringify(b)
    if (!same(src, edge.source) || !same(tgt, edge.target)) {
      store().setEdge(id, { source: src, target: tgt })
    }
  }

  const onLinkPointerUp = (view: dia.LinkView) => {
    commitDraft(view.model)
    syncMovedEnds(view.model)
  }

  // Port dots are hidden until they matter: hovering a symbol shows its own,
  // and holding a link drag ('pid-linking' on the paper root) shows them all.
  const onMagnetDown = () => paper.el.classList.add('pid-linking')
  const onGlobalPointerUp = () => {
    paper.el.classList.remove('pid-linking')
    // safety net: any grouped edit (typing, label drag) ends by now
    resumeHistory()
  }

  // --- pin placement ------------------------------------------------------
  // "＋ Add pin" in the panel arms one click: the next click on that symbol
  // adds a user connection pin exactly where it landed (4px lattice, like the
  // catalog ports). Any other click cancels.
  const snap4 = (v: number) => Math.round(v / 4) * 4
  const placePin = (view: dia.ElementView, x: number, y: number): boolean => {
    const arm = store().armPin
    if (!arm) return false
    store().setArmPin(null)
    const id = String(view.model.id)
    if (id !== arm) return true
    const node = activeSheet(store()).nodes.find((n) => n.id === id)
    if (!node) return true
    const local = localPortPoint(node, { x, y })
    if (!local) return true
    try {
      const g = getSymbol(node.symbolId).gridSize
      const px = Math.max(0, Math.min(g.w * 8, snap4(local.x)))
      const py = Math.max(0, Math.min(g.h * 8, snap4(local.y)))
      store().addExtraPort(id, { x: px, y: py, kind: 'both' })
    } catch { /* unknown symbol: nothing to pin */ }
    return true
  }

  // --- selection ----------------------------------------------------------
  const onElementPointerDown = (view: dia.ElementView, evt: dia.Event) => {
    const id = String(view.model.id)
    const sel = store().selection
    if (evt.shiftKey) {
      store().setSelection(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id])
    } else if (!sel.includes(id)) {
      store().setSelection([id])
    }
  }

  const onLinkPointerDown = (view: dia.LinkView, evt: dia.Event) => {
    const id = String(view.model.id)
    if (id.startsWith('draft-')) return
    if (evt.shiftKey) {
      const sel = store().selection
      store().setSelection(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id])
    } else {
      store().setSelection([id])
    }
  }

  const onBlankPointerDown = () => {
    if (store().armPin) store().setArmPin(null)
    if (store().selection.length) store().setSelection([])
  }

  // --- movement commit + live alignment guides ---------------------------
  const dragStart = new Map<string, { x: number; y: number }>()
  /** Waypoints of the links moving rigidly with the drag, as they were at grab. */
  const dragStartVerts = new Map<string, { x: number; y: number }[]>()
  const guideEls: SVGLineElement[] = []
  const guideLayer = () => paper.svg.querySelector('.joint-layers') as SVGGElement | null
  const clearGuides = () => {
    guideEls.forEach((g) => g.remove())
    guideEls.length = 0
  }
  const drawGuide = (vertical: boolean, at: number) => {
    const layer = guideLayer()
    if (!layer) return
    const size = paper.getComputedSize()
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    if (vertical) {
      line.setAttribute('x1', String(at)); line.setAttribute('x2', String(at))
      line.setAttribute('y1', '0'); line.setAttribute('y2', String(size.height))
    } else {
      line.setAttribute('y1', String(at)); line.setAttribute('y2', String(at))
      line.setAttribute('x1', '0'); line.setAttribute('x2', String(size.width))
    }
    line.setAttribute('stroke', '#2b6cb0')
    line.setAttribute('stroke-width', '0.75')
    line.setAttribute('stroke-dasharray', '4 3')
    line.setAttribute('pointer-events', 'none')
    layer.appendChild(line)
    guideEls.push(line)
  }
  const onElementPointerMove = (view: dia.ElementView) => {
    const id = String(view.model.id)
    const start = dragStart.get(id)
    if (!start) return
    clearGuides()
    const sheet = activeSheet(store())
    const node = sheet.nodes.find((n) => n.id === id)
    if (!node) return
    const p = view.model.position()
    // a multi-selection moves together live, not just at drop
    if (dragStart.size > 1) {
      const dx = p.x - start.x
      const dy = p.y - start.y
      for (const [nid, s0] of dragStart) {
        if (nid === id) continue
        const cell = graph.getCell(nid) as dia.Element | undefined
        if (cell?.isElement()) cell.position(s0.x + dx, s0.y + dy)
      }
      for (const [lid, v0] of dragStartVerts) {
        const link = graph.getCell(lid) as dia.Link | undefined
        link?.vertices(v0.map((p) => ({ x: p.x + dx, y: p.y + dy })))
      }
    }
    const hit = snapGuides({ ...node, x: p.x, y: p.y }, sheet.nodes, 4, sheet.edges)
    if (hit.guideX !== undefined) drawGuide(true, hit.guideX)
    if (hit.guideY !== undefined) drawGuide(false, hit.guideY)
  }
  const onElementPointerDownPos = (view: dia.ElementView) => {
    dragStart.clear()
    const id = String(view.model.id)
    const sel = store().selection
    const ids = sel.includes(id) && sel.length > 1 ? sel : [id]
    for (const nid of ids) {
      const cell = graph.getCell(nid) as dia.Element | undefined
      if (cell?.isElement()) dragStart.set(nid, cell.position())
    }
    dragStart.set(id, view.model.position())
    // Links whose both ends are being dragged travel rigidly, so their
    // waypoints move with them — live, not just on drop.
    dragStartVerts.clear()
    for (const link of graph.getLinks()) {
      const a = link.getSourceCell()?.id
      const b = link.getTargetCell()?.id
      if (a && b && dragStart.has(String(a)) && dragStart.has(String(b))) {
        const v = link.vertices()
        if (v.length) dragStartVerts.set(String(link.id), v.map((p) => ({ x: p.x, y: p.y })))
      }
    }
  }
  const onElementPointerUp = (view: dia.ElementView) => {
    clearGuides()
    const id = String(view.model.id)
    const start = dragStart.get(id)
    dragStart.delete(id)
    if (!start) return
    const p = view.model.position()
    const sheet = activeSheet(store())
    const node = sheet.nodes.find((n) => n.id === id)
    const hit = node ? snapGuides({ ...node, x: p.x, y: p.y }, sheet.nodes, 4, sheet.edges) : {}
    const nx = hit.x !== undefined ? Math.round(hit.x) : snap8(p.x)
    const ny = hit.y !== undefined ? Math.round(hit.y) : snap8(p.y)
    if (nx === start.x && ny === start.y) return
    const dx = nx - start.x
    const dy = ny - start.y
    const sel = store().selection
    if (sel.includes(id) && sel.length > 1) {
      const nodeIds = sel.filter((s) => activeSheet(store()).nodes.some((n) => n.id === s))
      store().moveNodes(nodeIds, dx, dy)
    } else {
      store().setNodePos(id, nx, ny)
    }
    dragStart.clear()
    dragStartVerts.clear()
  }

  // --- vertex editing on selected links ----------------------------------
  // The Vertices/Segments tools write the model on EVERY pointermove; the doc
  // must only hear about the finished gesture — one clean commit, one undo
  // step — or the store fights the drag mid-flight and undo floods with
  // hundreds of micro-states. Tool gestures are wrapped in named batches, so
  // the commit waits for the batch to close (vertex removal is unbatched and
  // commits immediately).
  const VERTEX_BATCHES = ['vertex-move', 'vertex-add', 'segment-move'] as const
  const inVertexGesture = () => VERTEX_BATCHES.some((n) => graph.hasActiveBatch(n))
  const pendingVerts = new Set<string>()
  const commitVertices = (id: string) => {
    const cell = graph.getCell(id) as dia.Link | undefined
    if (!cell || !cell.isLink()) return
    const view = cell.findView(paper) as dia.LinkView | null
    const anchor = (which: 'sourceAnchor' | 'targetAnchor'): { x: number; y: number } | null => {
      const p = view?.[which]
      return p ? { x: p.x, y: p.y } : null
    }
    store().setEdgeVertices(id, cleanVertices(cell.vertices(), anchor('sourceAnchor'), anchor('targetAnchor')))
  }
  const onLinkChangeVertices = (link: dia.Link, _v: unknown, opt: { ui?: boolean; tool?: string }) => {
    if (String(link.id).startsWith('draft-')) return
    if (!opt.ui && !opt.tool) return // reconciler writes echo back without ui
    if (inVertexGesture()) pendingVerts.add(String(link.id))
    else commitVertices(String(link.id))
  }
  const onBatchStop = (data: { batchName?: string } | undefined) => {
    if (!data?.batchName || !(VERTEX_BATCHES as readonly string[]).includes(data.batchName)) return
    if (inVertexGesture()) return // vertex-add wraps vertex-move; wait for the outermost
    for (const id of pendingVerts) commitVertices(id)
    pendingVerts.clear()
  }

  // --- selection highlight + link tools -----------------------------------
  const HIGHLIGHT = 'pid-selection'
  const syncSelection = () => {
    // pin-arming shows every connection dot and a crosshair cursor
    paper.el.classList.toggle('pid-pinning', Boolean(store().armPin))
    const sel = new Set(store().selection)
    for (const cell of graph.getCells()) {
      const view = cell.findView(paper)
      if (!view) continue
      const has = highlighters.stroke.get(view, HIGHLIGHT)
      if (sel.has(String(cell.id)) && !has) {
        highlighters.stroke.add(view, cell.isLink() ? { selector: 'line' } : { selector: 'root' }, HIGHLIGHT, {
          padding: 4,
          attrs: { stroke: '#2b6cb0', 'stroke-width': 2, 'stroke-opacity': 0.7 },
        })
        if (cell.isLink()) {
          ;(view as dia.LinkView).addTools(
            new dia.ToolsView({
              tools: [
                new linkTools.Vertices({ snapRadius: 8 }),
                // drag a whole run sideways — the natural way to arrange a line
                new linkTools.Segments({ snapRadius: 8 }),
                new linkTools.SourceArrowhead(),
                new linkTools.TargetArrowhead(),
                new linkTools.Remove({
                  distance: '25%',
                  // the default action removes only the JointJS cell; the doc
                  // would keep the edge and the next reconcile would resurrect
                  // the "deleted" line — deletion must go through the store
                  action: (_evt: dia.Event, toolView: dia.LinkView) => {
                    store().deleteIds([String(toolView.model.id)])
                    store().setSelection([])
                  },
                }),
              ],
            }),
          )
        }
      } else if (!sel.has(String(cell.id)) && has) {
        highlighters.stroke.remove(view, HIGHLIGHT)
        if (cell.isLink()) (view as dia.LinkView).removeTools()
      }
    }
  }
  const unsubSelection = useStore.subscribe(syncSelection)

  // --- keyboard -----------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return
    const s = store()
    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); return }
    if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); s.redo(); return }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); window.dispatchEvent(new CustomEvent('pid:save')); return }
    if (mod && e.key.toLowerCase() === 'c') {
      const selSet = new Set(s.selection)
      const sheet = activeSheet(s)
      clipboard = {
        nodes: sheet.nodes.filter((n) => selSet.has(n.id)),
        edges: sheet.edges.filter((ed) => selSet.has(ed.id)),
      }
      return
    }
    if (mod && e.key.toLowerCase() === 'v') {
      if (clipboard && clipboard.nodes.length) s.pasteNodes(clipboard.nodes, clipboard.edges)
      return
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      duplicateSelection()
      return
    }
    // Shift+F fits the sheet to the visible canvas; Shift+1 goes back to 1:1.
    if (e.shiftKey && e.key.toLowerCase() === 'f' && canvasRef.paper && canvasRef.graph) {
      e.preventDefault()
      fitView(canvasRef.paper, canvasRef.graph, activeSheet(s).sheetSize)
      return
    }
    if (e.shiftKey && e.key === '!' && canvasRef.paper) {
      e.preventDefault()
      zoomActual(canvasRef.paper)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.deleteSelected(); return }
    if (e.key === 'Escape') {
      if (s.armPin) { s.setArmPin(null); return }
      s.setSelection([])
      return
    }
    if (e.key.toLowerCase() === 'r' && s.selection.length) {
      for (const id of s.selection) if (activeSheet(s).nodes.some((n) => n.id === id)) s.rotateNode(id)
      return
    }
    const nudge = e.shiftKey ? 1 : 8
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0], ArrowUp: [0, -nudge], ArrowDown: [0, nudge],
    }
    const mv = moves[e.key]
    if (mv && s.selection.length) {
      e.preventDefault()
      const nodeIds = s.selection.filter((id) => activeSheet(s).nodes.some((n) => n.id === id))
      if (nodeIds.length) s.moveNodes(nodeIds, mv[0], mv[1])
    }
  }

  paper.on('element:pointerdown', (v: dia.ElementView, e: dia.Event, x: number, y: number) => {
    if (placePin(v, x, y)) return
    onElementPointerDown(v, e)
    onElementPointerDownPos(v)
  })
  paper.on('element:pointermove', onElementPointerMove)
  paper.on('element:pointerup', onElementPointerUp)
  paper.on('element:magnet:pointerdown', onMagnetDown)
  paper.on('link:pointerdown', onLinkPointerDown)
  paper.on('link:pointerup', onLinkPointerUp)
  paper.on('blank:pointerdown', onBlankPointerDown)
  graph.on('change:vertices', onLinkChangeVertices)
  graph.on('batch:stop', onBatchStop)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerup', onGlobalPointerUp)

  return () => {
    clearGuides()
    unsubSelection()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('pointerup', onGlobalPointerUp)
    paper.off('element:magnet:pointerdown')
    paper.off('element:pointerdown')
    paper.off('element:pointermove')
    paper.off('element:pointerup')
    paper.off('link:pointerdown')
    paper.off('link:pointerup')
    paper.off('blank:pointerdown')
    graph.off('change:vertices')
    graph.off('batch:stop', onBatchStop)
  }
}

/** Duplicate the selected components (and the lines between them), offset 16px. */
export function duplicateSelection(): void {
  const s = useStore.getState()
  const selSet = new Set(s.selection)
  if (selSet.size === 0) return
  const sheet = activeSheet(s)
  const nodes = sheet.nodes.filter((n) => selSet.has(n.id))
  if (nodes.length === 0) return
  const edges = sheet.edges.filter(
    (e) =>
      isPortEnd(e.source) && selSet.has(e.source.nodeId) &&
      isPortEnd(e.target) && selSet.has(e.target.nodeId),
  )
  s.pasteNodes(nodes, edges)
}

/** Marquee selection on blank-drag. */
/** Apply an alignment or distribution to the current node selection. */
export function applyAlignment(mode: Parameters<typeof alignNodes>[1] | 'distribute-h' | 'distribute-v'): void {
  const s = useStore.getState()
  const sheet = activeSheet(s)
  const nodes = sheet.nodes.filter((n) => s.selection.includes(n.id))
  if (nodes.length < 2) return
  const moves =
    mode === 'distribute-h' ? distributeNodes(nodes, 'h')
    : mode === 'distribute-v' ? distributeNodes(nodes, 'v')
    : alignNodes(nodes, mode)
  for (const m of moves) {
    const orig = nodes.find((n) => n.id === m.id)!
    if (orig.x !== m.x || orig.y !== m.y) s.setNodePos(m.id, m.x, m.y)
  }
}

export function attachMarquee(host: HTMLElement, paper: dia.Paper, graph: dia.Graph): () => void {
  let active = false
  let start = { x: 0, y: 0 }
  const box = document.createElement('div')
  box.style.cssText =
    'position:absolute;border:1px dashed #2b6cb0;background:rgba(43,108,176,.08);pointer-events:none;display:none;z-index:5'
  host.appendChild(box)

  const onBlankDown = (evt: dia.Event) => {
    const e = evt.originalEvent as PointerEvent | undefined
    if (!e || e.button !== 0) return
    active = true
    start = { x: e.clientX, y: e.clientY }
  }
  const draw = (e: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    const x = Math.min(start.x, e.clientX) - rect.left
    const y = Math.min(start.y, e.clientY) - rect.top
    box.style.display = 'block'
    box.style.left = `${x}px`
    box.style.top = `${y}px`
    box.style.width = `${Math.abs(e.clientX - start.x)}px`
    box.style.height = `${Math.abs(e.clientY - start.y)}px`
  }
  const onMove = (e: PointerEvent) => {
    if (active) draw(e)
  }
  const onUp = (e: PointerEvent) => {
    if (!active) return
    active = false
    box.style.display = 'none'
    if (Math.abs(e.clientX - start.x) < 4 && Math.abs(e.clientY - start.y) < 4) return
    const a = paper.clientToLocalPoint({ x: start.x, y: start.y })
    const b = paper.clientToLocalPoint({ x: e.clientX, y: e.clientY })
    const area = new g.Rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
    const ids = graph.findModelsInArea(area).map((m) => String(m.id))
    const s = useStore.getState()
    s.setSelection(e.shiftKey ? [...new Set([...s.selection, ...ids])] : ids)
  }

  paper.on('blank:pointerdown', onBlankDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    box.remove()
  }
}
