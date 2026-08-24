import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

beforeEach(() => {
  useStore.getState().loadIntoStore(createEmptyDoc())
  useStore.getState().addScreen()
})

describe('addHmiBatch', () => {
  it('adds widgets and pipes in ONE undoable step and returns their ids', () => {
    const st = useStore.getState()
    const before = useStore.temporal.getState().pastStates.length
    const { widgetIds, pipeIds } = st.addHmiBatch(
      [{ type: 'tank', x: 0, y: 0, w: 96, h: 128 }, { type: 'pump', x: 200, y: 0, w: 56, h: 56 }],
      [{ points: [{ x: 0, y: 40 }, { x: 200, y: 40 }] }],
    )
    const sc = useStore.getState().doc.hmiScreens[0]!
    expect(widgetIds).toHaveLength(2)
    expect(pipeIds).toHaveLength(1)
    expect(sc.widgets.map((w) => w.id)).toEqual(widgetIds)
    expect(sc.pipes.map((p) => p.id)).toEqual(pipeIds)
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1)
    useStore.getState().undo()
    const after = useStore.getState().doc.hmiScreens[0]!
    expect(after.widgets).toHaveLength(0)
    expect(after.pipes).toHaveLength(0)
  })
})
