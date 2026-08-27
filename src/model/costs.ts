import type { BudgetSettings, PlantNode, ProjectDoc } from './types'
import { getSymbol } from '../symbols/registry'

/**
 * Budgetary (order-of-magnitude) hardware prices in USD — the estimating
 * style of Matches' equipment cost database / AACE Class 5. Real prices vary
 * several-fold with size, material, and rating, so every value here is an
 * EDITABLE DEFAULT: the Budget dialog overrides per project, and each placed
 * component can carry its own exact price. `installFactor` (Lang-style)
 * scales hardware to installed cost.
 */
export interface PriceEntry {
  price: number
  label: string
}

export const DEFAULT_PRICES: Record<string, PriceEntry> = {
  // --- instrument bubbles, classified from ISA tag letters ---
  'instr.element': { price: 400, label: 'Primary element (TE/FE/LE…)' },
  'instr.transmitter': { price: 1500, label: 'Transmitter (FT/PT/LT/TT…)' },
  'instr.indicator': { price: 350, label: 'Local indicator (PI/TI/FI…)' },
  'instr.controller': { price: 2500, label: 'Controller / DCS loop share (FIC…)' },
  'instr.switch': { price: 300, label: 'Process switch (LSH/PSL…)' },
  'instr.converter': { price: 600, label: 'Converter / relay (FY/I-P…)' },
  'instr.recorder': { price: 1200, label: 'Recorder (FR/TR…)' },
  'instr.analyzer': { price: 15000, label: 'Analyzer (AT/AIT/AIC…)' },
  'instr.generic': { price: 800, label: 'Instrument (other)' },

  // --- control & actuated valves ---
  'cv.globe': { price: 4500, label: 'Control valve, globe' },
  'cv.butterfly': { price: 3200, label: 'Control valve, butterfly' },
  'cv.ball': { price: 3800, label: 'Control valve, ball' },
  'valve.solenoid': { price: 700, label: 'Solenoid valve (XV)' },
  'valve.mov': { price: 3500, label: 'Motor-operated valve' },

  // --- manual valves ---
  'valve.gate': { price: 350, label: 'Gate valve' },
  'valve.globe': { price: 450, label: 'Globe valve' },
  'valve.ball': { price: 250, label: 'Ball valve' },
  'valve.butterfly': { price: 300, label: 'Butterfly valve' },
  'valve.plug': { price: 400, label: 'Plug valve' },
  'valve.needle': { price: 150, label: 'Needle valve' },
  'valve.diaphragm': { price: 500, label: 'Diaphragm valve' },
  'valve.check': { price: 250, label: 'Check valve' },
  'valve.ballcheck': { price: 280, label: 'Ball check valve' },
  'valve.pinch': { price: 450, label: 'Pinch valve' },
  'valve.stopcheck': { price: 550, label: 'Stop-check valve' },
  'valve.knife': { price: 600, label: 'Knife gate valve' },
  'valve.threeway': { price: 650, label: '3-way valve' },
  'valve.fourway': { price: 900, label: '4-way valve' },
  'valve.angle': { price: 400, label: 'Angle valve' },
  'valve.foot': { price: 200, label: 'Foot valve' },
  'valve.float': { price: 250, label: 'Float valve' },

  // --- safety & relief ---
  psv: { price: 1800, label: 'Pressure safety valve' },
  pse: { price: 600, label: 'Rupture disc' },
  'psv.pilot': { price: 3500, label: 'Pilot-operated PSV' },
  pvsv: { price: 2200, label: 'P/V conservation vent' },
  'pcv.self': { price: 1200, label: 'Self-acting PCV' },
  'tcv.self': { price: 1100, label: 'Self-acting TCV' },
  bpcv: { price: 1400, label: 'Back-pressure valve' },
  'flame-arrestor': { price: 900, label: 'Flame arrestor' },
  breather: { price: 500, label: 'Breather valve' },
  'vacuum-breaker': { price: 400, label: 'Vacuum breaker' },

  // --- flow elements ---
  'fe.orifice': { price: 800, label: 'Orifice plate + flanges' },
  'fe.venturi': { price: 2500, label: 'Venturi tube' },
  'fe.magmeter': { price: 3500, label: 'Magnetic flow meter' },
  'fe.coriolis': { price: 9000, label: 'Coriolis meter' },
  'fe.vortex': { price: 2800, label: 'Vortex meter' },
  'fe.turbine': { price: 2000, label: 'Turbine meter' },
  'fe.rotameter': { price: 400, label: 'Rotameter' },
  'fe.ultrasonic': { price: 4500, label: 'Ultrasonic meter' },
  'fe.thermal': { price: 2500, label: 'Thermal mass meter' },
  'fe.pd': { price: 2200, label: 'PD meter' },
  'fe.pitot': { price: 900, label: 'Pitot / averaging pitot' },
  'fe.avgpitot': { price: 1100, label: 'Averaging pitot' },
  'fe.ro': { price: 300, label: 'Restriction orifice' },
  'fe.nozzle': { price: 1200, label: 'Flow nozzle' },

  // --- rotating ---
  'pump.centrifugal': { price: 4500, label: 'Centrifugal pump' },
  'pump.gear': { price: 3500, label: 'PD pump (gear/screw)' },
  'pump.diaphragm': { price: 2800, label: 'Diaphragm pump' },
  'pump.peristaltic': { price: 3200, label: 'Peristaltic pump' },
  'pump.plunger': { price: 5500, label: 'Plunger pump' },
  'pump.submersible': { price: 3000, label: 'Submersible pump' },
  'pump.vacuum': { price: 6500, label: 'Vacuum pump' },
  ejector: { price: 1500, label: 'Ejector / eductor' },
  'comp.centrifugal': { price: 85000, label: 'Centrifugal compressor' },
  'comp.recip': { price: 60000, label: 'Reciprocating compressor' },
  'comp.screw': { price: 45000, label: 'Screw compressor' },
  blower: { price: 6000, label: 'Blower' },
  fan: { price: 3500, label: 'Fan' },
  agitator: { price: 8000, label: 'Agitator' },
  motor: { price: 2500, label: 'Electric motor' },
  vfd: { price: 3000, label: 'VFD' },
  'turbine.steam': { price: 120000, label: 'Steam turbine' },

  // --- vessels ---
  'vessel.vertical': { price: 15000, label: 'Vertical vessel' },
  'vessel.horizontal': { price: 18000, label: 'Horizontal vessel' },
  'vessel.tank': { price: 25000, label: 'Storage tank' },
  'vessel.column-tray': { price: 90000, label: 'Trayed column' },
  'vessel.column-packed': { price: 70000, label: 'Packed column' },
  'vessel.cstr': { price: 60000, label: 'Stirred reactor' },
  'vessel.ko-drum': { price: 20000, label: 'KO drum' },
  'vessel.floating-roof': { price: 120000, label: 'Floating-roof tank' },
  'vessel.sphere': { price: 250000, label: 'Sphere' },
  'vessel.bullet': { price: 80000, label: 'Bullet' },
  'vessel.open': { price: 9000, label: 'Open tank' },
  'vessel.silo': { price: 30000, label: 'Silo' },
  'vessel.fixedbed': { price: 45000, label: 'Fixed-bed reactor' },
  'vessel.sep3': { price: 35000, label: '3-phase separator' },
  cyclone: { price: 8000, label: 'Cyclone' },

  // --- heat transfer ---
  'hx.shell-tube': { price: 18000, label: 'Shell & tube exchanger' },
  'hx.plate': { price: 12000, label: 'Plate exchanger' },
  'hx.air-cooler': { price: 35000, label: 'Air cooler' },
  'hx.kettle': { price: 30000, label: 'Kettle reboiler' },
  'hx.doublepipe': { price: 7000, label: 'Double-pipe exchanger' },
  'hx.condenser': { price: 20000, label: 'Condenser' },
  'hx.coil': { price: 1500, label: 'Heating/cooling coil' },
  'heater.electric': { price: 6000, label: 'Electric heater' },
  'heater.fired': { price: 150000, label: 'Fired heater' },
  'cooling-tower': { price: 45000, label: 'Cooling tower' },

  // --- utilities & packages ---
  boiler: { price: 90000, label: 'Boiler' },
  flare: { price: 60000, label: 'Flare' },
  stack: { price: 25000, label: 'Stack' },
  chiller: { price: 35000, label: 'Chiller' },
  deaerator: { price: 30000, label: 'Deaerator' },
  'air-dryer': { price: 9000, label: 'Air dryer' },
  'package-unit': { price: 50000, label: 'Package unit' },
  'filter-sep': { price: 7000, label: 'Filter separator' },
  'elec.mcc': { price: 25000, label: 'MCC' },
  'elec.transformer': { price: 20000, label: 'Transformer' },
  'elec.ups': { price: 8000, label: 'UPS' },
  'elec.barrier': { price: 400, label: 'IS barrier' },

  // --- category fallbacks (anything not listed above) ---
  'cat.valves': { price: 350, label: 'Valve (other)' },
  'cat.control-valves': { price: 4000, label: 'Control valve (other)' },
  'cat.safety': { price: 1200, label: 'Safety device (other)' },
  'cat.flow-elements': { price: 1500, label: 'Flow element (other)' },
  'cat.accessories': { price: 300, label: 'Instrument accessory' },
  'cat.rotating': { price: 5000, label: 'Rotating equipment (other)' },
  'cat.vessels': { price: 20000, label: 'Vessel (other)' },
  'cat.heat': { price: 15000, label: 'Heat transfer (other)' },
  'cat.inline': { price: 250, label: 'Fitting / inline item' },
  'cat.control': { price: 1500, label: 'Control hardware' },
  'cat.instruments': { price: 800, label: 'Instrument (other)' },
  'cat.custom': { price: 1000, label: 'Custom symbol' },
}

