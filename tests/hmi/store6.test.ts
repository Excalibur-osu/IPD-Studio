import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import type { HmiScreen } from '../../src/hmi/model'

const sc = (id: string, over: Partial<HmiScreen> = {}): HmiScreen =>
  ({ id, name: id, theme: 'classic', widgets: [], pipes: [], ...over })

const st = () => useStore.getState()

beforeEach(() => st().loadIntoStore(createEmptyDoc()))

describe('addImportedScreens', () => {
  it('appends all screens as ONE undo step and activates the first', () => {
    const before = useStore.temporal.getState().pastStates.length
    st().addImportedScreens([sc('ov', { home: true }), sc('a'), sc('b')])
    const s = useStore.getState()
    expect(s.doc.hmiScreens.map((x) => x.id)).toEqual(['ov', 'a', 'b'])
    expect(s.activeScreenId).toBe('ov')
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1)
    st().undo()
    expect(useStore.getState().doc.hmiScreens).toHaveLength(0)
  })

  it('an incoming home screen takes the star from existing screens', () => {
    const first = st().addScreen()
    st().setHomeScreen(first, true)
    st().addImportedScreens([sc('ov', { home: true })])
    const screens = useStore.getState().doc.hmiScreens
    expect(screens.filter((x) => x.home)).toHaveLength(1)
    expect(screens.find((x) => x.home)!.id).toBe('ov')
  })
})
