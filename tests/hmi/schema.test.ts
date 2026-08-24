import { describe, expect, it, vi } from 'vitest'
import { WIDGET_DEFAULT_SIZE, WIDGET_SCHEMA, checkWidgetProps } from '../../src/hmi/model'
import type { HmiWidget, WidgetType } from '../../src/hmi/model'
import { createEmptyDoc } from '../../src/model/doc'
import { loadDoc } from '../../src/model/migrate'

/**
 * The prop-key LEDGER. Every props key any HMI code reads or writes must be
 * listed here AND registered in WIDGET_SCHEMA for the types that use it.
 * Adding a prop in a future phase = add it in both places, deliberately.
 */
const LEDGER = [
  'capacity', 'level0', 'throttle',
  'LL', 'L', 'H', 'HH',
  'unit', 'min', 'max', 'base',
  'bindTank', 'bindPipe', 'controller',
  'symbolId', 'signal', 'writeValue', 'onLabel', 'offLabel', 'screen',
  'spark', 'span',
  'deadband', 'alarmDelay', 'priority',
] as const

describe('WIDGET_SCHEMA', () => {
  it('covers every widget type', () => {
    expect(Object.keys(WIDGET_SCHEMA).sort()).toEqual(Object.keys(WIDGET_DEFAULT_SIZE).sort())
  })

  it('registers every ledger key on at least one type, and nothing off-ledger', () => {
    const registered = new Set<string>()
    for (const schema of Object.values(WIDGET_SCHEMA)) for (const k of Object.keys(schema)) registered.add(k)
    for (const k of LEDGER) expect(registered, `ledger key "${k}" missing from WIDGET_SCHEMA`).toContain(k)
    for (const k of registered) {
      expect(LEDGER as readonly string[], `schema key "${k}" is not in the test ledger`).toContain(k)
    }
  })

  it('places the measurement bundle on all four measurement widgets', () => {
    for (const t of ['display', 'gauge', 'bar', 'trend'] as WidgetType[]) {
      for (const k of ['LL', 'H', 'unit', 'min', 'max', 'controller', 'base', 'bindTank', 'bindPipe']) {
        expect(WIDGET_SCHEMA[t][k], `${t}.${k}`).toBeDefined()
      }
    }
    expect(WIDGET_SCHEMA.tank.capacity).toBe('number')
    expect(WIDGET_SCHEMA.valve.throttle).toBe('boolean')
    expect(WIDGET_SCHEMA.nav.screen).toBe('screenRef')
    expect(WIDGET_SCHEMA.lamp.signal).toBe('signalRef')
  })

  it('checkWidgetProps flags only unknown keys', () => {
    const w = (type: WidgetType, props: HmiWidget['props']): HmiWidget =>
      ({ id: 'x', type, x: 0, y: 0, w: 10, h: 10, props })
    expect(checkWidgetProps(w('display', { unit: '%', controller: true }))).toEqual([])
    expect(checkWidgetProps(w('display', { unit: '%', wat: 1 }))).toEqual(['wat'])
    expect(checkWidgetProps(w('pump', undefined))).toEqual([])
    // a prop legal on one type is still unknown on another
    expect(checkWidgetProps(w('pump', { throttle: true }))).toEqual(['throttle'])
  })
})

describe('loadDoc unknown-prop handling', () => {
  it('warns but never drops unknown widget props (newer docs on older builds)', () => {
    const doc = JSON.parse(JSON.stringify(createEmptyDoc())) as ReturnType<typeof createEmptyDoc>
    doc.hmiScreens = [{
      id: 's1', name: 'S1', theme: 'classic', pipes: [],
      widgets: [{ id: 'w1', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'XI-1', props: { unit: '%', futureProp: 7 } }],
    }]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const loaded = loadDoc(doc)
      expect(warn).toHaveBeenCalledOnce()
      expect(String(warn.mock.calls[0])).toContain('futureProp')
      expect(loaded.hmiScreens[0]!.widgets[0]!.props).toMatchObject({ unit: '%', futureProp: 7 })
    } finally {
      warn.mockRestore()
    }
  })
})
