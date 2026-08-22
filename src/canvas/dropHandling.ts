import type { dia } from '@joint/core'
import { DRAG_MIME, type DragPayload } from '../panels/Palette'
import { getSymbol } from '../symbols/registry'
import type { NodeKind } from '../model/types'
import type { SymbolDef } from '../symbols/types'
import { nextLoopNumber } from '../isa/autonumber'
import { buildTypical } from '../assist/typicals'
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

/** Place a fully wired typical loop with its top-left near the canvas center. */
export function placeTypicalAtCenter(typicalId: string): void {
  const paper = canvasRef.paper
  if (!paper) return
  const el = paper.el as HTMLElement
  const rect = el.getBoundingClientRect()
  const local = paper.clientToLocalPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  const store = useStore.getState()
  const { nodes, edges } = buildTypical(typicalId, store.doc, { x: local.x - 96, y: local.y - 96 })
  store.addBatch(nodes, edges)
}

/** Open a file the user dropped on the canvas, routed by extension. */
async function openDroppedFile(file: File): Promise<void> {
  const name = file.name.toLowerCase()
  const text = await file.text()
  const store = useStore.getState()
  if (name.endsWith('.dxf')) {
    const { parseDxfUnderlay } = await import('../import/dxfUnderlay')
    const { sheetPx } = await import('../model/doc')
    const { activeSheet } = await import('../store/store')
    const { polylines, warnings } = parseDxfUnderlay(text, sheetPx(activeSheet(store).sheetSize))
    store.setUnderlay({ name: file.name, polylines })
    if (warnings.length) window.alert(warnings.join('\n'))
    return
  }
  if (store.dirty && !window.confirm(`Open “${file.name}”? Unsaved changes will be lost.`)) return
  const { loadAnyText } = await import('../persist/file')
  try {
    loadAnyText(file.name, text)
  } catch {
    window.alert(`Could not read ${file.name} as a PID Studio drawing`)
  }
}

export function attachDropHandling(host: HTMLElement, paper: dia.Paper): () => void {
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes(DRAG_MIME) || e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer?.files?.[0]
    if (file && /\.(pnid|json|xml|dxf)$/i.test(file.name)) {
      e.preventDefault()
      void openDroppedFile(file)
      return
    }
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
