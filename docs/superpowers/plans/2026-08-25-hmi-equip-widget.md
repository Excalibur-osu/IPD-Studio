# HMI Equipment Pack (`equip` widget) Implementation Plan — v0.9.9

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the HMI real animated, operable equipment beyond tank/pump/valve — compressors, blowers, agitators, conveyors, fired heaters — as one new `equip` widget that renders any P&ID glyph and behaves like a motor (Start/Stop, ramp, trip, drives flow).

**Architecture:** One new `WidgetType 'equip'` instead of five: it reuses the P&ID symbol registry for its glyph (like the existing `symbol` widget) and reuses the existing `motor` TagKind for its dynamics (like `pump`), so the engine, faceplate (signal-sniffing), alarms, and journal all work with **zero engine changes**. The flow network treats `equip` as an inline driver (contributes to `branch.pumps`) — critical because P&ID import currently maps compressors/blowers to `pump`, and remapping them to `equip` must not stop them driving flow. Import maps a curated set of motor-driven symbol ids to `equip`; everything else is unchanged.

**Tech Stack:** React 19 + TS strict + Vite 8, zustand, vitest (node env, `renderToStaticMarkup` for widget SVG tests — no jsdom needed), Playwright e2e.

**Spec:** Design agreed in-conversation 2026-08-25 (research: Ignition Perspective smart symbols, Symbol Factory, FUXA, ISA-101). This plan is the spec of record.

## Global Constraints

- TypeScript strict; no new runtime dependencies.
- `WIDGET_SCHEMA`, `WIDGET_DEFAULT_SIZE`, and the `renderWidget` switch are exhaustive over `WidgetType` — the compiler enforces Tasks 1–2 stay in sync.
- Every new props key must be in `tests/hmi/schema.test.ts` LEDGER **and** `WIDGET_SCHEMA` (`equip` uses only the already-ledgered `symbolId`).
- Calm-start doctrine: new equipment starts `RUN: 0` — an imported plant must come up with nothing moving and no alarms (the Praharsh-Test-3 regression test must stay green).
- e2e chains: `set -o pipefail` before piping playwright output; kill stale vite dev servers on :5173 before trusting a failure.
- Deploy = `npm run build` && `npx firebase-tools deploy --only hosting`; verify with a **cache-busted curl** comparing the `dist/assets` content-hash filename against live HTML.

## File Map

- Modify: `src/hmi/model.ts` — union + schema + default size
- Modify: `src/hmi/sim/tags.ts` — `equip` → `motor` kind
- Create: `src/hmi/widgets/equip.tsx` — the widget
- Modify: `src/hmi/widgets/index.tsx` — render case
- Modify: `src/hmi/sim/network.ts` — inline-driver allowlists
- Modify: `src/hmi/HmiPalette.tsx` — 5 new palette items carrying props
- Modify: `src/hmi/HmiCanvas.tsx` — drop handler carries props
- Modify: `src/hmi/HmiPropertyPanel.tsx` — symbolId row for `equip`
- Modify: `src/hmi/importFromPid.ts` — EQUIP_MOTOR mapping + routing/prefix bookkeeping
- Modify: `src/hmi/HmiToolbar.tsx` — Events modal trips equip motors
- Create: `tests/hmi/equip.test.ts` — tags/engine/network/render/palette/import coverage
- Create: `e2e/equip.spec.ts` — place → tag → run → faceplate Start → spin

---

### Task 1: Model + tag kind (`equip` exists and simulates as a motor)

**Files:**
- Modify: `src/hmi/model.ts:5-8` (union), `:46` (WIDGET_SCHEMA), `:93` (WIDGET_DEFAULT_SIZE)
- Modify: `src/hmi/sim/tags.ts:28-63` (`defFor`)
- Test: `tests/hmi/equip.test.ts`

