import { describe, expect, it } from 'vitest'
import { isProcessClass, LINE_STROKES, LINE_CLASS_LABELS } from '../../src/canvas/lineStyle'
import { GLYPHS } from '../../src/canvas/glyphs'
import { canConnect } from '../../src/canvas/connectionRules'
import type { LineClass } from '../../src/model/types'

const NEW_CLASSES: LineClass[] = ['signal.em', 'pipe.jacketed', 'pipe.traced', 'pipe.existing', 'pipe.underground', 'pipe.battery-limit']

describe('phase-2 line classes', () => {
  it('all 16 classes have strokes, labels, glyph entries', () => {
    expect(Object.keys(LINE_STROKES)).toHaveLength(16)
    for (const cls of NEW_CLASSES) {
      expect(LINE_STROKES[cls]).toBeDefined()
      expect(LINE_CLASS_LABELS[cls]).toBeDefined()
      expect(cls in GLYPHS).toBe(true)
    }
  })
  it('pipe.* classes are process-side', () => {
    expect(isProcessClass('pipe.jacketed')).toBe(true)
    expect(isProcessClass('process.major')).toBe(true)
    expect(isProcessClass('signal.em')).toBe(false)
    expect(canConnect('process', 'process', 'pipe.jacketed')).toBe(true)
    expect(canConnect('signal', 'signal', 'pipe.underground')).toBe(false)
    expect(canConnect('signal', 'both', 'signal.em')).toBe(true)
  })
  it('jacketed is double-line, em has wave glyphs', () => {
    expect(LINE_STROKES['pipe.jacketed'].double).toBe(true)
    expect(GLYPHS['signal.em']).not.toBeNull()
    expect(GLYPHS['pipe.jacketed']).toBeNull()
  })
})
