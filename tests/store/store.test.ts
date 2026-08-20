import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

function reset() {
  useStore.getState().loadIntoStore(createEmptyDoc('test'))
}

function addPump(x = 0, y = 0): string {
  return useStore.getState().addNode({
    symbolId: 'pump.centrifugal', kind: 'equipment', x, y, rotation: 0,
  })
}

describe('store', () => {
  beforeEach(reset)

  it('addNode returns id and appends node, marking dirty', () => {
    const id = addPump(8, 16)
    const s = useStore.getState()
    expect(s.doc.nodes).toHaveLength(1)
    expect(s.doc.nodes[0]!.id).toBe(id)
    expect(s.dirty).toBe(true)
  })

  it('setNodePos and moveNodes update positions', () => {
    const id = addPump(0, 0)
    useStore.getState().setNodePos(id, 24, 32)
    expect(useStore.getState().doc.nodes[0]).toMatchObject({ x: 24, y: 32 })
    useStore.getState().moveNodes([id], 8, -8)
    expect(useStore.getState().doc.nodes[0]).toMatchObject({ x: 32, y: 24 })
  })

  it('rotateNode cycles through quadrants', () => {
    const id = addPump()
    const s = useStore.getState()
    s.rotateNode(id); s.rotateNode(id); s.rotateNode(id); s.rotateNode(id)
    expect(useStore.getState().doc.nodes[0]!.rotation).toBe(0)
    useStore.getState().rotateNode(id)
    expect(useStore.getState().doc.nodes[0]!.rotation).toBe(90)
  })

  it('deleteIds cascades attached edges', () => {
    const a = addPump(0, 0)
    const b = addPump(100, 0)
    const e = useStore.getState().addEdge({
      lineClass: 'process.major',
      source: { nodeId: a, portId: 'out' },
      target: { nodeId: b, portId: 'in' },
    })
    expect(useStore.getState().doc.edges).toHaveLength(1)
    useStore.getState().deleteIds([a])
    const s = useStore.getState()
    expect(s.doc.nodes).toHaveLength(1)
    expect(s.doc.edges).toHaveLength(0)
    expect(s.doc.edges.find((x) => x.id === e)).toBeUndefined()
  })

  it('deleteSelected deletes the selection and clears it', () => {
    const a = addPump()
    useStore.getState().setSelection([a])
    useStore.getState().deleteSelected()
    const s = useStore.getState()
    expect(s.doc.nodes).toHaveLength(0)
    expect(s.selection).toEqual([])
  })

  it('pasteNodes remaps ids/edges, offsets +16, strips tags', () => {
    const a = addPump(0, 0)
    const b = addPump(100, 0)
    useStore.getState().setTag(a, { letters: 'FT', loop: '100' })
    useStore.getState().addEdge({
      lineClass: 'process.major',
      source: { nodeId: a, portId: 'out' },
      target: { nodeId: b, portId: 'in' },
    })
    const { doc } = useStore.getState()
    useStore.getState().pasteNodes(doc.nodes, doc.edges)
    const s = useStore.getState()
    expect(s.doc.nodes).toHaveLength(4)
    expect(s.doc.edges).toHaveLength(2)
    const pasted = s.doc.nodes.slice(2)
    expect(pasted[0]!.id).not.toBe(a)
    expect(pasted[0]!.x).toBe(16)
    expect(pasted[0]!.tag).toBeUndefined()
    const pastedEdge = s.doc.edges[1]!
    expect('nodeId' in pastedEdge.source && pastedEdge.source.nodeId).toBe(pasted[0]!.id)
    expect(s.selection).toEqual(pasted.map((p) => p.id))
  })

  it('undo/redo replay doc changes but not selection', () => {
    const a = addPump()
    useStore.getState().setSelection([a])
    useStore.getState().undo()
    expect(useStore.getState().doc.nodes).toHaveLength(0)
    useStore.getState().redo()
    expect(useStore.getState().doc.nodes).toHaveLength(1)
  })

  it('loadIntoStore clears history and dirty', () => {
    addPump()
    useStore.getState().loadIntoStore(createEmptyDoc('fresh'))
    const s = useStore.getState()
    expect(s.doc.meta.name).toBe('fresh')
    expect(s.dirty).toBe(false)
    s.undo()
    expect(useStore.getState().doc.meta.name).toBe('fresh')
  })
})
