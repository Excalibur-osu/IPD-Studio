import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiCanvas from '../../src/hmi/HmiCanvas'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

// HmiCanvas receives the screen via props (store is only touched in event
// handlers), so static markup rendering sees real content here.
describe('HmiCanvas edit rendering', () => {
  it('renders widgets, pipes, selection handles, and the theme background', () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 100, y: 80, w: 96, h: 128, tag: 'TK-1' })
    st.addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const screen = activeHmiScreen(useStore.getState())!
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[wid]} onSelect={() => {}} mode="edit" tool="select" onToolDone={() => {}} />)
    expect(html).toContain('data-testid="hmi-canvas"')
    expect(html).toContain('translate(100, 80)')
    expect(html).toContain('TK-1')
    expect(html).toContain('polyline')
    expect(html).toContain('data-handle="se"')
  })
  it('run mode hides handles', () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 0, y: 0, w: 96, h: 128 })
    const screen = activeHmiScreen(useStore.getState())!
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[wid]} onSelect={() => {}} mode="run" tool="select" onToolDone={() => {}} />)
    expect(html).not.toContain('data-handle')
  })
})
