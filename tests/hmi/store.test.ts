import { beforeEach, describe, expect, it } from 'vitest'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

describe('hmi store slice', () => {
  it('adds, renames, deletes screens and tracks the active one', () => {
    const st = () => useStore.getState()
    expect(st().activeScreenId).toBeNull()
    const id = st().addScreen()
    expect(st().activeScreenId).toBe(id)
    st().renameScreen(id, 'Overview')
    expect(activeHmiScreen(st())!.name).toBe('Overview')
    const id2 = st().addScreen()
    st().deleteScreen(id2)
    expect(st().activeScreenId).toBe(id)
    st().deleteScreen(id)
    expect(st().activeScreenId).toBeNull()
  })

  it('widget CRUD + move + delete are undoable', () => {
    const st = () => useStore.getState()
    st().addScreen()
    const wid = st().addWidget({ type: 'tank', x: 16, y: 16, w: 96, h: 128 })
    st().updateWidget(wid, { tag: 'TK-1' })
    st().moveWidgets([wid], 8, 16)
    const w = () => activeHmiScreen(st())!.widgets[0]
    expect(w()).toMatchObject({ tag: 'TK-1', x: 24, y: 32 })
    st().deleteHmiIds([wid])
    expect(activeHmiScreen(st())!.widgets).toHaveLength(0)
    st().undo()
    expect(activeHmiScreen(st())!.widgets).toHaveLength(1)
  })

  it('pipe CRUD and mixed delete', () => {
    const st = () => useStore.getState()
    st().addScreen()
    const pid = st().addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 80, y: 0 }] })
    st().updateHmiPipe(pid, { width: 6 })
    expect(activeHmiScreen(st())!.pipes[0]!.width).toBe(6)
    st().deleteHmiIds([pid])
    expect(activeHmiScreen(st())!.pipes).toHaveLength(0)
  })

  it('replaceScreen swaps content by id (re-import)', () => {
    const st = () => useStore.getState()
    const id = st().addScreen()
    st().replaceScreen({ id, name: 'HMI', theme: 'classic', widgets: [], pipes: [], fromSheetId: 'sh1' })
    expect(activeHmiScreen(st())!.fromSheetId).toBe('sh1')
  })

  it('setScreenTheme and addImportedScreen work', () => {
    const st = () => useStore.getState()
    const id = st().addScreen()
    st().setScreenTheme(id, 'hp')
    expect(activeHmiScreen(st())!.theme).toBe('hp')
    st().addImportedScreen({ id: 'imp1', name: 'Imported', theme: 'classic', widgets: [], pipes: [], fromSheetId: 's' })
    expect(st().activeScreenId).toBe('imp1')
  })
})
