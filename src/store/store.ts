import { create } from 'zustand'
import { temporal } from 'zundo'
import { ulid } from 'ulid'
import type { CustomSymbolDef, PlantEdge, PlantNode, ProjectDoc, Sheet, Tag } from '../model/types'
import { registerCustomSymbols } from '../symbols/custom'
import { isPortEnd } from '../model/types'
import { createEmptyDoc, createSheet } from '../model/doc'
import type { HmiPipe, HmiScreen, HmiTheme, HmiWidget } from '../hmi/model'
import { createScreen } from '../hmi/model'

export interface StoreState {
  doc: ProjectDoc
  activeSheetId: string
  selection: string[]
  dirty: boolean
  activeLineClass: PlantEdge['lineClass']

  addNode(partial: Omit<PlantNode, 'id'>): string
  setNodePos(id: string, x: number, y: number): void
  moveNodes(ids: string[], dx: number, dy: number): void
  rotateNode(id: string): void
  setNodeScale(id: string, scale: number): void
  setNodeConfig(id: string, config: Record<string, string>): void
  setTag(id: string, tag: Tag | undefined): void
  setLabel(id: string, label: string): void
  setLabelPos(id: string, pos: 'below' | 'center'): void
  setTagOffset(id: string, off: { x: number; y: number } | undefined): void
  setLabelOffset(id: string, off: { x: number; y: number } | undefined): void
  setNodeLink(id: string, link: PlantNode['link']): void
  setDatasheet(id: string, patch: Record<string, string>): void
  setUnderlay(underlay: Sheet['underlay']): void
  addCustomSymbol(def: CustomSymbolDef): void
  removeCustomSymbol(id: string): void
  setMeta(patch: Partial<ProjectDoc['meta']>): void
  setSettings(patch: Partial<ProjectDoc['settings']>): void
  /** Add a prebuilt group of nodes/edges (and optionally drop edges) as ONE undo step. */
  addBatch(nodes: PlantNode[], edges: PlantEdge[], deleteEdgeIds?: string[]): void
  setSheetMeta(patch: Partial<Pick<Sheet, 'name' | 'drawingNumber' | 'revision' | 'sheetSize'>>): void
  addSheet(): string
  renameSheet(id: string, name: string): void
  deleteSheet(id: string): void
  setActiveSheet(id: string): void
  addEdge(partial: Omit<PlantEdge, 'id'>): string
  setEdge(id: string, patch: Partial<Omit<PlantEdge, 'id'>>): void
  setEdgeVertices(id: string, vertices: { x: number; y: number }[]): void
  deleteIds(ids: string[]): void
  deleteSelected(): void
  setSelection(ids: string[]): void
  setActiveLineClass(lineClass: PlantEdge['lineClass']): void
  pasteNodes(nodes: PlantNode[], edges: PlantEdge[]): void
  loadIntoStore(doc: ProjectDoc): void
  markSaved(): void
  undo(): void
  redo(): void

  /** HMI Studio slice — screens live in doc.hmiScreens; edits are undoable. */
  activeScreenId: string | null
  setActiveScreen(id: string): void
  addScreen(): string
  addImportedScreen(screen: HmiScreen): void
  replaceScreen(screen: HmiScreen): void
  renameScreen(id: string, name: string): void
  deleteScreen(id: string): void
  setScreenTheme(id: string, theme: HmiTheme): void
  addWidget(partial: Omit<HmiWidget, 'id'>): string
  updateWidget(id: string, patch: Partial<Omit<HmiWidget, 'id'>>): void
  moveWidgets(ids: string[], dx: number, dy: number): void
  addHmiPipe(partial: Omit<HmiPipe, 'id'>): string
  updateHmiPipe(id: string, patch: Partial<Omit<HmiPipe, 'id'>>): void
  deleteHmiIds(ids: string[]): void
}

/** The sheet all node/edge actions and the canvas operate on. */
export function activeSheet(s: Pick<StoreState, 'doc' | 'activeSheetId'>): Sheet {
  return s.doc.sheets.find((sh) => sh.id === s.activeSheetId) ?? s.doc.sheets[0]!
}

/** The HMI screen all widget/pipe actions and the HMI canvas operate on. */
export function activeHmiScreen(s: Pick<StoreState, 'doc' | 'activeScreenId'>): HmiScreen | null {
  return s.doc.hmiScreens.find((sc) => sc.id === s.activeScreenId) ?? null
}

