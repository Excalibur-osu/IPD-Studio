import { dia, g, highlighters, linkTools } from '@joint/core'
import type { PlantEdge, PlantNode } from '../model/types'
import { isPortEnd } from '../model/types'
import type { PortKind } from '../symbols/types'
import { canConnect } from './connectionRules'
import { alignNodes, distributeNodes, snapGuides } from './alignment'
import { makeLink } from './shapes'
import { activeSheet, useStore } from '../store/store'

const snap8 = (v: number) => Math.round(v / 8) * 8

type PortKinds = Record<string, PortKind>

function portKindOf(cellView: dia.CellView, magnet: SVGElement | undefined): PortKind | null {
  const portId = magnet?.getAttribute('port')
  if (!portId) return null
  const kinds = (cellView.model.get('data') as { portKinds?: PortKinds } | undefined)?.portKinds
  return kinds?.[portId] ?? null
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

  paper.options.validateConnection = (srcView, srcMagnet, tgtView, tgtMagnet) => {
    const src = portKindOf(srcView as dia.CellView, srcMagnet as SVGElement)
    const tgt = portKindOf(tgtView as dia.CellView, tgtMagnet as SVGElement)
    if (!src || !tgt) return false
    if (srcView === tgtView) return false
    return canConnect(src, tgt, store().activeLineClass)
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
    link.remove()
    // Refuse fully dangling scribbles; allow one free end (vents, off-page).
    if (!source || !target) return
    if (!isPortEnd(source) && !isPortEnd(target)) return
    const id = store().addEdge({ lineClass: store().activeLineClass, source, target })
    store().setSelection([id])
  }

  const onLinkPointerUp = (view: dia.LinkView) => commitDraft(view.model)

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
    if (store().selection.length) store().setSelection([])
  }

  // --- movement commit + live alignment guides ---------------------------
  const dragStart = new Map<string, { x: number; y: number }>()
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
    if (!dragStart.has(id)) return
    clearGuides()
    const sheet = activeSheet(store())
    const node = sheet.nodes.find((n) => n.id === id)
    if (!node) return
    const p = view.model.position()
    const hit = snapGuides({ ...node, x: p.x, y: p.y }, sheet.nodes)
    if (hit.guideX !== undefined) drawGuide(true, hit.guideX)
    if (hit.guideY !== undefined) drawGuide(false, hit.guideY)
  }
  const onElementPointerDownPos = (view: dia.ElementView) => {
    const p = view.model.position()
    dragStart.set(String(view.model.id), { x: p.x, y: p.y })
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
    const hit = node ? snapGuides({ ...node, x: p.x, y: p.y }, sheet.nodes) : {}
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
  }

  // --- vertex editing on selected links ----------------------------------
  const onLinkChangeVertices = (link: dia.Link, _v: unknown, opt: { ui?: boolean }) => {
    if (!opt.ui || String(link.id).startsWith('draft-')) return
    const verts = link.vertices().map((v) => ({ x: snap8(v.x), y: snap8(v.y) }))
    store().setEdgeVertices(String(link.id), verts)
  }

  // --- selection highlight + link tools -----------------------------------
  const HIGHLIGHT = 'pid-selection'
  const syncSelection = () => {
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
            new dia.ToolsView({ tools: [new linkTools.Vertices({ snapRadius: 8 }), new linkTools.Remove({ distance: '25%' })] }),
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
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.deleteSelected(); return }
    if (e.key === 'Escape') { s.setSelection([]); return }
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

  paper.on('element:pointerdown', (v: dia.ElementView, e: dia.Event) => { onElementPointerDown(v, e); onElementPointerDownPos(v) })
  paper.on('element:pointermove', onElementPointerMove)
  paper.on('element:pointerup', onElementPointerUp)
  paper.on('link:pointerdown', onLinkPointerDown)
  paper.on('link:pointerup', onLinkPointerUp)
  paper.on('blank:pointerdown', onBlankPointerDown)
  graph.on('change:vertices', onLinkChangeVertices)
  window.addEventListener('keydown', onKeyDown)

  return () => {
    clearGuides()
    unsubSelection()
    window.removeEventListener('keydown', onKeyDown)
    paper.off('element:pointerdown')
    paper.off('element:pointermove')
    paper.off('element:pointerup')
    paper.off('link:pointerdown')
    paper.off('link:pointerup')
    paper.off('blank:pointerdown')
    graph.off('change:vertices')
  }
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
