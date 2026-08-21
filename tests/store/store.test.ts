import { beforeEach, describe, expect, it } from 'vitest'
import { activeSheet, useStore } from '../../src/store/store'
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
    expect(activeSheet(s).nodes).toHaveLength(1)
    expect(activeSheet(s).nodes[0]!.id).toBe(id)
    expect(s.dirty).toBe(true)
  })

  it('setNodePos and moveNodes update positions', () => {
    const id = addPump(0, 0)
    useStore.getState().setNodePos(id, 24, 32)
    expect(activeSheet(useStore.getState()).nodes[0]).toMatchObject({ x: 24, y: 32 })
    useStore.getState().moveNodes([id], 8, -8)
    expect(activeSheet(useStore.getState()).nodes[0]).toMatchObject({ x: 32, y: 24 })
  })

  it('rotateNode cycles through quadrants', () => {
    const id = addPump()
    const s = useStore.getState()
    s.rotateNode(id); s.rotateNode(id); s.rotateNode(id); s.rotateNode(id)
    expect(activeSheet(useStore.getState()).nodes[0]!.rotation).toBe(0)
    useStore.getState().rotateNode(id)
    expect(activeSheet(useStore.getState()).nodes[0]!.rotation).toBe(90)
  })

  it('deleteIds cascades attached edges', () => {
    const a = addPump(0, 0)
    const b = addPump(100, 0)
    const e = useStore.getState().addEdge({
      lineClass: 'process.major',
      source: { nodeId: a, portId: 'out' },
      target: { nodeId: b, portId: 'in' },
    })
    expect(activeSheet(useStore.getState()).edges).toHaveLength(1)
    useStore.getState().deleteIds([a])
    const s = useStore.getState()
    expect(activeSheet(s).nodes).toHaveLength(1)
    expect(activeSheet(s).edges).toHaveLength(0)
    expect(activeSheet(s).edges.find((x) => x.id === e)).toBeUndefined()
  })

  it('deleteSelected deletes the selection and clears it', () => {
    const a = addPump()
    useStore.getState().setSelection([a])
    useStore.getState().deleteSelected()
    const s = useStore.getState()
    expect(activeSheet(s).nodes).toHaveLength(0)
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
    const sheet = activeSheet(useStore.getState())
    useStore.getState().pasteNodes(sheet.nodes, sheet.edges)
    const s = useStore.getState()
    expect(activeSheet(s).nodes).toHaveLength(4)
    expect(activeSheet(s).edges).toHaveLength(2)
    const pasted = activeSheet(s).nodes.slice(2)
    expect(pasted[0]!.id).not.toBe(a)
    expect(pasted[0]!.x).toBe(16)
    expect(pasted[0]!.tag).toBeUndefined()
    const pastedEdge = activeSheet(s).edges[1]!
    expect('nodeId' in pastedEdge.source && pastedEdge.source.nodeId).toBe(pasted[0]!.id)
    expect(s.selection).toEqual(pasted.map((p) => p.id))
  })

  it('undo/redo replay doc changes but not selection', () => {
    const a = addPump()
    useStore.getState().setSelection([a])
    useStore.getState().undo()
    expect(activeSheet(useStore.getState()).nodes).toHaveLength(0)
    useStore.getState().redo()
    expect(activeSheet(useStore.getState()).nodes).toHaveLength(1)
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

describe('multi-sheet', () => {
  beforeEach(reset)

  it('addSheet appends, switches, and scopes actions to the new sheet', () => {
    const s = useStore.getState()
    const firstSheetId = s.activeSheetId
    const id2 = s.addSheet()
    expect(useStore.getState().activeSheetId).toBe(id2)
    addPump()
    const state = useStore.getState()
    expect(activeSheet(state).nodes).toHaveLength(1)
    expect(state.doc.sheets.find((sh) => sh.id === firstSheetId)!.nodes).toHaveLength(0)
  })

  it('deleteSheet refuses the last sheet and reactivates the first', () => {
    const s = useStore.getState()
    s.deleteSheet(s.activeSheetId)
    expect(useStore.getState().doc.sheets).toHaveLength(1)
    const id2 = useStore.getState().addSheet()
    useStore.getState().deleteSheet(id2)
    const state = useStore.getState()
    expect(state.doc.sheets).toHaveLength(1)
    expect(state.activeSheetId).toBe(state.doc.sheets[0]!.id)
  })

  it('renameSheet and setSheetMeta update the right sheet', () => {
    const s = useStore.getState()
    s.renameSheet(s.activeSheetId, 'Overview')
    useStore.getState().setSheetMeta({ drawingNumber: 'PID-7' })
    const sheet = activeSheet(useStore.getState())
    expect(sheet.name).toBe('Overview')
    expect(sheet.drawingNumber).toBe('PID-7')
  })

  it('setNodeLink pairs off-page connectors', () => {
    const s = useStore.getState()
    const a = s.addNode({ symbolId: 'ann.offpage', kind: 'annotation', x: 0, y: 0, rotation: 0 })
    const sheet2 = useStore.getState().addSheet()
    const b = useStore.getState().addNode({ symbolId: 'ann.offpage', kind: 'annotation', x: 0, y: 0, rotation: 0 })
    useStore.getState().setActiveSheet(useStore.getState().doc.sheets[0]!.id)
    useStore.getState().setNodeLink(a, { sheetId: sheet2, nodeId: b })
    expect(activeSheet(useStore.getState()).nodes[0]!.link).toEqual({ sheetId: sheet2, nodeId: b })
  })
})