function touched(doc: ProjectDoc): ProjectDoc {
  return { ...doc, meta: { ...doc.meta, modified: new Date().toISOString() } }
}

const initialDoc = createEmptyDoc()

export const useStore = create<StoreState>()(
  temporal(
    (set, get) => {
      /** Immutably replace the active sheet via an updater. */
      const patchSheet = (updater: (sheet: Sheet) => Sheet) => {
        set((s) => ({
          doc: touched({
            ...s.doc,
            sheets: s.doc.sheets.map((sh) => (sh.id === activeSheet(s).id ? updater(sh) : sh)),
          }),
          dirty: true,
        }))
      }

      /** Immutably replace the active HMI screen via an updater. */
      const patchScreen = (updater: (screen: HmiScreen) => HmiScreen) => {
        set((s) => {
          const id = s.activeScreenId
          if (!id) return s
          return {
            doc: touched({
              ...s.doc,
              hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? updater(sc) : sc)),
            }),
            dirty: true,
          }
        })
      }

      return {
        doc: initialDoc,
        activeSheetId: initialDoc.sheets[0]!.id,
        activeScreenId: null,
        selection: [],
        dirty: false,
        activeLineClass: 'process.major',

        addNode(partial) {
          const id = ulid()
          patchSheet((sh) => ({ ...sh, nodes: [...sh.nodes, { ...partial, id }] }))
          return id
        },

        setNodePos(id, x, y) {
          patchSheet((sh) => ({ ...sh, nodes: sh.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }))
        },

        moveNodes(ids, dx, dy) {
          const idSet = new Set(ids)
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => (idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
          }))
        },

        rotateNode(id) {
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) =>
              n.id === id ? { ...n, rotation: (((n.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : n,
            ),
          }))
        },

        setNodeScale(id, scale) {
          const clamped = Math.min(3, Math.max(0.5, Math.round(scale * 4) / 4))
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => {
              if (n.id !== id) return n
              const { scale: _drop, ...rest } = n
              return clamped === 1 ? rest : { ...rest, scale: clamped }
            }),
          }))
        },

        setNodeConfig(id, config) {
          patchSheet((sh) => ({ ...sh, nodes: sh.nodes.map((n) => (n.id === id ? { ...n, config } : n)) }))
        },

        setTag(id, tag) {
          patchSheet((sh) => ({ ...sh, nodes: sh.nodes.map((n) => (n.id === id ? { ...n, tag } : n)) }))
        },

        setLabel(id, label) {
          patchSheet((sh) => ({ ...sh, nodes: sh.nodes.map((n) => (n.id === id ? { ...n, label } : n)) }))
        },

        setTagOffset(id, off) {
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => {
              if (n.id !== id) return n
              const { tagOffset: _d, ...rest } = n
              return off ? { ...rest, tagOffset: off } : rest
            }),
          }))
        },

        setLabelOffset(id, off) {
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => {
              if (n.id !== id) return n
              const { labelOffset: _d, ...rest } = n
              return off ? { ...rest, labelOffset: off } : rest
            }),
          }))
        },

        setLabelPos(id, pos) {
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => {
              if (n.id !== id) return n
              const { labelPos: _drop, ...rest } = n
              return pos === 'below' ? rest : { ...rest, labelPos: pos }
            }),
          }))
        },

        setNodeLink(id, link) {
          patchSheet((sh) => ({ ...sh, nodes: sh.nodes.map((n) => (n.id === id ? { ...n, link } : n)) }))
        },

        setDatasheet(id, patch) {
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.map((n) => (n.id === id ? { ...n, datasheet: { ...n.datasheet, ...patch } } : n)),
          }))
        },

        setMeta(patch) {
          set((s) => ({ doc: touched({ ...s.doc, meta: { ...s.doc.meta, ...patch } }), dirty: true }))
        },

        setSettings(patch) {
          set((s) => ({ doc: touched({ ...s.doc, settings: { ...s.doc.settings, ...patch } }), dirty: true }))
        },

        addBatch(nodes, edges, deleteEdgeIds) {
          const drop = new Set(deleteEdgeIds ?? [])
          patchSheet((sh) => ({
            ...sh,
            nodes: [...sh.nodes, ...nodes],
            edges: [...sh.edges.filter((e) => !drop.has(e.id)), ...edges],
          }))
          set({ selection: nodes.map((n) => n.id) })
        },

        setSheetMeta(patch) {
          patchSheet((sh) => ({ ...sh, ...patch }))
        },

        addSheet() {
          const sheet = createSheet(get().doc.sheets.length + 1)
          set((s) => ({ doc: touched({ ...s.doc, sheets: [...s.doc.sheets, sheet] }), dirty: true }))
          set({ activeSheetId: sheet.id, selection: [] })
          return sheet.id
        },

        renameSheet(id, name) {
          set((s) => ({
            doc: touched({ ...s.doc, sheets: s.doc.sheets.map((sh) => (sh.id === id ? { ...sh, name } : sh)) }),
            dirty: true,
          }))
        },

        deleteSheet(id) {
          const s = get()
          if (s.doc.sheets.length <= 1) return
          const remaining = s.doc.sheets.filter((sh) => sh.id !== id)
          set({
            doc: touched({ ...s.doc, sheets: remaining }),
            dirty: true,
            activeSheetId: s.activeSheetId === id ? remaining[0]!.id : s.activeSheetId,
            selection: [],
          })
        },

        setActiveSheet(id) {
          if (get().doc.sheets.some((sh) => sh.id === id)) set({ activeSheetId: id, selection: [] })
        },

        addEdge(partial) {
          const id = ulid()
          patchSheet((sh) => ({ ...sh, edges: [...sh.edges, { ...partial, id }] }))
          return id
        },

        setEdge(id, patch) {
          patchSheet((sh) => ({ ...sh, edges: sh.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
        },

        setEdgeVertices(id, vertices) {
          get().setEdge(id, { vertices })
        },

        deleteIds(ids) {
          const idSet = new Set(ids)
          patchSheet((sh) => ({
            ...sh,
            nodes: sh.nodes.filter((n) => !idSet.has(n.id)),
            edges: sh.edges.filter(
              (e) =>
                !idSet.has(e.id) &&
                !(isPortEnd(e.source) && idSet.has(e.source.nodeId)) &&
                !(isPortEnd(e.target) && idSet.has(e.target.nodeId)),
            ),
          }))
          set((s) => ({ selection: s.selection.filter((sel) => !idSet.has(sel)) }))
        },

        deleteSelected() {
          get().deleteIds(get().selection)
        },

        setSelection(ids) {
          set({ selection: ids })
        },

        setActiveLineClass(lineClass) {
          set({ activeLineClass: lineClass })
        },

        pasteNodes(nodes, edges) {
          const idMap = new Map<string, string>()
          const newNodes: PlantNode[] = nodes.map((n) => {
            const id = ulid()
            idMap.set(n.id, id)
            const { tag: _tag, link: _link, ...rest } = n
            return { ...rest, id, x: n.x + 16, y: n.y + 16 }
          })
          const newEdges: PlantEdge[] = []
          for (const e of edges) {
            const src = isPortEnd(e.source) ? idMap.get(e.source.nodeId) : 'free'
            const tgt = isPortEnd(e.target) ? idMap.get(e.target.nodeId) : 'free'
            if (!src || !tgt) continue
            newEdges.push({
              ...e,
              id: ulid(),
              source: isPortEnd(e.source) ? { nodeId: src, portId: e.source.portId } : { x: e.source.x + 16, y: e.source.y + 16 },
              target: isPortEnd(e.target) ? { nodeId: tgt, portId: e.target.portId } : { x: e.target.x + 16, y: e.target.y + 16 },
              vertices: e.vertices?.map((v) => ({ x: v.x + 16, y: v.y + 16 })),
            })
          }
          patchSheet((sh) => ({ ...sh, nodes: [...sh.nodes, ...newNodes], edges: [...sh.edges, ...newEdges] }))
          set({ selection: newNodes.map((n) => n.id) })
        },

        setUnderlay(underlay) {
          patchSheet((sh) => {
            const next = { ...sh }
            if (underlay) next.underlay = underlay
            else delete next.underlay
            return next
          })
        },

        addCustomSymbol(def) {
          set((s) => {
            const doc = touched({ ...s.doc, customSymbols: [...(s.doc.customSymbols ?? []), def] })
            registerCustomSymbols(doc)
            return { doc, dirty: true }
          })
        },

        removeCustomSymbol(id) {
          set((s) => {
            const doc = touched({ ...s.doc, customSymbols: (s.doc.customSymbols ?? []).filter((d) => d.id !== id) })
            registerCustomSymbols(doc)
            return { doc, dirty: true }
          })
        },

        loadIntoStore(doc) {
          registerCustomSymbols(doc)
          set({ doc, activeSheetId: doc.sheets[0]!.id, activeScreenId: doc.hmiScreens[0]?.id ?? null, selection: [], dirty: false })
          useStore.temporal.getState().clear()
        },

        setActiveScreen(id) {
          if (get().doc.hmiScreens.some((sc) => sc.id === id)) set({ activeScreenId: id })
        },

        addScreen() {
          const screen = createScreen(get().doc.hmiScreens.length + 1)
          set((s) => ({
            doc: touched({ ...s.doc, hmiScreens: [...s.doc.hmiScreens, screen] }),
            activeScreenId: screen.id,
            dirty: true,
          }))
          return screen.id
        },

        addImportedScreen(screen) {
          set((s) => ({
            doc: touched({ ...s.doc, hmiScreens: [...s.doc.hmiScreens, screen] }),
            activeScreenId: screen.id,
            dirty: true,
          }))
        },

        replaceScreen(screen) {
          set((s) => ({
            doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === screen.id ? screen : sc)) }),
            dirty: true,
          }))
        },

        renameScreen(id, name) {
          set((s) => ({
            doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? { ...sc, name } : sc)) }),
            dirty: true,
          }))
        },

        deleteScreen(id) {
          set((s) => {
            const rest = s.doc.hmiScreens.filter((sc) => sc.id !== id)
            return {
              doc: touched({ ...s.doc, hmiScreens: rest }),
              activeScreenId: s.activeScreenId === id ? (rest[0]?.id ?? null) : s.activeScreenId,
              dirty: true,
            }
          })
        },

        setScreenTheme(id, theme) {
          set((s) => ({
            doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? { ...sc, theme } : sc)) }),
            dirty: true,
          }))
        },

        addWidget(partial) {
          const id = ulid()
          patchScreen((sc) => ({ ...sc, widgets: [...sc.widgets, { ...partial, id }] }))
          return id
        },

        updateWidget(id, patch) {
          patchScreen((sc) => ({ ...sc, widgets: sc.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
        },

        moveWidgets(ids, dx, dy) {
          const idSet = new Set(ids)
          patchScreen((sc) => ({
            ...sc,
            widgets: sc.widgets.map((w) => (idSet.has(w.id) ? { ...w, x: w.x + dx, y: w.y + dy } : w)),
          }))
        },

        addHmiPipe(partial) {
          const id = ulid()
          patchScreen((sc) => ({ ...sc, pipes: [...sc.pipes, { ...partial, id }] }))
          return id
        },

        updateHmiPipe(id, patch) {
          patchScreen((sc) => ({ ...sc, pipes: sc.pipes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
        },

        deleteHmiIds(ids) {
          const idSet = new Set(ids)
          patchScreen((sc) => ({
            ...sc,
            widgets: sc.widgets.filter((w) => !idSet.has(w.id)),
            pipes: sc.pipes.filter((p) => !idSet.has(p.id)),
          }))
        },

        markSaved() {
          set({ dirty: false })
        },

        undo() {
          useStore.temporal.getState().resume()
          useStore.temporal.getState().undo()
        },

        redo() {
          useStore.temporal.getState().resume()
          useStore.temporal.getState().redo()
        },
      }
    },
    {
      partialize: (state) => ({ doc: state.doc }),
      limit: 200,
      equality: (past, current) => past.doc === current.doc,
    },
  ),
)

/**
 * Undo grouping for continuous edits (typing, label dragging): the first
 * change records normally, then history pauses until resumeHistory() — so
 * one Ctrl+Z reverts the whole burst. resumeHistory is safe to over-call;
 * the global pointerup listener calls it as a safety net.
 */
export function pauseHistory(): void {
  useStore.temporal.getState().pause()
}

export function resumeHistory(): void {
  useStore.temporal.getState().resume()
}
