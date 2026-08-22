# HMI Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an HMI workspace to PID Studio: build operator mimic screens from a widget palette, run them as an interactive simulation (faceplates, alarms, animated flow), and generate a working HMI from a P&ID sheet in one click.

**Architecture:** The HMI canvas is plain React SVG (deliberately not JointJS) so widgets are pure, animatable, and jsdom-testable. Screen *structure* lives in the existing zustand+zundo doc store (`ProjectDoc.hmiScreens`, schema v4); ephemeral *simulation state* lives in a separate non-temporal zustand store ticked at 5 Hz. All sim/import logic is DOM-free and table-tested.

**Tech Stack:** React 19 + TS strict, zustand/zundo, vitest (node env, `renderToStaticMarkup` for component smoke tests), Playwright. **Zero new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-22-hmi-studio-design.md`

## Global Constraints

- TypeScript strict; `npm run build` (tsc -b + vite) must stay green after every task.
- No new npm dependencies, runtime or dev. Trends/gauges are hand-drawn SVG.
- Everything under `src/hmi/` except `*.tsx` files must be DOM-free (importable in vitest node env).
- Run unit tests with `npm test` (vitest run, env node, include `tests/**/*.test.{ts,tsx}` after Task 3 widens the glob).
- e2e: `set -o pipefail` before any piped playwright command; use `expect.poll` for anything async-rendered; kill stale vite dev servers before trusting an e2e failure.
- Simulation is labeled "Training / demo simulation" in the UI (spec §1).
- Default theme `classic`; second theme `hp` (ISA-101 gray). Theme is per-screen.
- Commit style: `feat:`/`test:`/`docs:` one-liners, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Deploy checkpoints (end of Tasks 9, 18, 22, 24): `npm run build` then `npx firebase-tools deploy --only hosting`; verify live by comparing `dist/assets` content-hash filename against the live HTML.

## File Structure

```
src/hmi/
  model.ts             types, createScreen, WIDGET_DEFAULT_SIZE, HMI_WORLD      (Task 1)
  theme.ts             ThemeTokens + THEMES                                     (Task 3)
  editGeometry.ts      snap/hit-test/resize math, pure                          (Task 5)
  importFromPid.ts     Sheet -> HmiScreen                                       (Tasks 19-20)
  simStore.ts          non-temporal runtime store + engine loop hook            (Task 14)
  sim/noise.ts         seeded LCG rng                                           (Task 10)
  sim/tags.ts          TagDef table build from a screen                         (Task 10)
  sim/network.ts       pipes+widgets -> FlowNetwork branches                    (Task 11)
  sim/engine.ts        buildSimModel/initTags/tick (pure)                       (Task 12)
  sim/alarms.ts        ISA-18.2-style lifecycle                                 (Task 13)
  widgets/shared.ts    WidgetView interface                                     (Task 3)
  widgets/*.tsx        one pure component per widget type                       (Tasks 3-4)
  widgets/index.tsx    renderWidget() dispatch                                  (Task 4)
  HmiWorkspace.tsx     layout shell + workspace CSS                             (Task 6)
  ScreenTabs.tsx       screen tab strip                                         (Task 6)
  HmiToolbar.tsx       edit-mode toolbar + (Task 15) runtime controls           (Tasks 6,15)
  HmiPalette.tsx       widget palette (drag + click-to-add)                     (Task 7)
  HmiCanvas.tsx        SVG canvas: edit interactions + runtime rendering        (Tasks 7,15,16)
  HmiPropertyPanel.tsx bindings/limits/appearance editor                        (Task 8)
  Faceplate.tsx        pump/valve/controller/display popup                      (Task 16)
  AlarmBanner.tsx      blinking banner + Ack                                    (Task 17)
  hmi.css              all HMI styles (imported by HmiWorkspace, lazy chunk)    (Task 6)
tests/hmi/*.test.ts(x)                                                          (each task)
e2e/hmi.spec.ts                                                                 (Tasks 9,18,21,22)
```

Modified: `src/model/types.ts`, `src/model/doc.ts`, `src/model/migrate.ts`, `src/store/store.ts`, `src/App.tsx`, `src/panels/Toolbar.tsx`, `vite.config.ts`, `src/import/dexpi.ts` (add `hmiScreens: []` to its doc literal), `README.md`.

---

# Phase 1 — Workspace + builder

### Task 1: HMI model types + schema v4

**Files:**
- Create: `src/hmi/model.ts`
- Modify: `src/model/types.ts`, `src/model/doc.ts`, `src/model/migrate.ts`, `src/import/dexpi.ts`
- Test: `tests/hmi/model.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `HmiTheme`, `WidgetType`, `HmiWidget`, `HmiPipe`, `HmiScreen`, `createScreen(number: number): HmiScreen`, `WIDGET_DEFAULT_SIZE: Record<WidgetType, {w,h}>`, `HMI_WORLD = { w: 1600, h: 1000 }`; `ProjectDoc.schemaVersion: 4` and required `hmiScreens: HmiScreen[]`; `loadDoc` accepts v1–v4.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/model.test.ts
import { describe, expect, it } from 'vitest'
import { createScreen, WIDGET_DEFAULT_SIZE, HMI_WORLD } from '../../src/hmi/model'
import { createEmptyDoc } from '../../src/model/doc'
import { loadDoc } from '../../src/model/migrate'
import { serializeDoc, deserializeDoc } from '../../src/persist/file'

describe('hmi model + schema v4', () => {
  it('createScreen defaults to classic theme and empty content', () => {
    const s = createScreen(1)
    expect(s.name).toBe('Screen 1')
    expect(s.theme).toBe('classic')
    expect(s.widgets).toEqual([])
    expect(s.pipes).toEqual([])
    expect(s.id.length).toBeGreaterThan(10)
  })

  it('every widget type has a default size', () => {
    for (const t of ['tank','pump','valve','display','gauge','trend','lamp','button','switch','label','symbol'] as const) {
      expect(WIDGET_DEFAULT_SIZE[t].w).toBeGreaterThan(0)
    }
    expect(HMI_WORLD).toEqual({ w: 1600, h: 1000 })
  })

  it('new docs are schema v4 with hmiScreens', () => {
    const doc = createEmptyDoc()
    expect(doc.schemaVersion).toBe(4)
    expect(doc.hmiScreens).toEqual([])
  })

  it('migrates v3 (and v2) docs by adding empty hmiScreens', () => {
    const v3 = { ...createEmptyDoc(), schemaVersion: 3 } as unknown as Record<string, unknown>
    delete v3.hmiScreens
    const doc = loadDoc(v3)
    expect(doc.schemaVersion).toBe(4)
    expect(doc.hmiScreens).toEqual([])
  })

  it('round-trips hmiScreens through serialize/deserialize', () => {
    const doc = createEmptyDoc()
    doc.hmiScreens.push(createScreen(1))
    doc.hmiScreens[0]!.widgets.push({ id: 'w1', type: 'tank', x: 8, y: 8, w: 96, h: 128, tag: 'TK-1' })
    const back = deserializeDoc(serializeDoc(doc))
    expect(back.hmiScreens[0]!.widgets[0]!.tag).toBe('TK-1')
  })

  it('rejects malformed hmiScreens', () => {
    const bad = { ...createEmptyDoc(), hmiScreens: 'nope' }
    expect(() => loadDoc(bad)).toThrow(/hmiScreens/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/model.test.ts`
Expected: FAIL — `src/hmi/model` does not exist.

- [ ] **Step 3: Create `src/hmi/model.ts`**

```ts
import { ulid } from 'ulid'

export type HmiTheme = 'classic' | 'hp'

export type WidgetType =
  | 'tank' | 'pump' | 'valve' | 'display' | 'gauge' | 'trend'
  | 'lamp' | 'button' | 'switch' | 'label' | 'symbol'

export interface HmiWidget {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  rotation?: 0 | 90 | 180 | 270
  /** Primary tag, e.g. 'LT-101' or 'P-101'. Widgets read derived signals (.PV/.RUN/.OP). */
  tag?: string
  label?: string
  /**
   * Per-type extras. Keys used by the sim/import (all optional):
   * capacity, level0, throttle, LL, L, H, HH, unit, base, bindTank, bindPipe,
   * controller, symbolId, signal, writeValue, onLabel, offLabel.
   */
  props?: Record<string, string | number | boolean>
}

export interface HmiPipe {
  id: string
  /** Drawn/imported upstream -> downstream. */
  points: { x: number; y: number }[]
  /** P&ID edge id when imported (informational). */
  flowRef?: string
  width?: number
}

export interface HmiScreen {
  id: string
  name: string
  theme: HmiTheme
  widgets: HmiWidget[]
  pipes: HmiPipe[]
  /** Source sheet when created via import; enables Re-import. */
  fromSheetId?: string
}

/** Logical canvas size; the SVG scales to fit its container. */
export const HMI_WORLD = { w: 1600, h: 1000 }

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  tank: { w: 96, h: 128 },
  pump: { w: 56, h: 56 },
  valve: { w: 48, h: 32 },
  display: { w: 96, h: 40 },
  gauge: { w: 96, h: 96 },
  trend: { w: 192, h: 96 },
  lamp: { w: 32, h: 32 },
  button: { w: 80, h: 32 },
  switch: { w: 64, h: 32 },
  label: { w: 96, h: 24 },
  symbol: { w: 64, h: 64 },
}

export function createScreen(number: number): HmiScreen {
  return { id: ulid(), name: `Screen ${number}`, theme: 'classic', widgets: [], pipes: [] }
}
```

- [ ] **Step 4: Bump the schema**

In `src/model/types.ts`: add `import type { HmiScreen } from '../hmi/model'` (type-only import keeps model/ DOM-free), change `schemaVersion: 3` to `schemaVersion: 4` in `ProjectDoc`, and add `hmiScreens: HmiScreen[]` after `sheets`.

In `src/model/doc.ts` `createEmptyDoc`: change `schemaVersion: 3` to `4` and add `hmiScreens: []`.

In `src/model/migrate.ts`:
- `migrateV1`: return `schemaVersion: 4` and `hmiScreens: []`.
- The `version === 2 || version === 3` branch: also accept `4`. After the existing checks add:

```ts
if (doc.hmiScreens !== undefined && !Array.isArray(doc.hmiScreens)) {
  throw new DocError('hmiScreens is malformed')
}
if (Array.isArray(doc.hmiScreens)) {
  for (const s of doc.hmiScreens) {
    if (typeof s.id !== 'string' || !Array.isArray(s.widgets) || !Array.isArray(s.pipes)) {
      throw new DocError('hmiScreens is malformed')
    }
  }
}
return { ...doc, schemaVersion: 4, hmiScreens: doc.hmiScreens ?? [] } as ProjectDoc
```

Then run `npx tsc -b` and fix every literal `ProjectDoc` construction it flags (known: `src/import/dexpi.ts`; also any test fixtures) by adding `hmiScreens: []` / `schemaVersion: 4`.

- [ ] **Step 5: Run tests + build**

Run: `npm test -- tests/hmi/model.test.ts && npm test && npm run build`
Expected: new tests PASS; full suite PASS (fix any fixture fallout); build green.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: schema v4 — HMI screen model + migration"
```

### Task 2: Store slice for HMI screens

**Files:**
- Modify: `src/store/store.ts`
- Test: `tests/hmi/store.test.ts`

**Interfaces:**
- Consumes: `HmiScreen`, `HmiWidget`, `HmiPipe`, `createScreen` from `src/hmi/model`.
- Produces on `StoreState`: `activeScreenId: string | null`, `setActiveScreen(id)`, `addScreen(): string`, `addImportedScreen(screen: HmiScreen)`, `replaceScreen(screen: HmiScreen)`, `renameScreen(id, name)`, `deleteScreen(id)`, `setScreenTheme(id, theme)`, `addWidget(partial: Omit<HmiWidget,'id'>): string`, `updateWidget(id, patch: Partial<Omit<HmiWidget,'id'>>)`, `moveWidgets(ids: string[], dx, dy)`, `addHmiPipe(partial: Omit<HmiPipe,'id'>): string`, `updateHmiPipe(id, patch)`, `deleteHmiIds(ids: string[])` (removes widgets *and* pipes). Exported selector `activeHmiScreen(s): HmiScreen | null`. `loadIntoStore` sets `activeScreenId` to the first screen (or null).

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

