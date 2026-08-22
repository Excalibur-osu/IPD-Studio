// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiWorkspace from '../../src/hmi/HmiWorkspace'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// zustand v5 hands server renders the store's INITIAL state, so store-connected
// components must be tested with a real client render (jsdom), not
// renderToStaticMarkup. Pure widgets keep using static markup.
async function mount(el: React.ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(el))
  return { host, root }
}

beforeEach(() => {
  document.body.innerHTML = ''
  useStore.getState().loadIntoStore(createEmptyDoc())
})

describe('HmiWorkspace shell', () => {
  it('shows the empty state when the doc has no screens', async () => {
    const { host } = await mount(<HmiWorkspace onExit={() => {}} />)
    expect(host.innerHTML).toContain('New screen')
    expect(host.innerHTML).toContain('Build from P&amp;ID')
  })
  it('renders screen tabs and the canvas once a screen exists', async () => {
    useStore.getState().addScreen()
    const { host } = await mount(<HmiWorkspace onExit={() => {}} />)
    expect(host.innerHTML).toContain('Screen 1')
    expect(host.innerHTML).toContain('data-testid="hmi-canvas"')
  })
})
