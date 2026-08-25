import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

const st = () => useStore.getState()
const screens = () => useStore.getState().doc.hmiScreens

beforeEach(() => {
  st().loadIntoStore(createEmptyDoc())
})

describe('screen management v2', () => {
  it('addScreen never reuses a taken name after deletes', () => {
    const a = st().addScreen() // Screen 1
    st().addScreen() // Screen 2
    st().deleteScreen(a)
    st().addScreen()
    const names = screens().map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('renameScreen dedupes against other screens', () => {
    st().addScreen()
    const b = st().addScreen()
    st().renameScreen(b, 'Screen 1')
    expect(screens()[1]!.name).toBe('Screen 1 2')
  })

  it('setHomeScreen is exclusive and undoable', () => {
    const a = st().addScreen()
    const b = st().addScreen()
    st().setHomeScreen(a, true)
    expect(screens().find((s) => s.id === a)!.home).toBe(true)
    st().setHomeScreen(b, true)
    expect(screens().find((s) => s.id === a)!.home).toBeUndefined()
    expect(screens().find((s) => s.id === b)!.home).toBe(true)
    st().setHomeScreen(b, false)
    expect(screens().every((s) => s.home === undefined)).toBe(true)
  })

  it('reorderScreens moves a screen to the target index', () => {
    const a = st().addScreen()
    st().addScreen()
    const c = st().addScreen()
    st().reorderScreens(c, 0)
    expect(screens().map((s) => s.id)[0]).toBe(c)
    st().reorderScreens(a, 2)
    expect(screens().map((s) => s.id)[2]).toBe(a)
  })

  it('duplicateScreen deep-copies with fresh ids and remaps pipe bindings', () => {
    const a = st().addScreen()
    st().addWidget({ type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1' })
    const pipeId = st().addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    st().addWidget({ type: 'display', x: 200, y: 0, w: 96, h: 40, tag: 'FT-1', props: { bindPipe: pipeId } })
    st().setHomeScreen(a, true)

    const dupId = st().duplicateScreen(a)
    const dup = screens().find((s) => s.id === dupId)!
    const src = screens().find((s) => s.id === a)!
    expect(dup.name).toBe(`${src.name} copy`)
    expect(dup.home).toBeUndefined() // only one home
    expect(dup.widgets).toHaveLength(2)
    expect(dup.widgets.every((w) => !src.widgets.some((sw) => sw.id === w.id))).toBe(true)
    expect(dup.pipes[0]!.id).not.toBe(pipeId)
    const dupDisplay = dup.widgets.find((w) => w.type === 'display')!
    expect(dupDisplay.props?.bindPipe).toBe(dup.pipes[0]!.id) // remapped, not stale
    // mutation isolation
    dup.widgets[0]!.props = { level0: 99 }
    expect(src.widgets[0]!.props).toBeUndefined()
  })
})