describe('hmi store slice', () => {
  it('adds, renames, deletes screens and tracks the active one', () => {
    const st = () => useStore.getState()
    expect(st().activeScreenId).toBeNull()
    const id = st().addScreen()
    expect(st().activeScreenId).toBe(id)
    st().renameScreen(id, 'Overview')
    expect(activeHmiScreen(st())!.name).toBe('Overview')
    const id2 = st().addScreen()
    st().deleteScreen(id2)
    expect(st().activeScreenId).toBe(id)
    st().deleteScreen(id)
    expect(st().activeScreenId).toBeNull()
  })

  it('widget CRUD + move + delete are undoable', () => {
    const st = () => useStore.getState()
    st().addScreen()
    const wid = st().addWidget({ type: 'tank', x: 16, y: 16, w: 96, h: 128 })
    st().updateWidget(wid, { tag: 'TK-1' })
    st().moveWidgets([wid], 8, 16)
    const w = () => activeHmiScreen(st())!.widgets[0]
    expect(w()).toMatchObject({ tag: 'TK-1', x: 24, y: 32 })
    st().deleteHmiIds([wid])
    expect(activeHmiScreen(st())!.widgets).toHaveLength(0)
    st().undo()
    expect(activeHmiScreen(st())!.widgets).toHaveLength(1)
  })

  it('pipe CRUD and mixed delete', () => {
    const st = () => useStore.getState()
    st().addScreen()
    const pid = st().addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 80, y: 0 }] })
    st().updateHmiPipe(pid, { width: 6 })
    expect(activeHmiScreen(st())!.pipes[0]!.width).toBe(6)
    st().deleteHmiIds([pid])
    expect(activeHmiScreen(st())!.pipes).toHaveLength(0)
  })

  it('replaceScreen swaps content by id (re-import)', () => {
    const st = () => useStore.getState()
    const id = st().addScreen()
    st().replaceScreen({ id, name: 'HMI', theme: 'classic', widgets: [], pipes: [], fromSheetId: 'sh1' })
    expect(activeHmiScreen(st())!.fromSheetId).toBe('sh1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/store.test.ts`
Expected: FAIL — actions not defined.

- [ ] **Step 3: Implement the slice in `src/store/store.ts`**

Add to the interface the members listed under **Produces**. Implementation mirrors the sheet actions; add next to `patchSheet`:

```ts
const patchScreen = (updater: (screen: HmiScreen) => HmiScreen) => {
  set((s) => {
    const id = s.activeScreenId
    if (!id) return s
    return {
      doc: touched({
        ...s.doc,
        hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? updater(sc) : sc)),
      }),
      dirty: true,
    }
  })
}
```

Actions (all inside the store creator; `ulid()` for ids):

```ts
activeScreenId: null,
setActiveScreen: (id) => set({ activeScreenId: id }),
addScreen: () => {
  const screen = createScreen(get().doc.hmiScreens.length + 1)
  set((s) => ({ doc: touched({ ...s.doc, hmiScreens: [...s.doc.hmiScreens, screen] }), activeScreenId: screen.id, dirty: true }))
  return screen.id
},
addImportedScreen: (screen) =>
  set((s) => ({ doc: touched({ ...s.doc, hmiScreens: [...s.doc.hmiScreens, screen] }), activeScreenId: screen.id, dirty: true })),
replaceScreen: (screen) =>
  set((s) => ({ doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === screen.id ? screen : sc)) }), dirty: true })),
renameScreen: (id, name) =>
  set((s) => ({ doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? { ...sc, name } : sc)) }), dirty: true })),
setScreenTheme: (id, theme) =>
  set((s) => ({ doc: touched({ ...s.doc, hmiScreens: s.doc.hmiScreens.map((sc) => (sc.id === id ? { ...sc, theme } : sc)) }), dirty: true })),
deleteScreen: (id) =>
  set((s) => {
    const rest = s.doc.hmiScreens.filter((sc) => sc.id !== id)
    return {
      doc: touched({ ...s.doc, hmiScreens: rest }),
      activeScreenId: s.activeScreenId === id ? (rest[0]?.id ?? null) : s.activeScreenId,
      dirty: true,
    }
  }),
addWidget: (partial) => {
  const id = ulid()
  patchScreen((sc) => ({ ...sc, widgets: [...sc.widgets, { ...partial, id }] }))
  return id
},
updateWidget: (id, patch) =>
  patchScreen((sc) => ({ ...sc, widgets: sc.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
moveWidgets: (ids, dx, dy) =>
  patchScreen((sc) => ({ ...sc, widgets: sc.widgets.map((w) => (ids.includes(w.id) ? { ...w, x: w.x + dx, y: w.y + dy } : w)) })),
addHmiPipe: (partial) => {
  const id = ulid()
  patchScreen((sc) => ({ ...sc, pipes: [...sc.pipes, { ...partial, id }] }))
  return id
},
updateHmiPipe: (id, patch) =>
  patchScreen((sc) => ({ ...sc, pipes: sc.pipes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
deleteHmiIds: (ids) =>
  patchScreen((sc) => ({
    ...sc,
    widgets: sc.widgets.filter((w) => !ids.includes(w.id)),
    pipes: sc.pipes.filter((p) => !ids.includes(p.id)),
  })),
```

In `loadIntoStore`, also set `activeScreenId: doc.hmiScreens[0]?.id ?? null`. Export the selector:

```ts
export function activeHmiScreen(s: Pick<StoreState, 'doc' | 'activeScreenId'>): HmiScreen | null {
  return s.doc.hmiScreens.find((sc) => sc.id === s.activeScreenId) ?? null
}
```

Check zundo config: if the store's `temporal` options use `partialize`, include `hmiScreens` implicitly by partializing on `doc` (it already does — the doc is one object; no change needed unless a field list exists).

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/store.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: store slice for HMI screens (undoable widget/pipe CRUD)"
```

### Task 3: Theme tokens + process widgets (tank, pump, valve, lamp, label)

**Files:**
- Create: `src/hmi/theme.ts`, `src/hmi/widgets/shared.ts`, `src/hmi/widgets/tank.tsx`, `src/hmi/widgets/pump.tsx`, `src/hmi/widgets/valve.tsx`, `src/hmi/widgets/lamp.tsx`, `src/hmi/widgets/label.tsx`
- Modify: `vite.config.ts` (test include glob)
- Test: `tests/hmi/widgets1.test.tsx`

**Interfaces:**
- Consumes: `HmiWidget`, `HmiTheme` from model.
- Produces: `ThemeTokens`, `THEMES: Record<HmiTheme, ThemeTokens>`; `WidgetView { widget, theme, sim, history?, alarm? }`; components `Tank`, `Pump`, `Valve`, `Lamp`, `LabelText` — each `(view: WidgetView) => JSX`, rendering into a `<g>` positioned by the CALLER (components draw in local 0,0..w,h space).

- [ ] **Step 1: Widen the vitest glob**

In `vite.config.ts` set `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']`.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/hmi/widgets1.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { THEMES } from '../../src/hmi/theme'
import Tank from '../../src/hmi/widgets/tank'
import Pump from '../../src/hmi/widgets/pump'
import Valve from '../../src/hmi/widgets/valve'
import Lamp from '../../src/hmi/widgets/lamp'
import type { HmiWidget } from '../../src/hmi/model'

const w = (over: Partial<HmiWidget>): HmiWidget =>
  ({ id: 'w', type: 'tank', x: 0, y: 0, w: 96, h: 128, ...over })

const render = (el: React.ReactElement) => renderToStaticMarkup(<svg>{el}</svg>)

describe('process widgets', () => {
  it('tank clips liquid to the level PV', () => {
    const html = render(<Tank widget={w({ tag: 'TK-1' })} theme={THEMES.classic} sim={{ PV: 25 }} />)
    expect(html).toContain('TK-1')
    expect(html).toContain('25')          // % readout
    expect(html).toContain(THEMES.classic.liquid)
  })
  it('pump colors by RUN state in classic, stays gray in hp', () => {
    const run = render(<Pump widget={w({ type: 'pump', w: 56, h: 56, tag: 'P-1' })} theme={THEMES.classic} sim={{ RUN: 1 }} />)
    const stop = render(<Pump widget={w({ type: 'pump', w: 56, h: 56, tag: 'P-1' })} theme={THEMES.classic} sim={{ RUN: 0 }} />)
    expect(run).toContain(THEMES.classic.running)
    expect(stop).toContain(THEMES.classic.stopped)
    const hp = render(<Pump widget={w({ type: 'pump', w: 56, h: 56 })} theme={THEMES.hp} sim={{ RUN: 1 }} />)
    expect(hp).not.toContain(THEMES.classic.running)
  })
  it('throttling valve shows percent, on/off valve shows state color', () => {
    const t = render(<Valve widget={w({ type: 'valve', w: 48, h: 32, tag: 'LV-1', props: { throttle: true } })} theme={THEMES.classic} sim={{ OP: 37 }} />)
    expect(t).toContain('37')
    const o = render(<Valve widget={w({ type: 'valve', w: 48, h: 32 })} theme={THEMES.classic} sim={{ OPEN: 1 }} />)
    expect(o).toContain(THEMES.classic.open)
  })
  it('lamp reads its bound signal', () => {
    const on = render(<Lamp widget={w({ type: 'lamp', w: 32, h: 32, props: { signal: 'P-1.RUN' } })} theme={THEMES.classic} sim={{ 'P-1.RUN': 1 }} />)
    expect(on).toContain(THEMES.classic.running)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/hmi/widgets1.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement theme + shared + widgets**

`src/hmi/theme.ts`:

```ts
import type { HmiTheme } from './model'

export interface ThemeTokens {
  bg: string; grid: string; text: string; textDim: string
  equipStroke: string; equipFill: string
  running: string; stopped: string; open: string; closed: string
  liquid: string; pipe: string; pipeFlow: string
  alarm: string; alarmAck: string; warn: string
  sp: string; op: string; panel: string
}

export const THEMES: Record<HmiTheme, ThemeTokens> = {
  classic: {
    bg: '#0f2338', grid: '#16324e', text: '#e8f0fa', textDim: '#8fa8c0',
    equipStroke: '#9fb6cc', equipFill: '#1b3a58',
    running: '#26c281', stopped: '#e0455a', open: '#26c281', closed: '#e0455a',
    liquid: '#38a8e8', pipe: '#5c789a', pipeFlow: '#7fd4ff',
    alarm: '#ff4d4d', alarmAck: '#ffb020', warn: '#ffb020',
    sp: '#ffd166', op: '#9b8cff', panel: '#132c46',
  },
  hp: {
    bg: '#d9d9d9', grid: '#cfcfcf', text: '#1f1f1f', textDim: '#5a5a5a',
    equipStroke: '#4a4a4a', equipFill: '#c4c4c4',
    running: '#3d3d3d', stopped: '#f0f0f0', open: '#3d3d3d', closed: '#f0f0f0',
    liquid: '#a8b8c4', pipe: '#8a8a8a', pipeFlow: '#6a7f92',
    alarm: '#d92b2b', alarmAck: '#e08a00', warn: '#e08a00',
    sp: '#2b5cd9', op: '#6a4fd9', panel: '#e8e8e8',
  },
}
```

`src/hmi/widgets/shared.ts`:

```ts
import type { HmiWidget } from '../model'
import type { ThemeTokens } from '../theme'

export interface WidgetView {
  widget: HmiWidget
  theme: ThemeTokens
  /** Live values: own-tag signals ('PV','RUN','OP','OPEN','SP','MODE') plus any
   *  fully-qualified 'TAG.SIGNAL' keys a props.signal binding asks for. Empty in edit mode. */
  sim: Record<string, number>
  history?: number[]
  alarm?: 'none' | 'unacked' | 'acked'
}

export const fmt = (v: number | undefined, digits = 1): string =>
  v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits)
```

`src/hmi/widgets/tank.tsx`:

```tsx
import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Tank({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const level = Math.max(0, Math.min(100, sim.PV ?? 0))
  const liquidH = ((h - 8) * level) / 100
  const r = Math.min(12, w / 4)
  return (
    <g>
      <rect x={2} y={2} width={w - 4} height={h - 4} rx={r} fill={theme.equipFill} stroke={theme.equipStroke} strokeWidth={2} />
      <clipPath id={`clip-${widget.id}`}>
        <rect x={4} y={4} width={w - 8} height={h - 8} rx={r - 2} />
      </clipPath>
      <rect x={4} y={4 + (h - 8) - liquidH} width={w - 8} height={liquidH} fill={theme.liquid} clipPath={`url(#clip-${widget.id})`} />
      <text x={w / 2} y={h / 2} textAnchor="middle" fill={theme.text} fontSize={13} fontWeight={600}>{fmt(sim.PV, 0)}%</text>
      <text x={w / 2} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/pump.tsx`:

```tsx
import type { WidgetView } from './shared'

export default function Pump({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const r = Math.min(w, h) / 2 - 4
  const cx = w / 2, cy = h / 2
  const running = (sim.RUN ?? 0) >= 0.5
  const fill = running ? theme.running : theme.stopped
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <g className={running ? 'hmi-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M ${cx} ${cy} L ${cx + r * 0.8} ${cy - r * 0.45} L ${cx + r * 0.8} ${cy + r * 0.45} Z`} fill={theme.bg} opacity={0.85} />
      </g>
      <text x={cx} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/valve.tsx`:

```tsx
import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Valve({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const throttle = widget.props?.throttle === true
  const frac = throttle ? Math.max(0, Math.min(1, (sim.OP ?? 0) / 100)) : ((sim.OPEN ?? 0) >= 0.5 ? 1 : 0)
  const fill = frac > 0.02 ? theme.open : theme.closed
  const midX = w / 2, botY = h - 2
  return (
    <g>
      <polygon points={`2,2 ${midX},${h / 2} 2,${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      <polygon points={`${w - 2},2 ${midX},${h / 2} ${w - 2},${botY}`} fill={fill} stroke={theme.equipStroke} strokeWidth={2} />
      {throttle && (
        <text x={midX} y={-4} textAnchor="middle" fill={theme.text} fontSize={11}>{fmt(sim.OP, 0)}%</text>
      )}
      <text x={midX} y={h + 14} textAnchor="middle" fill={theme.textDim} fontSize={11}>{widget.tag ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/lamp.tsx`:

```tsx
import type { WidgetView } from './shared'

export default function Lamp({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const key = typeof widget.props?.signal === 'string' ? widget.props.signal : ''
  const on = (sim[key] ?? 0) >= 0.5
  return (
    <g>
      <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 3} fill={on ? theme.running : theme.panel} stroke={theme.equipStroke} strokeWidth={2} />
      <text x={w / 2} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.label ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/label.tsx`:

```tsx
import type { WidgetView } from './shared'

export default function LabelText({ widget, theme }: WidgetView) {
  return (
    <text x={0} y={widget.h / 2 + 4} fill={theme.text} fontSize={Math.max(12, widget.h - 10)}>
      {widget.label ?? 'Text'}
    </text>
  )
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/hmi/widgets1.test.tsx`
Expected: PASS (fix the theme.ts hex typo if TS/tests complain).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: HMI theme tokens + tank/pump/valve/lamp/label widgets"
```

### Task 4: Indicator widgets (display, gauge, button, switch, trend, symbol) + dispatch

**Files:**
- Create: `src/hmi/widgets/display.tsx`, `src/hmi/widgets/gauge.tsx`, `src/hmi/widgets/button.tsx`, `src/hmi/widgets/switchw.tsx`, `src/hmi/widgets/trend.tsx`, `src/hmi/widgets/symbol.tsx`, `src/hmi/widgets/index.tsx`
- Test: `tests/hmi/widgets2.test.tsx`

**Interfaces:**
- Consumes: `WidgetView`, `THEMES`, `getSymbol` from `src/symbols/registry`.
- Produces: components `Display`, `Gauge`, `PushButton`, `ToggleSwitch`, `Trend`, `SymbolGraphic`; `renderWidget(view: WidgetView): React.ReactElement` dispatching on `view.widget.type` (used by the canvas from Task 7 on).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/widgets2.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { THEMES } from '../../src/hmi/theme'
import { renderWidget } from '../../src/hmi/widgets/index'
import type { HmiWidget } from '../../src/hmi/model'

const mk = (over: Partial<HmiWidget>): HmiWidget =>
  ({ id: 'w1', type: 'display', x: 0, y: 0, w: 96, h: 40, ...over })
const render = (widget: HmiWidget, sim: Record<string, number> = {}, history?: number[]) =>
  renderToStaticMarkup(<svg>{renderWidget({ widget, theme: THEMES.classic, sim, history })}</svg>)

describe('indicator widgets', () => {
  it('display shows value + unit and alarm border when in alarm', () => {
    const html = render(mk({ tag: 'LT-101', props: { unit: '%' } }), { PV: 42.4 })
    expect(html).toContain('42.4')
    expect(html).toContain('%')
    const alarmed = renderToStaticMarkup(<svg>{renderWidget({ widget: mk({}), theme: THEMES.classic, sim: { PV: 97 }, alarm: 'unacked' })}</svg>)
    expect(alarmed).toContain(THEMES.classic.alarm)
  })
  it('gauge needle angle tracks PV across min..max', () => {
    const lo = render(mk({ type: 'gauge', w: 96, h: 96 }), { PV: 0 })
    const hi = render(mk({ type: 'gauge', w: 96, h: 96 }), { PV: 100 })
    expect(lo).not.toEqual(hi)
    expect(lo).toContain('rotate(-120')
    expect(hi).toContain('rotate(120')
  })
  it('trend draws a polyline from history', () => {
    const html = render(mk({ type: 'trend', w: 192, h: 96 }), {}, [10, 50, 90])
    expect(html).toContain('polyline')
  })
  it('button and switch render labels', () => {
    expect(render(mk({ type: 'button', label: 'START' }))).toContain('START')
    expect(render(mk({ type: 'switch', props: { onLabel: 'AUTO' } }), { 'X.Y': 1 })).toContain('AUTO')
  })
  it('symbol widget embeds a registry symbol scaled to its box', () => {
    const html = render(mk({ type: 'symbol', w: 64, h: 64, props: { symbolId: 'valve.gate' } }))
    expect(html).toContain('data-hmi-symbol="valve.gate"')
  })
  it('renderWidget covers every type without throwing', () => {
    for (const type of ['tank','pump','valve','display','gauge','trend','lamp','button','switch','label','symbol'] as const) {
      expect(() => render(mk({ type, props: type === 'symbol' ? { symbolId: 'valve.gate' } : undefined }))).not.toThrow()
    }
  })
})
```

Note: `valve.gate` must be a real registry id — check `src/symbols/lib/valves-manual.ts` for the exact gate-valve id at implementation time and use that string in both test and (if needed) defaults. If it differs (e.g. `valve.manual.gate`), update the test string.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/widgets2.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement the widgets**

`src/hmi/widgets/display.tsx`:

```tsx
import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Display({ widget, theme, sim, alarm }: WidgetView) {
  const { w, h } = widget
  const unit = typeof widget.props?.unit === 'string' ? widget.props.unit : ''
  const border = alarm === 'unacked' ? theme.alarm : alarm === 'acked' ? theme.alarmAck : theme.equipStroke
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} fill={theme.panel} stroke={border} strokeWidth={alarm && alarm !== 'none' ? 3 : 1.5} />
      <text x={8} y={h / 2 + 5} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''}</text>
      <text x={w - 8} y={h / 2 + 5} textAnchor="end" fill={theme.text} fontSize={14} fontWeight={600}>
        {fmt(sim.PV)}{unit ? ` ${unit}` : ''}
      </text>
    </g>
  )
}
```

`src/hmi/widgets/gauge.tsx` — needle sweeps −120°..+120° over `props.min ?? 0` .. `props.max ?? 100`:

```tsx
import type { WidgetView } from './shared'
import { fmt } from './shared'

export default function Gauge({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const min = Number(widget.props?.min ?? 0)
  const max = Number(widget.props?.max ?? 100)
  const pv = sim.PV ?? min
  const frac = max > min ? Math.max(0, Math.min(1, (pv - min) / (max - min))) : 0
  const angle = -120 + 240 * frac
  const cx = w / 2, cy = h * 0.58, r = Math.min(w, h) * 0.42
  const arc = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const s = arc(-120), e = arc(120)
  return (
    <g>
      <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`} fill="none" stroke={theme.equipStroke} strokeWidth={4} strokeLinecap="round" />
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke={theme.text} strokeWidth={2.5} />
      </g>
      <circle cx={cx} cy={cy} r={3.5} fill={theme.text} />
      <text x={cx} y={cy + r * 0.7} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={600}>{fmt(pv, 0)}</text>
      <text x={cx} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{widget.tag ?? widget.label ?? ''}</text>
    </g>
  )
}
```

`src/hmi/widgets/button.tsx` (pure visual; the canvas wires pointer events):

```tsx
import type { WidgetView } from './shared'

export default function PushButton({ widget, theme }: WidgetView) {
  const { w, h } = widget
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={6} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fill={theme.text} fontSize={12} fontWeight={600}>
        {widget.label ?? 'BUTTON'}
      </text>
    </g>
  )
}
```

`src/hmi/widgets/switchw.tsx` — reads its bound signal (`props.signal`, fully-qualified key in `sim`), shows `onLabel`/`offLabel`:

```tsx
import type { WidgetView } from './shared'

export default function ToggleSwitch({ widget, theme, sim }: WidgetView) {
  const { w, h } = widget
  const key = typeof widget.props?.signal === 'string' ? widget.props.signal : ''
  const on = (sim[key] ?? Object.values(sim)[0] ?? 0) >= 0.5
  const text = on
    ? String(widget.props?.onLabel ?? 'ON')
    : String(widget.props?.offLabel ?? 'OFF')
  const knobX = on ? w - h / 2 - 3 : h / 2 + 3
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={(h - 2) / 2} fill={on ? theme.running : theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      <circle cx={knobX} cy={h / 2} r={h / 2 - 5} fill={theme.text} />
      <text x={w / 2} y={h + 12} textAnchor="middle" fill={theme.textDim} fontSize={10}>{text}</text>
    </g>
  )
}
```

`src/hmi/widgets/trend.tsx` — draws `history` (0..100 range by default) right-aligned:

```tsx
import type { WidgetView } from './shared'
import { fmt } from './shared'

const CAP = 600

export default function Trend({ widget, theme, sim, history = [] }: WidgetView) {
  const { w, h } = widget
  const min = Number(widget.props?.min ?? 0)
  const max = Number(widget.props?.max ?? 100)
  const span = max - min || 1
  const pts = history.slice(-CAP)
  const step = pts.length > 1 ? (w - 8) / (pts.length - 1) : 0
  const path = pts.map((v, i) => `${4 + i * step},${4 + (h - 8) * (1 - (v - min) / span)}`).join(' ')
  return (
    <g>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={theme.panel} stroke={theme.equipStroke} strokeWidth={1.5} />
      {pts.length > 1 && <polyline points={path} fill="none" stroke={theme.liquid} strokeWidth={2} />}
      <text x={6} y={12} fill={theme.textDim} fontSize={10}>{widget.tag ?? ''} {fmt(sim.PV)}</text>
    </g>
  )
}
```

`src/hmi/widgets/symbol.tsx` — reuses the P&ID symbol renderers (spec §5). Symbols draw in `gridSize*8` local px with `currentColor` strokes; scale to the widget box and tint:

```tsx
import { getSymbol } from '../../symbols/registry'
import type { WidgetView } from './shared'

export default function SymbolGraphic({ widget, theme, sim }: WidgetView) {
  const id = typeof widget.props?.symbolId === 'string' ? widget.props.symbolId : ''
  let inner = '', sw = 8, sh = 8
  try {
    const def = getSymbol(id)
    inner = def.render(widget.props as Record<string, string> ?? {})
    sw = def.gridSize.w * 8
    sh = def.gridSize.h * 8
  } catch {
    inner = '<rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor"/>'
    sw = sh = 32
  }
  const on = (sim.RUN ?? sim.OPEN ?? 0) >= 0.5
  const color = on ? theme.running : theme.equipStroke
  const scale = Math.min(widget.w / sw, widget.h / sh)
  return (
    <g data-hmi-symbol={id} color={color} transform={`scale(${scale})`}
       dangerouslySetInnerHTML={{ __html: inner }} />
  )
}
```

`src/hmi/widgets/index.tsx`:

```tsx
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
```

Import note: the registry map fills when `src/symbols/lib/index.ts` registers the catalog — check how existing non-canvas code triggers registration (`import '../symbols/lib'` side effect) and add the same side-effect import at the top of `widgets/index.tsx` if `getSymbol` comes back empty in tests.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/widgets2.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: HMI indicator widgets + renderWidget dispatch"
```

### Task 5: Edit-geometry helpers

**Files:**
- Create: `src/hmi/editGeometry.ts`
- Test: `tests/hmi/editGeometry.test.ts`

**Interfaces:**
- Consumes: `HmiScreen`, `HmiWidget`, `HmiPipe`.
- Produces: `snap8(v: number): number`; `widgetRect(w: HmiWidget): {x,y,w,h}`; `hitWidget(screen, pt: {x,y}): HmiWidget | null` (topmost = last in array); `hitPipe(screen, pt, tol?: number): HmiPipe | null`; `type Handle = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'`; `HANDLES: Handle[]`; `handlePoint(rect, h: Handle): {x,y}`; `resizeRect(rect, h: Handle, dx, dy, min?: number): {x,y,w,h}`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/editGeometry.test.ts
import { describe, expect, it } from 'vitest'
import { snap8, hitWidget, hitPipe, resizeRect, handlePoint } from '../../src/hmi/editGeometry'
import type { HmiScreen } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'a', type: 'tank', x: 0, y: 0, w: 100, h: 100 },
    { id: 'b', type: 'pump', x: 50, y: 50, w: 100, h: 100 },
  ],
  pipes: [{ id: 'p', points: [{ x: 200, y: 0 }, { x: 200, y: 300 }] }],
}

describe('editGeometry', () => {
  it('snap8 rounds to the 8px grid', () => {
    expect(snap8(11)).toBe(8)
    expect(snap8(12.1)).toBe(16)
    expect(snap8(-3)).toBe(0)
  })
  it('hitWidget returns topmost (later array wins) and null outside', () => {
    expect(hitWidget(screen, { x: 75, y: 75 })!.id).toBe('b')
    expect(hitWidget(screen, { x: 10, y: 10 })!.id).toBe('a')
    expect(hitWidget(screen, { x: 400, y: 400 })).toBeNull()
  })
  it('hitPipe uses segment distance with tolerance', () => {
    expect(hitPipe(screen, { x: 204, y: 150 })!.id).toBe('p')
    expect(hitPipe(screen, { x: 220, y: 150 })).toBeNull()
  })
  it('resizeRect drags handles with a minimum size', () => {
    const r = { x: 0, y: 0, w: 100, h: 100 }
    expect(resizeRect(r, 'se', 20, 12)).toEqual({ x: 0, y: 0, w: 120, h: 112 })
    expect(resizeRect(r, 'nw', 30, 40)).toEqual({ x: 30, y: 40, w: 70, h: 60 })
    expect(resizeRect(r, 'e', -200, 0).w).toBe(16)
  })
  it('handlePoint locates corner and edge handles', () => {
    expect(handlePoint({ x: 0, y: 0, w: 100, h: 100 }, 'se')).toEqual({ x: 100, y: 100 })
    expect(handlePoint({ x: 0, y: 0, w: 100, h: 100 }, 'n')).toEqual({ x: 50, y: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/editGeometry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/editGeometry.ts`**

```ts
import type { HmiPipe, HmiScreen, HmiWidget } from './model'

export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const snap8 = (v: number): number => Math.round(v / 8) * 8

export const widgetRect = (w: HmiWidget): Rect => ({ x: w.x, y: w.y, w: w.w, h: w.h })

export function hitWidget(screen: HmiScreen, pt: { x: number; y: number }): HmiWidget | null {
  for (let i = screen.widgets.length - 1; i >= 0; i--) {
    const w = screen.widgets[i]!
    if (pt.x >= w.x && pt.x <= w.x + w.w && pt.y >= w.y && pt.y <= w.y + w.h) return w
  }
  return null
}

function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const px = a.x + t * dx - p.x, py = a.y + t * dy - p.y
  return Math.hypot(px, py)
}

export function hitPipe(screen: HmiScreen, pt: { x: number; y: number }, tol = 6): HmiPipe | null {
  for (let i = screen.pipes.length - 1; i >= 0; i--) {
    const p = screen.pipes[i]!
    for (let k = 0; k + 1 < p.points.length; k++) {
      if (segDist(pt, p.points[k]!, p.points[k + 1]!) <= tol) return p
    }
  }
  return null
}

export function handlePoint(r: Rect, h: Handle): { x: number; y: number } {
  const mx = r.x + r.w / 2, my = r.y + r.h / 2
  switch (h) {
    case 'nw': return { x: r.x, y: r.y }
    case 'n': return { x: mx, y: r.y }
    case 'ne': return { x: r.x + r.w, y: r.y }
    case 'e': return { x: r.x + r.w, y: my }
    case 'se': return { x: r.x + r.w, y: r.y + r.h }
    case 's': return { x: mx, y: r.y + r.h }
    case 'sw': return { x: r.x, y: r.y + r.h }
    case 'w': return { x: r.x, y: my }
  }
}

export function resizeRect(r: Rect, h: Handle, dx: number, dy: number, min = 16): Rect {
  let { x, y, w, h: hh } = r
  const west = h.includes('w'), east = h.includes('e')
  const north = h.startsWith('n'), south = h.startsWith('s')
  if (east) w = Math.max(min, r.w + dx)
  if (south) hh = Math.max(min, r.h + dy)
  if (west) { const nw = Math.max(min, r.w - dx); x = r.x + (r.w - nw); w = nw }
  if (north) { const nh = Math.max(min, r.h - dy); y = r.y + (r.h - nh); hh = nh }
  return { x, y, w, h: hh }
}
```

Careful: `'sw'` — `startsWith('s')` is true and `includes('w')` is true, which is correct (south + west). `'se'`: south + east. Handles `'n'|'s'` only move one axis because neither `includes('w')` nor `includes('e')` matches... except `'nw'` also `startsWith('n')` — again correct (north + west). Verify against the test table.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/editGeometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: HMI edit geometry (snap, hit-test, resize)"
```

### Task 6: Workspace shell — App toggle, HmiWorkspace, ScreenTabs, HmiToolbar, hmi.css

**Files:**
- Create: `src/hmi/HmiWorkspace.tsx`, `src/hmi/ScreenTabs.tsx`, `src/hmi/HmiToolbar.tsx`, `src/hmi/hmi.css`
- Modify: `src/App.tsx`, `src/panels/Toolbar.tsx`
- Test: `tests/hmi/workspace.test.tsx`

**Interfaces:**
- Consumes: store slice (Task 2).
- Produces: `HmiWorkspace({ onExit }: { onExit(): void })` default export; App pref key `'pid.ui.workspace'` (`'pid' | 'hmi'`); `Toolbar` gains optional prop `onOpenHmi?: () => void`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/workspace.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiWorkspace from '../../src/hmi/HmiWorkspace'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

describe('HmiWorkspace shell', () => {
  it('shows the empty state when the doc has no screens', () => {
    const html = renderToStaticMarkup(<HmiWorkspace onExit={() => {}} />)
    expect(html).toContain('New screen')
    expect(html).toContain('Build from P&amp;ID')
  })
  it('renders screen tabs and the canvas once a screen exists', () => {
    useStore.getState().addScreen()
    const html = renderToStaticMarkup(<HmiWorkspace onExit={() => {}} />)
    expect(html).toContain('Screen 1')
    expect(html).toContain('data-testid="hmi-canvas"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/workspace.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the shell**

`src/hmi/hmi.css` (imported only by HmiWorkspace → ships in the lazy chunk):

```css
.hmi {
  height: 100%;
  display: grid;
  grid-template-areas: "toolbar toolbar toolbar" "palette center props" "status status status";
  grid-template-rows: 40px 1fr 24px;
  grid-template-columns: 200px 1fr 280px;
}
.hmi.run-mode { grid-template-columns: 0 1fr 0; }
.hmi-toolbar { grid-area: toolbar; display: flex; align-items: center; gap: 6px; padding: 0 10px; background: #182c44; color: #dce8f4; }
.hmi-toolbar button { background: #24405f; color: inherit; border: 1px solid #35567c; border-radius: 4px; padding: 3px 10px; cursor: pointer; }
.hmi-toolbar button:hover { background: #2d4f75; }
.hmi-toolbar button.active { background: #2b6cb0; border-color: #2b6cb0; }
.hmi-toolbar .grow { flex: 1; }
.hmi-toolbar .demo-note { font-size: 10px; opacity: 0.65; }
.hmi-side { grid-area: palette; overflow-y: auto; background: #f4f6f9; border-right: 1px solid #d5d5d5; }
.hmi-props { grid-area: props; overflow-y: auto; background: #f4f6f9; border-left: 1px solid #d5d5d5; padding: 10px; }
.hmi-center { grid-area: center; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.hmi-canvas-wrap { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: auto; background: #0a1826; }
.hmi-canvas-wrap svg { max-width: 100%; max-height: 100%; }
.hmi-status { grid-area: status; display: flex; align-items: center; gap: 12px; padding: 0 10px; font-size: 11px; background: #f0f0f4; border-top: 1px solid #d5d5d5; }
.hmi-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #dce8f4; }
.hmi-empty button { font-size: 14px; padding: 8px 18px; }
.hmi-tabs { display: flex; gap: 2px; padding: 2px 6px; background: #10243a; }
.hmi-tab { padding: 3px 12px; font-size: 12px; color: #9db4cc; background: #16324e; border-radius: 4px 4px 0 0; cursor: pointer; display: flex; gap: 6px; }
.hmi-tab.active { background: #2b6cb0; color: #fff; }
@keyframes hmi-spin { to { transform: rotate(360deg); } }
.hmi-spin { animation: hmi-spin 1.2s linear infinite; }
@keyframes hmi-dash { to { stroke-dashoffset: -24; } }
.hmi-flow { animation: hmi-dash 1s linear infinite; }
@keyframes hmi-blink { 50% { opacity: 0.15; } }
.hmi-blink { animation: hmi-blink 0.9s step-start infinite; }
.hmi-widget.selected { outline: none; }
```

`src/hmi/ScreenTabs.tsx` — copy the structure of `src/panels/SheetTabs.tsx` verbatim, substituting: `doc.hmiScreens` / `activeScreenId` / `setActiveScreen` / `addScreen` / `renameScreen` / `deleteScreen`, class names `hmi-tabs` / `hmi-tab`, delete confirm text `Delete ${sc.name}?`, and allow deleting the last screen (no `length > 1` guard).

`src/hmi/HmiToolbar.tsx` (edit-mode subset for now; runtime controls arrive in Task 15):

```tsx
import { useStore } from '../store/store'

export default function HmiToolbar({ onExit }: { onExit(): void }) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const name = useStore((s) => s.doc.meta.name)
  return (
    <header className="hmi-toolbar">
      <strong>HMI Studio</strong>
      <span style={{ opacity: 0.7 }}>{name}</span>
      <button onClick={onExit} title="Back to the P&ID editor">⇄ P&ID</button>
      <span className="grow" />
      <button onClick={undo} title="Ctrl+Z">↩</button>
      <button onClick={redo} title="Ctrl+Y">↪</button>
      <span className="demo-note">Training / demo simulation — not for operations</span>
    </header>
  )
}
```

`src/hmi/HmiWorkspace.tsx`:

```tsx
import './hmi.css'
import { useStore, activeHmiScreen } from '../store/store'
import HmiToolbar from './HmiToolbar'
import ScreenTabs from './ScreenTabs'

export default function HmiWorkspace({ onExit }: { onExit(): void }) {
  const screen = useStore(activeHmiScreen)
  const addScreen = useStore((s) => s.addScreen)
  return (
    <div className="hmi">
      <HmiToolbar onExit={onExit} />
      <div className="hmi-side" />
      <div className="hmi-center">
        {screen ? (
          <>
            <div className="hmi-canvas-wrap">
              <svg data-testid="hmi-canvas" viewBox="0 0 1600 1000" />
            </div>
            <ScreenTabs />
          </>
        ) : (
          <div className="hmi-empty">
            <p>No HMI screens yet.</p>
            <button onClick={addScreen}>New screen</button>
            <button disabled title="Coming in a later task">Build from P&ID sheet…</button>
          </div>
        )}
      </div>
      <div className="hmi-props" />
      <div className="hmi-status"><span>HMI workspace</span></div>
    </div>
  )
}
```

(The placeholder `<svg>` is replaced by `<HmiCanvas/>` in Task 7; the empty side/props divs fill in Tasks 7–8. The "Build from P&ID sheet…" button enables in Task 21.)

`src/App.tsx` — add the workspace switch:

```tsx
import { lazy, Suspense, useState } from 'react'
const HmiWorkspace = lazy(() => import('./hmi/HmiWorkspace'))
// inside App():
const [workspace, setWorkspaceState] = useState<'pid' | 'hmi'>(() =>
  (localStorage.getItem('pid.ui.workspace') === 'hmi' ? 'hmi' : 'pid'))
const setWorkspace = (w: 'pid' | 'hmi') => {
  setWorkspaceState(w)
  try { localStorage.setItem('pid.ui.workspace', w) } catch { /* ignore */ }
}
if (workspace === 'hmi') {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading HMI workspace…</div>}>
      <HmiWorkspace onExit={() => setWorkspace('pid')} />
    </Suspense>
  )
}
// existing return: pass <Toolbar onOpenHmi={() => setWorkspace('hmi')} />
```

Wrap the raw `localStorage.getItem` in the same try/catch style as `readPref` (private mode). `src/panels/Toolbar.tsx`: change the signature to `export default function Toolbar({ onOpenHmi }: { onOpenHmi?: () => void })` and insert after the `Fit` button:

```tsx
<span className="tb-sep" />
<button onClick={onOpenHmi} title="Switch to the HMI workspace" data-testid="open-hmi">HMI ⇄</button>
```

- [ ] **Step 4: Run tests + build**

Run: `npm test -- tests/hmi/workspace.test.tsx && npm test && npm run build`
Expected: PASS; build green (confirms the lazy chunk splits — look for a separate `HmiWorkspace-*.js` in the vite output listing).

- [ ] **Step 5: Manual smoke**

Run: `npm run dev` — click `HMI ⇄`, see empty state, add a screen, rename it, switch back to P&ID. (Kill the dev server after.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: HMI workspace shell with lazy chunk + screen tabs"
```

### Task 7: HmiCanvas edit mode + palette (select, drag, resize, nudge, delete, drag-drop add)

**Files:**
- Create: `src/hmi/HmiCanvas.tsx`, `src/hmi/HmiPalette.tsx`
- Modify: `src/hmi/HmiWorkspace.tsx` (mount both, hold selection state)
- Test: `tests/hmi/canvas.test.tsx`

**Interfaces:**
- Consumes: `renderWidget`, `THEMES`, `editGeometry`, store slice.
- Produces: `HmiCanvas({ screen, selection, onSelect, mode })` where `mode: 'edit' | 'run'` (run behavior lands in Tasks 15–16; for now run renders without handles); `HmiPalette()` (drag source, MIME `'application/x-hmi-widget'`, payload `JSON.stringify({ type })`); selection state lives in `HmiWorkspace` as `useState<string[]>` and is passed down (property panel needs it in Task 8). Widgets render at `translate(x,y)`; pipes as polylines under widgets.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/canvas.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiCanvas from '../../src/hmi/HmiCanvas'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

describe('HmiCanvas edit rendering', () => {
  it('renders widgets, pipes, selection handles, and the theme background', () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 100, y: 80, w: 96, h: 128, tag: 'TK-1' })
    st.addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const screen = activeHmiScreen(useStore.getState())!
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[wid]} onSelect={() => {}} mode="edit" />)
    expect(html).toContain('data-testid="hmi-canvas"')
    expect(html).toContain('translate(100, 80)')
    expect(html).toContain('TK-1')
    expect(html).toContain('polyline')
    expect(html).toContain('data-handle="se"')   // resize handles on the selected widget
  })
  it('run mode hides handles', () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 0, y: 0, w: 96, h: 128 })
    const screen = activeHmiScreen(useStore.getState())!
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[wid]} onSelect={() => {}} mode="run" />)
    expect(html).not.toContain('data-handle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/canvas.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/HmiPalette.tsx`**

```tsx
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
```

Add to `hmi.css`: `.hmi-pal-item { padding: 6px 8px; margin: 2px 0; background: #fff; border: 1px solid #d5d5d5; border-radius: 4px; cursor: grab; font-size: 12px; } .hmi-pal-item:hover { border-color: #2b6cb0; }`

- [ ] **Step 4: Implement `src/hmi/HmiCanvas.tsx`**

```tsx
import { useRef, useState } from 'react'
import type { HmiScreen, HmiWidget } from './model'
import { HMI_WORLD, WIDGET_DEFAULT_SIZE } from './model'
import type { WidgetType } from './model'
import { THEMES } from './theme'
import { renderWidget } from './widgets/index'
import { HANDLES, handlePoint, hitPipe, hitWidget, resizeRect, snap8, widgetRect } from './editGeometry'
import type { Handle } from './editGeometry'
import { useStore } from '../store/store'
import { HMI_DRAG_MIME } from './HmiPalette'

export interface HmiCanvasProps {
  screen: HmiScreen
  selection: string[]
  onSelect(ids: string[]): void
  mode: 'edit' | 'run'
  /** Runtime hooks (Tasks 15–16). */
  sim?: Record<string, Record<string, number>>
  flows?: Record<string, number>
  onWidgetClick?(w: HmiWidget): void
}

type DragState =
  | { kind: 'move'; start: { x: number; y: number }; last: { x: number; y: number } }
  | { kind: 'resize'; handle: Handle; start: { x: number; y: number }; orig: { x: number; y: number; w: number; h: number }; id: string }
  | null

export default function HmiCanvas({ screen, selection, onSelect, mode, sim, flows, onWidgetClick }: HmiCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [ghost, setGhost] = useState<{ dx: number; dy: number } | null>(null)
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

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === 'run') {
      const w = hitWidget(screen, toWorld(e))
      if (w && onWidgetClick) onWidgetClick(w)
      return
    }
    const pt = toWorld(e)
    const target = e.target as Element
    const handle = target.getAttribute?.('data-handle') as Handle | null
    if (handle && selection.length === 1) {
      const w = screen.widgets.find((x) => x.id === selection[0])
      if (w) {
        setDrag({ kind: 'resize', handle, start: pt, orig: widgetRect(w), id: w.id })
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        return
      }
    }
    const w = hitWidget(screen, pt)
    if (w) {
      const ids = e.shiftKey ? (selection.includes(w.id) ? selection : [...selection, w.id]) : selection.includes(w.id) ? selection : [w.id]
      onSelect(ids)
      setDrag({ kind: 'move', start: pt, last: pt })
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      return
    }
    const p = hitPipe(screen, pt)
    onSelect(p ? [p.id] : [])
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const pt = toWorld(e)
    if (drag.kind === 'move') {
      setGhost({ dx: snap8(pt.x - drag.start.x), dy: snap8(pt.y - drag.start.y) })
    } else {
      const r = resizeRect(drag.orig, drag.handle, snap8(pt.x - drag.start.x), snap8(pt.y - drag.start.y))
      st().updateWidget(drag.id, r)   // resize commits live; zundo coalescing keeps this acceptable
    }
  }

  const onPointerUp = () => {
    if (drag?.kind === 'move' && ghost && (ghost.dx !== 0 || ghost.dy !== 0)) {
      st().moveWidgets(selection.filter((id) => screen.widgets.some((w) => w.id === id)), ghost.dx, ghost.dy)
    }
    setDrag(null)
    setGhost(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode === 'run' || selection.length === 0) return
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

  return (
    <svg
      ref={svgRef}
      data-testid="hmi-canvas"
      viewBox={`0 0 ${HMI_WORLD.w} ${HMI_WORLD.h}`}
      style={{ background: theme.bg, touchAction: 'none' }}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(HMI_DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
      onDrop={onDrop}
    >
      {screen.pipes.map((p) => {
        const pts = p.points.map((q) => `${q.x},${q.y}`).join(' ')
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
      {screen.widgets.map((w) => {
        const o = offset(w.id)
        const values = sim?.[w.tag ?? ''] ?? {}
        return (
          <g key={w.id} data-wid={w.id} className="hmi-widget" transform={`translate(${w.x + o.dx}, ${w.y + o.dy})`}>
            {renderWidget({ widget: w, theme, sim: values })}
            {mode === 'edit' && selection.includes(w.id) && (
              <rect x={-2} y={-2} width={w.w + 4} height={w.h + 4} fill="none" stroke="#2b6cb0" strokeDasharray="4 3" strokeWidth={1.5} />
            )}
          </g>
        )
      })}
      {mode === 'edit' && selection.length === 1 && (() => {
        const w = screen.widgets.find((x) => x.id === selection[0])
        if (!w) return null
        const o = offset(w.id)
        return HANDLES.map((h) => {
          const p = handlePoint({ x: w.x + o.dx, y: w.y + o.dy, w: w.w, h: w.h }, h)
          return <rect key={h} data-handle={h} x={p.x - 4} y={p.y - 4} width={8} height={8} fill="#2b6cb0" stroke="#fff" strokeWidth={1} style={{ cursor: `${h}-resize` }} />
        })
      })()}
    </svg>
  )
}
```

- [ ] **Step 5: Mount in `HmiWorkspace.tsx`**

Add `const [selection, setSelection] = useState<string[]>([])`, reset it (`setSelection([])`) whenever `activeScreenId` changes (a `useEffect` keyed on the id), put `<HmiPalette />` in `.hmi-side`, and replace the placeholder `<svg>` with `<HmiCanvas screen={screen} selection={selection} onSelect={setSelection} mode="edit" />`.

- [ ] **Step 6: Run tests + manual smoke**

Run: `npm test -- tests/hmi/canvas.test.tsx && npm test`
Expected: PASS. Then `npm run dev`: drag a tank + pump from the palette, move them, resize via handles, shift-click both, arrow-nudge, delete one, Ctrl+Z restores. Kill the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: HMI canvas edit interactions + widget palette"
```

### Task 8: Property panel

**Files:**
- Create: `src/hmi/HmiPropertyPanel.tsx`
- Modify: `src/hmi/HmiWorkspace.tsx` (mount in `.hmi-props`)
- Test: `tests/hmi/props.test.tsx`

**Interfaces:**
- Consumes: store slice, `activeHmiScreen`.
- Produces: `HmiPropertyPanel({ selection }: { selection: string[] })` — edits the single selected widget (tag, label, x/y/w/h, per-type props, alarm limits) or pipe (width), plus screen-level theme select when nothing is selected. Numeric prop inputs write numbers into `widget.props` (not strings).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/props.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import HmiPropertyPanel from '../../src/hmi/HmiPropertyPanel'

beforeEach(() => useStore.getState().loadIntoStore(createEmptyDoc()))

describe('HmiPropertyPanel', () => {
  it('shows screen theme select when nothing is selected', () => {
    useStore.getState().addScreen()
    const html = renderToStaticMarkup(<HmiPropertyPanel selection={[]} />)
    expect(html).toContain('Theme')
    expect(html).toContain('classic')
  })
  it('shows tag + geometry + limit fields for a tank', () => {
    const st = useStore.getState()
    st.addScreen()
    const wid = st.addWidget({ type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1' })
    const html = renderToStaticMarkup(<HmiPropertyPanel selection={[wid]} />)
    expect(html).toContain('TK-1')
    expect(html).toContain('HH')
    expect(html).toContain('Capacity')
  })
  it('shows signal binding for a lamp and width for a pipe', () => {
    const st = useStore.getState()
    st.addScreen()
    const lid = st.addWidget({ type: 'lamp', x: 0, y: 0, w: 32, h: 32 })
    expect(renderToStaticMarkup(<HmiPropertyPanel selection={[lid]} />)).toContain('Signal')
    const pid = st.addHmiPipe({ points: [{ x: 0, y: 0 }, { x: 8, y: 0 }] })
    expect(renderToStaticMarkup(<HmiPropertyPanel selection={[pid]} />)).toContain('Width')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/props.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/HmiPropertyPanel.tsx`**

```tsx
import { useStore, activeHmiScreen } from '../store/store'
import type { HmiWidget } from './model'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', fontSize: 12 }}>
      <span>{label}</span>{children}
    </label>
  )
}

function NumProp({ w, k, label }: { w: HmiWidget; k: string; label: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  const v = w.props?.[k]
  return (
    <Row label={label}>
      <input type="number" style={{ width: 70 }} value={typeof v === 'number' ? v : ''} placeholder="auto"
        onChange={(e) => updateWidget(w.id, { props: { ...w.props, [k]: e.target.value === '' ? undefined as never : Number(e.target.value) } })} />
    </Row>
  )
}

function StrProp({ w, k, label, placeholder }: { w: HmiWidget; k: string; label: string; placeholder?: string }) {
  const updateWidget = useStore((s) => s.updateWidget)
  return (
    <Row label={label}>
      <input style={{ width: 110 }} value={typeof w.props?.[k] === 'string' ? String(w.props[k]) : ''} placeholder={placeholder}
        onChange={(e) => updateWidget(w.id, { props: { ...w.props, [k]: e.target.value } })} />
    </Row>
  )
}

export default function HmiPropertyPanel({ selection }: { selection: string[] }) {
  const screen = useStore(activeHmiScreen)
  const updateWidget = useStore((s) => s.updateWidget)
  const updateHmiPipe = useStore((s) => s.updateHmiPipe)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  if (!screen) return <div className="hmi-props-inner" />
  const w = selection.length === 1 ? screen.widgets.find((x) => x.id === selection[0]) : undefined
  const pipe = !w && selection.length === 1 ? screen.pipes.find((p) => p.id === selection[0]) : undefined

  if (pipe) {
    return (
      <div>
        <h4>Pipe</h4>
        <Row label="Width">
          <input type="number" style={{ width: 70 }} value={pipe.width ?? 4}
            onChange={(e) => updateHmiPipe(pipe.id, { width: Number(e.target.value) || 4 })} />
        </Row>
      </div>
    )
  }

  if (!w) {
    return (
      <div>
        <h4>Screen</h4>
        <Row label="Theme">
          <select value={screen.theme} onChange={(e) => setScreenTheme(screen.id, e.target.value as 'classic' | 'hp')}>
            <option value="classic">classic</option>
            <option value="hp">hp (ISA-101 gray)</option>
          </select>
        </Row>
        <p style={{ fontSize: 11, color: '#667' }}>Select a widget to edit its bindings.</p>
      </div>
    )
  }

  const geom = (k: 'x' | 'y' | 'w' | 'h') => (
    <input key={k} type="number" style={{ width: 56 }} value={w[k]}
      onChange={(e) => updateWidget(w.id, { [k]: Number(e.target.value) || 0 })} />
  )

  return (
    <div>
      <h4>{w.type}</h4>
      <Row label="Tag">
        <input style={{ width: 110 }} value={w.tag ?? ''} placeholder="e.g. LT-101"
          onChange={(e) => updateWidget(w.id, { tag: e.target.value || undefined })} />
      </Row>
      <Row label="Label">
        <input style={{ width: 110 }} value={w.label ?? ''}
          onChange={(e) => updateWidget(w.id, { label: e.target.value || undefined })} />
      </Row>
      <Row label="X / Y">{geom('x')}{geom('y')}</Row>
      <Row label="W / H">{geom('w')}{geom('h')}</Row>
      {w.type === 'tank' && (<><NumProp w={w} k="capacity" label="Capacity" /><NumProp w={w} k="level0" label="Start level %" /></>)}
      {(w.type === 'tank' || w.type === 'display' || w.type === 'gauge') && (
        <>
          <h5 style={{ margin: '10px 0 2px' }}>Alarm limits</h5>
          <NumProp w={w} k="LL" label="LL" /><NumProp w={w} k="L" label="L" />
          <NumProp w={w} k="H" label="H" /><NumProp w={w} k="HH" label="HH" />
        </>
      )}
      {(w.type === 'display' || w.type === 'gauge' || w.type === 'trend') && (
        <><StrProp w={w} k="unit" label="Unit" placeholder="%" /><NumProp w={w} k="min" label="Min" /><NumProp w={w} k="max" label="Max" /></>
      )}
      {w.type === 'valve' && (
        <Row label="Throttling">
          <input type="checkbox" checked={w.props?.throttle === true}
            onChange={(e) => updateWidget(w.id, { props: { ...w.props, throttle: e.target.checked } })} />
        </Row>
      )}
      {(w.type === 'lamp' || w.type === 'switch' || w.type === 'button') && (
        <StrProp w={w} k="signal" label="Signal" placeholder="P-101.RUN" />
      )}
      {w.type === 'button' && <NumProp w={w} k="writeValue" label="Write value" />}
      {w.type === 'switch' && (<><StrProp w={w} k="onLabel" label="On label" /><StrProp w={w} k="offLabel" label="Off label" /></>)}
      {w.type === 'symbol' && <StrProp w={w} k="symbolId" label="Symbol id" placeholder="valve.gate" />}
    </div>
  )
}
```

Mount `<HmiPropertyPanel selection={selection} />` inside `.hmi-props` in `HmiWorkspace.tsx`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/props.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: HMI property panel (bindings, limits, theme)"
```

### Task 9: Pipe drawing tool + Phase-1 e2e + deploy checkpoint

**Files:**
- Modify: `src/hmi/HmiToolbar.tsx` (pipe-tool toggle), `src/hmi/HmiWorkspace.tsx` (tool state), `src/hmi/HmiCanvas.tsx` (pipe-draw mode)
- Create: `e2e/hmi.spec.ts`

**Interfaces:**
- Consumes: `addHmiPipe`, `snap8`.
- Produces: `HmiCanvasProps` gains `tool: 'select' | 'pipe'` and `onToolDone(): void`; toolbar button `data-testid="hmi-pipe-tool"`.

- [ ] **Step 1: Implement the tool**

`HmiWorkspace`: `const [tool, setTool] = useState<'select' | 'pipe'>('select')`; pass `tool={tool}` and `onToolDone={() => setTool('select')}` to the canvas; pass `tool`/`setTool` to `HmiToolbar`, which renders:

```tsx
<button className={tool === 'pipe' ? 'active' : ''} data-testid="hmi-pipe-tool"
  onClick={() => setTool(tool === 'pipe' ? 'select' : 'pipe')}
  title="Draw a pipe: click points, double-click or Enter to finish, Esc to cancel">Pipe</button>
```

`HmiCanvas`: add local `const [draft, setDraft] = useState<{ x: number; y: number }[]>([])`. When `tool === 'pipe'` in edit mode:

- `onPointerDown`: append the snapped point instead of selecting — `setDraft((d) => [...d, { x: snap8(pt.x), y: snap8(pt.y) }])`; if `e.detail === 2` (double-click) and `draft.length >= 1`, commit.
- Commit: `if (draft.length >= 2) st().addHmiPipe({ points: draft }); setDraft([]); onToolDone()`.
- `onKeyDown`: `Enter` commits, `Escape` clears the draft and calls `onToolDone()`.
- Render the draft: `<polyline points={...draft} fill="none" stroke={theme.pipeFlow} strokeDasharray="6 4" strokeWidth={3} />` plus a small circle on each draft point.

Manual check with `npm run dev`: draw an L-shaped pipe between two widgets, select it, change width, delete it, undo.

- [ ] **Step 2: Write the Phase-1 e2e**

```ts
// e2e/hmi.spec.ts
import { expect, test } from '@playwright/test'

test('build an HMI screen by hand and keep it across reload', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  // place a tank and a pump via palette double-click
  await page.getByText('Tank', { exact: true }).dblclick()
  await page.getByText('Pump', { exact: true }).dblclick()
  const canvas = page.getByTestId('hmi-canvas')
  await expect(canvas.locator('g.hmi-widget')).toHaveCount(2)
  // draw a pipe
  await page.getByTestId('hmi-pipe-tool').click()
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5)
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.keyboard.press('Enter')
  await expect(canvas.locator('polyline')).not.toHaveCount(0)
  // autosave then reload
  await page.waitForTimeout(1200)   // autosave debounce — check src/persist/autosave.ts for the actual delay and match it
  await page.reload()
  await expect(page.getByTestId('hmi-canvas')).toBeVisible()
  await expect(page.getByTestId('hmi-canvas').locator('g.hmi-widget')).toHaveCount(2)
})
```

Before writing, read `src/persist/autosave.ts` to confirm the debounce interval and whether autosave restores automatically on load (the P&ID e2e specs will show the pattern — mirror `e2e/happy-path.spec.ts`'s reload handling; if load needs a "restore" prompt click, add it).

- [ ] **Step 3: Run everything**

Run: `set -o pipefail; npm test && npm run e2e 2>&1 | tail -20`
Expected: unit + e2e PASS (kill stale vite dev servers first: `pkill -f vite || true`).

- [ ] **Step 4: Commit + deploy checkpoint**

```bash
git add -A && git commit -m "feat: HMI pipe tool + phase-1 e2e"
npm run build && npx firebase-tools deploy --only hosting
```

Verify live: content-hash of `dist/assets/index-*.js` appears in the live page HTML at https://pid-studio-praharsh.web.app.

---

# Phase 2 — Runtime + manual simulation

### Task 10: Seeded noise + tag table

**Files:**
- Create: `src/hmi/sim/noise.ts`, `src/hmi/sim/tags.ts`
- Test: `tests/hmi/tags.test.ts`

**Interfaces:**
- Consumes: `HmiScreen`, `HmiWidget`.
- Produces: `makeRng(seed: number): () => number` (deterministic 0..1). `TagKind = 'tank' | 'motor' | 'valve' | 'valveOnOff' | 'display' | 'controller'`; `interface TagDef { name: string; kind: TagKind; unit?: string; min: number; max: number; limits?: { LL?: number; L?: number; H?: number; HH?: number }; capacity?: number; level0?: number; bindTank?: string; bindPipe?: string; base?: number }`; `buildTagDefs(screen: HmiScreen): TagDef[]` — one def per *distinct* widget tag; tanks get default limits `{LL:5,L:10,H:90,HH:95}` overridden by widget props; displays with `props.controller === true` become `kind: 'controller'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/tags.test.ts
import { describe, expect, it } from 'vitest'
import { makeRng } from '../../src/hmi/sim/noise'
import { buildTagDefs } from '../../src/hmi/sim/tags'
import type { HmiScreen } from '../../src/hmi/model'

const screen = (widgets: HmiScreen['widgets']): HmiScreen =>
  ({ id: 's', name: 'S', theme: 'classic', widgets, pipes: [] })

describe('noise', () => {
  it('is deterministic per seed and in 0..1', () => {
    const a = makeRng(42), b = makeRng(42), c = makeRng(7)
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual([c(), c(), c()])
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
})

describe('buildTagDefs', () => {
  it('creates defs per kind with defaults and prop overrides', () => {
    const defs = buildTagDefs(screen([
      { id: '1', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1', props: { H: 80, capacity: 200 } },
      { id: '2', type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-1' },
      { id: '3', type: 'valve', x: 0, y: 0, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
      { id: '4', type: 'valve', x: 0, y: 0, w: 48, h: 32, tag: 'HV-1' },
      { id: '5', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'LT-1', props: { bindTank: 'TK-1' } },
      { id: '6', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'LIC-1', props: { controller: true } },
    ]))
    const by = Object.fromEntries(defs.map((d) => [d.name, d]))
    expect(by['TK-1']).toMatchObject({ kind: 'tank', capacity: 200, limits: { LL: 5, L: 10, H: 80, HH: 95 } })
    expect(by['P-1']!.kind).toBe('motor')
    expect(by['LV-1']!.kind).toBe('valve')
    expect(by['HV-1']!.kind).toBe('valveOnOff')
    expect(by['LT-1']).toMatchObject({ kind: 'display', bindTank: 'TK-1' })
    expect(by['LIC-1']!.kind).toBe('controller')
  })
  it('dedupes repeated tags and skips untagged/static widgets', () => {
    const defs = buildTagDefs(screen([
      { id: '1', type: 'display', x: 0, y: 0, w: 96, h: 40, tag: 'FT-1' },
      { id: '2', type: 'trend', x: 0, y: 0, w: 192, h: 96, tag: 'FT-1' },
      { id: '3', type: 'label', x: 0, y: 0, w: 96, h: 24 },
    ]))
    expect(defs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/tags.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/hmi/sim/noise.ts`:

```ts
/** Deterministic LCG (numerical recipes constants) so sim tests can pin a seed. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
```

`src/hmi/sim/tags.ts`:

```ts
import type { HmiScreen, HmiWidget } from '../model'

export type TagKind = 'tank' | 'motor' | 'valve' | 'valveOnOff' | 'display' | 'controller'

export interface TagDef {
  name: string
  kind: TagKind
  unit?: string
  min: number
  max: number
  limits?: { LL?: number; L?: number; H?: number; HH?: number }
  capacity?: number
  level0?: number
  bindTank?: string
  bindPipe?: string
  base?: number
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function defFor(w: HmiWidget): TagDef | null {
  if (!w.tag) return null
  const p = w.props ?? {}
  switch (w.type) {
    case 'tank':
      return {
        name: w.tag, kind: 'tank', unit: '%', min: 0, max: 100,
        capacity: num(p.capacity) ?? (w.w * w.h) / 75,
        level0: num(p.level0) ?? 40,
        limits: { LL: num(p.LL) ?? 5, L: num(p.L) ?? 10, H: num(p.H) ?? 90, HH: num(p.HH) ?? 95 },
      }
    case 'pump':
      return { name: w.tag, kind: 'motor', min: 0, max: 1 }
    case 'valve':
      return { name: w.tag, kind: p.throttle === true ? 'valve' : 'valveOnOff', min: 0, max: 100 }
    case 'display':
    case 'gauge':
    case 'trend': {
      const limits = [p.LL, p.L, p.H, p.HH].some((v) => num(v) !== undefined)
        ? { LL: num(p.LL), L: num(p.L), H: num(p.H), HH: num(p.HH) }
        : undefined
      return {
        name: w.tag, kind: p.controller === true ? 'controller' : 'display',
        unit: typeof p.unit === 'string' ? p.unit : undefined,
        min: num(p.min) ?? 0, max: num(p.max) ?? 100, limits,
        bindTank: typeof p.bindTank === 'string' ? p.bindTank : undefined,
        bindPipe: typeof p.bindPipe === 'string' ? p.bindPipe : undefined,
        base: num(p.base),
      }
    }
    default:
      return null
  }
}

/** One TagDef per distinct widget tag; first widget of a tag wins. */
export function buildTagDefs(screen: HmiScreen): TagDef[] {
  const out = new Map<string, TagDef>()
  for (const w of screen.widgets) {
    const d = defFor(w)
    if (d && !out.has(d.name)) out.set(d.name, d)
  }
  return [...out.values()]
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/tags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sim tag table + seeded noise"
```

### Task 11: Flow network build

**Files:**
- Create: `src/hmi/sim/network.ts`
- Test: `tests/hmi/network.test.ts`

**Interfaces:**
- Consumes: `HmiScreen`, `HmiWidget`, `HmiPipe`.
- Produces:

```ts
export type EndRef = { kind: 'source' } | { kind: 'sink' } | { kind: 'tank'; tag: string }
export interface Branch { id: string; from: EndRef; to: EndRef; pumps: string[]; valves: string[]; pipeIds: string[] }
export interface FlowNetwork { branches: Branch[] }
export function buildNetwork(screen: HmiScreen): FlowNetwork
export function pipeFlowMap(net: FlowNetwork, branchFlows: Record<string, number>): Record<string, number>
```

Semantics: a pipe endpoint "attaches" to a widget when the point lies within the widget rect inflated by `ATTACH = 14`px. Pumps and valves are *inline* — a pipe ending at a pump/valve chains to the pipe starting at that same pump/valve, forming one branch. A branch starts at a tank or a free end (source) and ends at a tank or free end (sink). Pipe direction is `points[0] → points[last]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/network.test.ts
import { describe, expect, it } from 'vitest'
import { buildNetwork, pipeFlowMap } from '../../src/hmi/sim/network'
import type { HmiScreen, HmiWidget, HmiPipe } from '../../src/hmi/model'

const W = (id: string, type: HmiWidget['type'], x: number, y: number, w: number, h: number, tag: string, props?: HmiWidget['props']): HmiWidget =>
  ({ id, type, x, y, w, h, tag, props })
const P = (id: string, ...pts: [number, number][]): HmiPipe =>
  ({ id, points: pts.map(([x, y]) => ({ x, y })) })
const S = (widgets: HmiWidget[], pipes: HmiPipe[]): HmiScreen =>
  ({ id: 's', name: 'S', theme: 'classic', widgets, pipes })

describe('buildNetwork', () => {
  it('chains source -> pump -> valve -> tank into one branch', () => {
    // source at x=0; pump at (100,90..146); valve at (300,95..127); tank at (500..596, 40..168)
    const screen = S(
      [W('p', 'pump', 100, 90, 56, 56, 'P-1'), W('v', 'valve', 300, 95, 48, 32, 'LV-1', { throttle: true }), W('t', 'tank', 500, 40, 96, 128, 'TK-1')],
      [P('e1', [0, 118], [110, 118]), P('e2', [150, 118], [310, 111]), P('e3', [340, 111], [510, 100])],
    )
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(1)
    const b = net.branches[0]!
    expect(b.from).toEqual({ kind: 'source' })
    expect(b.to).toEqual({ kind: 'tank', tag: 'TK-1' })
    expect(b.pumps).toEqual(['P-1'])
    expect(b.valves).toEqual(['LV-1'])
    expect(b.pipeIds).toEqual(['e1', 'e2', 'e3'])
  })
  it('tank -> valve -> sink is a drain branch', () => {
    const screen = S(
      [W('t', 'tank', 0, 0, 96, 128, 'TK-1'), W('v', 'valve', 200, 150, 48, 32, 'HV-1')],
      [P('e1', [48, 120], [210, 166]), P('e2', [240, 166], [400, 166])],
    )
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(1)
    expect(net.branches[0]!.from).toEqual({ kind: 'tank', tag: 'TK-1' })
    expect(net.branches[0]!.to).toEqual({ kind: 'sink' })
    expect(net.branches[0]!.valves).toEqual(['HV-1'])
  })
  it('two independent pipes make two branches; pipeFlowMap spreads branch flow to pipes', () => {
    const screen = S([], [P('a', [0, 0], [100, 0]), P('b', [0, 50], [100, 50])])
    const net = buildNetwork(screen)
    expect(net.branches).toHaveLength(2)
    const flows = pipeFlowMap(net, { [net.branches[0]!.id]: 7, [net.branches[1]!.id]: 0 })
    expect(flows.a === 7 || flows.b === 7).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/network.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/sim/network.ts`**

```ts
import type { HmiPipe, HmiScreen, HmiWidget } from '../model'

export type EndRef = { kind: 'source' } | { kind: 'sink' } | { kind: 'tank'; tag: string }

export interface Branch {
  id: string
  from: EndRef
  to: EndRef
  pumps: string[]
  valves: string[]
  pipeIds: string[]
}

export interface FlowNetwork { branches: Branch[] }

const ATTACH = 14

function hitInflated(w: HmiWidget, p: { x: number; y: number }): boolean {
  return p.x >= w.x - ATTACH && p.x <= w.x + w.w + ATTACH && p.y >= w.y - ATTACH && p.y <= w.y + w.h + ATTACH
}

function widgetAt(screen: HmiScreen, p: { x: number; y: number }): HmiWidget | null {
  for (let i = screen.widgets.length - 1; i >= 0; i--) {
    const w = screen.widgets[i]!
    if ((w.type === 'tank' || w.type === 'pump' || w.type === 'valve' || w.type === 'symbol') && w.tag !== undefined && hitInflated(w, p)) return w
    if (w.type === 'symbol' && hitInflated(w, p)) return w   // untagged symbol: flow passes through
  }
  return null
}

export function buildNetwork(screen: HmiScreen): FlowNetwork {
  const start = new Map<string, HmiPipe[]>()   // widget id -> pipes starting at it
  const ends = new Map<HmiPipe, { a: HmiWidget | null; b: HmiWidget | null }>()
  for (const p of screen.pipes) {
    const a = widgetAt(screen, p.points[0]!)
    const b = widgetAt(screen, p.points[p.points.length - 1]!)
    ends.set(p, { a, b })
    if (a) start.set(a.id, [...(start.get(a.id) ?? []), p])
  }
  const inline = (w: HmiWidget | null): w is HmiWidget =>
    !!w && (w.type === 'pump' || w.type === 'valve' || w.type === 'symbol')

  const used = new Set<string>()
  const branches: Branch[] = []
  let n = 0

  for (const p of screen.pipes) {
    if (used.has(p.id)) continue
    const { a } = ends.get(p)!
    // only begin a branch at a non-inline start (tank / free end), or an inline
    // element nothing flows into (dangling chain head)
    if (inline(a) && screen.pipes.some((q) => q !== p && !used.has(q.id) && ends.get(q)!.b?.id === a.id)) continue

    const branch: Branch = {
      id: `B${++n}`,
      from: a && a.type === 'tank' && a.tag ? { kind: 'tank', tag: a.tag } : { kind: 'source' },
      to: { kind: 'sink' },
      pumps: [], valves: [], pipeIds: [],
    }
    if (inline(a)) {
      if (a.type === 'pump' && a.tag) branch.pumps.push(a.tag)
      if (a.type === 'valve' && a.tag) branch.valves.push(a.tag)
    }
    let cur: HmiPipe | undefined = p
    while (cur && !used.has(cur.id)) {
      used.add(cur.id)
      branch.pipeIds.push(cur.id)
      const tail = ends.get(cur)!.b
      if (!tail) { branch.to = { kind: 'sink' }; break }
      if (tail.type === 'tank' && tail.tag) { branch.to = { kind: 'tank', tag: tail.tag }; break }
      if (tail.type === 'pump' && tail.tag) branch.pumps.push(tail.tag)
      if (tail.type === 'valve' && tail.tag) branch.valves.push(tail.tag)
      cur = (start.get(tail.id) ?? []).find((q) => !used.has(q.id))
      if (!cur) { branch.to = { kind: 'sink' }; break }
    }
    branches.push(branch)
  }
  return { branches }
}

export function pipeFlowMap(net: FlowNetwork, branchFlows: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of net.branches) for (const id of b.pipeIds) out[id] = branchFlows[b.id] ?? 0
  return out
}
```

Note the second `w.type === 'symbol'` line in `widgetAt` is reachable only for untagged symbols (the first condition requires a tag) — keep both so tagged symbols (imported inline fittings) also pass flow through without contributing pumps/valves.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/network.test.ts`
Expected: PASS. If the chain test fails on ordering, debug attach rects by printing `ends` — coordinates in the tests are chosen to attach unambiguously.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: flow-network compiler (pipes+widgets -> branches)"
```

### Task 12: Simulation engine tick

**Files:**
- Create: `src/hmi/sim/engine.ts`
- Test: `tests/hmi/engine.test.ts`

**Interfaces:**
- Consumes: `buildTagDefs`, `buildNetwork`, `pipeFlowMap`, `makeRng`.
- Produces:

```ts
export interface ControllerSpec { tag: string; pvTag: string; outTag: string }
export interface SimModel { defs: TagDef[]; net: FlowNetwork; controllers: ControllerSpec[] }
export type Tags = Record<string, Record<string, number>>
export function buildSimModel(screen: HmiScreen): SimModel   // controllers wired in Task 22; empty array until then
export function initTags(model: SimModel): Tags
export function tick(model: SimModel, tags: Tags, dt: number, rng: () => number): { tags: Tags; branchFlows: Record<string, number> }
```

Physics constants (spec §6): pump rated `10` u/s, pressurized source `6` u/s, throttling valve fraction `OP/100`, on/off valve `OPEN`, tank `level += (Σin − Σout)/capacity*100*dt` clamped 0..100; branch flow 0 when a source tank is < 0.5 or a destination tank is > 99.5. Signals: tank `PV`; motor `RUN`; valve `OP` (throttle, init 40) or `OPEN` (init 1); display `PV` (bindTank → tank level + small noise; bindPipe → that pipe's flow; else drift `base ?? 50` ± slow wander); controller `PV/SP/OP/MODE` (SP 50, MODE 1). `tick` must be pure — never mutate its inputs.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/engine.test.ts
import { describe, expect, it } from 'vitest'
import { buildSimModel, initTags, tick } from '../../src/hmi/sim/engine'
import { makeRng } from '../../src/hmi/sim/noise'
import type { HmiScreen } from '../../src/hmi/model'

// source -> pump P-1 -> throttling valve LV-1 -> tank TK-1, plus TK-1 -> on/off valve HV-1 -> sink
const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-1' },
    { id: 'v', type: 'valve', x: 300, y: 95, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1', props: { capacity: 100, level0: 40 } },
    { id: 'h', type: 'valve', x: 650, y: 150, w: 48, h: 32, tag: 'HV-1' },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 310, y: 111 }] },
    { id: 'e3', points: [{ x: 340, y: 111 }, { x: 510, y: 100 }] },
    { id: 'e4', points: [{ x: 590, y: 160 }, { x: 660, y: 166 }] },
    { id: 'e5', points: [{ x: 692, y: 166 }, { x: 800, y: 166 }] },
  ],
}

const run = (mut?: (tags: ReturnType<typeof initTags>) => void, seconds = 10) => {
  const model = buildSimModel(screen)
  let tags = initTags(model)
  if (mut) mut(tags)
  let flows: Record<string, number> = {}
  const rng = makeRng(1)
  for (let i = 0; i < seconds * 5; i++) {
    const r = tick(model, tags, 0.2, rng)
    tags = r.tags
    flows = r.branchFlows
  }
  return { tags, flows, model }
}

describe('engine tick', () => {
  it('initTags seeds defaults', () => {
    const model = buildSimModel(screen)
    const tags = initTags(model)
    expect(tags['TK-1']!.PV).toBe(40)
    expect(tags['P-1']!.RUN).toBe(0)
    expect(tags['LV-1']!.OP).toBe(40)
    expect(tags['HV-1']!.OPEN).toBe(1)
  })
  it('nothing flows while the pump is stopped, but the drain still empties the tank', () => {
    const { tags, flows } = run()
    expect(Object.values(flows).some((f) => f > 0)).toBe(true)   // drain branch
    expect(tags['TK-1']!.PV).toBeLessThan(40)
  })
  it('running pump with open valves fills the tank; closed HV holds level up', () => {
    const { tags } = run((t) => { t['P-1']!.RUN = 1; t['LV-1']!.OP = 100; t['HV-1']!.OPEN = 0 })
    expect(tags['TK-1']!.PV).toBeGreaterThan(55)   // 10 u/s into capacity 100 for 10 s minus nothing out
  })
  it('closed throttling valve blocks the fill branch', () => {
    const { tags } = run((t) => { t['P-1']!.RUN = 1; t['LV-1']!.OP = 0; t['HV-1']!.OPEN = 0 })
    expect(tags['TK-1']!.PV).toBeCloseTo(40, 0)
  })
  it('tank clamps at 0 and never goes negative', () => {
    const { tags } = run((t) => { t['TK-1']!.PV = 1 }, 60)
    expect(tags['TK-1']!.PV).toBeGreaterThanOrEqual(0)
  })
  it('tick does not mutate its input tags object', () => {
    const model = buildSimModel(screen)
    const tags = initTags(model)
    const snapshot = JSON.parse(JSON.stringify(tags))
    tick(model, tags, 0.2, makeRng(1))
    expect(tags).toEqual(snapshot)
  })
  it('is deterministic for a fixed seed', () => {
    expect(run().tags['TK-1']!.PV).toBe(run().tags['TK-1']!.PV)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/sim/engine.ts`**

```ts
import type { HmiScreen } from '../model'
import type { TagDef } from './tags'
import { buildTagDefs } from './tags'
import type { Branch, FlowNetwork } from './network'
import { buildNetwork } from './network'

export interface ControllerSpec { tag: string; pvTag: string; outTag: string }
export interface SimModel { defs: TagDef[]; net: FlowNetwork; controllers: ControllerSpec[] }
export type Tags = Record<string, Record<string, number>>

const PUMP_RATED = 10
const SOURCE_HEAD = 6
const KP = 1.5
const KI = 0.4

export function buildSimModel(screen: HmiScreen): SimModel {
  return { defs: buildTagDefs(screen), net: buildNetwork(screen), controllers: wireControllers(buildTagDefs(screen)) }
}

/** Family+loop matching: LIC-101 pairs with LT-101 (PV) and LV-101 (OP target). */
export function wireControllers(defs: TagDef[]): ControllerSpec[] {
  const out: ControllerSpec[] = []
  for (const c of defs) {
    if (c.kind !== 'controller') continue
    const m = /^([A-Z])[A-Z]*-?(\w+)$/.exec(c.name)
    if (!m) continue
    const [, family, loop] = m
    const partner = (pred: (d: TagDef) => boolean) =>
      defs.find((d) => { const pm = /^([A-Z])[A-Z]*-?(\w+)$/.exec(d.name); return !!pm && pm[1] === family && pm[2] === loop && pred(d) })
    const pv = partner((d) => d.kind === 'display' || d.kind === 'tank')
    const valve = partner((d) => d.kind === 'valve')
    if (pv && valve) out.push({ tag: c.name, pvTag: pv.name, outTag: valve.name })
  }
  return out
}

export function initTags(model: SimModel): Tags {
  const tags: Tags = {}
  for (const d of model.defs) {
    switch (d.kind) {
      case 'tank': tags[d.name] = { PV: d.level0 ?? 40 }; break
      case 'motor': tags[d.name] = { RUN: 0 }; break
      case 'valve': tags[d.name] = { OP: 40 }; break
      case 'valveOnOff': tags[d.name] = { OPEN: 1 }; break
      case 'display': tags[d.name] = { PV: d.base ?? (d.min + d.max) / 2 }; break
      case 'controller': tags[d.name] = { PV: 0, SP: 50, OP: 40, MODE: 1, I: 0 }; break
    }
  }
  return tags
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function branchFlow(b: Branch, tags: Tags, tankLevel: (t: string) => number): number {
  let driver = b.pumps.length > 0
    ? (b.pumps.every((p) => (tags[p]?.RUN ?? 0) >= 0.5) ? PUMP_RATED : 0)
    : SOURCE_HEAD
  for (const v of b.valves) {
    const t = tags[v]
    const frac = t?.OP !== undefined ? clamp(t.OP / 100, 0, 1) : (t?.OPEN ?? 1) >= 0.5 ? 1 : 0
    driver *= frac
  }
  if (b.from.kind === 'tank' && tankLevel(b.from.tag) <= 0.5) return 0
  if (b.to.kind === 'tank' && tankLevel(b.to.tag) >= 99.5) return 0
  return driver
}

export function tick(model: SimModel, prev: Tags, dt: number, rng: () => number): { tags: Tags; branchFlows: Record<string, number> } {
  const tags: Tags = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v }]))
  const defOf = new Map(model.defs.map((d) => [d.name, d]))

  // 1) controllers (AUTO) drive their valve OP via velocity-form PI
  for (const c of model.controllers) {
    const t = tags[c.tag]
    if (!t || (t.MODE ?? 0) < 0.5) continue
    const pv = tags[c.pvTag]?.PV ?? 0
    const e = (t.SP ?? 50) - pv
    t.I = clamp((t.I ?? 0) + KI * e * dt, -100, 100)
    const op = clamp(KP * e + t.I, 0, 100)
    t.PV = pv
    t.OP = op
    const valve = tags[c.outTag]
    if (valve && valve.OP !== undefined) valve.OP = op
  }

  // 2) branch flows from the *previous* levels
  const level = (tag: string) => prev[tag]?.PV ?? 0
  const branchFlows: Record<string, number> = {}
  for (const b of model.net.branches) branchFlows[b.id] = branchFlow(b, tags, level)

  // 3) integrate tanks
  for (const d of model.defs) {
    if (d.kind !== 'tank') continue
    let net = 0
    for (const b of model.net.branches) {
      if (b.to.kind === 'tank' && b.to.tag === d.name) net += branchFlows[b.id]!
      if (b.from.kind === 'tank' && b.from.tag === d.name) net -= branchFlows[b.id]!
    }
    const t = tags[d.name]!
    t.PV = clamp(t.PV! + (net / (d.capacity ?? 100)) * 100 * dt, 0, 100)
  }

  // 4) measurement displays
  for (const d of model.defs) {
    if (d.kind !== 'display') continue
    const t = tags[d.name]!
    if (d.bindTank) t.PV = clamp((tags[d.bindTank]?.PV ?? 0) + (rng() - 0.5) * 0.8, 0, 100)
    else if (d.bindPipe) {
      const b = model.net.branches.find((br) => br.pipeIds.includes(d.bindPipe!))
      t.PV = b ? branchFlows[b.id]! : 0
    } else {
      const base = d.base ?? (d.min + d.max) / 2
      const wander = (rng() - 0.5) * (d.max - d.min) * 0.01
      t.PV = clamp((t.PV ?? base) + wander + (base - (t.PV ?? base)) * 0.02, d.min, d.max)
    }
  }
  return { tags, branchFlows }
}
```

(`wireControllers` runs now but finds pairs only when controller widgets exist — Task 22 makes the import create them and adds convergence tests. The `I` integrator lives inside the controller's signal record so reset re-zeroes it.)

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/engine.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: HMI simulation engine (flows, tanks, PI hooks)"
```

### Task 13: Alarm lifecycle

**Files:**
- Create: `src/hmi/sim/alarms.ts`
- Test: `tests/hmi/alarms.test.ts`

**Interfaces:**
- Consumes: `TagDef`, `Tags`.
- Produces:

```ts
export type AlarmLevel = 'LL' | 'L' | 'H' | 'HH'
export type AlarmPhase = 'active' | 'acked' | 'cleared'
export interface AlarmRecord { id: string; tag: string; level: AlarmLevel; phase: AlarmPhase; since: number }
export function evalAlarms(defs: TagDef[], tags: Tags, prev: AlarmRecord[], t: number): AlarmRecord[]
export function ackAlarms(alarms: AlarmRecord[], id?: string): AlarmRecord[]   // no id = ack all
```

Rules (spec §6): violation with no record → `active`; still violated → phase unchanged; violation ends → `active` becomes `cleared` (stays listed), `acked` is removed; `cleared` that re-violates → `active` again. `ackAlarms`: `active`→`acked`, `cleared`→removed. `id` format `${tag}:${level}` (stable, so re-evaluation preserves identity). HH/LL evaluated independently of H/L (a 97% level raises both H and HH).

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/alarms.test.ts
import { describe, expect, it } from 'vitest'
import { evalAlarms, ackAlarms } from '../../src/hmi/sim/alarms'
import type { TagDef } from '../../src/hmi/sim/tags'

const defs: TagDef[] = [{ name: 'TK-1', kind: 'tank', min: 0, max: 100, limits: { LL: 5, L: 10, H: 90, HH: 95 } }]
const at = (pv: number) => ({ 'TK-1': { PV: pv } })

describe('alarm lifecycle', () => {
  it('raises H then HH as the level climbs', () => {
    let a = evalAlarms(defs, at(92), [], 1)
    expect(a).toEqual([{ id: 'TK-1:H', tag: 'TK-1', level: 'H', phase: 'active', since: 1 }])
    a = evalAlarms(defs, at(97), a, 2)
    expect(a.map((x) => x.id).sort()).toEqual(['TK-1:H', 'TK-1:HH'])
  })
  it('active -> cleared on return to normal, removed after ack', () => {
    let a = evalAlarms(defs, at(92), [], 1)
    a = evalAlarms(defs, at(50), a, 2)
    expect(a[0]!.phase).toBe('cleared')
    a = ackAlarms(a)
    expect(a).toHaveLength(0)
  })
  it('acked then normal is removed silently; cleared re-violation reactivates', () => {
    let a = ackAlarms(evalAlarms(defs, at(92), [], 1))
    expect(a[0]!.phase).toBe('acked')
    expect(evalAlarms(defs, at(50), a, 2)).toHaveLength(0)
    let b = evalAlarms(defs, at(92), [], 1)
    b = evalAlarms(defs, at(50), b, 2)
    b = evalAlarms(defs, at(93), b, 3)
    expect(b[0]!.phase).toBe('active')
  })
  it('low limits mirror high limits', () => {
    const a = evalAlarms(defs, at(3), [], 1)
    expect(a.map((x) => x.level).sort()).toEqual(['L', 'LL'])
  })
  it('ack by id only acks that alarm', () => {
    let a = evalAlarms(defs, at(97), [], 1)
    a = ackAlarms(a, 'TK-1:HH')
    expect(a.find((x) => x.id === 'TK-1:HH')!.phase).toBe('acked')
    expect(a.find((x) => x.id === 'TK-1:H')!.phase).toBe('active')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/alarms.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/sim/alarms.ts`**

```ts
import type { TagDef } from './tags'
import type { Tags } from './engine'

export type AlarmLevel = 'LL' | 'L' | 'H' | 'HH'
export type AlarmPhase = 'active' | 'acked' | 'cleared'
export interface AlarmRecord { id: string; tag: string; level: AlarmLevel; phase: AlarmPhase; since: number }

function violated(level: AlarmLevel, limit: number, pv: number): boolean {
  return level === 'H' || level === 'HH' ? pv >= limit : pv <= limit
}

export function evalAlarms(defs: TagDef[], tags: Tags, prev: AlarmRecord[], t: number): AlarmRecord[] {
  const byId = new Map(prev.map((a) => [a.id, a]))
  const out: AlarmRecord[] = []
  for (const d of defs) {
    if (!d.limits) continue
    const pv = tags[d.name]?.PV
    if (pv === undefined) continue
    for (const level of ['LL', 'L', 'H', 'HH'] as AlarmLevel[]) {
      const limit = d.limits[level]
      if (limit === undefined) continue
      const id = `${d.name}:${level}`
      const existing = byId.get(id)
      if (violated(level, limit, pv)) {
        out.push(existing && existing.phase !== 'cleared' ? existing : { id, tag: d.name, level, phase: 'active', since: existing?.phase === 'cleared' ? t : existing?.since ?? t })
      } else if (existing) {
        if (existing.phase === 'active') out.push({ ...existing, phase: 'cleared' })
        else if (existing.phase === 'cleared') out.push(existing)
        // 'acked' + normal -> drop
      }
    }
  }
  return out
}

export function ackAlarms(alarms: AlarmRecord[], id?: string): AlarmRecord[] {
  return alarms.flatMap((a) => {
    if (id !== undefined && a.id !== id) return [a]
    if (a.phase === 'active') return [{ ...a, phase: 'acked' as const }]
    if (a.phase === 'cleared') return []
    return [a]
  })
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/alarms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ISA-18.2-style alarm lifecycle"
```

### Task 14: Sim store + engine loop

**Files:**
- Create: `src/hmi/simStore.ts`
- Test: `tests/hmi/simStore.test.ts`

**Interfaces:**
- Consumes: engine, alarms, network (`pipeFlowMap`), tags, noise.
- Produces a **non-temporal** zustand store `useSimStore`:

```ts
interface SimStoreState {
  mode: 'edit' | 'run'
  playing: boolean
  speed: 1 | 5
  t: number
  tags: Tags
  pipeFlows: Record<string, number>
  alarms: AlarmRecord[]
  history: Record<string, number[]>          // key: tag, PV per tick, capped 600
  enterRun(screen: HmiScreen): void          // compile model, init tags, mode='run', playing=true, t=0
  exitRun(): void                            // mode='edit', playing=false
  playPause(): void
  setSpeed(s: 1 | 5): void
  reset(): void                              // re-init tags/alarms/history/t from the compiled model
  tickOnce(dt: number): void                 // one engine step + alarm eval + history push
  writeTag(tag: string, signal: string, value: number): void
  ack(id?: string): void
}
export function useSimEngine(): void         // hook: 200ms interval calling tickOnce(0.2 * speed) while mode==='run' && playing
```

`writeTag` accepts fully-qualified `'TAG.SIGNAL'` when `signal === ''` (split on the last `.`) — buttons/switches store one string. The rng lives in module state, re-seeded to `1234` by `enterRun`/`reset` (determinism for tests/e2e).

- [ ] **Step 1: Write the failing test**

```ts
// tests/hmi/simStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useSimStore } from '../../src/hmi/simStore'
import type { HmiScreen } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 100, y: 90, w: 56, h: 56, tag: 'P-1' },
    { id: 't', type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1', props: { capacity: 50, level0: 88, H: 90 } },
  ],
  pipes: [
    { id: 'e1', points: [{ x: 0, y: 118 }, { x: 110, y: 118 }] },
    { id: 'e2', points: [{ x: 150, y: 118 }, { x: 510, y: 100 }] },
  ],
}

beforeEach(() => useSimStore.getState().exitRun())

describe('simStore', () => {
  it('enterRun compiles and seeds; tickOnce advances time and history', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    expect(st().mode).toBe('run')
    expect(st().tags['TK-1']!.PV).toBe(88)
    st().tickOnce(0.2)
    expect(st().t).toBeCloseTo(0.2)
    expect(st().history['TK-1']).toHaveLength(1)
  })
  it('pump start fills tank through the pipes and raises the H alarm; ack works', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    st().writeTag('P-1', 'RUN', 1)
    for (let i = 0; i < 60; i++) st().tickOnce(0.2)   // 12 s at 10 u/s into capacity 50
    expect(st().tags['TK-1']!.PV).toBeGreaterThan(90)
    expect(st().pipeFlows.e1).toBeGreaterThan(0)
    expect(st().alarms.some((a) => a.id === 'TK-1:H' && a.phase === 'active')).toBe(true)
    st().ack()
    expect(st().alarms[0]!.phase).toBe('acked')
  })
  it('reset restores initial state; writeTag accepts TAG.SIGNAL form', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    st().writeTag('P-1.RUN', '', 1)
    expect(st().tags['P-1']!.RUN).toBe(1)
    for (let i = 0; i < 10; i++) st().tickOnce(0.2)
    st().reset()
    expect(st().t).toBe(0)
    expect(st().tags['TK-1']!.PV).toBe(88)
    expect(st().history['TK-1'] ?? []).toHaveLength(0)
  })
  it('history caps at 600 samples', () => {
    const st = () => useSimStore.getState()
    st().enterRun(screen)
    for (let i = 0; i < 650; i++) st().tickOnce(0.2)
    expect(st().history['TK-1']!.length).toBe(600)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/simStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/simStore.ts`**

```ts
import { create } from 'zustand'
import { useEffect } from 'react'
import type { HmiScreen } from './model'
import type { SimModel, Tags } from './sim/engine'
import { buildSimModel, initTags, tick } from './sim/engine'
import type { AlarmRecord } from './sim/alarms'
import { ackAlarms, evalAlarms } from './sim/alarms'
import { pipeFlowMap } from './sim/network'
import { makeRng } from './sim/noise'

const HISTORY_CAP = 600
let model: SimModel | null = null
let rng = makeRng(1234)

interface SimStoreState {
  mode: 'edit' | 'run'
  playing: boolean
  speed: 1 | 5
  t: number
  tags: Tags
  pipeFlows: Record<string, number>
  alarms: AlarmRecord[]
  history: Record<string, number[]>
  enterRun(screen: HmiScreen): void
  exitRun(): void
  playPause(): void
  setSpeed(s: 1 | 5): void
  reset(): void
  tickOnce(dt: number): void
  writeTag(tag: string, signal: string, value: number): void
  ack(id?: string): void
}

export const useSimStore = create<SimStoreState>()((set, get) => ({
  mode: 'edit', playing: false, speed: 1, t: 0,
  tags: {}, pipeFlows: {}, alarms: [], history: {},

  enterRun: (screen) => {
    model = buildSimModel(screen)
    rng = makeRng(1234)
    set({ mode: 'run', playing: true, t: 0, tags: initTags(model), pipeFlows: {}, alarms: [], history: {} })
  },
  exitRun: () => { model = null; set({ mode: 'edit', playing: false, t: 0, tags: {}, pipeFlows: {}, alarms: [], history: {} }) },
  playPause: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  reset: () => {
    if (!model) return
    rng = makeRng(1234)
    set({ t: 0, tags: initTags(model), pipeFlows: {}, alarms: [], history: {}, playing: true })
  },
  tickOnce: (dt) => {
    if (!model) return
    const s = get()
    const { tags, branchFlows } = tick(model, s.tags, dt, rng)
    const t = s.t + dt
    const history: Record<string, number[]> = { ...s.history }
    for (const d of model.defs) {
      const pv = tags[d.name]?.PV
      if (pv === undefined) continue
      history[d.name] = [...(history[d.name] ?? []), pv].slice(-HISTORY_CAP)
    }
    set({ t, tags, pipeFlows: pipeFlowMap(model.net, branchFlows), alarms: evalAlarms(model.defs, tags, s.alarms, t), history })
  },
  writeTag: (tag, signal, value) => {
    let tg = tag, sig = signal
    if (sig === '') {
      const i = tag.lastIndexOf('.')
      if (i < 0) return
      tg = tag.slice(0, i); sig = tag.slice(i + 1)
    }
    set((s) => ({ tags: { ...s.tags, [tg]: { ...s.tags[tg], [sig]: value } } }))
  },
  ack: (id) => set((s) => ({ alarms: ackAlarms(s.alarms, id) })),
}))

/** Drives the sim while mounted: 5 Hz wall clock, dt scaled by speed. */
export function useSimEngine(): void {
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  useEffect(() => {
    if (mode !== 'run' || !playing) return
    const h = setInterval(() => useSimStore.getState().tickOnce(0.2 * speed), 200)
    return () => clearInterval(h)
  }, [mode, playing, speed])
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/simStore.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: runtime sim store + 5Hz engine loop"
```

### Task 15: Runtime mode — toolbar controls + live canvas bindings

**Files:**
- Modify: `src/hmi/HmiToolbar.tsx`, `src/hmi/HmiWorkspace.tsx`, `src/hmi/HmiCanvas.tsx`
- Test: `tests/hmi/runtime.test.tsx`

**Interfaces:**
- Consumes: `useSimStore`, `useSimEngine`.
- Produces: `HmiCanvasProps` gains `history?: Record<string, number[]>` and `alarms?: AlarmRecord[]`; canvas computes per-widget `alarm` (`'unacked'` if any `active|cleared` record for its tag, `'acked'` if only acked) and passes `history[widget.tag]` to trend widgets. Toolbar test ids: `hmi-run-toggle`, `hmi-play`, `hmi-speed`, `hmi-reset`, `hmi-theme`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/runtime.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStore, activeHmiScreen } from '../../src/store/store'
import { createEmptyDoc } from '../../src/model/doc'
import { useSimStore } from '../../src/hmi/simStore'
import HmiCanvas from '../../src/hmi/HmiCanvas'
import { THEMES } from '../../src/hmi/theme'

beforeEach(() => { useStore.getState().loadIntoStore(createEmptyDoc()); useSimStore.getState().exitRun() })

describe('runtime canvas bindings', () => {
  it('live values, flow overlay, and alarm outline render from sim props', () => {
    const st = useStore.getState()
    st.addScreen()
    st.addWidget({ type: 'tank', x: 500, y: 40, w: 96, h: 128, tag: 'TK-1' })
    st.addHmiPipe({ points: [{ x: 0, y: 118 }, { x: 510, y: 100 }] })
    const screen = activeHmiScreen(useStore.getState())!
    const pipeId = screen.pipes[0]!.id
    const html = renderToStaticMarkup(
      <HmiCanvas screen={screen} selection={[]} onSelect={() => {}} mode="run"
        sim={{ 'TK-1': { PV: 76 } }} flows={{ [pipeId]: 5 }}
        alarms={[{ id: 'TK-1:H', tag: 'TK-1', level: 'H', phase: 'active', since: 1 }]} />)
    expect(html).toContain('76')
    expect(html).toContain('hmi-flow')
    expect(html).toContain(THEMES.classic.alarm)
    expect(html).toContain('hmi-blink')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/runtime.test.tsx`
Expected: FAIL (alarm outline not implemented).

- [ ] **Step 3: Implement**

`HmiCanvas.tsx` — extend props:

```ts
history?: Record<string, number[]>
alarms?: AlarmRecord[]
```

In the widget render loop:

```tsx
const recs = (alarms ?? []).filter((a) => a.tag === w.tag)
const alarm = recs.some((a) => a.phase === 'active' || a.phase === 'cleared') ? 'unacked' : recs.length > 0 ? 'acked' : 'none'
// pass into renderWidget: { widget: w, theme, sim: values, history: history?.[w.tag ?? ''], alarm }
{alarm !== 'none' && (
  <rect x={-4} y={-4} width={w.w + 8} height={w.h + 8} fill="none"
    stroke={alarm === 'unacked' ? theme.alarm : theme.alarmAck} strokeWidth={3}
    className={alarm === 'unacked' ? 'hmi-blink' : undefined} />
)}
```

`HmiToolbar.tsx` — full version (replaces the Task 6 edit-mode subset; keep `onExit`, undo/redo and the pipe tool visible only in edit mode):

```tsx
import { useStore, activeHmiScreen } from '../store/store'
import { useSimStore } from './simStore'

export default function HmiToolbar({ onExit, tool, setTool }: {
  onExit(): void
  tool: 'select' | 'pipe'
  setTool(t: 'select' | 'pipe'): void
}) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const screen = useStore(activeHmiScreen)
  const setScreenTheme = useStore((s) => s.setScreenTheme)
  const mode = useSimStore((s) => s.mode)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const sim = useSimStore.getState
  const toggleRun = () => {
    if (!screen) return
    if (mode === 'run') sim().exitRun()
    else sim().enterRun(screen)
  }
  return (
    <header className="hmi-toolbar">
      <strong>HMI Studio</strong>
      <button onClick={onExit} title="Back to the P&ID editor">⇄ P&ID</button>
      {screen && (
        <button data-testid="hmi-run-toggle" className={mode === 'run' ? 'active' : ''} onClick={toggleRun}>
          {mode === 'run' ? '■ Stop (edit)' : '▶ RUN'}
        </button>
      )}
      {mode === 'run' ? (
        <>
          <button data-testid="hmi-play" onClick={() => sim().playPause()}>{playing ? 'Pause' : 'Play'}</button>
          <button data-testid="hmi-speed" onClick={() => sim().setSpeed(speed === 1 ? 5 : 1)}>{speed}×</button>
          <button data-testid="hmi-reset" onClick={() => sim().reset()}>Reset</button>
        </>
      ) : (
        <>
          <button className={tool === 'pipe' ? 'active' : ''} data-testid="hmi-pipe-tool"
            onClick={() => setTool(tool === 'pipe' ? 'select' : 'pipe')}
            title="Draw a pipe: click points, Enter to finish, Esc to cancel">Pipe</button>
          <button onClick={undo} title="Ctrl+Z">↩</button>
          <button onClick={redo} title="Ctrl+Y">↪</button>
        </>
      )}
      {screen && (
        <button data-testid="hmi-theme" onClick={() => setScreenTheme(screen.id, screen.theme === 'classic' ? 'hp' : 'classic')}
          title="Toggle classic / ISA-101 high-performance theme">{screen.theme === 'classic' ? 'Classic' : 'ISA-101'}</button>
      )}
      <span className="grow" />
      <span className="demo-note">Training / demo simulation — not for operations</span>
    </header>
  )
}
```

`HmiWorkspace.tsx`:

```tsx
import { useSimStore, useSimEngine } from './simStore'
// inside component:
useSimEngine()
const mode = useSimStore((s) => s.mode)
const simTags = useSimStore((s) => s.tags)
const pipeFlows = useSimStore((s) => s.pipeFlows)
const alarms = useSimStore((s) => s.alarms)
const history = useSimStore((s) => s.history)
// root div: <div className={`hmi${mode === 'run' ? ' run-mode' : ''}`}>
// hide palette/props panels when mode==='run' (grid column collapse via .run-mode)
// canvas: <HmiCanvas screen={screen} selection={selection} onSelect={setSelection}
//   mode={mode} tool={tool} onToolDone={() => setTool('select')}
//   sim={simTags} flows={pipeFlows} alarms={alarms} history={history}
//   onWidgetClick={setFaceplateFor /* Task 16 */} />
```

Also call `useSimStore.getState().exitRun()` in a `useEffect` cleanup on unmount (leaving the workspace stops the sim), and guard `toggleRun` against an empty screen.

- [ ] **Step 4: Run tests + manual smoke**

Run: `npm test -- tests/hmi/runtime.test.tsx && npm test`
Expected: PASS. Dev-server smoke: build pump→tank with a pipe chain, RUN, see the tank drain via gravity, Pause/5×/Reset, theme toggle re-colors live. Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: HMI runtime mode — sim controls + live canvas bindings"
```

### Task 16: Faceplates + operator writes

**Files:**
- Create: `src/hmi/Faceplate.tsx`
- Modify: `src/hmi/HmiWorkspace.tsx` (faceplate state + mount), `src/hmi/HmiCanvas.tsx` (button/switch writes on pointerdown in run mode)
- Test: `tests/hmi/faceplate.test.tsx`

**Interfaces:**
- Consumes: `useSimStore` (`tags`, `writeTag`), widget props.
- Produces: `Faceplate({ widget, onClose }: { widget: HmiWidget; onClose(): void })` — variants: pump (`fp-start`/`fp-stop`), valve on/off (`fp-open`/`fp-close`), throttling valve (`fp-op` range input), controller (`fp-sp` number input, `fp-auto`/`fp-man`, `fp-op` enabled in MAN), display/tank (read-only PV + limits). Close via `fp-close` button. In run mode the canvas: `button` widgets write `props.signal` with `props.writeValue ?? 1` on pointerdown (and `0` on pointerup for momentary); `switch` widgets toggle their signal; all other widgets call `onWidgetClick`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/faceplate.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useSimStore } from '../../src/hmi/simStore'
import Faceplate from '../../src/hmi/Faceplate'
import type { HmiScreen, HmiWidget } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [
    { id: 'p', type: 'pump', x: 0, y: 0, w: 56, h: 56, tag: 'P-1' },
    { id: 'v', type: 'valve', x: 0, y: 200, w: 48, h: 32, tag: 'LV-1', props: { throttle: true } },
    { id: 'c', type: 'display', x: 0, y: 400, w: 96, h: 40, tag: 'LIC-1', props: { controller: true } },
  ],
  pipes: [],
}
const w = (id: string): HmiWidget => screen.widgets.find((x) => x.id === id)!

beforeEach(() => { useSimStore.getState().exitRun(); useSimStore.getState().enterRun(screen) })

describe('Faceplate', () => {
  it('pump faceplate shows Start/Stop and current state', () => {
    const html = renderToStaticMarkup(<Faceplate widget={w('p')} onClose={() => {}} />)
    expect(html).toContain('data-testid="fp-start"')
    expect(html).toContain('data-testid="fp-stop"')
    expect(html).toContain('P-1')
    expect(html).toContain('STOPPED')
  })
  it('throttling valve faceplate exposes an OP slider', () => {
    const html = renderToStaticMarkup(<Faceplate widget={w('v')} onClose={() => {}} />)
    expect(html).toContain('data-testid="fp-op"')
    expect(html).toContain('type="range"')
  })
  it('controller faceplate shows PV/SP/OP + AUTO/MAN', () => {
    const html = renderToStaticMarkup(<Faceplate widget={w('c')} onClose={() => {}} />)
    expect(html).toContain('data-testid="fp-sp"')
    expect(html).toContain('data-testid="fp-auto"')
    expect(html).toContain('data-testid="fp-man"')
  })
  it('writeTag through the store flips pump state (what fp-start does)', () => {
    useSimStore.getState().writeTag('P-1', 'RUN', 1)
    expect(useSimStore.getState().tags['P-1']!.RUN).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/faceplate.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/Faceplate.tsx`**

```tsx
import { useSimStore } from './simStore'
import type { HmiWidget } from './model'

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ margin: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>{label}</span><span>{value.toFixed(1)}</span></div>
      <div style={{ height: 8, background: '#0004', borderRadius: 4 }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

export default function Faceplate({ widget, onClose }: { widget: HmiWidget; onClose(): void }) {
  const tag = widget.tag ?? ''
  const t = useSimStore((s) => s.tags[tag]) ?? {}
  const write = useSimStore((s) => s.writeTag)
  const isController = widget.props?.controller === true
  const auto = (t.MODE ?? 1) >= 0.5

  return (
    <div className="hmi-faceplate" data-testid="faceplate">
      <header>
        <strong>{tag}</strong> <span style={{ opacity: 0.7 }}>{widget.label ?? widget.type}</span>
        <button data-testid="fp-close" onClick={onClose} style={{ marginLeft: 'auto' }}>×</button>
      </header>

      {widget.type === 'pump' && (
        <>
          <p className="fp-state">{(t.RUN ?? 0) >= 0.5 ? 'RUNNING' : 'STOPPED'}</p>
          <div className="fp-row">
            <button data-testid="fp-start" onClick={() => write(tag, 'RUN', 1)}>Start</button>
            <button data-testid="fp-stop" onClick={() => write(tag, 'RUN', 0)}>Stop</button>
          </div>
        </>
      )}

      {widget.type === 'valve' && widget.props?.throttle === true && (
        <>
          <Bar label="Position %" value={t.OP ?? 0} color="#26c281" />
          <input data-testid="fp-op" type="range" min={0} max={100} value={t.OP ?? 0}
            onChange={(e) => write(tag, 'OP', Number(e.target.value))} style={{ width: '100%' }} />
          <div className="fp-row">
            <button onClick={() => write(tag, 'OP', 100)}>Open</button>
            <button onClick={() => write(tag, 'OP', 0)}>Close</button>
          </div>
        </>
      )}

      {widget.type === 'valve' && widget.props?.throttle !== true && (
        <>
          <p className="fp-state">{(t.OPEN ?? 0) >= 0.5 ? 'OPEN' : 'CLOSED'}</p>
          <div className="fp-row">
            <button data-testid="fp-open" onClick={() => write(tag, 'OPEN', 1)}>Open</button>
            <button data-testid="fp-close2" onClick={() => write(tag, 'OPEN', 0)}>Close</button>
          </div>
        </>
      )}

      {isController && (
        <>
          <Bar label="PV" value={t.PV ?? 0} color="#38a8e8" />
          <Bar label="SP" value={t.SP ?? 0} color="#ffd166" />
          <Bar label="OP" value={t.OP ?? 0} color="#9b8cff" />
          <div className="fp-row">
            <label style={{ fontSize: 11 }}>SP
              <input data-testid="fp-sp" type="number" style={{ width: 64, marginLeft: 6 }} value={Math.round((t.SP ?? 50) * 10) / 10}
                onChange={(e) => write(tag, 'SP', Number(e.target.value))} />
            </label>
            <button data-testid="fp-auto" className={auto ? 'active' : ''} onClick={() => write(tag, 'MODE', 1)}>AUTO</button>
            <button data-testid="fp-man" className={auto ? '' : 'active'} onClick={() => write(tag, 'MODE', 0)}>MAN</button>
          </div>
          <input data-testid="fp-op" type="range" min={0} max={100} value={t.OP ?? 0} disabled={auto}
            onChange={(e) => write(tag, 'OP', Number(e.target.value))} style={{ width: '100%' }} />
        </>
      )}

      {(widget.type === 'tank' || (widget.type === 'display' && !isController) || widget.type === 'gauge' || widget.type === 'trend') && (
        <Bar label="PV" value={t.PV ?? 0} color="#38a8e8" />
      )}
    </div>
  )
}
```

Add to `hmi.css`:

```css
.hmi-faceplate { position: absolute; right: 16px; top: 56px; width: 240px; background: #1d314e; color: #e8f0fa; border: 1px solid #35567c; border-radius: 8px; padding: 12px; box-shadow: 0 8px 24px #0008; z-index: 20; }
.hmi-faceplate header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.hmi-faceplate .fp-row { display: flex; gap: 6px; margin-top: 8px; }
.hmi-faceplate button { flex: 1; background: #24405f; color: inherit; border: 1px solid #35567c; border-radius: 4px; padding: 5px; cursor: pointer; }
.hmi-faceplate button.active { background: #2b6cb0; }
.hmi-faceplate .fp-state { font-size: 16px; font-weight: 700; margin: 6px 0; }
```

`HmiWorkspace.tsx`: `const [faceplate, setFaceplate] = useState<string | null>(null)` (widget id); pass `onWidgetClick={(w) => { if (w.type !== 'button' && w.type !== 'switch') setFaceplate(w.id) }}`; render inside `.hmi-center` (position: relative):

```tsx
{mode === 'run' && faceplate && (() => {
  const w = screen?.widgets.find((x) => x.id === faceplate)
  return w ? <Faceplate widget={w} onClose={() => setFaceplate(null)} /> : null
})()}
```

Clear `faceplate` on mode change and screen switch. `HmiCanvas.tsx` run-mode pointerdown: before the generic `onWidgetClick` call, handle interactive widgets:

```ts
if (w.type === 'button') {
  const sig = typeof w.props?.signal === 'string' ? w.props.signal : ''
  if (sig) useSimStore.getState().writeTag(sig, '', Number(w.props?.writeValue ?? 1))
  return
}
if (w.type === 'switch') {
  const sig = typeof w.props?.signal === 'string' ? w.props.signal : ''
  if (sig) {
    const [tg, s] = [sig.slice(0, sig.lastIndexOf('.')), sig.slice(sig.lastIndexOf('.') + 1)]
    const cur = useSimStore.getState().tags[tg]?.[s] ?? 0
    useSimStore.getState().writeTag(sig, '', cur >= 0.5 ? 0 : 1)
  }
  return
}
```

(import `useSimStore` in the canvas; a plain import is fine — the store is tiny.) Switch/lamp widgets read fully-qualified keys, so the canvas must merge them into the per-widget `sim` record: when `w.props?.signal` is a `'TAG.SIG'` string, add `values[signal] = sim?.[TAG]?.[SIG] ?? 0` before rendering.

- [ ] **Step 4: Run tests + manual smoke**

Run: `npm test -- tests/hmi/faceplate.test.tsx && npm test`
Expected: PASS. Dev smoke: RUN → click pump → Start → flow animates → click throttling valve → drag slider → tank fill rate changes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: DCS-style faceplates + operator button/switch writes"
```

### Task 17: Alarm banner + acknowledge

**Files:**
- Create: `src/hmi/AlarmBanner.tsx`
- Modify: `src/hmi/HmiWorkspace.tsx` (mount above the canvas in run mode)
- Test: `tests/hmi/banner.test.tsx`

**Interfaces:**
- Consumes: `useSimStore` (`alarms`, `ack`, `t`).
- Produces: `AlarmBanner()` — newest-first rows `[time] TAG LEVEL phase`, row blinks (`hmi-blink`) while `active`/`cleared`, per-row Ack button (`data-testid="alarm-ack"` on the first row's button), `Ack all` button (`data-testid="alarm-ack-all"`). Hidden (renders null) when there are no alarms.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/hmi/banner.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useSimStore } from '../../src/hmi/simStore'
import AlarmBanner from '../../src/hmi/AlarmBanner'
import type { HmiScreen } from '../../src/hmi/model'

const screen: HmiScreen = {
  id: 's', name: 'S', theme: 'classic',
  widgets: [{ id: 't', type: 'tank', x: 0, y: 0, w: 96, h: 128, tag: 'TK-1', props: { level0: 97 } }],
  pipes: [],
}

beforeEach(() => { useSimStore.getState().exitRun() })

describe('AlarmBanner', () => {
  it('renders nothing without alarms', () => {
    expect(renderToStaticMarkup(<AlarmBanner />)).toBe('')
  })
  it('lists active alarms with ack buttons after a tick raises them', () => {
    useSimStore.getState().enterRun(screen)
    useSimStore.getState().tickOnce(0.2)   // level0 97 -> H + HH active
    const html = renderToStaticMarkup(<AlarmBanner />)
    expect(html).toContain('TK-1')
    expect(html).toContain('HH')
    expect(html).toContain('hmi-blink')
    expect(html).toContain('data-testid="alarm-ack-all"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hmi/banner.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/hmi/AlarmBanner.tsx`**

```tsx
import { useSimStore } from './simStore'

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export default function AlarmBanner() {
  const alarms = useSimStore((s) => s.alarms)
  const ack = useSimStore((s) => s.ack)
  if (alarms.length === 0) return null
  const rows = [...alarms].sort((a, b) => b.since - a.since).slice(0, 5)
  return (
    <div className="hmi-alarms">
      {rows.map((a, i) => (
        <div key={a.id} className={`hmi-alarm-row ${a.phase}${a.phase !== 'acked' ? ' hmi-blink' : ''}`}>
          <span className="al-time">{mmss(a.since)}</span>
          <strong>{a.tag}</strong>
          <span className="al-level">{a.level}</span>
          <span className="al-phase">{a.phase.toUpperCase()}</span>
          <button data-testid={i === 0 ? 'alarm-ack' : undefined} onClick={() => ack(a.id)}>Ack</button>
        </div>
      ))}
      <button data-testid="alarm-ack-all" className="al-all" onClick={() => ack()}>Ack all</button>
    </div>
  )
}
```

`hmi.css`:

```css
.hmi-alarms { position: absolute; left: 12px; top: 48px; z-index: 15; display: flex; flex-direction: column; gap: 3px; }
.hmi-alarm-row { display: flex; gap: 8px; align-items: center; font-size: 12px; padding: 4px 8px; border-radius: 4px; color: #fff; background: #b02a2a; }
.hmi-alarm-row.cleared { background: #8a6d00; }
.hmi-alarm-row.acked { background: #7a3a3a; opacity: 0.85; }
.hmi-alarm-row button, .al-all { background: #0006; color: #fff; border: 1px solid #fff5; border-radius: 3px; cursor: pointer; font-size: 11px; }
.al-all { align-self: flex-start; padding: 3px 10px; }
```

Mount in `HmiWorkspace` inside `.hmi-center` when `mode === 'run'`: `<AlarmBanner />`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/hmi/banner.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: blinking alarm banner with acknowledge"
```

### Task 18: Phase-2 e2e + deploy checkpoint

**Files:**
- Modify: `e2e/hmi.spec.ts`

- [ ] **Step 1: Add the operate-the-plant e2e**

Append a second test. Helper for world→client coordinates (world is 1600×1000 inside the canvas bbox):

```ts
test('operate a hand-built screen: start pump, watch it fill, alarm, ack', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const box = () => canvas.boundingBox().then((b) => b!)
  const world = async (wx: number, wy: number) => {
    const b = await box()
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  // place tank + pump by palette double-click (both spawn at 320,240), then drag the tank away
  await page.getByText('Tank', { exact: true }).dblclick()
  let p = await world(360, 280)
  await page.mouse.move(p.x, p.y); await page.mouse.down()
  p = await world(800, 300); await page.mouse.move(p.x, p.y); await page.mouse.up()
  await page.getByText('Pump', { exact: true }).dblclick()
  // give both tags via the property panel
  const setTag = async (wx: number, wy: number, tag: string) => {
    const q = await world(wx, wy)
    await page.mouse.click(q.x, q.y)
    await page.getByPlaceholder('e.g. LT-101').fill(tag)
  }
  await setTag(348, 268, 'P-1')          // pump body (56x56 at 320,240)
  await setTag(840, 360, 'TK-1')         // tank body (96x128 at 800,300 after drag)
  // pipes: source -> pump, pump -> tank
  await page.getByTestId('hmi-pipe-tool').click()
  for (const [wx, wy] of [[100, 268], [316, 268]]) { const q = await world(wx, wy); await page.mouse.click(q.x, q.y) }
  await page.keyboard.press('Enter')
  await page.getByTestId('hmi-pipe-tool').click()
  for (const [wx, wy] of [[380, 268], [800, 330]]) { const q = await world(wx, wy); await page.mouse.click(q.x, q.y) }
  await page.keyboard.press('Enter')
  // run + operate
  await page.getByTestId('hmi-run-toggle').click()
  const q = await world(348, 268)
  await page.mouse.click(q.x, q.y)                        // pump faceplate
  await page.getByTestId('fp-start').click()
  const levelText = () => canvas.locator('text', { hasText: '%' }).first().textContent()
  const before = await levelText()
  await expect.poll(levelText, { timeout: 15000 }).not.toBe(before)   // level moving
  await page.getByTestId('fp-close').click()
  await page.getByTestId('hmi-speed').click()             // 5x to reach the alarm faster
  await expect(page.getByTestId('alarm-ack')).toBeVisible({ timeout: 60000 })  // H alarm at 90%
  await page.getByTestId('alarm-ack-all').click()
  await page.getByTestId('hmi-run-toggle').click()        // back to edit
})
```

Coordinate literals assume `WIDGET_DEFAULT_SIZE` and the palette double-click spawn point (320,240) from Tasks 1/7 — adjust only if those constants changed. If clicks land on empty space, take a screenshot (`page.screenshot`) to debug placement before touching tolerances.

- [ ] **Step 2: Run the full suite**

Run: `pkill -f vite || true; set -o pipefail; npm test && npm run e2e 2>&1 | tail -20`
Expected: all PASS.

- [ ] **Step 3: Commit + deploy checkpoint (Phase 2 live)**

```bash
git add -A && git commit -m "test: phase-2 e2e — operate, alarm, ack"
npm run build && npx firebase-tools deploy --only hosting
```

Verify the live site serves the new bundle (content-hash check), then manually on the live site: build a two-widget screen, RUN, start the pump.

<!-- CONTINUE-6 -->
