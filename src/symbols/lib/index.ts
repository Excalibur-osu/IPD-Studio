import { registerSymbols } from '../registry'
import { bubble } from './bubble'
import { manualValves } from './valves-manual'
import { controlValves } from './valves-control'
import { safetyDevices } from './safety'

registerSymbols([bubble, ...manualValves, ...controlValves, ...safetyDevices])
