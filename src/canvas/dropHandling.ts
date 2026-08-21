import type { dia } from '@joint/core'
import { DRAG_MIME, type DragPayload } from '../panels/Palette'
import { getSymbol } from '../symbols/registry'
import type { NodeKind } from '../model/types'
import type { SymbolDef } from '../symbols/types'
import { nextLoopNumber } from '../isa/autonumber'
import { useStore } from '../store/store'
import { canvasRef } from './paperSetup'

export function kindForSymbol(def: Pick<SymbolDef, 'tagRule' | 'category'>): NodeKind {
  switch (def.tagRule) {
    case 'isa-instrument':
      return 'instrument'
    case 'valve':
      return 'valve'
    case 'equipment':
      return 'equipment'
    default:
      return def.category === 'annotation' ? 'annotation' : 'fitting'
  }
}

const snap8 = (v: number) => Math.round(v / 8) * 8

/** Place a symbol snapped at the visible canvas center (palette Enter quick-add). */
export function placeAtCenter(symbolId: string): void {
  const paper = canvasRef.paper
  if (!paper) return
  const def = getSymbol(symbolId)
  const el = paper.el as HTMLElement
  const rect = el.getBoundingClientRect()
  const local = paper.clientToLocalPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  const store = useStore.getState()
  const w = def.gridSize.w * 8
  const h = def.gridSize.h * 8
  const node: Parameters<typeof store.addNode>[0] = {
    symbolId: def.id,
    kind: kindForSymbol(def),
    x: snap8(local.x - w / 2),
    y: snap8(local.y - h / 2),
    rotation: 0,
  }
  if (def.defaultConfig) node.config = { ...def.defaultConfig }
  const id = store.addNode(node)
  store.setSelection([id])
}

export function attachDropHandling(host: HTMLElement, paper: dia.Paper): () => void {
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes(DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  const onDrop = (e: DragEvent) => {
    const raw = e.dataTransfer?.getData(DRAG_MIME)
    if (!raw) return
    e.preventDefault()
    const payload = JSON.parse(raw) as DragPayload
    const def = getSymbol(payload.symbolId)
    const local = paper.clientToLocalPoint({ x: e.clientX, y: e.clientY })
    const store = useStore.getState()
    const w = def.gridSize.w * 8
    const h = def.gridSize.h * 8
    const node: Parameters<typeof store.addNode>[0] = {
      symbolId: def.id,
      kind: kindForSymbol(def),
      x: snap8(local.x - w / 2),
      y: snap8(local.y - h / 2),
      rotation: 0,
    }
    if (def.defaultConfig) node.config = { ...def.defaultConfig }
    if (payload.presetLetters) {
      node.tag = { letters: payload.presetLetters, loop: nextLoopNumber(store.doc, payload.presetLetters) }
    }
    const id = store.addNode(node)
    store.setSelection([id])
  }
  host.addEventListener('dragover', onDragOver)
  host.addEventListener('drop', onDrop)
  return () => {
    host.removeEventListener('dragover', onDragOver)
    host.removeEventListener('drop', onDrop)
  }
}
