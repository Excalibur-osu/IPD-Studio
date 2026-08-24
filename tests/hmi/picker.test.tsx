// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import type { PlantNode } from '../../src/model/types'
import HmiPropertyPanel from '../../src/hmi/HmiPropertyPanel'
import '../../src/symbols/lib/index'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function mount(el: React.ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(el))
  return host
}

const bubble = (id: string, letters: string, loop: string): PlantNode =>
  ({ id, symbolId: 'instr.bubble', kind: 'instrument', x: 0, y: 0, rotation: 0, tag: { letters, loop } })

function loadWithPlant(nodes: PlantNode[]) {
  const doc = createEmptyDoc()
  doc.sheets[0] = { ...doc.sheets[0]!, nodes }
  useStore.getState().loadIntoStore(doc)
}

const fire = (el: Element, type: string) =>
  act(async () => { el.dispatchEvent(new window.Event(type, { bubbles: true })) })

beforeEach(() => {
  document.body.innerHTML = ''
  loadWithPlant([])
})

describe('TagPicker in the property panel', () => {
  it('offers plant tags on focus and commits a pick to the widget', async () => {
    loadWithPlant([bubble('n1', 'FT', '101')])
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'display', x: 0, y: 0, w: 96, h: 40 })
    const host = await mount(<HmiPropertyPanel selection={[wid]} />)

    const input = host.querySelector('[data-testid="prop-tag"]') as HTMLInputElement
    await act(async () => input.focus())
    expect(host.innerHTML).toContain('Flow Transmitter')

    const item = [...host.querySelectorAll('.hmi-combo-item')].find((el) => el.textContent?.includes('FT-101'))!
    await fire(item, 'pointerdown')
    const w = useStore.getState().doc.hmiScreens[0]!.widgets[0]!
    expect(w.tag).toBe('FT-101')
  })

  it('keeps free text legal: typing + blur commits verbatim', async () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'display', x: 0, y: 0, w: 96, h: 40 })
    const host = await mount(<HmiPropertyPanel selection={[wid]} />)
    const input = host.querySelector('[data-testid="prop-tag"]') as HTMLInputElement
    await act(async () => {
      input.focus()
      // React reads the value through its own tracker; set via the native setter
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      set.call(input, 'MY-99')
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    // React delegates onBlur through focusout
    await fire(input, 'focusout')
    expect(useStore.getState().doc.hmiScreens[0]!.widgets[0]!.tag).toBe('MY-99')
  })
})

describe('value-source rows', () => {
  it('controller checkbox sets props.controller and swaps the hint text', async () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'LIC-1' })
    const host = await mount(<HmiPropertyPanel selection={[wid]} />)
    expect(host.innerHTML).toContain('Bind tank')

    const box = host.querySelector('[data-testid="prop-controller"]') as HTMLInputElement
    await act(async () => box.click())
    expect(useStore.getState().doc.hmiScreens[0]!.widgets[0]!.props?.controller).toBe(true)
  })

  it('pick buttons arm the pick and reflect the armed state', async () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'display', x: 0, y: 0, w: 96, h: 40 })
    const onArmPick = vi.fn()
    let host = await mount(<HmiPropertyPanel selection={[wid]} onArmPick={onArmPick} />)
    ;(host.querySelector('[data-testid="pick-bindTank"]') as HTMLButtonElement).click()
    expect(onArmPick).toHaveBeenCalledWith({ kind: 'tank', widgetId: wid })

    document.body.innerHTML = ''
    host = await mount(<HmiPropertyPanel selection={[wid]} armedPick={{ kind: 'pipe', widgetId: wid }} onArmPick={onArmPick} />)
    expect((host.querySelector('[data-testid="pick-bindPipe"]') as HTMLButtonElement).textContent).toContain('click canvas')
  })

  it('clear button removes the binding', async () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'display', x: 0, y: 0, w: 96, h: 40, props: { bindTank: 'TK-1' } })
    const host = await mount(<HmiPropertyPanel selection={[wid]} />)
    expect(host.innerHTML).toContain('TK-1')
    const clear = [...host.querySelectorAll('button')].find((b) => b.title === 'Clear binding')!
    await act(async () => clear.click())
    expect(useStore.getState().doc.hmiScreens[0]!.widgets[0]!.props?.bindTank).toBeUndefined()
  })
})

describe('SignalPicker', () => {
  it('offers widget-derived TAG.SIGNAL refs and commits a pick', async () => {
    const st = useStore.getState()
    st.addScreen()
    st.addWidget({ type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-9' })
    const lid = st.addWidget({ type: 'lamp', x: 0, y: 0, w: 32, h: 32 })
    const host = await mount(<HmiPropertyPanel selection={[lid]} />)
    const input = host.querySelector('[data-testid="prop-signal"]') as HTMLInputElement
    await act(async () => input.focus())
    const item = [...host.querySelectorAll('.hmi-combo-item')].find((el) => el.textContent?.includes('P-9.RUN'))!
    await fire(item, 'pointerdown')
    expect(useStore.getState().doc.hmiScreens[0]!.widgets[1]!.props?.signal).toBe('P-9.RUN')
  })
})
