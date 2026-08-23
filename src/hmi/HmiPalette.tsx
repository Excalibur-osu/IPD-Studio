import type { HmiWidget, WidgetType } from './model'
import { WIDGET_DEFAULT_SIZE } from './model'
import { THEMES } from './theme'
import { renderWidget } from './widgets/index'
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

const PREVIEW_SIM: Partial<Record<WidgetType, Record<string, number>>> = {
  tank: { PV: 62 }, pump: { RUN: 1 }, valve: { OP: 60 }, display: { PV: 48.3 },
  gauge: { PV: 65 }, trend: { PV: 52 }, lamp: { on: 1 }, switch: { on: 1 },
}
const TREND_PREVIEW = [30, 35, 42, 40, 48, 55, 52, 60, 58, 66, 63, 70]

function ItemPreview({ type }: { type: WidgetType }) {
  const size = WIDGET_DEFAULT_SIZE[type]
  const widget: HmiWidget = {
    id: `pal-${type}`, type, x: 0, y: 0, ...size,
    label: type === 'label' ? 'Text' : type === 'button' ? 'START' : undefined,
    props: type === 'valve' ? { throttle: true }
      : type === 'symbol' ? { symbolId: 'vessel.column-tray' }
      : type === 'lamp' || type === 'switch' ? { signal: 'on' }
      : undefined,
  }
  const pad = 14
  return (
    <svg width={54} height={36} viewBox={`${-pad} ${-pad} ${size.w + 2 * pad} ${size.h + 2 * pad}`}
      style={{ background: THEMES.classic.bg, borderRadius: 4, flex: '0 0 auto' }} aria-hidden>
      {renderWidget({ widget, theme: THEMES.classic, sim: PREVIEW_SIM[type] ?? {}, history: type === 'trend' ? TREND_PREVIEW : undefined })}
    </svg>
  )
}

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
          <ItemPreview type={it.type} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}
