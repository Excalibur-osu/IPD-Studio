import type { WidgetView } from './shared'
import { fmt } from './shared'

/**
 * Vessel widget. `props.shape` (set by the P&ID import) keeps the source
 * symbol's silhouette so operators recognize the equipment:
 *  - vertical (default): dished drum, rounded corners
 *  - horizontal: lying capsule
 *  - cone: storage tank with a peaked roof
 *  - agitated: stirred reactor — motor, shaft, impeller
 */
export default function Tank({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const shape = typeof widget.props?.shape === 'string' ? widget.props.shape : 'vertical'
  const level = Math.max(0, Math.min(100, sim.PV ?? 0))
  // roof/motor band above the level-holding body
  const roofH = shape === 'cone' ? Math.min(16, h * 0.22) : shape === 'agitated' ? 10 : 0
  const bodyTop = 2 + roofH
  const innerTop = bodyTop + 2
  const innerBot = h - 4
  const span = innerBot - innerTop
  const liquidH = (span * level) / 100
  const r = shape === 'horizontal' ? (h - 4) / 2 : shape === 'cone' ? 2 : Math.min(12, w / 4)
  const gid = `tg-${widget.id}`
  const shaftY = h * 0.68

  const outline = shape === 'cone'
    ? <path d={`M2 ${bodyTop} L${w / 2} 2 L${w - 2} ${bodyTop} V${h - 2} H2 Z`} fill={theme.equipFill} stroke={theme.equipStroke} strokeWidth={2} strokeLinejoin="round" />
    : <rect x={2} y={bodyTop} width={w - 4} height={h - 2 - bodyTop} rx={r} fill={theme.equipFill} stroke={theme.equipStroke} strokeWidth={2} />

  return (
    <g data-shape={shape}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.liquid} stopOpacity={0.65} />
          <stop offset="45%" stopColor={theme.liquid} />
          <stop offset="100%" stopColor={theme.liquid} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {outline}
      <clipPath id={`clip-${widget.id}`}>
        <rect x={4} y={innerTop} width={w - 8} height={span} rx={Math.max(0, r - 2)} />
      </clipPath>
      <rect x={4} y={innerBot - liquidH} width={w - 8} height={liquidH} fill={`url(#${gid})`} clipPath={`url(#clip-${widget.id})`} />
      {shape === 'agitated' && (
        <g data-agitator stroke={theme.equipStroke} fill={theme.equipFill}>
          <rect x={w / 2 - 8} y={1} width={16} height={10} strokeWidth={2} />
          <line x1={w / 2} y1={11} x2={w / 2} y2={shaftY} strokeWidth={2} />
          <path d={`M${w / 2 - 9} ${shaftY} L${w / 2} ${shaftY - 8} L${w / 2 + 9} ${shaftY}`} fill="none" strokeWidth={2} strokeLinejoin="round" />
        </g>
      )}
      {/* level ticks at 25/50/75% */}
      {[25, 50, 75].map((tk) => (
        <line key={tk} x1={w - 12} x2={w - 5} y1={innerTop + span * (1 - tk / 100)} y2={innerTop + span * (1 - tk / 100)}
          stroke={theme.equipStroke} strokeWidth={1.5} opacity={0.8} />
      ))}
      {/* alarm-limit markers (same defaults the sim applies) */}
      {([['LL', 5, theme.alarm], ['L', 10, theme.warn], ['H', 90, theme.warn], ['HH', 95, theme.alarm]] as const).map(([key, dflt, color]) => {
        const raw = widget.props?.[key]
        const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : dflt
        const y = innerTop + span * (1 - Math.max(0, Math.min(100, v)) / 100)
        return (
          <g key={key}>
            <line x1={2} x2={10} y1={y} y2={y} stroke={color} strokeWidth={2} />
            <text x={12} y={y + 2.5} fill={color} fontSize={7} fontWeight={700}>{key}</text>
          </g>
        )
      })}
      <text x={w / 2} y={(bodyTop + h) / 2 + 5} textAnchor="middle" fill={theme.text} fontSize={14} fontWeight={700}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{fmt(sim.PV, 0)}%</text>
      <text x={w / 2} y={h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
