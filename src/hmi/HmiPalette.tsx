import type { WidgetType } from './model'
import { WIDGET_DEFAULT_SIZE } from './model'
import { useStore } from '../store/store'

export const HMI_DRAG_MIME = 'application/x-hmi-widget'

const ITEMS: { type: WidgetType; label: string }[] = [
  { type: 'tank', label: 'Tank' }, { type: 'pump', label: 'Pump' },
  { type: 'valve', label: 'Valve' }, { type: 'display', label: 'Value display' },
  { type: 'gauge', label: 'Gauge' }, { type: 'trend', label: 'Trend' },
  { type: 'lamp', label: 'Lamp' }, { type: 'button', label: 'Button' },
  { type: 'switch', label: 'Switch' }, { type: 'label', label: 'Text' },
  { type: 'symbol', label: 'P&ID symbol' },
]

export default function HmiPalette() {
  const addWidget = useStore((s) => s.addWidget)
  return (
    <div style={{ padding: 8 }}>
      <h4 style={{ margin: '4px 0 8px' }}>Widgets</h4>
      {ITEMS.map((it) => (
        <div
          key={it.type}
          className="hmi-pal-item"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(HMI_DRAG_MIME, JSON.stringify({ type: it.type }))
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onDoubleClick={() => {
            const size = WIDGET_DEFAULT_SIZE[it.type]
            addWidget({ type: it.type, x: 320, y: 240, ...size })
          }}
          title="Drag onto the canvas (or double-click to place)"
        >
          {it.label}
        </div>
      ))}
    </div>
  )
}
