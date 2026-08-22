import { beforeEach, describe, expect, it } from 'vitest'
import { useSimStore } from '../../src/hmi/simStore'
import type { HmiScreen } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-1' },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1', props: { capacity: 50, level0: 88, H: 90 } },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 510, y: 100 }] },
  ],
}

beforeEach(() => useSimStore.getState().exitRun())

describe('simStore', () => {
  it('enterRun compiles and seeds; tickOnce advances time and history', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    expect(st().mode).toBe('run')
    expect(st().tags['TK-1']!.PV).toBe(88)
    st().tickOnce(0.2)
    expect(st().t).toBeCloseTo(0.2)
    expect(st().history['TK-1']).toHaveLength(1)
  })
  it('pump start fills tank through the pipes and raises the H alarm; ack works', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    st().writeTag('P-1', 'RUN', 1)
    st().tickOnce(0.2)
    expect(st().pipeFlows.e1).toBeGreaterThan(0)   // flowing while filling (stops once full)
    for (let i = 0; i < 59; i++) st().tickOnce(0.2)
    expect(st().tags['TK-1']!.PV).toBeGreaterThan(90)
    expect(st().alarms.some((a) => a.id === 'TK-1:H' && a.phase === 'active')).toBe(true)
    st().ack()
    expect(st().alarms[0]!.phase).toBe('acked')
  })
  it('reset restores initial state; writeTag accepts TAG.SIGNAL form', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    st().writeTag('P-1.RUN', '', 1)
    expect(st().tags['P-1']!.RUN).toBe(1)
    for (let i = 0; i < 10; i++) st().tickOnce(0.2)
    st().reset()
    expect(st().t).toBe(0)
    expect(st().tags['TK-1']!.PV).toBe(88)
    expect(st().history['TK-1'] ?? []).toHaveLength(0)
  })
  it('history caps at 600 samples', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    for (let i = 0; i < 650; i++) st().tickOnce(0.2)
    expect(st().history['TK-1']!.length).toBe(600)
  })
})