/** ISA-letter classification for the generic instrument bubble. */
function instrumentKey(letters: string): string {
  if (letters.startsWith('A')) return 'instr.analyzer'
  if (/S[HL]*$/.test(letters) && letters.length > 1) return 'instr.switch'
  if (letters.endsWith('Y')) return 'instr.converter'
  if (letters.includes('C') && !letters.endsWith('V')) return 'instr.controller'
  if (letters.endsWith('T')) return 'instr.transmitter'
  if (letters.endsWith('R')) return 'instr.recorder'
  if (letters.endsWith('E')) return 'instr.element'
  if (letters.endsWith('I') || letters.endsWith('G')) return 'instr.indicator'
  return 'instr.generic'
}

/** The pricing bucket a node belongs to. Annotations cost nothing. */
export function priceKeyFor(node: PlantNode): string | null {
  if (node.kind === 'annotation') return null
  if (node.kind === 'instrument') {
    const letters = node.tag?.letters ?? ''
    if (node.symbolId === 'instr.bubble' || /^[A-Z]{1,4}$/.test(letters)) {
      return letters ? instrumentKey(letters) : 'instr.generic'
    }
  }
  if (DEFAULT_PRICES[node.symbolId]) return node.symbolId
  try {
    return `cat.${getSymbol(node.symbolId).category}`
  } catch {
    return 'cat.custom'
  }
}

