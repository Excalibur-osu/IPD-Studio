# HMI Studio — Design Specification

**Date:** 2026-08-22
**Status:** Approved by user (theme/import/sim-depth/extras decisions confirmed)
**Feature name:** HMI Studio — the operate-mode companion to the P&ID editor

## 1. What we are building

A second workspace inside PID Studio where users build **HMI screens** (operator
mimic displays) and run them as an **interactive simulation**: tanks fill, pipes
show animated flow, pumps start and stop from DCS-style faceplates, alarms blink
in a banner until acknowledged. The marquee feature: **one button converts a
P&ID sheet into a working HMI** — because PID Studio already has validated ISA
tags, port geometry, and derivable control loops, the import can auto-wire a
simulation where an `LIC-101 / LV-101 / LT-101` loop actually holds tank level.

This stays true to the product differentiator: *data behind the drawing*. The
P&ID's intelligence is what makes the HMI generation possible; no browser tool
does this today (FUXA does SCADA runtime but has no P&ID model to generate from).

### Decisions already made (with the user)

| Decision | Choice |
|---|---|
| Default look | **Classic SCADA** (colorful); ISA-101 High-Performance gray as a toggle |
| P&ID import | **Snapshot + re-import** — import creates an editable screen; a Re-import button refreshes it; no live link |
| Simulation depth | **Phased**: manual interactive sim ships first (Phase 2), auto-wired PID loops after (Phase 3) |
| Extras (all in) | Faceplates, alarm banner + acknowledge, trend sparkline widget, sim speed controls |
| Deploy cadence | Each phase ships and deploys, matching every release so far |

### Explicitly NOT in scope (deliberate)

- **No real device connectivity** (no OPC-UA/Modbus/MQTT). The tag data source
  is the built-in simulator only. The runtime is labeled **"training / demo
  simulation"** in the UI — illustrative physics, not engineering-grade.
- No alarm history/journal, no shelving — just active-alarm banner + ack (ISA-18.2 flavor, not conformance).
- No operator security levels / login.
- No scripting or expression language on widgets (bindings are tag picks).
- No new runtime dependencies. Trends and gauges are hand-drawn SVG.
- No live-linked import (decided: snapshot + re-import).
- Simulation ticks only while the HMI workspace is open in RUN mode.

## 2. Vocabulary (industry concepts we mirror)

- **Tag** — named live value, `LT-101` with **signals** `.PV` (value), `.SP`
  (setpoint), `.OP` (output %), `.RUN` (motor state), `.MODE` (AUTO/MAN).
- **Design mode vs runtime** — every industrial package (Ignition, InTouch,
  WinCC, FactoryTalk) separates building screens from operating them. Ours is
  the EDIT / RUN toggle.
- **Faceplate** — popup opened by clicking equipment; the standard way
  operators command a DCS (Start/Stop, Open/Close, PV/SP/OP + AUTO/MAN).
- **Mimic** — the process picture: equipment + pipes + live values.
- **ISA-101 / High-Performance HMI** — gray-background style where color is
  reserved for abnormal states; our second theme.
- **ISA-18.2** — alarm management standard; source of our alarm lifecycle
  (Active→Acked→Cleared) and HH/H/L/LL limit naming.

## 3. Placement & schema

- **Workspace toggle in the top toolbar: `P&ID | HMI`** (persisted UI pref).
  Same app, same document, no router. The HMI workspace is code-split via
  `React.lazy` so the P&ID editor's initial load is unaffected.
- **Schema v4**: `ProjectDoc.hmiScreens?: HmiScreen[]` plus
  `activeScreenId` in the store (not persisted, like `activeSheetId`).
  `migrate.ts` gains v3→v4 (add empty array). Everything else untouched, so
  all existing files load.
- HMI screens get their own tab strip (mirrors SheetTabs). Save/load/autosave/
  undo come free from the existing store + zundo.

## 4. Architecture

**The HMI canvas is plain React SVG — deliberately NOT JointJS.**

