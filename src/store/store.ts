import { create } from 'zustand'
import { temporal } from 'zundo'
import { ulid } from 'ulid'
import type { PlantEdge, PlantNode, ProjectDoc, Tag } from '../model/types'
import { isPortEnd } from '../model/types'
import { createEmptyDoc } from '../model/doc'

export interface StoreState {
  doc: ProjectDoc
  selection: string[]
  dirty: boolean
  activeLineClass: PlantEdge['lineClass']

  addNode(partial: Omit<PlantNode, 'id'>): string
  setNodePos(id: string, x: number, y: number): void
  moveNodes(ids: string[], dx: number, dy: number): void
  rotateNode(id: string): void
  setNodeConfig(id: string, config: Record<string, string>): void
  setTag(id: string, tag: Tag | undefined): void
  setLabel(id: string, label: string): void
  setMeta(patch: Partial<ProjectDoc['meta']>): void
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
}

function touched(doc: ProjectDoc): ProjectDoc {
  return { ...doc, meta: { ...doc.meta, modified: new Date().toISOString() } }
}

export const useStore = create<StoreState>()(
  temporal(
    (set, get) => ({
      doc: createEmptyDoc(),
      selection: [],
      dirty: false,
      activeLineClass: 'process.major',

      addNode(partial) {
        const id = ulid()
        set((s) => ({
          doc: touched({ ...s.doc, nodes: [...s.doc.nodes, { ...partial, id }] }),
          dirty: true,
        }))
        return id
      },

      setNodePos(id, x, y) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
          }),
          dirty: true,
        }))
      },

      moveNodes(ids, dx, dy) {
        const idSet = new Set(ids)
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) =>
              idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
            ),
          }),
          dirty: true,
        }))
      },

      rotateNode(id) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) =>
              n.id === id ? { ...n, rotation: (((n.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : n,
            ),
          }),
          dirty: true,
        }))
      },

      setNodeConfig(id, config) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, config } : n)),
          }),
          dirty: true,
        }))
      },

      setTag(id, tag) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, tag } : n)),
          }),
          dirty: true,
        }))
      },

      setLabel(id, label) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
          }),
          dirty: true,
        }))
      },

      setMeta(patch) {
        set((s) => ({ doc: touched({ ...s.doc, meta: { ...s.doc.meta, ...patch } }), dirty: true }))
      },

      addEdge(partial) {
        const id = ulid()
        set((s) => ({
          doc: touched({ ...s.doc, edges: [...s.doc.edges, { ...partial, id }] }),
          dirty: true,
        }))
        return id
      },

      setEdge(id, patch) {
        set((s) => ({
          doc: touched({
            ...s.doc,
            edges: s.doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          }),
          dirty: true,
        }))
      },

      setEdgeVertices(id, vertices) {
        get().setEdge(id, { vertices })
      },

      deleteIds(ids) {
        const idSet = new Set(ids)
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: s.doc.nodes.filter((n) => !idSet.has(n.id)),
            edges: s.doc.edges.filter(
              (e) =>
                !idSet.has(e.id) &&
                !(isPortEnd(e.source) && idSet.has(e.source.nodeId)) &&
                !(isPortEnd(e.target) && idSet.has(e.target.nodeId)),
            ),
          }),
          selection: s.selection.filter((sel) => !idSet.has(sel)),
          dirty: true,
        }))
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
          const { tag: _tag, ...rest } = n
          return { ...rest, id, x: n.x + 16, y: n.y + 16 }
        })
        const newEdges: PlantEdge[] = []
        for (const e of edges) {
          const src = isPortEnd(e.source) ? idMap.get(e.source.nodeId) : 'free'
          const tgt = isPortEnd(e.target) ? idMap.get(e.target.nodeId) : 'free'
          if (!src || !tgt) continue // endpoint outside pasted set — drop
          newEdges.push({
            ...e,
            id: ulid(),
            source: isPortEnd(e.source) ? { nodeId: src, portId: e.source.portId } : { x: e.source.x + 16, y: e.source.y + 16 },
            target: isPortEnd(e.target) ? { nodeId: tgt, portId: e.target.portId } : { x: e.target.x + 16, y: e.target.y + 16 },
            vertices: e.vertices?.map((v) => ({ x: v.x + 16, y: v.y + 16 })),
          })
        }
        set((s) => ({
          doc: touched({
            ...s.doc,
            nodes: [...s.doc.nodes, ...newNodes],
            edges: [...s.doc.edges, ...newEdges],
          }),
          selection: newNodes.map((n) => n.id),
          dirty: true,
        }))
      },

      loadIntoStore(doc) {
        set({ doc, selection: [], dirty: false })
        useStore.temporal.getState().clear()
      },

      markSaved() {
        set({ dirty: false })
      },

      undo() {
        useStore.temporal.getState().undo()
      },

      redo() {
        useStore.temporal.getState().redo()
      },
    }),
    {
      partialize: (state) => ({ doc: state.doc }),
      limit: 200,
      equality: (past, current) => past.doc === current.doc,
    },
  ),
)
