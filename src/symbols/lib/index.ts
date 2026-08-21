import { registerSymbols } from '../registry'
import { bubble } from './bubble'
import { converters } from './converters'
import { manualValves } from './valves-manual'
import { controlValves } from './valves-control'
import { safetyDevices, safetyDevices2 } from './safety'
import { flowElements, flowElements2 } from './flow-elements'
import { accessories, accessories2 } from './accessories'
import { rotating, rotating2 } from './rotating'
import { vessels, vessels2 } from './vessels'
import { heat, heat2 } from './heat'
import { inlineItems, inlineItems2 } from './inline'
import { controlHardware, controlHardware2 } from './control'
import { annotations, annotations2 } from './annotation'
import { solids } from './solids'
import { utilities } from './utilities'

registerSymbols([
  bubble,
  ...converters,
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
  ...inlineItems2,
  ...controlHardware,
  ...controlHardware2,
  ...annotations,
  ...annotations2,
  ...solids,
  ...utilities,
])