/** Unit price: per-node exact cost → project override → default table. */
export function unitCost(node: PlantNode, budget?: BudgetSettings): number {
  if (typeof node.cost === 'number' && Number.isFinite(node.cost)) return node.cost
  const key = priceKeyFor(node)
  if (key === null) return 0
  const override = budget?.overrides?.[key]
  if (typeof override === 'number' && Number.isFinite(override)) return override
  return DEFAULT_PRICES[key]?.price ?? 0
}

export interface CostLine {
  key: string
  label: string
  count: number
  unit: number
  subtotal: number
}
export interface CostReport {
  /** Hardware subtotal (no factor). */
  hardware: number
  /** hardware × installFactor. */
  total: number
  lines: CostLine[]
  /** Nodes with no price anywhere (excluded annotations don't count). */
  unpriced: number
}

/** Whole-project estimate across every sheet, grouped by price bucket.
 *  Nodes with a per-node cost group under their bucket at their own price
 *  (mixed prices in one bucket show the summed subtotal; unit = '—' case
 *  is handled by the dialog). */
export function projectCost(doc: ProjectDoc): CostReport {
  const budget = doc.budget
  const byKey = new Map<string, CostLine>()
  let unpriced = 0
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) {
      const key = priceKeyFor(node)
      if (key === null) continue
      const cost = unitCost(node, budget)
      if (cost === 0 && node.cost === undefined) unpriced++
      const entry = DEFAULT_PRICES[key]
      const line = byKey.get(key) ?? {
        key,
        label: entry?.label ?? key,
        count: 0,
        unit: budget?.overrides?.[key] ?? entry?.price ?? 0,
        subtotal: 0,
      }
      line.count++
      line.subtotal += cost
      byKey.set(key, line)
    }
  }
  const lines = [...byKey.values()].sort((a, b) => b.subtotal - a.subtotal)
  const hardware = lines.reduce((s, l) => s + l.subtotal, 0)
  const factor = budget?.installFactor ?? 1
  return { hardware, total: hardware * factor, lines, unpriced }
}

/** Compact money formatting for the status bar: 12400 -> "12.4k". */
export function fmtMoney(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (v >= 1e4) return `${(v / 1e3).toFixed(0)}k`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return String(Math.round(v))
}
