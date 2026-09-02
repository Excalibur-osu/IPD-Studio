// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import type { Rule } from '../rules'
import { finding } from '../rules'
import { formatTag, validateLetters } from '../../isa/tag'
import { getSymbol } from '../../symbols/registry'

export const duplicateTag: Rule = {
  id: 'duplicate-tag',
  title: 'Duplicate tags',
  severity: 'critical',
  discipline: 'tagging',
  why: 'Two objects with one tag means the index, the datasheets and the loop all point at the wrong thing.',
  run(ix) {
    const out = []
    for (const [key, group] of ix.nodesByKey) {
      if (group.length < 2) continue
      // the first wearer keeps the tag; the rest are the duplicates to resolve
      for (const dup of group.slice(1)) {
        out.push(
          finding(duplicateTag, `${key}#${dup.node.id}`, `${key} is used more than once`, {
            targetId: dup.node.id,
            sheetId: dup.sheet.id,
            fix: dup.node.tag
              ? {
                  label: 'Give it the next free number',
                  spec: { kind: 'assign-tag', nodeId: dup.node.id, sheetId: dup.sheet.id, letters: dup.node.tag.letters },
                }
              : undefined,
          }),
        )
      }
    }
    return out
  },
}

export const missingTag: Rule = {
  id: 'missing-tag',
  title: 'Untagged instruments',
  severity: 'warning',
  discipline: 'tagging',
  why: 'An untagged instrument cannot appear in the index, carry a record, or join a loop.',
  run(ix) {
    const out = []
    for (const n of ix.allNodes) {
      if (n.node.kind !== 'instrument' || n.key) continue
      const name = getSymbol(n.node.symbolId).name
      out.push(
        finding(missingTag, n.node.id, `${name} has no tag`, {
          targetId: n.node.id,
          sheetId: n.sheet.id,
        }),
      )
    }
    return out
  },
}

export const invalidLetters: Rule = {
  id: 'invalid-letters',
  title: 'Invalid ISA letters',
  severity: 'critical',
  discipline: 'tagging',
  why: 'A tag that does not parse against ISA-5.1 means the drawing says something no reader can act on.',
  run(ix) {
    const out = []
    for (const n of ix.allNodes) {
      // ISA-5.1 letter tables describe INSTRUMENTS. Equipment is tagged by a
      // different convention entirely — P-101 for a pump, TK-101 for a tank,
      // E-101 for an exchanger — and single-letter prefixes are normal there.
      // Running the instrument tables over equipment flags the app's own
      // bundled HMI template as an error, which is how this was found. The
      // company standard defines the equipment convention (v0.18).
      if (n.node.kind !== 'instrument') continue
      const letters = n.node.tag?.letters
      if (!letters) continue
      const v = validateLetters(letters)
      if (v.ok) continue
      out.push(
        finding(invalidLetters, n.key ?? n.node.id, `${letters}: ${v.reason}`, {
          targetId: n.node.id,
          sheetId: n.sheet.id,
        }),
      )
    }
    return out
  },
}

export const numberingGap: Rule = {
  id: 'tag-numbering-gap',
  title: 'Gaps in tag numbering',
  severity: 'info',
  discipline: 'tagging',
  why: 'Usually harmless, occasionally the trace of an instrument that was deleted and never replaced.',
  run(ix) {
    const byLetters = new Map<string, number[]>()
    for (const n of ix.allNodes) {
      const t = n.node.tag
      if (!t?.letters || !t.loop) continue
      const num = Number(t.loop)
      if (!Number.isFinite(num)) continue
      const list = byLetters.get(t.letters)
      if (list) list.push(num)
      else byLetters.set(t.letters, [num])
    }
    const out = []
    for (const [letters, numbers] of byLetters) {
      if (numbers.length < 3) continue // too few to call anything a gap
      const sorted = [...new Set(numbers)].sort((a, b) => a - b)
      const missing: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        for (let v = sorted[i - 1]! + 1; v < sorted[i]!; v++) {
          missing.push(v)
          if (missing.length > 6) break
        }
        if (missing.length > 6) break
      }
      if (!missing.length) continue
      const shown = missing.slice(0, 6).map((m) => `${letters}-${String(m).padStart(3, '0')}`).join(', ')
      out.push(
        finding(numberingGap, letters, `${letters} numbering skips ${shown}${missing.length > 6 ? '…' : ''}`),
      )
    }
    return out
  },
}

export const valveTagOnBubble: Rule = {
  id: 'valve-tag-on-bubble',
  title: 'Tag and symbol disagree',
  severity: 'info',
  discipline: 'tagging',
  why: 'A valve tag on an instrument bubble usually means the wrong symbol was placed.',
  run(ix) {
    const out = []
    for (const n of ix.allNodes) {
      const t = n.node.tag
      if (n.node.symbolId !== 'instr.bubble' || !t?.letters) continue
      if (t.letters.length < 2 || !t.letters.endsWith('V')) continue
      out.push(
        finding(valveTagOnBubble, n.key ?? n.node.id, `${formatTag(t, '-')} is a valve tag on an instrument bubble — did you mean the valve symbol?`, {
          targetId: n.node.id,
          sheetId: n.sheet.id,
        }),
      )
    }
    return out
  },
}

export const TAGGING_RULES: Rule[] = [duplicateTag, invalidLetters, missingTag, numberingGap, valveTagOnBubble]
