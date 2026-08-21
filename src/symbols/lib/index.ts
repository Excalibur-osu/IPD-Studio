import { registerSymbols } from '../registry'
import { bubble } from './bubble'
import { manualValves } from './valves-manual'
import { controlValves } from './valves-control'
import { safetyDevices, safetyDevices2 } from './safety'
import { flowElements, flowElements2 } from './flow-elements'
import { accessories, accessories2 } from './accessories'
import { rotating } from './rotating'
import { vessels } from './vessels'
import { heat } from './heat'
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
  ...vessels,
  ...heat,
  ...inlineItems,
  ...controlHardware,
  ...annotations,
])