- HMI needs none of JointJS's value (ports/magnets/obstacle routing) and much
  it can't give cleanly: 5 Hz live updates, rich widget internals (trends,
  gauges), CSS animations, click-to-operate semantics.
- Pure React SVG widgets are **testable in vitest/jsdom** (JointJS never was —
  the single biggest testing gotcha in this repo disappears for the HMI half).
- Builder interactions we implement ourselves are modest and well-understood:
  pointer-drag with 8px grid snap, corner-handle resize, click / shift-click
  selection, arrow-key nudge, delete, polyline pipe tool. Undo via the
  existing temporal store.

**Two stores, one rule:** persistent screen *structure* lives in the main doc
store (undoable, autosaved); ephemeral *simulation state* (tag values, alarms,
history buffers, run/speed) lives in a separate small zustand store with **no
zundo** — operator actions and sim ticks must never pollute drawing undo
history or autosave churn.

```
src/hmi/
  model.ts            types + defaults (DOM-free)
  importFromPid.ts    Sheet -> HmiScreen mapping (DOM-free)
  simStore.ts         non-temporal zustand store for runtime state
  sim/
    tags.ts           tag table build, signal addressing (DOM-free)
    network.ts        flow-network build from screen pipes/widgets (DOM-free)
    engine.ts         tick(state, network, dt) pure function (DOM-free)
    alarms.ts         limit evaluation + lifecycle state machine (DOM-free)
    noise.ts          seeded deterministic drift/noise (DOM-free)
  HmiWorkspace.tsx    layout shell (toolbar, palette, canvas, props, banner)
  HmiCanvas.tsx       SVG canvas: edit interactions + runtime rendering
  HmiPalette.tsx      widget palette
  HmiPropertyPanel.tsx  bindings/ranges/limits/appearance editor
  ScreenTabs.tsx      screen tab strip
  Faceplate.tsx       runtime popup (pump / valve / controller variants)
  AlarmBanner.tsx     top strip, blink + Ack
  RuntimeToolbar.tsx  RUN/EDIT, Run/Pause, speed, Reset, theme toggle
  widgets/            one file per widget type, pure (props -> SVG)
```

## 5. Domain model

```ts
export type HmiTheme = 'classic' | 'hp'

export type WidgetType =
  | 'tank' | 'pump' | 'valve' | 'display' | 'gauge' | 'trend'
  | 'lamp' | 'button' | 'switch' | 'label' | 'symbol'

export interface HmiWidget {
  id: string
  type: WidgetType
  x: number; y: number; w: number; h: number
  rotation?: 0 | 90 | 180 | 270
  /** Primary tag, e.g. 'LT-101' or 'P-101'. Widgets read derived signals (.PV/.RUN/.OP). */
  tag?: string
  label?: string
  /** Per-type extras: units, min/max, alarm limits, symbolId (for 'symbol'),
   *  onLabel/offLabel, writeSignal/writeValue (button/switch), color overrides. */
  props?: Record<string, string | number | boolean>
}

export interface HmiPipe {
  id: string
  points: { x: number; y: number }[]
  /** Sim branch whose flow animates this pipe (assigned by import or by proximity). */
  flowRef?: string
  width?: number
}

export interface HmiScreen {
  id: string
  name: string
  theme: HmiTheme            // default 'classic'
  widgets: HmiWidget[]
  pipes: HmiPipe[]
  fromSheetId?: string       // set by import; enables Re-import
}
```

Widget catalog (v1):

| Widget | Runtime behavior | Signals read/written |
|---|---|---|
| tank | animated fill level, % text | reads `.PV` (0–100) |
| pump | color = running/stopped, impeller spin animation; click → faceplate | `.RUN` (bool) |
| valve | color/wedge = open/closed, % for throttling; click → faceplate | `.OP` (0–100) or `.OPEN` (bool) |
| display | numeric value + units, alarm-colored border | `.PV` |
| gauge | radial arc with needle + limit band | `.PV` |
| trend | scrolling sparkline of recent history | `.PV` history |
| lamp | on/off indicator light | any bool signal |
| button | momentary write on press | writes configured signal |
| switch | latching toggle | writes configured signal |
| label | static text | — |
| symbol | any of the 180+ P&ID symbol renderers as a graphic, optional state tint | optional bool for tint |

