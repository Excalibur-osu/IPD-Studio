// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * ISA-5.1-style identification letter tables.
 * Authored independently from public-domain engineering knowledge of the
 * instrument identification lettering conventions; no standard text reproduced.
 */

/** First letter: measured or initiating variable. */
export const FIRST_LETTERS: Record<string, string> = {
  A: 'Analysis',
  B: 'Burner',
  C: "User's Choice",
  D: "User's Choice",
  E: 'Voltage',
  F: 'Flow',
  G: "User's Choice",
  H: 'Hand',
  I: 'Current',
  J: 'Power',
  K: 'Time',
  L: 'Level',
  M: "User's Choice",
  N: "User's Choice",
  O: "User's Choice",
  P: 'Pressure',
  Q: 'Quantity',
  R: 'Radiation',
  S: 'Speed',
  T: 'Temperature',
  U: 'Multivariable',
  V: 'Vibration',
  W: 'Weight',
  X: 'Unclassified',
  Y: 'Event/State',
  Z: 'Position',
}

/** Optional modifier directly after the first letter. */
export const FIRST_MODIFIERS: Record<string, string> = {
  D: 'Differential',
  F: 'Ratio',
  J: 'Scan',
  K: 'Rate-of-Change',
  Q: 'Totalizing',
  S: 'Safety',
  X: 'X-axis',
  Y: 'Y-axis',
  Z: 'Z-axis',
}

/** Succeeding letters: readout / passive and output / active functions. */
export const SUCCEEDING_LETTERS: Record<string, string> = {
  A: 'Alarm',
  B: "User's Choice",
  C: 'Controller',
  E: 'Element',
  G: 'Gauge',
  I: 'Indicator',
  K: 'Control Station',
  L: 'Light',
  N: "User's Choice",
  O: 'Restriction',
  P: 'Test Point',
  R: 'Recorder',
  S: 'Switch',
  T: 'Transmitter',
  U: 'Multifunction',
  V: 'Valve',
  W: 'Well',
  X: 'Unclassified',
  Y: 'Relay',
  Z: 'Actuator',
}

/** Non-terminal (adjective) forms for succeeding letters that change shape. */
export const NON_TERMINAL_WORDS: Record<string, string> = {
  I: 'Indicating',
  R: 'Recording',
  C: 'Control',
}

/** Letters that must terminate the functional sequence. */
export const TERMINAL_ONLY = new Set(['V', 'Z'])

/** Trailing set-point modifiers. */
export const TRAILING_MODIFIERS: Record<string, string> = {
  H: 'High',
  L: 'Low',
  M: 'Middle',
}
