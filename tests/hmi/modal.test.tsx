// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Modal from '../../src/panels/Modal'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function mount(el: React.ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(el))
  return host
}

beforeEach(() => { document.body.innerHTML = '' })

describe('Modal', () => {
  it('renders title and children in the shared card', async () => {
    const host = await mount(<Modal title="Delete screen" onClose={() => {}}><p>body text</p></Modal>)
    expect(host.querySelector('.search-overlay')).toBeTruthy()
    expect(host.querySelector('.datasheet-box')).toBeTruthy()
    expect(host.innerHTML).toContain('Delete screen')
    expect(host.innerHTML).toContain('body text')
  })

  it('Escape and backdrop click close; clicking the card does not', async () => {
    const onClose = vi.fn()
    const host = await mount(<Modal title="T" onClose={onClose}>x</Modal>)
    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => (host.querySelector('.datasheet-box') as HTMLElement).click())
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => (host.querySelector('.search-overlay') as HTMLElement).click())
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
