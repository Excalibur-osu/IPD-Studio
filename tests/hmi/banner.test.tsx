// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useSimStore } from '../../src/hmi/simStore'
import AlarmBanner from '../../src/hmi/AlarmBanner'
import type { HmiScreen } from '../../src/hmi/model'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [{ id: 't', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1', props: { level0: 97 } }],
  pipes: [],
}

async function mount(el: React.ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(el))
  return host
}

beforeEach(() => {
  document.body.innerHTML = ''
  useSimStore.getState().exitRun()
})

describe('AlarmBanner', () => {
  it('renders nothing without alarms', async () => {
    const host = await mount(<AlarmBanner />)
    expect(host.innerHTML).toBe('')
  })
  it('lists active alarms with ack buttons after a tick raises them', async () => {
    useSimStore.getState().enterRun(screen)
    await act(async () => useSimStore.getState().tickOnce(0.2))
    const host = await mount(<AlarmBanner />)
    expect(host.innerHTML).toContain('TK-1')
    expect(host.innerHTML).toContain('HH')
    expect(host.innerHTML).toContain('hmi-blink')
    expect(host.innerHTML).toContain('data-testid="alarm-ack-all"')
  })
})
