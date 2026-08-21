import { registerSymbols } from '../registry'
import { bubble } from './bubble'
import { manualValves } from './valves-manual'
import { controlValves } from './valves-control'
import { safetyDevices, safetyDevices2 } from './safety'
import { flowElements, flowElements2 } from './flow-elements'
import { accessories, accessories2 } from './accessories'
import { rotating, rotating2 } from './rotating'
import { vessels, vessels2 } from './vessels'
import { heat, heat2 } from './heat'
import { inlineItems } from './inline'
import { controlHardware } from './control'
import { annotations } from './annotation'

registerSymbols([
  bubble,
  ...manualValves,
  ...controlValves,
  ...safetyDevices,
  ...safetyDevices2,
  ...flowElements,
  ...flowElements2,
  ...accessories,
  ...accessories2,
  ...rotating,
  ...rotating2,
  ...vessels,
  ...vessels2,
  ...heat,
  ...heat2,
  ...inlineItems,
  ...controlHardware,
  ...annotations,
])