The `symbol` widget reuses the existing `SymbolDef.render()` SVG strings
(inserted into an SVG `<g>`), which guarantees **every** imported P&ID node has
a faithful visual even before a dedicated widget exists for it.

## 6. Simulation

### Tag table
Built when RUN starts: walk the screen's widgets → create tags with signals,
engineering units, ranges, and default alarm limits (levels: LL 5 / L 10 /
H 90 / HH 95, overridable per widget in the property panel). Deterministic
seeded noise (`noise.ts`, LCG) gives measurements realistic drift; tests pin
the seed.

### Flow network (`network.ts`)
Pipes + widgets compile to a directed graph: **sources** (pipe free ends that
feed in, off-page arrows), **sinks** (free ends out), **tanks** (capacity from
widget size or props), and **branch elements** (pumps, valves) along pipe runs.
Direction comes from P&ID edge direction on import, or drawing order for
hand-drawn pipes.

### Tick (`engine.ts`) — pure function, 5 Hz × sim speed
- Branch flow = rated flow of its driver (running pump, or a pressurized
  source) × Π(valve open fractions along the run); zero if any closed valve,
  stopped pump on the run, empty upstream tank, or full downstream tank.
- Tanks integrate: `level += (Σin − Σout) / capacity · dt`, clamped 0–100.
- Measurement signals = physical value + noise; temp/pressure display tags
  drift plausibly around a base value.
- **Phase 3:** controllers run velocity-form PI, `OP` drives their wired
  valve, `PV` reads their wired transmitter; AUTO/MAN from the faceplate.
- Alarm evaluation each tick (`alarms.ts`): per-tag limit checks feed the
  ISA-18.2-style lifecycle `Normal → Active/Unacked → Active/Acked →
  Cleared/Unacked → Normal`; banner shows anything not Normal, blinks while
  unacked.

### Runtime interaction
Faceplate opens on click (pump: Start/Stop; valve: Open/Close or 0–100
slider; controller: PV/SP/OP bars, SP entry, AUTO/MAN). Buttons/switches write
their configured signal. Pipe flow animation: `stroke-dasharray` dash march
whose speed is proportional to branch flow (CSS variable per pipe; zero flow =
static). Sim controls: Run / Pause / 1× / 5× / Reset.

## 7. Themes

A theme = token set consumed by widgets: background, pipe idle/flow colors,
running/stopped, open/closed, alarm colors, text.

- **classic** (default): dark navy background, saturated states (green
  running, red stopped, cyan liquid, yellow/red alarms) — demo-friendly.
- **hp** (ISA-101 High-Performance): light-gray background, dark-gray
  equipment, muted fills; **only alarms are saturated**. Educational and
  credible; one toggle away.

Theme is per-screen, switchable live in the runtime toolbar.

## 8. P&ID → HMI import (`importFromPid.ts`)

One toolbar action: **"Build HMI from sheet…"** (pick sheet; default active).
Creates a new `HmiScreen` (snapshot; `fromSheetId` recorded). **Re-import**
replaces that screen's contents after confirm. Mapping:

