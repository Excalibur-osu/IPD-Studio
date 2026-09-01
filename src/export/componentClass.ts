// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/** Pragmatic symbol-id -> Proteus/DEXPI ComponentClass mapping. */
const MAP: Record<string, string> = {
  'instr.bubble': 'ProcessInstrument',
  // valves
  'valve.gate': 'GateValve',
  'valve.globe': 'GlobeValve',
  'valve.ball': 'BallValve',
  'valve.butterfly': 'ButterflyValve',
  'valve.plug': 'PlugValve',
  'valve.needle': 'NeedleValve',
  'valve.diaphragm': 'DiaphragmValve',
  'valve.pinch': 'PinchValve',
  'valve.check': 'CheckValve',
  'valve.stopcheck': 'CheckValve',
  'valve.threeway': 'Valve',
  'valve.fourway': 'Valve',
  'valve.angle': 'AngleValve',
  'valve.knife': 'GateValve',
  'cv.globe': 'ControlValve',
  'cv.butterfly': 'ControlValve',
  'cv.ball': 'ControlValve',
  psv: 'SafetyValve',
  'psv.pilot': 'SafetyValve',
  pvsv: 'SafetyValve',
  pse: 'RuptureDisc',
  'pcv.self': 'PressureRegulator',
  bpcv: 'PressureRegulator',
  'tcv.self': 'TemperatureRegulator',
  // flow elements
  'fe.orifice': 'FlowMeasuringElement',
  'fe.venturi': 'FlowMeasuringElement',
  'fe.nozzle': 'FlowMeasuringElement',
  'fe.pitot': 'FlowMeasuringElement',
  'fe.avgpitot': 'FlowMeasuringElement',
  'fe.magmeter': 'FlowMeasuringElement',
  'fe.coriolis': 'FlowMeasuringElement',
  'fe.vortex': 'FlowMeasuringElement',
  'fe.turbine': 'FlowMeasuringElement',
  'fe.ultrasonic': 'FlowMeasuringElement',
  'fe.thermal': 'FlowMeasuringElement',
  'fe.pd': 'FlowMeasuringElement',
  'fe.rotameter': 'FlowMeasuringElement',
  'fe.ro': 'RestrictionOrifice',
  // rotating
  'pump.centrifugal': 'CentrifugalPump',
  'pump.gear': 'RotaryPump',
  'pump.diaphragm': 'ReciprocatingPump',
  'pump.peristaltic': 'RotaryPump',
  'pump.plunger': 'ReciprocatingPump',
  'pump.submersible': 'CentrifugalPump',
  'pump.vacuum': 'Pump',
  ejector: 'Ejector',
  'comp.centrifugal': 'CentrifugalCompressor',
  'comp.recip': 'ReciprocatingCompressor',
  'comp.screw': 'RotaryCompressor',
  blower: 'Blower',
  'turbine.steam': 'Turbine',
  motor: 'Motor',
  agitator: 'Agitator',
  // vessels
  'vessel.vertical': 'PressureVessel',
  'vessel.horizontal': 'PressureVessel',
  'vessel.tank': 'Tank',
  'vessel.floating-roof': 'Tank',
  'vessel.open': 'Tank',
  'vessel.sphere': 'PressureVessel',
  'vessel.bullet': 'PressureVessel',
  'vessel.silo': 'Silo',
  'vessel.column-tray': 'ProcessColumn',
  'vessel.column-packed': 'ProcessColumn',
  'vessel.cstr': 'Reactor',
  'vessel.fixedbed': 'Reactor',
  'vessel.ko-drum': 'Separator',
  'vessel.sep3': 'Separator',
  cyclone: 'Separator',
  scrubber: 'ProcessColumn',
  centrifuge: 'Centrifuge',
  // heat
  'hx.shell-tube': 'HeatExchanger',
  'hx.plate': 'PlateHeatExchanger',
  'hx.air-cooler': 'AirCooledExchanger',
  'hx.kettle': 'HeatExchanger',
  'hx.doublepipe': 'HeatExchanger',
  'hx.condenser': 'HeatExchanger',
  'heater.electric': 'Heater',
  'heater.fired': 'Furnace',
  'cooling-tower': 'CoolingTower',
  // inline
  'strainer.y': 'Strainer',
  'strainer.basket': 'Strainer',
  'strainer.cone': 'Strainer',
  'filter.cartridge': 'Filter',
  'mixer.static': 'StaticMixer',
  'fit.reducer': 'PipeReducer',
  'fit.reducer-ecc': 'PipeReducer',
  'fit.flanges': 'Flange',
  'fit.blind': 'BlindFlange',
  'fit.spectacle': 'SpectacleBlind',
  'fit.spade': 'Blind',
  'fit.steam-trap': 'SteamTrap',
  'fit.expansion': 'ExpansionJoint',
  'fit.sightglass': 'SightGlass',
  'fit.hose': 'Hose',
  'fit.silencer': 'Silencer',
}

export function componentClassFor(symbolId: string): string {
  return MAP[symbolId] ?? 'PlantItem'
}

const REVERSE: Record<string, string> = {}
for (const [symbolId, cls] of Object.entries(MAP)) {
  if (!(cls in REVERSE)) REVERSE[cls] = symbolId
}

/** Best-effort reverse mapping for foreign DEXPI files; null when unknown. */
export function symbolForComponentClass(componentClass: string): string | null {
  return REVERSE[componentClass] ?? null
}
