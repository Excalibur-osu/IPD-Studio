import { describe, expect, it } from 'vitest'
import { snap8, hitWidget, hitPipe, resizeRect, handlePoint } from '../../src/hmi/editGeometry'
import type { HmiScreen } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'a', type: 'tank', x: 0, y: 0, w: 100, h: 100 },
    { id: 'b', type: 'pump', x: 50, y: 50, w: 100, h: 100 },
  ],
  pipes: [{ id: 'p', points: [{ x: 200, y: 0 }, { x: 200, y: 300 }] }],
}

describe('editGeometry', () => {
  it('snap8 rounds to the 8px grid', () => {
    expect(snap8(11)).toBe(8)
    expect(snap8(12.1)).toBe(16)
    expect(snap8(-3)).toBe(0)
  })
  it('hitWidget returns topmost (later array wins) and null outside', () => {
    expect(hitWidget(screen, { x: 75, y: 75 })!.id).toBe('b')
    expect(hitWidget(screen, { x: 10, y: 10 })!.id).toBe('a')
    expect(hitWidget(screen, { x: 400, y: 400 })).toBeNull()
  })
  it('hitPipe uses segment distance with tolerance', () => {
    expect(hitPipe(screen, { x: 204, y: 150 })!.id).toBe('p')
    expect(hitPipe(screen, { x: 220, y: 150 })).toBeNull()
  })
  it('resizeRect drags handles with a minimum size', () => {
    const r = { x: 0, y: 0, w: 100, h: 100 }
    expect(resizeRect(r, 'se', 20, 12)).toEqual({ x: 0, y: 0, w: 120, h: 112 })
    expect(resizeRect(r, 'nw', 30, 40)).toEqual({ x: 30, y: 40, w: 70, h: 60 })
    expect(resizeRect(r, 'e', -200, 0).w).toBe(16)
  })
  it('handlePoint locates corner and edge handles', () => {
    expect(handlePoint({ x: 0, y: 0, w: 100, h: 100 }, 'se')).toEqual({ x: 100, y: 100 })
    expect(handlePoint({ x: 0, y: 0, w: 100, h: 100 }, 'n')).toEqual({ x: 50, y: 0 })
  })
})
