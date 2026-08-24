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
  widgets: [
    { id: 'p', type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-1' },
    { id: 't', type: 'tank', x: 200, y: 0, w: 96, h: 128, tag: 'TK-1', props: { level0: 97 } },
  ],
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

describe('journal with commands', () => {
  it('mixes operator commands with alarm events and filters them', async () => {
    const st = useSimStore.getState()
    st.enterRun(screen)
    st.writeTag('P-1', 'RUN', 1)
    st.tickOnce(0.2) // TK-1 at 97 trips its default H/HH
    const host = await mount(<AlarmBanner />)

    const journalToggle = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Journal'))!
    await act(async () => journalToggle.click())
    const panel = () => host.querySelector('[data-testid="alarm-journal"]')!
    expect(panel().innerHTML).toContain('START')
    expect(panel().innerHTML).toContain('ALARM')

    await act(async () => (host.querySelector('[data-testid="journal-commands"]') as HTMLButtonElement).click())
    expect(panel().innerHTML).toContain('START')
    expect(panel().innerHTML).not.toContain('>ALARM<')

    await act(async () => (host.querySelector('[data-testid="journal-alarms"]') as HTMLButtonElement).click())
    expect(panel().innerHTML).not.toContain('START')
    expect(panel().innerHTML).toContain('ALARM')
  })
})
