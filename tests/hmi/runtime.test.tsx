import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import { useSimStore } from '../../src/hmi/simStore'
import HmiCanvas from '../../src/hmi/HmiCanvas'
import { THEMES } from '../../src/hmi/theme'

beforeEach(() => {
  useStore.getState().loadIntoStore(createEmptyDoc())
  useSimStore.getState().exitRun()
})

describe('runtime canvas bindings', () => {
  it('live values, flow overlay, and alarm outline render from sim props', () => {
    const st = useStore.getState()
    st.addScreen()
    st.addWidget({ type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1' })
    st.addHmiPipe({ points: [{ x: 0, y: 118 }, { x: 510, y: 100 }] })
    const screen = activeHmiScreen(useStore.getState())!
    const pipeId = screen.pipes[0]!.id
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[]} onSelect={() => {}} mode="run" tool="select" onToolDone={() => {}}
        sim={{ 'TK-1': { PV: 76 } }} flows={{ [pipeId]: 5 }}
        alarms={[{ tag: 'TK-1', phase: 'active' }]} />)
    expect(html).toContain('76')
    expect(html).toContain('hmi-flow')
    expect(html).toContain(THEMES.classic.alarm)
    expect(html).toContain('hmi-blink')
  })
})
