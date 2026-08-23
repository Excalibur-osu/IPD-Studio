import { describe, expect, it } from 'vitest'
import { hitWidget, marqueeHits, normRect, rectsOverlap } from '../../src/hmi/editGeometry'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'panel', type: 'panel', x: 100, y: 100, w: 300, h: 200, label: 'AREA' },
    { id: 'tank', type: 'tank', x: 160, y: 150, w: 96, h: 128, tag: 'TK-1' },
    { id: 'lab', type: 'label', x: 600, y: 40, w: 96, h: 24 },
  ],
  pipes: [{ id: 'pipe', points: [{ x: 500, y: 500 }, { x: 900, y: 500 }] }],
}

describe('hitWidget with panels', () => {
  it('panel grabs by title strip and border band only', () => {
    expect(hitWidget(screen, { x: 250, y: 110 })?.id).toBe('panel') // title strip
    expect(hitWidget(screen, { x: 104, y: 200 })?.id).toBe('panel') // left band
    expect(hitWidget(screen, { x: 300, y: 200 })).toBeNull() // interior falls through
  })
  it('widgets inside a panel stay clickable', () => {
    expect(hitWidget(screen, { x: 200, y: 200 })?.id).toBe('tank')
  })
  it('operate mode skips panels and labels entirely', () => {
    expect(hitWidget(screen, { x: 250, y: 110 }, { operate: true })).toBeNull()
    expect(hitWidget(screen, { x: 640, y: 50 }, { operate: true })).toBeNull()
    expect(hitWidget(screen, { x: 200, y: 200 }, { operate: true })?.id).toBe('tank')
  })
})

describe('marquee', () => {
  it('normRect normalizes any drag direction', () => {
    expect(normRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 40, h: 60 })
  })
  it('rectsOverlap is strict on touching-only edges', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false)
  })
  it('catches widgets by box overlap and pipes by segment crossing', () => {
    // band over the tank only
    expect(marqueeHits(screen, { x: 150, y: 140, w: 120, h: 150 })).toEqual(['panel', 'tank'])
    // thin vertical band crossing the pipe mid-run (no endpoint inside)
    expect(marqueeHits(screen, { x: 690, y: 480, w: 20, h: 40 })).toEqual(['pipe'])
    // empty corner
    expect(marqueeHits(screen, { x: 1200, y: 800, w: 50, h: 50 })).toEqual([])
  })
})