**Interfaces:**
- Produces: `WidgetType` includes `'equip'`; `WIDGET_SCHEMA.equip = { symbolId: 'symbolRef' }`; `WIDGET_DEFAULT_SIZE.equip = { w: 64, h: 64 }`; `buildTagDefs` yields `kind: 'motor'` for tagged equip widgets. Later tasks rely on tag signals `RUN/RAMP/FAULT` (already provided by the engine for `motor`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/equip.test.ts
import { describe, expect, it } from 'vitest'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'
import { buildTagDefs } from '../../src/hmi/sim/tags'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'

const rng = () => 0.5
const screen = (widgets: HmiWidget[], pipes: HmiScreen['pipes'] = []): HmiScreen =>
  ({ id: 's1', name: 'S', theme: 'classic', widgets, pipes })
const equip = (tag: string, x = 200, y = 200): HmiWidget =>
  ({ id: `w-${tag}`, type: 'equip', x, y, w: 64, h: 64, tag, props: { symbolId: 'comp.centrifugal' } })

describe('equip tag model', () => {
  it('a tagged equip widget is a motor', () => {
    const defs = buildTagDefs(screen([equip('K-101')]))
    expect(defs).toEqual([{ name: 'K-101', kind: 'motor', min: 0, max: 1 }])
  })

  it('starts stopped and ramps up over ~2s once RUN is set', () => {
    const model = buildSimModel(screen([equip('K-101')]))
    let tags = initTags(model)
    expect(tags['K-101']).toEqual({ RUN: 0, RAMP: 0 })
    tags['K-101']!.RUN = 1
    for (let i = 0; i < 5; i++) tags = tick(model, tags, 0.2, rng).tags
    expect(tags['K-101']!.RAMP).toBeGreaterThan(0.4)
    expect(tags['K-101']!.RAMP).toBeLessThan(0.6)
  })

  it('a FAULT opens the breaker like a pump trip', () => {
    const model = buildSimModel(screen([equip('K-101')]))
    let tags = initTags(model)
    tags['K-101']!.RUN = 1
    tags['K-101']!.FAULT = 1
    tags = tick(model, tags, 0.2, rng).tags
    expect(tags['K-101']!.RUN).toBe(0)
    expect(tags['K-101']!.RAMP).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hmi/equip.test.ts`
Expected: FAIL — TS error: `'"equip"' is not assignable to type 'WidgetType'`.

- [ ] **Step 3: Implement**

`src/hmi/model.ts` — three edits:

```ts
export type WidgetType =
  | 'tank' | 'pump' | 'valve' | 'display' | 'gauge' | 'trend'
  | 'lamp' | 'button' | 'switch' | 'label' | 'symbol'
  | 'bar' | 'panel' | 'nav' | 'equip'
```

In `WIDGET_SCHEMA` (after `symbol`):

```ts
  equip: { symbolId: 'symbolRef' },
```

In `WIDGET_DEFAULT_SIZE` (after `symbol`):

```ts
  equip: { w: 64, h: 64 },
```

`src/hmi/sim/tags.ts` — in `defFor`, next to `case 'pump'`:

```ts
    case 'pump':
    case 'equip':
      return { name: w.tag, kind: 'motor', min: 0, max: 1 }
```

- [ ] **Step 4: Run tests to verify they pass — plus the exhaustiveness fallout**

Run: `npx vitest run tests/hmi/equip.test.ts tests/hmi/schema.test.ts`
Expected: equip.test.ts PASSES. `npx tsc --noEmit` will FAIL on `renderWidget` (non-exhaustive switch) — that is Task 2; do not commit yet if tsc gates the commit, otherwise commit with Task 2 together only if needed. Preferred: proceed to Task 2 before committing.

*(Do not add a placeholder render case here — Task 2 owns the component. If `npm test` runs tsc first, Tasks 1+2 are one commit.)*

### Task 2: The `equip` widget component

**Files:**
- Create: `src/hmi/widgets/equip.tsx`
- Modify: `src/hmi/widgets/index.tsx:18-34`
- Test: `tests/hmi/equip.test.ts` (render section)

**Interfaces:**
- Consumes: `WidgetView` from `./shared` (`{ widget, theme, sim }`), `getSymbol` from `../../symbols/registry`, glyph transform pattern from `src/hmi/widgets/symbol.tsx:22-27`, motor state pattern from `src/hmi/widgets/pump.tsx:7-10`.
- Produces: `<Equip>` rendering `<g data-hmi-equip={symbolId}>` with: glyph tinted `theme.alarm` (fault) / `theme.running` (running) / `theme.equipStroke` (stopped); `hmi-blink` on fault or while starting (`RAMP < 1`); a spinning arc badge (class `hmi-spin`) bottom-right while running; tag text under the box.

- [ ] **Step 1: Write the failing render test (append to tests/hmi/equip.test.ts)**

```ts
import { renderToStaticMarkup } from 'react-dom/server'
import { renderWidget } from '../../src/hmi/widgets/index'
import { THEMES } from '../../src/hmi/theme'

describe('equip widget rendering', () => {
  const render = (sim: Record<string, number>) =>
    renderToStaticMarkup(renderWidget({ widget: equip('K-101'), theme: THEMES.classic, sim }))

  it('renders the P&ID glyph and the tag', () => {
    const html = render({})
    expect(html).toContain('data-hmi-equip="comp.centrifugal"')
    expect(html).toContain('K-101')
    expect(html).not.toContain('hmi-spin')
  })
  it('spins its badge while running and blinks while starting', () => {
    const html = render({ RUN: 1, RAMP: 0.3 })
    expect(html).toContain('hmi-spin')
    expect(html).toContain('hmi-blink')
  })
  it('marks a fault', () => {
    const html = render({ RUN: 0, FAULT: 1 })
    expect(html).toContain('data-fault')
    expect(html).toContain('hmi-blink')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hmi/equip.test.ts`
Expected: FAIL — `renderWidget` has no `'equip'` case (returns undefined) or TS error.

- [ ] **Step 3: Implement the component**

`src/hmi/widgets/equip.tsx`:

```tsx
import { getSymbol } from '../../symbols/registry'
import type { WidgetView } from './shared'

/** Motor-driven equipment (compressor, blower, agitator, conveyor, heater…):
 *  any P&ID glyph + the pump's motor state model. RUN/RAMP/FAULT come from
 *  the existing motor TagKind, so faceplate Start/Stop, trip events, and the
 *  flow network all treat it like a driver. */
export default function Equip({ widget, theme, sim }: WidgetView) {
  const id = typeof widget.props?.symbolId === 'string' ? widget.props.symbolId : ''
  let inner = '', sw = 8, sh = 8
  try {
    const def = getSymbol(id)
    inner = def.render((widget.props as Record<string, string>) ?? {})
    sw = def.gridSize.w * 8
    sh = def.gridSize.h * 8
  } catch {
    inner = '<rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor"/>'
    sw = sh = 32
  }
  const running = (sim.RUN ?? 0) >= 0.5
  const faulted = (sim.FAULT ?? 0) >= 0.5
  const starting = running && !faulted && (sim.RAMP ?? 1) < 1
  const color = faulted ? theme.alarm : running ? theme.running : theme.equipStroke
  const rot = widget.rotation ?? 0
  const swapped = rot === 90 || rot === 270
  const scale = Math.min(widget.w / (swapped ? sh : sw), widget.h / (swapped ? sw : sh))
  const transform = rot === 0
    ? `scale(${scale})`
    : `translate(${widget.w / 2} ${widget.h / 2}) rotate(${rot}) scale(${scale}) translate(${-sw / 2} ${-sh / 2})`
  const bx = widget.w - 8, by = widget.h - 8 // status badge center
  return (
    <g data-hmi-equip={id}>
      <g color={color} transform={transform} className={faulted ? 'hmi-blink' : undefined}
        data-fault={faulted || undefined} dangerouslySetInnerHTML={{ __html: inner }} />
      <circle cx={bx} cy={by} r={7} fill={theme.bg} stroke={color} strokeWidth={1.5} />
      <g className={running ? (starting ? 'hmi-spin hmi-blink' : 'hmi-spin') : undefined}
        style={{ transformOrigin: `${bx}px ${by}px` }}>
        <path d={`M ${bx} ${by - 4.5} A 4.5 4.5 0 1 1 ${bx - 4.5} ${by}`} fill="none"
          stroke={running ? theme.running : theme.equipStroke} strokeWidth={2} strokeLinecap="round" />
      </g>
      <text x={widget.w / 2} y={widget.h + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontWeight={600}
        stroke={theme.bg} strokeWidth={3} paintOrder="stroke">{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/index.tsx` — add import + case:

```tsx
import Equip from './equip'
// in the switch:
    case 'equip': return <Equip {...view} />
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/hmi/equip.test.ts && npx tsc --noEmit`
Expected: PASS, clean compile (exhaustive switches satisfied).

- [ ] **Step 5: Commit Tasks 1+2**

```bash
git add src/hmi/model.ts src/hmi/sim/tags.ts src/hmi/widgets/equip.tsx src/hmi/widgets/index.tsx tests/hmi/equip.test.ts
git commit -m "feat(hmi): equip widget type — P&ID glyph with motor dynamics"
```

### Task 3: Flow network treats `equip` as an inline driver

**Files:**
- Modify: `src/hmi/sim/network.ts:36` (`widgetAt` allowlist), `:54-55` (`inline`), `:69-76` (`emit` device collection)
- Test: `tests/hmi/equip.test.ts` (network section)

**Interfaces:**
- Consumes: `buildNetwork(screen)`, `solveFlows` signatures unchanged.
- Produces: a pipe chain through a tagged `equip` yields `branch.pumps` containing the equip tag (so `solveFlows`' pump gating, ramp scaling, SBD suppression, and `equipFlows` all apply unchanged).

- [ ] **Step 1: Write the failing test (append)**

```ts
import { buildNetwork } from '../../src/hmi/sim/network'

describe('equip in the flow network', () => {
  // tank(0,0 96x128) → pipe → equip K-101 (200,40 64x64) → pipe → free end (sink)
  const tank: HmiWidget = { id: 'w-tk', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1' }
  const sc = screen(
    [tank, equip('K-101', 200, 40)],
    [
      { id: 'p1', points: [{ x: 96, y: 100 }, { x: 200, y: 72 }] },
      { id: 'p2', points: [{ x: 264, y: 72 }, { x: 400, y: 72 }] },
    ],
  )
  it('collects the equip tag as a branch driver', () => {
    const net = buildNetwork(sc)
    expect(net.branches).toHaveLength(1)
    expect(net.branches[0]!.pumps).toEqual(['K-101'])
    expect(net.branches[0]!.from).toEqual({ kind: 'tank', tag: 'TK-1' })
  })
  it('moves flow only when the equip runs', () => {
    const model = buildSimModel(sc)
    let tags = initTags(model)
    let r = tick(model, tags, 0.2, rng)
    expect(Object.values(r.branchFlows).every((f) => f === 0)).toBe(true) // calm start
    r.tags['K-101']!.RUN = 1
    for (let i = 0; i < 15; i++) r = tick(model, r.tags, 0.2, rng) // ramp to full
    expect(Object.values(r.branchFlows).some((f) => f > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hmi/equip.test.ts`
Expected: FAIL — `branches[0].pumps` is `[]` (equip widgets are invisible to `widgetAt`, pipe endpoints don't attach).

- [ ] **Step 3: Implement — three one-line edits in `src/hmi/sim/network.ts`**

`widgetAt` (line 36):

```ts
    if (w.type !== 'tank' && w.type !== 'pump' && w.type !== 'valve' && w.type !== 'symbol' && w.type !== 'equip') continue
```

`inline` (line 54-55):

```ts
  const inline = (w: HmiWidget | null): w is HmiWidget =>
    !!w && (w.type === 'pump' || w.type === 'valve' || w.type === 'symbol' || w.type === 'equip')
```

`emit` device collection (line 73):

```ts
      if ((w.type === 'pump' || w.type === 'equip') && w.tag) branch.pumps.push(w.tag)
```

- [ ] **Step 4: Run the whole hmi test dir**

Run: `npx vitest run tests/hmi`
Expected: PASS (existing network/import/regression tests untouched — equip didn't exist in any older document).

- [ ] **Step 5: Commit**

```bash
git add src/hmi/sim/network.ts tests/hmi/equip.test.ts
git commit -m "feat(hmi): equip widgets drive flow as inline motors"
```

### Task 4: Palette items, drop payload, property panel

**Files:**
- Modify: `src/hmi/HmiPalette.tsx:9-63` (SECTIONS + preview), `src/hmi/HmiCanvas.tsx:469-478` (onDrop)
- Modify: `src/hmi/HmiPropertyPanel.tsx:355` (symbolId row)
- Test: `tests/hmi/equip.test.ts` (palette section)

**Interfaces:**
- Consumes: `HMI_DRAG_MIME`, `addWidget(partial)` (`src/store/store.ts:79`).
- Produces: exported `const SECTIONS` (adds `props?: HmiWidget['props']` per item) from HmiPalette; drag payload/dblclick now `{ type, props? }`; `HmiCanvas.onDrop` applies `props`.

- [ ] **Step 1: Write the failing test (append)**

```ts
import { SECTIONS } from '../../src/hmi/HmiPalette'
import { getSymbol } from '../../src/symbols/registry'
import '../../src/symbols/lib/index'

describe('palette equipment items', () => {
  const items = SECTIONS.flatMap((s) => s.items).filter((it) => it.type === 'equip')
  it('offers the five motor-equipment presets', () => {
    expect(items.map((it) => it.label)).toEqual(['Agitator', 'Compressor', 'Blower', 'Conveyor', 'Heater'])
  })
  it('every preset symbolId resolves in the registry', () => {
    for (const it of items) {
      const id = it.props?.symbolId
      expect(typeof id).toBe('string')
      expect(() => getSymbol(id as string)).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hmi/equip.test.ts`
Expected: FAIL — `SECTIONS` is not exported / no equip items.

- [ ] **Step 3: Implement**

`src/hmi/HmiPalette.tsx`:
- Type + export: `export const SECTIONS: { title: string; items: { type: WidgetType; label: string; props?: HmiWidget['props'] }[] }[] = [...]`
- Equipment section items become:

```ts
    items: [
      { type: 'tank', label: 'Tank' }, { type: 'pump', label: 'Pump' },
      { type: 'valve', label: 'Valve' },
      { type: 'equip', label: 'Agitator', props: { symbolId: 'agitator' } },
      { type: 'equip', label: 'Compressor', props: { symbolId: 'comp.centrifugal' } },
      { type: 'equip', label: 'Blower', props: { symbolId: 'blower' } },
      { type: 'equip', label: 'Conveyor', props: { symbolId: 'conveyor.belt' } },
      { type: 'equip', label: 'Heater', props: { symbolId: 'heater.fired' } },
      { type: 'symbol', label: 'P&ID symbol' },
    ],
```

- `PREVIEW_SIM` gains `equip: { RUN: 1 }`.
- `ItemPreview` takes the item, not just the type: `function ItemPreview({ item }: { item: { type: WidgetType; label: string; props?: HmiWidget['props'] } })`, widget props become `item.props ?? (type === 'valve' ? { throttle: true } : …existing chain…)`, and the map key must include the label (`key={it.type + it.label}` — five items share `type 'equip'`).
- `onDragStart` payload: `JSON.stringify({ type: it.type, props: it.props })`; `onDoubleClick`: `addWidget({ type: it.type, x: 320, y: 240, ...size, ...(it.props ? { props: it.props } : {}) })`.

`src/hmi/HmiCanvas.tsx` `onDrop`:

```ts
    const { type, props } = JSON.parse(raw) as { type: WidgetType; props?: HmiWidget['props'] }
    const pt = toWorld(e)
    const size = WIDGET_DEFAULT_SIZE[type]
    const id = st().addWidget({ type, x: snap8(pt.x - size.w / 2), y: snap8(pt.y - size.h / 2), ...size, ...(props ? { props } : {}) })
```

(`HmiWidget` may need importing as a type in HmiCanvas if not already.)

`src/hmi/HmiPropertyPanel.tsx:355`:

```tsx
      {(w.type === 'symbol' || w.type === 'equip') && <StrProp w={w} k="symbolId" label="Symbol id" placeholder="valve.gate" />}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/hmi && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hmi/HmiPalette.tsx src/hmi/HmiCanvas.tsx src/hmi/HmiPropertyPanel.tsx tests/hmi/equip.test.ts
git commit -m "feat(hmi): palette equipment presets (agitator/compressor/blower/conveyor/heater)"
```

### Task 5: Import maps motor-driven P&ID equipment to `equip`

**Files:**
- Modify: `src/hmi/importFromPid.ts:18-20` (AUTO_PREFIX), `:35-65` (widgetTypeFor), `:89-98` (size clamp), `:104-105` (keepRot), `:250-255` (solidRect)
- Test: `tests/hmi/equip.test.ts` (import section)

**Interfaces:**
- Consumes: `mapNodes(sheet, separator)` (exported), `PlantNode` shape (`kind`, `symbolId`, `tag`), symbol registry categories.
- Produces: nodes whose `symbolId` is in `EQUIP_MOTOR` become `{ type: 'equip', props: { symbolId } }`; everything else maps exactly as before (`pump.*` → pump, `hx.*` → symbol, vessels → tank…). Auto-tag prefix for equip is `M`.

- [ ] **Step 1: Write the failing test (append)**

```ts
import { mapNodes } from '../../src/hmi/importFromPid'
import type { Sheet } from '../../src/model/types'

describe('import maps motor equipment to equip', () => {
  const node = (id: string, symbolId: string) =>
    ({ id, kind: 'equipment', symbolId, x: 100, y: 100 }) as Sheet['nodes'][number]
  const sheet = (nodes: Sheet['nodes']) => ({ id: 'sh1', name: 'S', nodes, edges: [] }) as unknown as Sheet
  const typeOf = (symbolId: string) => {
    const { widgets } = mapNodes(sheet([node('n1', symbolId)]), '-')
    return { type: widgets[0]?.type, props: widgets[0]?.props }
  }

  it('compressors, blowers, agitators, conveyors, heaters, boilers become equip', () => {
    for (const id of ['comp.centrifugal', 'comp.recip', 'comp.screw', 'blower', 'agitator',
      'turbine.steam', 'conveyor.belt', 'conveyor.screw', 'bucket-elevator', 'feeder.rotary',
      'crusher', 'mill.ball', 'extruder', 'blender.ribbon', 'screen.vibrating',
      'heater.fired', 'heater.electric', 'boiler', 'cooling-tower']) {
      expect(typeOf(id), id).toEqual({ type: 'equip', props: { symbolId: id } })
    }
  })
  it('pumps stay pumps, exchangers stay symbols', () => {
    expect(typeOf('pump.centrifugal').type).toBe('pump')
    expect(typeOf('ejector').type).toBe('pump')
    expect(typeOf('hx.shell-tube').type).toBe('symbol')
  })
  it('untagged equip gets an M- auto tag', () => {
    const { widgets } = mapNodes(sheet([node('n1', 'comp.centrifugal')]), '-')
    expect(widgets[0]!.tag).toBe('M-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hmi/equip.test.ts`
Expected: FAIL — `comp.centrifugal` maps to `pump` today.

- [ ] **Step 3: Implement in `src/hmi/importFromPid.ts`**

Above `widgetTypeFor`:

```ts
/** Motor-driven equipment the HMI runs as an `equip` widget (Start/Stop,
 *  ramp, trip). pump.* keeps the dedicated pump widget; ejector has no motor
 *  but drives flow, so it stays a pump; hx.* stays a passive graphic. */
const EQUIP_MOTOR = new Set([
  'comp.centrifugal', 'comp.recip', 'comp.screw', 'blower', 'agitator', 'motor', 'turbine.steam',
  'conveyor.belt', 'conveyor.screw', 'bucket-elevator', 'feeder.rotary', 'crusher',
  'mill.ball', 'extruder', 'blender.ribbon', 'screen.vibrating', 'dryer.rotary',
  'heater.fired', 'heater.electric', 'boiler', 'cooling-tower',
])
```

In `widgetTypeFor`, inside the `if (node.kind !== 'instrument')` block, **before** the `category === 'rotating'` line:

```ts
    if (EQUIP_MOTOR.has(node.symbolId)) return { type: 'equip', props: { symbolId: node.symbolId } }
    if (category === 'rotating') return { type: 'pump', props: undefined }
```

`AUTO_PREFIX` gains `equip: 'M'`:

```ts
const AUTO_PREFIX: Partial<Record<WidgetType, string>> = {
  tank: 'TK', pump: 'P', valve: 'V', display: 'XI', symbol: 'X', equip: 'M',
}
```

Size clamp in `mapNodes` (next to the pump clamp, line ~96):

```ts
      if (mapped.type === 'pump' || mapped.type === 'equip') { w = Math.max(w, 40); h = Math.max(h, 40) }
```

(replaces the pump-only line)

`keepRot` (line 105) — equip renders glyphs like symbol, so keep orientation:

```ts
    const keepRot = (mapped.type === 'valve' || mapped.type === 'symbol' || mapped.type === 'equip') && (rot === 90 || rot === 180 || rot === 270)
```

`solidRect` (line 252) — routed pipes must go around equipment:

```ts
    if (w.type === 'tank' || w.type === 'pump' || w.type === 'valve' || w.type === 'symbol' || w.type === 'equip') {
```

(`MOVABLE` at line 308 stays unchanged — equipment keeps its P&ID position.)

- [ ] **Step 4: Run the full unit suite (regression gate)**

Run: `npx vitest run`
Expected: ALL PASS — especially the Praharsh-Test-3 calm-start regression (compressors/blowers there change from `pump` to `equip` widgets, but both start `RUN: 0` and both drive flow the same way, so flows and alarms stay identical at t=0).

- [ ] **Step 5: Commit**

```bash
git add src/hmi/importFromPid.ts tests/hmi/equip.test.ts
git commit -m "feat(hmi): import maps compressors/blowers/agitators/conveyors/heaters to equip"
```

### Task 6: Events modal can trip any motor

**Files:**
- Modify: `src/hmi/HmiToolbar.tsx:22-45` (EventsModal collection + labels)

**Interfaces:**
- Consumes: `writeTag(tag, 'FAULT', v)`; widgets across `doc.hmiScreens`.
- Produces: the trip list includes `equip` tags; row label is `Trip {tag}` / `Clear {tag} trip` (works for pumps and equipment alike).

- [ ] **Step 1: Check e2e copy dependency first**

Run: `grep -rn "Trip pump" e2e/ tests/`
If any spec asserts the exact string `Trip pump`, update it in the same commit.

- [ ] **Step 2: Implement**

In `EventsModal`'s widget scan:

```ts
      if (w.type === 'pump' || w.type === 'equip') pumps.push(w.tag)
```

And the row labels (drop the word "pump" so a compressor row reads honestly):

```ts
        {pumps.slice(0, 6).map((t) => row(
          (tags[t]?.FAULT ?? 0) >= 0.5 ? `Clear ${t} trip` : `Trip ${t}`,
          (tags[t]?.FAULT ?? 0) >= 0.5, () => toggle(t, 'FAULT'), `f-${t}`))}
```

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit` (plus any e2e grep hits from Step 1 fixed).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hmi/HmiToolbar.tsx
git commit -m "feat(hmi): events modal trips equip motors too"
```

### Task 7: e2e — place, tag, run, operate

**Files:**
- Create: `e2e/equip.spec.ts` (model it on the run-mode flows in `e2e/` — reuse their helpers/selectors)

**Interfaces:**
- Consumes: palette item text `Compressor`; property panel Tag field (TagPicker); RUN mode toolbar; `[data-testid="faceplate"]`, `[data-testid="fp-close"]`, `[data-testid="event-row"]`.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test'
// reuse the local helpers other HMI specs use for: open app → HMI workspace → blank screen

test('compressor: place, tag, start from faceplate, trip from events', async ({ page }) => {
  // 1. place from palette — dblclick places but does NOT select (v0.9.4 gotcha)
  await page.getByText('Compressor', { exact: true }).dblclick()
  const canvas = page.locator('svg.hmi-canvas') // match the selector other specs use
  await expect(page.locator('[data-hmi-equip="comp.centrifugal"]')).toHaveCount(1)

  // 2. select it, then tag it K-101 via the property panel TagPicker
  await canvas.click({ position: await positionOfEquip(page) }) // world 320,240 + size/2, via the spec's coord helper
  await page.getByLabel('Tag').fill('K-101') // TagPicker commits per keystroke

  // 3. RUN mode → click the equipment → faceplate → Start
  await page.getByRole('button', { name: 'Run' }).click()
  await page.locator('[data-hmi-equip]').click()
  const fp = page.locator('[data-testid="faceplate"]')
  await expect(fp).toBeVisible()
  await fp.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.hmi-spin')).toHaveCount(1) // status badge spinning
  await page.locator('[data-testid="fp-close"]').click()

  // 4. events modal trips it
  await page.getByRole('button', { name: '⚡' }).click()
  await page.locator('[data-testid="event-row"]', { hasText: 'Trip K-101' }).click()
  await expect(page.locator('[data-fault]')).toHaveCount(1)
})
```

Adapt selectors/helpers to whatever the existing HMI e2e specs actually use (read one first — they encode the mode toggles and canvas selector). Known gotchas from memory: aim canvas clicks at multiples of 8; await widget count before pointer moves; combo options commit on `pointerdown`.

- [ ] **Step 2: Run it**

```bash
set -o pipefail
pkill -f "vite" || true
npx playwright test e2e/equip.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/equip.spec.ts
git commit -m "test(e2e): equip widget place/tag/start/trip flow"
```

### Task 8: Release v0.9.9

**Files:**
- Modify: `package.json` (version), memory file after deploy.

- [ ] **Step 1: Full gates**

```bash
set -o pipefail
npx tsc --noEmit && npx vitest run
pkill -f "vite" || true
npx playwright test
```

Expected: all green (585+ unit, 33 e2e).

- [ ] **Step 2: Version bump + commit**

```bash
npm version 0.9.9 --no-git-tag-version
git add package.json package-lock.json
git commit -m "feat: v0.9.9 — equipment pack: equip widget (compressor/blower/agitator/conveyor/heater) with motor dynamics, palette presets, import mapping"
```

- [ ] **Step 3: Build + deploy + verify**

```bash
npm run build
npx firebase-tools deploy --only hosting
# verify: dist asset hash appears in LIVE html (cache-busted)
ASSET=$(ls dist/assets/index-*.js | head -1 | xargs basename)
curl -s "https://pid-studio-praharsh.web.app/?cb=$RANDOM" | grep -c "$ASSET"
```

Expected: grep count ≥ 1 (retry after a minute if CDN lags — first read can serve the old bundle).

- [ ] **Step 4: Update project memory** — append the v0.9.9 entry (what shipped + any new gotchas) to `pid-studio-project.md`.

## Self-Review Notes

- Coverage: model/schema (T1), rendering (T2), sim/flow (T3), authoring UX (T4), import (T5), operations (T6), end-to-end (T7), ship (T8). Heat exchangers, custom HMI widget upload, vessel-shape fidelity, and a widget registry are explicitly **out of scope** (next releases).
- Type consistency: `equip` props carry only `symbolId` (already in the LEDGER); TagKind reused is `motor`; palette item type extended with optional `props` used by T4's test.
- Risk checked: remapping rotating equipment from `pump` → `equip` preserves flow-driving because T3 lands before T5 and both are gated by the full-suite regression run in T5 Step 4.
