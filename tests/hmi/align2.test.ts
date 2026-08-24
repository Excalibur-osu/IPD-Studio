import { describe, expect, it } from 'vitest'
import { duplicateWidgets } from '../../src/hmi/align'
import type { HmiWidget } from '../../src/hmi/model'

describe('duplicateWidgets deep copy', () => {
  it('clones props AND pens — mutating the copy never touches the source', () => {
    const src: HmiWidget = {
      id: 'w1', type: 'trend', x: 0, y: 0, w: 192, h: 96, tag: 'FT-1',
      props: { min: 0, max: 100 },
      pens: [{ ref: 'LIC-1.SP', color: '#fff' }],
    }
    const [copy] = duplicateWidgets([src])
    copy!.pens![0]!.ref = 'HACKED'
    ;(copy!.props as Record<string, number>).max = 999
    expect(src.pens![0]!.ref).toBe('LIC-1.SP')
    expect(src.props!.max).toBe(100)
    expect(copy!.x).toBe(16)
  })
})
