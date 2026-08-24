import { describe, expect, it } from 'vitest'
import type { CommandEvent, JournalEntry } from '../../src/hmi/sim/alarms'
import { commandText, pushCommand } from '../../src/hmi/sim/commands'

const cmd = (t: number, tag: string, sig: string, from: number, to: number): CommandEvent =>
  ({ t, tag, what: 'CMD', sig, from, to })

describe('commandText', () => {
  it('speaks operator language per signal', () => {
    expect(commandText(cmd(0, 'P-1', 'RUN', 0, 1))).toBe('START')
    expect(commandText(cmd(0, 'P-1', 'RUN', 1, 0))).toBe('STOP')
    expect(commandText(cmd(0, 'HV-1', 'OPEN', 0, 1))).toBe('OPEN')
    expect(commandText(cmd(0, 'HV-1', 'OPEN', 1, 0))).toBe('CLOSE')
    expect(commandText(cmd(0, 'LIC-1', 'MODE', 1, 0))).toBe('MAN')
    expect(commandText(cmd(0, 'LIC-1', 'MODE', 0, 1))).toBe('AUTO')
    expect(commandText(cmd(0, 'LIC-1', 'SP', 50, 60))).toBe('SP 50 → 60')
    expect(commandText(cmd(0, 'LIC-1', 'OP', 40, 62.5))).toBe('OP 40 → 62.5')
    expect(commandText(cmd(0, 'X-1', 'FOO', 0, 5))).toBe('FOO = 5')
  })
})

describe('pushCommand', () => {
  it('appends newest-first and enforces the cap', () => {
    let j: JournalEntry[] = []
    j = pushCommand(j, cmd(1, 'P-1', 'RUN', 0, 1), 3)
    j = pushCommand(j, cmd(10, 'HV-1', 'OPEN', 0, 1), 3)
    expect(j.map((e) => e.tag)).toEqual(['HV-1', 'P-1'])
    j = pushCommand(j, cmd(20, 'P-2', 'RUN', 0, 1), 3)
    j = pushCommand(j, cmd(30, 'P-3', 'RUN', 0, 1), 3)
    expect(j).toHaveLength(3)
    expect(j[0]!.tag).toBe('P-3')
  })

  it('coalesces a slider burst: same tag+signal within 2s keeps the original "from"', () => {
    let j: JournalEntry[] = []
    j = pushCommand(j, cmd(5.0, 'LIC-1', 'SP', 50, 52), 10)
    j = pushCommand(j, cmd(5.4, 'LIC-1', 'SP', 52, 55), 10)
    j = pushCommand(j, cmd(6.0, 'LIC-1', 'SP', 55, 60), 10)
    expect(j).toHaveLength(1)
    const e = j[0] as CommandEvent
    expect(e.from).toBe(50)
    expect(e.to).toBe(60)
    expect(e.t).toBe(6.0)
    // a different signal, or a gap, starts a fresh entry
    j = pushCommand(j, cmd(6.2, 'LIC-1', 'MODE', 1, 0), 10)
    j = pushCommand(j, cmd(9.0, 'LIC-1', 'MODE', 0, 1), 10)
    expect(j).toHaveLength(3)
  })
})
