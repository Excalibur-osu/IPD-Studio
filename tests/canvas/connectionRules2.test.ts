import { describe, expect, it } from 'vitest'
import { compatibleKinds, pickLineClass } from '../../src/canvas/connectionRules'

describe('compatibleKinds', () => {
  it('accepts any pairing that some line class could join', () => {
    expect(compatibleKinds('process', 'process')).toBe(true)
    expect(compatibleKinds('signal', 'signal')).toBe(true)
    expect(compatibleKinds('both', 'process')).toBe(true)
    expect(compatibleKinds('both', 'signal')).toBe(true)
    expect(compatibleKinds('both', 'both')).toBe(true)
  })
  it('refuses strictly mixed pairs', () => {
    expect(compatibleKinds('process', 'signal')).toBe(false)
    expect(compatibleKinds('signal', 'process')).toBe(false)
  })
})

describe('pickLineClass', () => {
  it('keeps the active class when it fits both ports', () => {
    expect(pickLineClass('process', 'process', 'pipe.jacketed')).toBe('pipe.jacketed')
    expect(pickLineClass('signal', 'both', 'signal.pneumatic')).toBe('signal.pneumatic')
    expect(pickLineClass('both', 'both', 'process.minor')).toBe('process.minor')
  })
  it('switches to a signal default when a signal port meets a process class', () => {
    // controller bubble (both) -> valve actuator (signal) while toolbar says process.major
    expect(pickLineClass('both', 'signal', 'process.major')).toBe('signal.electric')
    expect(pickLineClass('signal', 'signal', 'pipe.traced')).toBe('signal.electric')
  })
  it('switches to process.major when process-only ports meet a signal class', () => {
    expect(pickLineClass('process', 'process', 'signal.electric')).toBe('process.major')
    expect(pickLineClass('process', 'both', 'signal.data')).toBe('process.major')
  })
  it('both/both stays with the active class in either family', () => {
    expect(pickLineClass('both', 'both', 'signal.electric')).toBe('signal.electric')
    expect(pickLineClass('both', 'both', 'process.major')).toBe('process.major')
  })
  it('free ends (null) leave the active class alone', () => {
    expect(pickLineClass('process', null, 'process.major')).toBe('process.major')
    expect(pickLineClass(null, 'signal', 'process.major')).toBe('signal.electric')
    expect(pickLineClass(null, null, 'signal.pneumatic')).toBe('signal.pneumatic')
  })
})
