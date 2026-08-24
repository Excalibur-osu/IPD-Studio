import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

beforeEach(() => {
  useStore.getState().loadIntoStore(createEmptyDoc())
})

describe('patchScreen stale-id safety', () => {
  it('falls back to the first screen when activeScreenId is stale', () => {
    const st = useStore.getState()
    st.addScreen()
    st.addScreen()
    // simulate the post-undo situation: the pointed-at screen is gone
    useStore.setState({ activeScreenId: 'no-such-screen' })
    useStore.getState().addWidget({ type: 'pump', x: 0, y: 0, w: 56, h: 56 })
    const s = useStore.getState()
    // the edit lands on the same screen activeHmiScreen() resolves to — not lost
    expect(s.doc.hmiScreens[0]!.widgets).toHaveLength(1)
    expect(s.doc.hmiScreens[1]!.widgets).toHaveLength(0)
  })

  it('is a true no-op with no screens: same doc identity, no undo step', () => {
    const before = useStore.getState().doc
    const undoDepth = useStore.temporal.getState().pastStates.length
    useStore.getState().updateWidget('ghost', { x: 8 })
    expect(useStore.getState().doc).toBe(before)
    expect(useStore.getState().dirty).toBe(false)
    expect(useStore.temporal.getState().pastStates.length).toBe(undoDepth)
  })
})
