import { useEffect, useRef } from 'react'
import { canvasRef, createPaper, zoomAt } from './paperSetup'
import { reconcile } from './reconciler'
import { decorateLinks } from './decorations'
import { attachDropHandling } from './dropHandling'
import { attachInteractions, attachMarquee } from './interactions'
import '../symbols/lib/index'
import { sheetPx } from '../model/doc'
import { activeSheet, useStore } from '../store/store'

export default function Canvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sheetSize = useStore((s) => activeSheet(s).sheetSize)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const paperEl = document.createElement('div')
    host.appendChild(paperEl)
    const { paper, graph } = createPaper(paperEl, activeSheet(useStore.getState()).sheetSize)
    canvasRef.paper = paper
    canvasRef.graph = graph
    paper.translate(24, 24)

    paper.on('render:done', () => decorateLinks(paper))
    const detachDrop = attachDropHandling(host, paper)
    const detachInteractions = attachInteractions(paper, graph)
    const detachMarquee = attachMarquee(host, paper, graph)

    let prevSheetId = useStore.getState().activeSheetId
    let prevSheet = activeSheet(useStore.getState())
    reconcile(graph, prevSheet, undefined)
    const unsubscribe = useStore.subscribe((s) => {
      const sheet = activeSheet(s)
      if (s.activeSheetId !== prevSheetId) {
        prevSheetId = s.activeSheetId
        prevSheet = sheet
        graph.clear()
        reconcile(graph, sheet, undefined)
      } else if (sheet !== prevSheet) {
        const before = prevSheet
        prevSheet = sheet
        reconcile(graph, sheet, before)
      }
    })

    let panning = false
    let spaceDown = false
    let last = { x: 0, y: 0 }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(paper, e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        spaceDown = e.type === 'keydown'
        host.style.cursor = spaceDown ? 'grab' : ''
        if (e.type === 'keydown') e.preventDefault()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        panning = true
        last = { x: e.clientX, y: e.clientY }
        host.setPointerCapture(e.pointerId)
        host.style.cursor = 'grabbing'
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!panning) return
      const t = paper.translate()
      paper.translate(t.tx + e.clientX - last.x, t.ty + e.clientY - last.y)
      last = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (panning) {
        panning = false
        host.releasePointerCapture(e.pointerId)
        host.style.cursor = spaceDown ? 'grab' : ''
      }
    }

    host.addEventListener('wheel', onWheel, { passive: false })
    host.addEventListener('pointerdown', onPointerDown, true)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)

    return () => {
      detachMarquee()
      detachInteractions()
      detachDrop()
      unsubscribe()
      host.removeEventListener('wheel', onWheel)
      host.removeEventListener('pointerdown', onPointerDown, true)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      paper.remove()
      canvasRef.paper = undefined
      canvasRef.graph = undefined
      host.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const { w, h } = sheetPx(sheetSize)
    canvasRef.paper?.setDimensions(w, h)
  }, [sheetSize])

  return <div ref={hostRef} className="canvas-host" data-testid="canvas" />
}
