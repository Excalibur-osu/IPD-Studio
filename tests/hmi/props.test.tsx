// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiPropertyPanel from '../../src/hmi/HmiPropertyPanel'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function mount(el: React.ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(el))
  return host
}

beforeEach(() => {
  document.body.innerHTML = ''
  useStore.getState().loadIntoStore(createEmptyDoc())
})

describe('HmiPropertyPanel', () => {
  it('shows screen theme select when nothing is selected', async () => {
    useStore.getState().addScreen()
    const host = await mount(<HmiPropertyPanel selection={[]} />)
    expect(host.innerHTML).toContain('Theme')
    expect(host.innerHTML).toContain('classic')
  })
  it('shows tag + geometry + limit fields for a tank', async () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1' })
    const host = await mount(<HmiPropertyPanel selection={[wid]} />)
    expect(host.innerHTML).toContain('TK-1')
    expect(host.innerHTML).toContain('HH')
    expect(host.innerHTML).toContain('Capacity')
  })
  it('shows signal binding for a lamp and width for a pipe', async () => {
    const st = useStore.getState()
    st.addScreen()
    const lid = st.addWidget({ type: 'lamp', x: 0, y: 0, w: 32, h: 32 })
    expect((await mount(<HmiPropertyPanel selection={[lid]} />)).innerHTML).toContain('Signal')
    const pid = st.addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 8, y: 0 }] })
    expect((await mount(<HmiPropertyPanel selection={[pid]} />)).innerHTML).toContain('Width')
  })
})
