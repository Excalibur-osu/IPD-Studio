import { beforeEach, describe, expect, it } from 'vitest'
import type { HmiPipe, HmiScreen, HmiWidget } from '../../src/hmi/model'
import { clearClipboard, copySelection, hasClipboard, pastePayload } from '../../src/hmi/clipboard'

const screen = (widgets: HmiWidget[], pipes: HmiPipe[] = []): HmiScreen =>
  ({ id: 's1', name: 'S1', theme: 'classic', widgets, pipes })

const tank: HmiWidget = { id: 'w1', type: 'tank', x: 100, y: 100, w: 96, h: 128, tag: 'TK-1', props: { level0: 60 } }
const pump: HmiWidget = { id: 'w2', type: 'pump', x: 300, y: 140, w: 56, h: 56, tag: 'P-1' }
const pipe: HmiPipe = { id: 'p1', points: [{ x: 40, y: 168 }, { x: 300, y: 168 }], width: 5 }

beforeEach(() => clearClipboard())

describe('clipboard', () => {
  it('copies only the selected widgets and pipes', () => {
    copySelection(screen([tank, pump], [pipe]), ['w1', 'p1'])
    expect(hasClipboard()).toBe(true)
    const p = pastePayload({ x: 148, y: 164 })! // paste centered on the copy's own center
    expect(p.widgets).toHaveLength(1)
    expect(p.pipes).toHaveLength(1)
    expect(p.widgets[0]).toMatchObject({ type: 'tank', tag: 'TK-1' })
    expect('id' in p.widgets[0]!).toBe(false)
  })

  it('pastes centered at the cursor, snapped to the grid', () => {
    copySelection(screen([tank]), ['w1'])
    // tank center is (148, 164); ask for (503, 301) -> snapped delta
    const p = pastePayload({ x: 503, y: 301 })!
    const w = p.widgets[0]!
    expect((w.x - tank.x) % 8).toBe(0)
    expect((w.y - tank.y) % 8).toBe(0)
    expect(Math.abs(w.x + w.w / 2 - 503)).toBeLessThanOrEqual(8)
    expect(Math.abs(w.y + w.h / 2 - 301)).toBeLessThanOrEqual(8)
  })

  it('translates pipes with the same delta as widgets', () => {
    copySelection(screen([tank], [pipe]), ['w1', 'p1'])
    const p = pastePayload({ x: 148 + 80, y: 164 + 40 })!
    const w = p.widgets[0]!
    const dx = w.x - tank.x, dy = w.y - tank.y
    expect(p.pipes[0]!.points[0]).toEqual({ x: pipe.points[0]!.x + dx, y: pipe.points[0]!.y + dy })
  })

  it('deep-copies: mutating a paste never touches the source or later pastes', () => {
    copySelection(screen([tank]), ['w1'])
    const a = pastePayload({ x: 148, y: 164 })!
    a.widgets[0]!.props!.level0 = 999
    expect(tank.props!.level0).toBe(60)
    const b = pastePayload({ x: 148, y: 164 })!
    expect(b.widgets[0]!.props!.level0).toBe(60)
  })

  it('repeat pastes at the same cursor stagger by 16', () => {
    copySelection(screen([tank]), ['w1'])
    const a = pastePayload({ x: 148, y: 164 })!
    const b = pastePayload({ x: 148, y: 164 })!
    expect(b.widgets[0]!.x - a.widgets[0]!.x).toBe(16)
    expect(b.widgets[0]!.y - a.widgets[0]!.y).toBe(16)
  })

  it('empty selection copies nothing', () => {
    copySelection(screen([tank]), [])
    expect(hasClipboard()).toBe(false)
    expect(pastePayload({ x: 0, y: 0 })).toBeNull()
  })
})
