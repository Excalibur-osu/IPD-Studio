import '../../symbols/lib/index'
import type { WidgetView } from './shared'
import Tank from './tank'
import Pump from './pump'
import Valve from './valve'
import Lamp from './lamp'
import LabelText from './label'
import Display from './display'
import Gauge from './gauge'
import PushButton from './button'
import ToggleSwitch from './switchw'
import Trend from './trend'
import SymbolGraphic from './symbol'

export function renderWidget(view: WidgetView): React.ReactElement {
  switch (view.widget.type) {
    case 'tank': return <Tank {...view} />
    case 'pump': return <Pump {...view} />
    case 'valve': return <Valve {...view} />
    case 'lamp': return <Lamp {...view} />
    case 'label': return <LabelText {...view} />
    case 'display': return <Display {...view} />
    case 'gauge': return <Gauge {...view} />
    case 'button': return <PushButton {...view} />
    case 'switch': return <ToggleSwitch {...view} />
    case 'trend': return <Trend {...view} />
    case 'symbol': return <SymbolGraphic {...view} />
  }
}
