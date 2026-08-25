import { describe, expect, it } from 'vitest'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'
import { HMI_WORLD } from '../../src/hmi/model'
import { buildOverview, keyTags } from '../../src/hmi/overview'

const W = (type: HmiWidget['type'], tag?: string, props?: HmiWidget['props']): HmiWidget =>
  ({ id: `w-${type}-${tag ?? Math.random()}`, type, x: 0, y: 0, w: 40, h: 40, tag, props })

const screen = (id: string, name: string, widgets: HmiWidget[]): HmiScreen =>
  ({ id, name, theme: 'classic', widgets, pipes: [] })

describe('keyTags', () => {
  it('picks controllers first, then tanks, then flows, deduped and capped', () => {
    const sc = screen('a', 'Feed', [
      W('display', 'XI-1'),
      W('display', 'FT-1', { bindPipe: 'p1' }),
      W('tank', 'TK-1'),
      W('display', 'LIC-1', { controller: true }),
      W('trend', 'LIC-1'), // duplicate tag, different widget
      W('tank', 'TK-2'),
    ])
    expect(keyTags(sc, 3).map((t) => t.tag)).toEqual(['LIC-1', 'TK-1', 'TK-2'])
    expect(keyTags(sc, 4).map((t) => t.tag)).toEqual(['LIC-1', 'TK-1', 'TK-2', 'FT-1'])
  })
  it('screens with nothing tagged yield nothing', () => {
    expect(keyTags(screen('a', 'Empty', [W('label')]))).toEqual([])
  })
  it('pumps and valves never become tile rows — they have no PV to show', () => {
    const sc = screen('a', 'Feed', [W('pump', 'P-1'), W('valve', 'HV-1'), W('tank', 'TK-1')])
    expect(keyTags(sc).map((t) => t.tag)).toEqual(['TK-1'])
  })
})

describe('buildOverview', () => {
  const screens = [
    screen('s1', 'Feed section', [W('display', 'LIC-1', { controller: true }), W('tank', 'TK-1')]),
    screen('s2', 'Storage', [W('tank', 'TK-9')]),
    screen('s3', 'Utilities', []),
  ]
  const ov = buildOverview(screens)

  it('is the home screen, named Plant overview', () => {
    expect(ov.home).toBe(true)
    expect(ov.name).toBe('Plant overview')
    expect(ov.pipes).toEqual([])
  })
  it('builds one titled tile with a nav per source screen', () => {
    const panels = ov.widgets.filter((w) => w.type === 'panel')
    const navs = ov.widgets.filter((w) => w.type === 'nav')
    expect(panels.map((p) => p.label)).toEqual(['Feed section', 'Storage', 'Utilities'])
    expect(navs.map((n) => n.props?.screen)).toEqual(['s1', 's2', 's3'])
    expect(navs.every((n) => typeof n.label === 'string')).toBe(true)
  })
  it('fills tiles with the key displays', () => {
    const displays = ov.widgets.filter((w) => w.type === 'display')
    expect(displays.map((d) => d.tag)).toEqual(['LIC-1', 'TK-1', 'TK-9'])
  })
  it('everything stays inside the world with fresh ids', () => {
    for (const w of ov.widgets) {
      expect(w.x).toBeGreaterThanOrEqual(0)
      expect(w.y).toBeGreaterThanOrEqual(0)
      expect(w.x + w.w).toBeLessThanOrEqual(HMI_WORLD.w)
      expect(w.y + w.h).toBeLessThanOrEqual(HMI_WORLD.h)
    }
    const srcIds = new Set(screens.flatMap((s) => s.widgets.map((w) => w.id)))
    expect(ov.widgets.every((w) => !srcIds.has(w.id))).toBe(true)
  })
  it('widgets inside a tile stay inside that tile', () => {
    const panel = ov.widgets.find((w) => w.type === 'panel' && w.label === 'Feed section')!
    const members = ov.widgets.filter((w) => w.type !== 'panel' &&
      w.x >= panel.x && w.x + w.w <= panel.x + panel.w && w.y >= panel.y && w.y + w.h <= panel.y + panel.h)
    // its 2 displays + its nav
    expect(members.length).toBe(3)
  })
})
