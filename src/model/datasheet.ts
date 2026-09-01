// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

export interface DatasheetField {
  key: string
  label: string
}

/** ISA-20-style datasheet field catalog, grouped in form sections. */
export const DATASHEET_SECTIONS: Record<'general' | 'process' | 'element' | 'signal', DatasheetField[]> = {
  general: [
    { key: 'general.service', label: 'Service' },
    { key: 'general.area', label: 'Area / Unit' },
    { key: 'general.line', label: 'Line / Equipment' },
    { key: 'general.pid', label: 'P&ID No.' },
    { key: 'general.manufacturer', label: 'Manufacturer' },
    { key: 'general.model', label: 'Model' },
  ],
  process: [
    { key: 'process.fluid', label: 'Fluid' },
    { key: 'process.phase', label: 'Phase' },
    { key: 'process.flow.min', label: 'Flow min' },
    { key: 'process.flow.norm', label: 'Flow normal' },
    { key: 'process.flow.max', label: 'Flow max' },
    { key: 'process.pressure', label: 'Operating pressure' },
    { key: 'process.temperature', label: 'Operating temperature' },
    { key: 'process.density', label: 'Density / SG' },
    { key: 'process.viscosity', label: 'Viscosity' },
  ],
  element: [
    { key: 'element.type', label: 'Element / body type' },
    { key: 'element.size', label: 'Size / rating' },
    { key: 'element.material', label: 'Material' },
    { key: 'element.connection', label: 'Process connection' },
  ],
  signal: [
    { key: 'signal.output', label: 'Output signal' },
    { key: 'signal.range', label: 'Calibrated range' },
    { key: 'signal.power', label: 'Power supply' },
    { key: 'signal.fail', label: 'Fail action' },
    { key: 'signal.ex', label: 'Hazardous area rating' },
  ],
}

/** Prune sections that make no sense for the instrument's letters. */
export function fieldsFor(letters: string): typeof DATASHEET_SECTIONS {
  const noProcess = letters.startsWith('H') // hand devices
  return {
    general: DATASHEET_SECTIONS.general,
    process: noProcess ? [] : DATASHEET_SECTIONS.process,
    element: DATASHEET_SECTIONS.element,
    signal: DATASHEET_SECTIONS.signal,
  }
}
