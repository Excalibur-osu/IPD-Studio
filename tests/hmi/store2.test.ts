import { beforeEach, describe, expect, it } from 'vitest'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

beforeEach(() => {
  useStore.getState().loadIntoStore(createEmptyDoc())
  useStore.getState().addScreen()
})

const screen = () => activeHmiScreen(useStore.getState())!

describe('batch widget actions', () => {
  it('addWidgets inserts all in one update and returns ids in order', () => {
    const ids = useStore.getState().addWidgets([
      { type: 'display', x: 0, y: 0, w: 96, h: 40 },
      { type: 'lamp', x: 200, y: 0, w: 32, h: 32 },
    ])
    expect(ids).toHaveLength(2)
    expect(screen().widgets.map((w) => w.id)).toEqual(ids)
  })
  it('updateWidgets patches many widgets at once', () => {
    const st = useStore.getState()
    const ids = st.addWidgets([
      { type: 'display', x: 0, y: 0, w: 96, h: 40 },
      { type: 'display', x: 50, y: 90, w: 96, h: 40 },
    ])
    st.updateWidgets([{ id: ids[0]!, patch: { x: 8 } }, { id: ids[1]!, patch: { x: 8 } }])
    expect(screen().widgets.map((w) => w.x)).toEqual([8, 8])
  })
  it('reorderWidgets front/back preserves relative order of the moved set', () => {
    const st = useStore.getState()
    const [a, b, c] = st.addWidgets([
      { type: 'lamp', x: 0, y: 0, w: 32, h: 32 },
      { type: 'lamp', x: 40, y: 0, w: 32, h: 32 },
      { type: 'lamp', x: 80, y: 0, w: 32, h: 32 },
    ])
    st.reorderWidgets([a!], 'front')
    expect(screen().widgets.map((w) => w.id)).toEqual([b, c, a])
    st.reorderWidgets([c!, a!], 'back')
    expect(screen().widgets.map((w) => w.id)).toEqual([c, a, b])
  })
  it('moveWidgets translates pipes in the selection too', () => {
    const st = useStore.getState()
    const pid = st.addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const wid = st.addWidget({ type: 'lamp', x: 0, y: 50, w: 32, h: 32 })
    st.moveWidgets([pid, wid], 16, 8)
    expect(screen().pipes[0]!.points).toEqual([{ x: 16, y: 8 }, { x: 116, y: 8 }])
    expect(screen().widgets[0]!.x).toBe(16)
  })
})
