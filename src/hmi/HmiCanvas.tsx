import { memo, useRef, useState } from 'react'
import type { ThemeTokens } from './theme'
import type { HmiScreen, HmiWidget, WidgetType } from './model'
import { HMI_WORLD, WIDGET_DEFAULT_SIZE } from './model'
import { THEMES } from './theme'
import { renderWidget } from './widgets/index'
import { HANDLES, handlePoint, hitPipe, hitWidget, marqueeHits, normRect, resizeRect, snap8, widgetRect } from './editGeometry'
import type { Handle, Rect } from './editGeometry'
import { duplicateWidgets } from './align'
import { useStore } from '../store/store'
import { useSimStore } from './simStore'
import { HMI_DRAG_MIME } from './HmiPalette'

/** Structural subset of sim/alarms' AlarmRecord that the canvas needs. */
export interface AlarmView { tag: string; phase: 'active' | 'acked' | 'cleared' }

export interface HmiCanvasProps {
  screen: HmiScreen
  selection: string[]
  onSelect(ids: string[]): void
  mode: 'edit' | 'run'
  tool: 'select' | 'pipe'
  onToolDone(): void
  /** Runtime bindings (absent in edit mode). */
  sim?: Record<string, Record<string, number>>
  flows?: Record<string, number>
  history?: Record<string, number[]>
  alarms?: AlarmView[]
  onWidgetClick?(w: HmiWidget): void
}

interface WidgetGProps {
  widget: HmiWidget
  theme: ThemeTokens
  values: Record<string, number>
  history?: number[]
  alarm: 'none' | 'unacked' | 'acked'
  selected: boolean
  editing: boolean
  ox: number
  oy: number
}

/** Edit-mode preview values so the screen reads as a design, not a void. */
const PREVIEW_TREND = Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i / 4.5) * 18 + (i % 3) * 2)
function previewSim(w: HmiWidget): Record<string, number> {
  switch (w.type) {
    case 'tank': return { PV: 42 }
    case 'valve': return { OP: 40, OPEN: 1 }
    case 'pump': return { RUN: 0 }
    case 'display': case 'gauge': case 'trend': case 'bar': {
      const min = Number(w.props?.min ?? 0), max = Number(w.props?.max ?? 100)
      return { PV: min + (max - min) * 0.45, ...(w.props?.controller === true ? { SP: (min + max) / 2 } : {}) }
    }
    default: return {}
  }
}

const shallowEq = (a: Record<string, number>, b: Record<string, number>) => {
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => a[k] === b[k])
}

/** Memoized widget group: a 5 Hz tick only re-renders widgets whose values,
 *  history, alarm state, or geometry actually changed. */
const WidgetG = memo(
  function WidgetG({ widget, theme, values, history, alarm, selected, editing, ox, oy }: WidgetGProps) {
    return (
      <g data-wid={widget.id} className="hmi-widget" transform={`translate(${widget.x + ox}, ${widget.y + oy})`}>
        {renderWidget({ widget, theme, sim: values, history, alarm })}
        {alarm !== 'none' && (
          <rect x={-4} y={-4} width={widget.w + 8} height={widget.h + 8} fill="none"
            stroke={alarm === 'unacked' ? theme.alarm : theme.alarmAck} strokeWidth={3}
            className={alarm === 'unacked' ? 'hmi-blink' : undefined} />
        )}
        {editing && selected && (
          <rect x={-2} y={-2} width={widget.w + 4} height={widget.h + 4} fill="none" stroke="#2b6cb0" strokeDasharray="4 3" strokeWidth={1.5} />
        )}
      </g>
    )
  },
  (prev, next) =>
    prev.widget === next.widget &&
    prev.theme === next.theme &&
    prev.alarm === next.alarm &&
    prev.selected === next.selected &&
    prev.editing === next.editing &&
    prev.ox === next.ox &&
    prev.oy === next.oy &&
    // identity only: history arrays are rebuilt each tick for bound tags, so
    // trends re-render every tick (correct — samples scroll even when PV is
    // flat at the cap); unbound widgets pass undefined === undefined
    prev.history === next.history &&
    shallowEq(prev.values, next.values),
)

type DragState =
  | { kind: 'move'; start: { x: number; y: number }; downId: string; wasSelected: boolean }
  | { kind: 'resize'; handle: Handle; start: { x: number; y: number }; orig: Rect; id: string; live?: Rect }
  | { kind: 'marquee'; start: { x: number; y: number }; cur: { x: number; y: number }; base: string[] }
  | { kind: 'vertex'; pipeId: string; index: number; live?: { x: number; y: number } }
  | null