| P&ID | HMI |
|---|---|
| vessels category | `tank` (capacity ∝ symbol area × scale) |
| rotating category | `pump` |
| control-valves | `valve` (throttling, `.OP`) |
| valves-manual | `valve` (on/off, `.OPEN`; operable in runtime like a hand valve) |
| instrument bubbles, letters ending T (LT/FT/PT/TT…) | `display` bound to the physical value it measures (level of connected vessel, flow of its pipe, else drifting value) |
| controller bubbles (…IC/…C) | `display` (controller variant: PV+SP) that opens the controller faceplate; wired to its loop in Phase 3 |
| local indicators (PI/TI/LI…), converters, misc instruments | `display` with drifting value |
| heat/inline/flow-elements/safety/solids/utilities/etc. | `symbol` graphic (flow passes through inline elements) |
| annotation, off-page connectors | skipped; off-page arrows/connectors become network sources/sinks |
| edges `process.*` / `pipe.*` | `HmiPipe` — points = source port world pos + stored vertices + target port world pos (reuses `portWorld()` from `alignment.ts`) |
| edges `signal.*`, `link.internal` | dropped (HMIs don't draw signal wiring; loops connect logically) |

Positions/sizes copy 1:1 (same 8px-grid coordinate space) — the imported HMI
looks like the P&ID and the user declutters it in EDIT mode. Tag names come
from node tags (`formatTag`); untagged equipment falls back to its label, else
an auto name (`TK-1`, `P-1`, …). Loop wiring (Phase 3) reuses the existing
loop-derivation logic that powers the Loop panel / loop diagrams.

## 9. Testing strategy

House style: logic is DOM-free and table-tested.

- `tests/hmi/model.test.ts` — schema v4 migration, defaults.
- `tests/hmi/import.test.ts` — mapping table against `examples/sample-plant.pnid.json` + focused fixtures (each category, tag fallbacks, pipe geometry, signal-edge dropping).
- `tests/hmi/sim.test.ts` — network build; tank fills iff pump running and path open; clamps at full/empty; flow zero through closed valve; PI loop converges PV→SP (Phase 3); determinism under fixed seed.
- `tests/hmi/alarms.test.ts` — limit crossings drive the full lifecycle incl. ack-before-clear vs clear-before-ack.
- Widget smoke tests via `react-dom/server` `renderToStaticMarkup` (no new deps): each widget renders, level/state reflected in markup, both themes.
- `e2e/hmi.spec.ts` — switch workspace → import sample sheet → RUN → level text changes (expect.poll, per the async-render gotcha) → pump faceplate Stop → flow stops → alarm fires on overfill → Ack.

## 10. Milestones (each ships + deploys)

1. **Phase 1 — Workspace + builder:** schema v4 + migration, workspace toggle
   (lazy-loaded), screen tabs, SVG canvas with edit interactions, widget
   palette (all types, static rendering), property panel with tag/range/limit
   editing, pipe drawing tool, persistence/undo. *Deliverable: build and save
   an HMI screen by hand.*
2. **Phase 2 — Runtime + manual sim:** sim store + tag table + network +
   engine + alarms, RUN/EDIT toggle, faceplates, alarm banner + ack, flow
   animation, trend widget live, sim speed controls, both themes. *Deliverable:
   operate a hand-built screen; everything moves.*
3. **Phase 3 — Import + auto loops:** importFromPid + Re-import, controller
   PI loops auto-wired from P&ID tags/loops, controller faceplate AUTO/MAN.
   *Deliverable: sample refinery P&ID → working HMI in one click.*
4. **Phase 4 — Polish:** demo HMI template in the templates menu, README +
   docs section, e2e hardening, perf pass (history caps, memoized widgets),
   any UX feedback round.

## 11. Risks & mitigations

- **Sim realism expectations** — label "training / demo simulation" in the
  runtime toolbar; docs say illustrative physics.
- **Scope creep in the physics** — the tick contract (§6) is the v1 physics;
  anything deeper (pressure networks, thermal balances) is explicitly future.
- **Bundle growth** — lazy chunk for the whole HMI workspace; zero new deps;
  trends/gauges hand-drawn.
- **Perf with many widgets/trends** — 5 Hz tick, memoized pure widgets,
  history ring buffers capped (≈600 samples/tag).
- **Two canvases drift apart in UX feel** — reuse app.css patterns, same
  panel/collapse behaviors, same keyboard conventions (Delete, arrows, Ctrl+Z).
