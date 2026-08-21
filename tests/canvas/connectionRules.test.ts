import { describe, expect, it } from 'vitest'
import { canConnect } from '../../src/canvas/connectionRules'

describe('canConnect', () => {
  it('process lines need process-capable ports on both ends', () => {
    expect(canConnect('process', 'process', 'process.major')).toBe(true)
    expect(canConnect('process', 'both', 'process.major')).toBe(true)
    expect(canConnect('both', 'both', 'process.minor')).toBe(true)
    expect(canConnect('process', 'signal', 'process.major')).toBe(false)
    expect(canConnect('signal', 'signal', 'process.impulse')).toBe(false)
  })
  it('signal lines need signal-capable ports on both ends', () => {
    expect(canConnect('signal', 'signal', 'signal.electric')).toBe(true)
    expect(canConnect('signal', 'both', 'signal.pneumatic')).toBe(true)
    expect(canConnect('both', 'both', 'link.internal')).toBe(true)
    expect(canConnect('process', 'signal', 'signal.electric')).toBe(false)
    expect(canConnect('process', 'both', 'signal.data')).toBe(false)
  })
  it('impulse lines are process connections', () => {
    expect(canConnect('process', 'both', 'process.impulse')).toBe(true)
  })
})
