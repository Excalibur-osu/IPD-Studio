// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useSimStore } from '../../src/hmi/simStore'
import Faceplate from '../../src/hmi/Faceplate'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-1' },
    { id: 'v', type: 'valve', x: 0, y: 200, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
    { id: 'c', type: 'display', x: 0, y: 400, w: 96, h: 40, tag: 'LIC-1', props: { controller: true } },
  ],
  pipes: [],
}
const w = (id: string): HmiWidget => screen.widgets.find((x) => x.id === id)!

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
  useSimStore.getState().enterRun(screen)
})

describe('Faceplate', () => {
  it('pump faceplate shows Start/Stop and current state', async () => {
    const host = await mount(<Faceplate widget={w('p')} onClose={() => {}} />)
    expect(host.innerHTML).toContain('data-testid="fp-start"')
    expect(host.innerHTML).toContain('data-testid="fp-stop"')
    expect(host.innerHTML).toContain('P-1')
    expect(host.innerHTML).toContain('STOPPED')
  })
  it('throttling valve faceplate exposes an OP slider', async () => {
    const host = await mount(<Faceplate widget={w('v')} onClose={() => {}} />)
    expect(host.innerHTML).toContain('data-testid="fp-op"')
    expect(host.innerHTML).toContain('type="range"')
  })
  it('controller faceplate shows PV/SP/OP + AUTO/MAN', async () => {
    const host = await mount(<Faceplate widget={w('c')} onClose={() => {}} />)
    expect(host.innerHTML).toContain('data-testid="fp-sp"')
    expect(host.innerHTML).toContain('data-testid="fp-auto"')
    expect(host.innerHTML).toContain('data-testid="fp-man"')
  })
  it('writeTag flips pump state and the faceplate reflects it (STARTING → RUNNING)', async () => {
    await act(async () => useSimStore.getState().writeTag('P-1', 'RUN', 1))
    let host = await mount(<Faceplate widget={w('p')} onClose={() => {}} />)
    expect(host.innerHTML).toContain('STARTING') // spin-up ramp in progress
    // ~2s of sim time completes the ramp
    await act(async () => { for (let i = 0; i < 11; i++) useSimStore.getState().tickOnce(0.2) })
    document.body.innerHTML = ''
    host = await mount(<Faceplate widget={w('p')} onClose={() => {}} />)
    expect(host.innerHTML).toContain('RUNNING')
  })
})
