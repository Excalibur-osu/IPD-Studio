// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { Tag } from '../model/types'
import {
  FIRST_LETTERS,
  FIRST_MODIFIERS,
  NON_TERMINAL_WORDS,
  SUCCEEDING_LETTERS,
  TERMINAL_ONLY,
  TRAILING_MODIFIERS,
} from './letters'

export interface LetterPart {
  letter: string
  role: 'measured' | 'modifier' | 'function' | 'state'
  word: string
}

export type LettersResult = { ok: true; parts: LetterPart[] } | { ok: false; reason: string; parts: LetterPart[] }

const TAG_RE = /^([A-Za-z]{1,5})-?(\d{1,6})([A-Za-z])?$/

export function parseTag(input: string): Tag | null {
  const m = TAG_RE.exec(input.trim())
  if (!m) return null
  const [, letters, loop, suffix] = m
  if (!letters || !loop) return null
  const tag: Tag = { letters: letters.toUpperCase(), loop }
  if (suffix) tag.suffix = suffix.toUpperCase()
  return tag
}

export function formatTag(tag: Tag, separator: '-' | '' = '-'): string {
  return `${tag.letters}${separator}${tag.loop}${tag.suffix ?? ''}`
}

/**
 * Validate a functional identification letter sequence.
 * Rules (documented simplifications of common industry practice):
 * - 2..5 uppercase letters; first letter must be a measured-variable letter.
 * - Position 2 may be a first-letter modifier when more letters follow;
 *   `S` counts as the Safety modifier only when directly followed by V or E
 *   (PSV, PSE, TSV...) — otherwise S is the Switch function (PSH, LSL...).
 * - Remaining letters must be succeeding-function letters; V and Z terminate.
 * - Trailing H/L/M set-point modifiers allowed after a function letter,
 *   doubled for HH/LL; for position switches, terminal O/C = Open/Closed.
 * - Letter ordering beyond this is not enforced.
 */
export function validateLetters(letters: string): LettersResult {
  const parts: LetterPart[] = []
  if (!letters) return { ok: false, reason: 'Tag letters are empty', parts }
  if (!/^[A-Z]+$/.test(letters)) {
    return { ok: false, reason: 'Tag letters must be uppercase letters only (A–Z)', parts }
  }
  if (letters.length < 2) return { ok: false, reason: 'A tag needs at least two letters', parts }
  if (letters.length > 5) return { ok: false, reason: 'A tag has at most five letters', parts }

  const first = letters[0]!
  const firstWord = FIRST_LETTERS[first]
  if (!firstWord) return { ok: false, reason: `"${first}" is not a measured-variable letter`, parts }
  parts.push({ letter: first, role: 'measured', word: firstWord })

  let i = 1
  const second = letters[1]
  if (
    letters.length > 2 &&
    second &&
    FIRST_MODIFIERS[second] &&
    (second !== 'S' || letters[2] === 'V' || letters[2] === 'E') &&
    (!'XYZ'.includes(second) || 'VZG'.includes(first))
  ) {
    parts.push({ letter: second, role: 'modifier', word: FIRST_MODIFIERS[second]! })
    i = 2
  }

  let sawFunction = false
  let prevFunction = ''
  while (i < letters.length) {
    const ch = letters[i]!
    const rest = letters.length - i - 1

    // Position-switch state: Z...S followed by terminal O or C.
    if (first === 'Z' && prevFunction === 'S' && rest === 0 && (ch === 'O' || ch === 'C')) {
      parts.push({ letter: ch, role: 'state', word: ch === 'O' ? 'Open' : 'Closed' })
      i++
      continue
    }

    // Trailing set-point modifiers (H/L/M), possibly doubled (HH, LL).
    if (sawFunction && TRAILING_MODIFIERS[ch]) {
      let run = ch
      let j = i + 1
      while (j < letters.length && letters[j] === ch && run.length < 2) {
        run += ch
        j++
      }
      if (j < letters.length && !TRAILING_MODIFIERS[letters[j]!]) {
        return {
          ok: false,
          reason: `"${ch}" is only valid as a trailing High/Low/Middle modifier`,
          parts,
        }
      }
      const word = run
        .split('')
        .map((c) => TRAILING_MODIFIERS[c]!)
        .join('-')
      parts.push({ letter: run, role: 'state', word })
      i = j
      continue
    }

    const word = SUCCEEDING_LETTERS[ch]
    if (!word) {
      return { ok: false, reason: `"${ch}" is not a valid succeeding letter here`, parts }
    }
    if (TERMINAL_ONLY.has(ch) && rest > 0) {
      return { ok: false, reason: `"${ch}" must be the final letter`, parts }
    }
    parts.push({ letter: ch, role: 'function', word })
    sawFunction = true
    prevFunction = ch
    i++
  }

  if (!sawFunction && !parts.some((p) => p.role === 'state')) {
    return { ok: false, reason: 'A tag needs at least one function letter', parts }
  }
  return { ok: true, parts }
}

/** Best-effort plain-English expansion, e.g. FIC -> "Flow Indicating Controller". */
export function expandLetters(letters: string): string {
  const result = validateLetters(letters)
  const parts = result.parts
  const lastFunctionIdx = (() => {
    for (let k = parts.length - 1; k >= 0; k--) if (parts[k]!.role === 'function') return k
    return -1
  })()
  const words = parts.map((p, idx) => {
    if (p.role === 'function' && idx !== lastFunctionIdx && NON_TERMINAL_WORDS[p.letter]) {
      return NON_TERMINAL_WORDS[p.letter]!
    }
    return p.word
  })
  return words.join(' ')
}