export default function HmiCanvas({ screen, selection, onSelect, mode, tool, onToolDone, sim, flows, history, alarms, onWidgetClick }: HmiCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [ghost, setGhost] = useState<{ dx: number; dy: number } | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([])
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const theme = THEMES[screen.theme]
  const st = useStore.getState

  /** Client -> world coordinates through the viewBox. */
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const r = svg.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * HMI_WORLD.w,
      y: ((e.clientY - r.top) / r.height) * HMI_WORLD.h,
    }
  }

  /** Pipe drawing stays orthogonal: an oblique click gets an elbow
   *  (horizontal-first, like the importer) so the run stays right-angled while
   *  the clicked endpoint is honored exactly. Alt draws free angles. */
  const withElbow = (pts: { x: number; y: number }[], next: { x: number; y: number }, free: boolean) => {
    const last = pts[pts.length - 1]
    if (!last || free) return [...pts, next]
    if (Math.abs(next.x - last.x) > 6 && Math.abs(next.y - last.y) > 6) {
      return [...pts, { x: next.x, y: last.y }, next]
    }
    return [...pts, next]
  }

  const commitDraft = (points: { x: number; y: number }[]) => {
    if (points.length >= 2) st().addHmiPipe({ points })
    setDraft([])
    setHover(null)
    onToolDone()
  }

  const duplicateSel = () => {
    const picked = screen.widgets.filter((w) => selection.includes(w.id))
    if (picked.length === 0) return
    onSelect(st().addWidgets(duplicateWidgets(picked)))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = toWorld(e)
    if (mode === 'run') {
      const w = hitWidget(screen, pt, { operate: true })
      if (!w) return
      const sig = typeof w.props?.signal === 'string' ? w.props.signal : ''
      if (w.type === 'nav') {
        const target = typeof w.props?.screen === 'string' ? w.props.screen : ''
        if (target) st().setActiveScreen(target)
        return
      }
      if (w.type === 'button') {
        if (sig) useSimStore.getState().writeTag(sig, '', Number(w.props?.writeValue ?? 1))
        return
      }
      if (w.type === 'switch') {
        if (sig.includes('.')) {
          const i = sig.lastIndexOf('.')
          const cur = useSimStore.getState().tags[sig.slice(0, i)]?.[sig.slice(i + 1)] ?? 0
          useSimStore.getState().writeTag(sig, '', cur >= 0.5 ? 0 : 1)
        }
        return
      }
      if (!w.tag) return
      if (onWidgetClick) onWidgetClick(w)
      return
    }
    if (tool === 'pipe') {
      const next = withElbow(draft, { x: snap8(pt.x), y: snap8(pt.y) }, e.altKey)
      if (e.detail === 2) commitDraft(next)
      else setDraft(next)
      return
    }
    const target = e.target as Element
    const handle = (target.getAttribute?.('data-handle') ?? null) as Handle | null
    if (handle && selection.length === 1) {
      const w = screen.widgets.find((x) => x.id === selection[0])
      if (w) {
        setDrag({ kind: 'resize', handle, start: pt, orig: widgetRect(w), id: w.id })
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
    const vertexAttr = target.getAttribute?.('data-vertex')
    const vertexPipe = target.getAttribute?.('data-vertex-pipe')
    if (vertexAttr !== null && vertexAttr !== undefined && vertexPipe) {
      setDrag({ kind: 'vertex', pipeId: vertexPipe, index: Number(vertexAttr) })
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const w = hitWidget(screen, pt)
    if (w) {
      if (e.shiftKey) {
        // shift-click toggles membership; removing never starts a drag
        if (selection.includes(w.id)) { onSelect(selection.filter((id) => id !== w.id)); return }
        onSelect([...selection, w.id])
        setDrag({ kind: 'move', start: pt, downId: w.id, wasSelected: false })
      } else {
        const wasSelected = selection.includes(w.id)
        if (!wasSelected) onSelect([w.id])
        setDrag({ kind: 'move', start: pt, downId: w.id, wasSelected })
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const p = hitPipe(screen, pt)
    if (p) {
      if (e.shiftKey) {
        onSelect(selection.includes(p.id) ? selection.filter((id) => id !== p.id) : [...selection, p.id])
      } else if (selection.includes(p.id)) {
        setDrag({ kind: 'move', start: pt, downId: p.id, wasSelected: true })
        e.currentTarget.setPointerCapture(e.pointerId)
      } else {
        onSelect([p.id])
      }
      return
    }
    // empty canvas: rubber-band select (shift keeps what's already selected)
    setDrag({ kind: 'marquee', start: pt, cur: pt, base: e.shiftKey ? selection : [] })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === 'edit' && tool === 'pipe') {
      const pt = toWorld(e)
      setHover({ x: snap8(pt.x), y: snap8(pt.y) })
      return
    }
    if (!drag) return
    const pt = toWorld(e)
    if (drag.kind === 'move') {
      setGhost({ dx: snap8(pt.x - drag.start.x), dy: snap8(pt.y - drag.start.y) })
    } else if (drag.kind === 'marquee') {
      setDrag({ ...drag, cur: pt })
    } else if (drag.kind === 'vertex') {
      setDrag({ ...drag, live: { x: snap8(pt.x), y: snap8(pt.y) } })
    } else {
      // live-preview only; the store commit happens once on pointerup so a
      // resize gesture is ONE undo step, not hundreds
      const live = resizeRect(drag.orig, drag.handle, snap8(pt.x - drag.start.x), snap8(pt.y - drag.start.y))
      setDrag({ ...drag, live })
    }
  }

  const onPointerUp = () => {
    if (drag?.kind === 'move') {
      if (ghost && (ghost.dx !== 0 || ghost.dy !== 0)) {
        st().moveWidgets(selection.filter((id) => screen.widgets.some((w) => w.id === id) || screen.pipes.some((p) => p.id === id)), ghost.dx, ghost.dy)
      } else if (drag.wasSelected && selection.length > 1) {
        // plain click (no movement) on part of a group: collapse to just it
        onSelect([drag.downId])
      }
    }
    if (drag?.kind === 'resize' && drag.live) {
      st().updateWidget(drag.id, drag.live)
    }
    if (drag?.kind === 'marquee') {
      const r = normRect(drag.start, drag.cur)
      if (r.w < 4 && r.h < 4) onSelect(drag.base)
      else onSelect([...new Set([...drag.base, ...marqueeHits(screen, r)])])
    }
    if (drag?.kind === 'vertex' && drag.live) {
      const p = screen.pipes.find((x) => x.id === drag.pipeId)
      if (p) st().updateHmiPipe(p.id, { points: p.points.map((q, i) => (i === drag.index ? drag.live! : q)) })
    }
    setDrag(null)
    setGhost(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode === 'run') return
    if (tool === 'pipe') {
      if (e.key === 'Enter') commitDraft(draft)
      if (e.key === 'Escape') { setDraft([]); setHover(null); onToolDone() }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      onSelect([...screen.widgets.map((w) => w.id), ...screen.pipes.map((p) => p.id)])
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      duplicateSel()
      return
    }
    if (e.key === 'Escape') { onSelect([]); return }
    if (selection.length === 0) return
    if (e.key === 'Delete' || e.key === 'Backspace') { st().deleteHmiIds(selection); onSelect([]) }
    const step = e.shiftKey ? 1 : 8
    if (e.key === 'ArrowLeft') st().moveWidgets(selection, -step, 0)
    if (e.key === 'ArrowRight') st().moveWidgets(selection, step, 0)
    if (e.key === 'ArrowUp') st().moveWidgets(selection, 0, -step)
    if (e.key === 'ArrowDown') st().moveWidgets(selection, 0, step)
  }

  const onDrop = (e: React.DragEvent<SVGSVGElement>) => {
    const raw = e.dataTransfer.getData(HMI_DRAG_MIME)
    if (!raw) return
    e.preventDefault()
    const { type } = JSON.parse(raw) as { type: WidgetType }
    const pt = toWorld(e)
    const size = WIDGET_DEFAULT_SIZE[type]
    const id = st().addWidget({ type, x: snap8(pt.x - size.w / 2), y: snap8(pt.y - size.h / 2), ...size })
    onSelect([id])
  }

  const offset = (id: string) => (ghost && selection.includes(id) ? ghost : { dx: 0, dy: 0 })
  const marqueeRect = drag?.kind === 'marquee' ? normRect(drag.start, drag.cur) : null
  const selectedPipe =
    mode === 'edit' && tool === 'select' && selection.length === 1
      ? screen.pipes.find((p) => p.id === selection[0])
      : undefined

  return (
    <svg
      ref={svgRef}
      data-testid="hmi-canvas"
      viewBox={`0 0 ${HMI_WORLD.w} ${HMI_WORLD.h}`}
      style={{ background: theme.bg, touchAction: 'none', cursor: mode === 'edit' && tool === 'pipe' ? 'crosshair' : undefined }}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(HMI_DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
      onDrop={onDrop}
    >
      <defs>
        <pattern id="hmi-grid-dots" width={32} height={32} patternUnits="userSpaceOnUse">
          <circle cx={1.5} cy={1.5} r={1.2} fill={theme.grid} />
        </pattern>
      </defs>
      {mode === 'edit' && <rect width={HMI_WORLD.w} height={HMI_WORLD.h} fill="url(#hmi-grid-dots)" />}
      {screen.pipes.map((raw) => {
        const p = drag?.kind === 'vertex' && drag.pipeId === raw.id && drag.live
          ? { ...raw, points: raw.points.map((q, i) => (i === drag.index ? drag.live! : q)) }
          : raw
        const o = offset(p.id)
        const pts = p.points.map((q) => `${q.x + o.dx},${q.y + o.dy}`).join(' ')
        const flow = flows?.[p.id] ?? 0
        const wpx = p.width ?? 4
        return (
          <g key={p.id}>
            <polyline points={pts} fill="none" stroke={theme.pipe} strokeWidth={wpx} strokeLinejoin="round" />
            {flow > 0 && (
              <polyline points={pts} fill="none" stroke={theme.pipeFlow} strokeWidth={wpx} strokeLinejoin="round"
                className="hmi-flow" strokeDasharray="10 14"
                style={{ animationDuration: `${Math.max(0.35, Math.min(3, 8 / flow))}s` }} />
            )}
            {mode === 'edit' && selection.includes(p.id) && (
              <polyline points={pts} fill="none" stroke="#2b6cb0" strokeWidth={wpx + 4} opacity={0.35} />
            )}
          </g>
        )
      })}
      {screen.widgets.map((raw) => {
        const w = drag?.kind === 'resize' && drag.id === raw.id && drag.live ? { ...raw, ...drag.live } : raw
        const o = offset(w.id)
        const values: Record<string, number> = sim ? { ...(sim[w.tag ?? ''] ?? {}) } : previewSim(w)
        const signal = typeof w.props?.signal === 'string' ? w.props.signal : ''
        if (sim && signal.includes('.')) {
          const i = signal.lastIndexOf('.')
          values[signal] = sim[signal.slice(0, i)]?.[signal.slice(i + 1)] ?? 0
        }
        const recs = (alarms ?? []).filter((a) => a.tag === w.tag)
        const alarm = recs.some((a) => a.phase === 'active' || a.phase === 'cleared') ? 'unacked' as const : recs.length > 0 ? 'acked' as const : 'none' as const
        const hist = history?.[w.tag ?? ''] ?? (!sim && w.type === 'trend' ? PREVIEW_TREND : undefined)
        return (
          <WidgetG key={w.id} widget={w} theme={theme} values={values} history={hist}
            alarm={alarm} selected={selection.includes(w.id)} editing={mode === 'edit'} ox={o.dx} oy={o.dy} />
        )
      })}
      {draft.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={(hover ? withElbow(draft, hover, false) : draft).map((q) => `${q.x},${q.y}`).join(' ')}
            fill="none" stroke={theme.pipeFlow} strokeDasharray="6 4" strokeWidth={3} />
          {draft.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={3} fill={theme.pipeFlow} />)}
        </g>
      )}
      {selectedPipe && (drag?.kind === 'vertex' && drag.pipeId === selectedPipe.id && drag.live
        ? selectedPipe.points.map((q, i) => (i === drag.index ? drag.live! : q))
        : selectedPipe.points
      ).map((q, i) => (
        <circle key={i} data-vertex={i} data-vertex-pipe={selectedPipe.id} cx={q.x} cy={q.y} r={5}
          fill="#fff" stroke="#2b6cb0" strokeWidth={2} style={{ cursor: 'move' }} />
      ))}
      {marqueeRect && (marqueeRect.w >= 4 || marqueeRect.h >= 4) && (
        <rect x={marqueeRect.x} y={marqueeRect.y} width={marqueeRect.w} height={marqueeRect.h}
          fill="#2b6cb022" stroke="#2b6cb0" strokeDasharray="6 4" strokeWidth={1.5} pointerEvents="none" />
      )}
      {mode === 'edit' && tool === 'select' && selection.length === 1 && (() => {
        const found = screen.widgets.find((x) => x.id === selection[0])
        if (!found) return null
        const w = drag?.kind === 'resize' && drag.id === found.id && drag.live ? { ...found, ...drag.live } : found
        const o = offset(w.id)
        return HANDLES.map((h) => {
          const p = handlePoint({ x: w.x + o.dx, y: w.y + o.dy, w: w.w, h: w.h }, h)
          return <rect key={h} data-handle={h} x={p.x - 4} y={p.y - 4} width={8} height={8} fill="#2b6cb0" stroke="#fff" strokeWidth={1} style={{ cursor: `${h}-resize` }} />
        })
      })()}
    </svg>
  )
}
