# PID Studio — Design Specification

**Date:** 2026-08-20
**Status:** Draft for review
**Working name:** `pid-studio` (rename welcome before first release)

## 1. What we are building

An open-source, browser-based, **intelligent P&ID / instrumentation diagram editor**. Users drag ISA-5.1-style symbols from a palette onto a canvas, connect them with properly routed process and signal lines, tag instruments with validated ISA tags, and export professional deliverables (SVG/PDF drawing, instrument index, line list).

The differentiator over Lucidchart/draw.io-class tools: **data behind the drawing**. Every symbol and line is a typed domain object — tags are parsed and validated against ISA-5.1 letter rules, loops are derived automatically, deliverables are generated from the model, and the document format is open JSON designed to map onto DEXPI.

### Decisions already made (with the user)

| Decision | Choice |
|---|---|
| First users | Engineers + students both; free open core |
| Storage | Local-first: pure browser app, no backend, no login. Files on user's machine + IndexedDB autosave |
| License | AGPL-3.0 |
| V1 shape | Core done properly (~80 symbols, all 6+ ISA line types, tags, loops, exports) — not everything-at-rough-quality |
| Engine | JointJS open core (`@joint/core`, MPL-2.0) + React + TypeScript |

### Explicitly NOT in v1 (deliberate)

- No backend, accounts, or real-time collaboration
- No DWG/DXF import or export (hardest interop; later)
- No DEXPI XML export yet (model is designed to map to it; export is phase 2)
- No SCADA/runtime features (FUXA's category — different product)
- No 3D
- No full 200+ symbol catalog (v1 ships ~80 covering the common ~95%; library format makes adding symbols a data change, not a code change)
- No AI features

### Legal note on symbols

ISA-5.1 the *document* is copyrighted; the symbols are drawn independently from geometric first principles (circle, square, hexagon, diamond, line conventions) as commonly documented in public engineering references. We never copy/trace the standard's artwork, never feed ISA documents to AI tools, and label the library "ISA-5.1-style". Before any commercial packaging, contact permissions@isa.org.

## 2. Stack

- **Vite + React 18 + TypeScript (strict)** — app shell, panels, tooling
- **@joint/core 4.x (MPL-2.0)** — canvas: SVG rendering, ports/magnets, manhattan (obstacle-avoiding) orthogonal routing, link tools
- **Zustand + zundo** — domain store with temporal undo/redo
- **idb-keyval** — IndexedDB autosave
- **Vitest** — unit tests; **Playwright** — thin e2e happy path
- No CSS framework dependency decision forced; plain CSS modules to start

License compatibility: MPL-2.0 (file-level copyleft) is compatible inside an AGPL-3.0 app. All other deps MIT/ISC.

## 3. Architecture — unidirectional data flow

**The domain store is the single source of truth. JointJS is a controlled view.**

```
User input (palette drag, canvas interaction, panels, keyboard)
        │  paper/DOM events translated to…
        ▼
Store actions (addNode, moveNode, connect, setTag, delete, …)
        ▼
Zustand domain store  ──zundo──▶ undo/redo history
        │  subscribe
        ▼
Reconciler (diff by id + per-cell version) ──▶ JointJS Graph/Paper (SVG)
        │
        ├──▶ Validation engine (recompute affected checks)
        ├──▶ Derived state: loops, instrument index, line list
        └──▶ Autosave (debounced → IndexedDB)
```

Rules:
- Every mutation goes through a store action. JointJS interactive gestures (drag, link draw) are committed to the store on completion (`pointerup` / `link:connect`); the reconciler makes the graph match the store (no-op when already matching).
- Undo/redo = zundo time travel on the domain state; reconciler applies the delta to the canvas.
- Benefit: save/load, undo, validation, exports, and future collaboration all operate on ONE clean JSON model; the canvas engine stays swappable.

### Modules

```
src/
  model/        # types, schema, migrations — zero UI deps
  isa/          # ISA-5.1 letter tables, tag parser/validator/expander, auto-numbering
  symbols/      # symbol library: defs (data) + SVG renderers + ports
  store/        # zustand store, actions, derived selectors (loops, index, line list)
  canvas/       # JointJS integration: paper setup, reconciler, event→action translation,
                # custom link views (ISA line decorations), routing config
  panels/       # React UI: palette, property panel, validation panel, loop panel, toolbar
  export/       # svg export, print/PDF pipeline + title block, CSV generators
  persist/      # file save/load (.pnid.json), IndexedDB autosave, schema versioning
```

Each module is independently testable; `model/`, `isa/`, `export/` have no DOM dependencies at all.

## 4. Domain model (DEXPI-aligned, simplified)

```ts
type ProjectDoc = {
  schemaVersion: 1;
  meta: { name: string; drawingNumber: string; revision: string; author: string;
          sheetSize: 'A4'|'A3'|'A2'|'A1'|'ANSI_B'|'ANSI_D'; created: string; modified: string };
  settings: { gridPx: number; tagSeparator: '-' | '' };
  nodes: PlantNode[];
  edges: PlantEdge[];
};

type PlantNode = {
  id: string;                       // ulid
  symbolId: string;                 // e.g. 'instr.bubble', 'valve.gate', 'equip.pump.centrifugal'
  kind: 'equipment'|'instrument'|'valve'|'fitting'|'annotation';
  x: number; y: number;
  rotation: 0|90|180|270; flipH?: boolean;
  config?: Record<string, string>;  // symbol parameters, e.g. bubble {display, location}
  tag?: Tag;
  label?: string;                   // free text / equipment service name
  attrs?: Record<string, string>;   // extensible: service, rating, notes…
};

type Tag = { letters: string; loop: string; suffix?: string };  // FT-101A → {FT, 101, A}

type PlantEdge = {
  id: string;
  lineClass:
    | 'process.major' | 'process.minor'
    | 'signal.electric' | 'signal.pneumatic' | 'signal.hydraulic'
    | 'signal.capillary' | 'signal.data' | 'signal.software' | 'link.internal';
  source: { nodeId: string; portId: string } | { x: number; y: number };  // free end allowed
  target: { nodeId: string; portId: string } | { x: number; y: number };
  vertices?: {x:number;y:number}[];   // user-pinned waypoints; router fills the rest
  lineNumber?: { size: string; spec: string; service: string; seq: string };  // process lines
  arrow?: 'none' | 'flow';
};
```

**Loops are derived, not stored:** instruments grouped by `tag.loop` (+ letter-family awareness) feed the loop panel and instrument index. No stored Loop entity to fall out of sync. DEXPI mapping notes: PlantNode(kind=equipment)→`Equipment`, (instrument)→`ProcessInstrument`, process edges→`PipingNetworkSegment`, signal edges→signal connections; documented per-field in `model/DEXPI-MAPPING.md` as we go.

## 5. Symbol library

Symbols are **typed data + parametric SVG renderers**, not hand-placed clipart:

```ts
type SymbolDef = {
  id: string; name: string; category: SymbolCategory;
  gridSize: { w: number; h: number };          // in grid units (grid = 8px)
  render: (cfg: Record<string,string>) => string;  // SVG markup, stroke-only, currentColor
  ports: { id: string; x: number; y: number; kind: 'process'|'signal'|'both' }[];
  tagRule: 'isa-instrument' | 'valve' | 'equipment' | 'none';
  defaultLetters?: string;                     // palette presets, e.g. FT, PT, LT, TT
  keywords: string[];                          // palette search
};
```

The core elegance: **one parameterized instrument bubble** — `config.display ∈ {discrete, shared, computer, plc}` × `config.location ∈ {field, control-room, aux, behind-panel}` renders all 16 ISA variants (circle / circle-in-square / hexagon / diamond-in-square × no line / solid line / double line / dashed line) from one renderer. Valve + actuator likewise composes (body × actuator type × fail action).

**V1 catalog (~80):** instrument bubbles (parameterized, + palette presets for FT/PT/LT/TT/AT/FIC/PIC/LIC/TIC/PSV-adjacent switches); control valve bodies (globe, butterfly, ball) × actuators (diaphragm, piston, motor, solenoid, manual) with FC/FO fail marks; manual valves (gate, globe, ball, butterfly, plug, needle, check, 3-way); safety (PSV, rupture disc, vacuum breaker); flow primaries (orifice flanges, venturi, magmeter, coriolis, vortex, turbine, rotameter, pitot); level (gauge glass, displacer, radar nozzle); temperature (thermowell); equipment (centrifugal pump, PD pump, dosing pump, compressor, blower/fan, motor M-circle, agitator, vertical vessel, horizontal vessel, storage tank, column w/ trays, shell-&-tube HX, plate HX, air cooler, filter/strainer, ejector); fittings (concentric/eccentric reducer, spectacle blind, spade, flange pair, sample point, drain/vent, off-page connector, flow arrow, spec break, insulation mark); annotations (text, note flag, revision cloud).

Adding a symbol after v1 = adding one data module + tests. No editor changes.

## 6. Lines — ISA-5.1 signal conventions

Rendered by a custom JointJS link view that decorates the routed path with repeated glyphs (sampled along path length):

| lineClass | Rendering |
|---|---|
| process.major | solid, heavy (2.5px) |
| process.minor | solid, light (1.25px) |
| signal.electric | dashed `– – –` |
| signal.pneumatic | solid + repeated double slash `⫽` |
| signal.hydraulic | solid + repeated `L` ticks |
| signal.capillary | solid + repeated `×` |
| signal.data / software | solid + repeated small circles ○ |
| link.internal | fine dashed |

Routing: JointJS `manhattan` (obstacle-avoiding, sharp 90° corners), user-dragged waypoints persisted as `vertices`. Connection validation: port `kind` compatibility (process↔process, signal↔signal/both); violations refused live with visual feedback.

## 7. ISA tag intelligence

- `isa/` holds the ISA-5.1 letter tables as data: first letters (measured variable) incl. modifiers (D, F, Q, S, K…), succeeding letters (readout/output functions), authored independently from public engineering knowledge.
- **Parser/validator:** `FIC` → Flow · Indicating · Controller ✓; unknown/illegal combos → warning with reason. Property panel shows the plain-English expansion live as the user types.
- **Auto-numbering:** placing a tagged symbol suggests the next free loop number for that letter family; duplicate tags flagged document-wide.
- **Loop panel:** groups instruments by loop number, shows loop members and gentle completeness hints (FT+FIC but no final element → info). Hints, never blockers.

## 8. Editor UX (v1)

- **Layout:** palette (left, categorized + search) · canvas (center) · property panel (right, context-sensitive) · toolbar (top: file, undo/redo, zoom, export) · status bar (validation count, zoom, cursor grid pos)
- **Canvas:** 8px grid + snap, pan (space/middle-drag), zoom to cursor, marquee + shift-select, drag from palette to place, R rotate, arrows nudge, Del delete, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste (pasted instruments get tag cleared to avoid silent duplicates), Ctrl+S save
- **Property panel by selection:** instrument → tag editor (letters + loop + suffix, live expansion + validation), symbol config (bubble display/location, valve actuator/fail); line → class picker, line number editor, flow arrow toggle; equipment → tag + service label
- **Persistence:** autosave every change (debounced 500ms) to IndexedDB; File → Save/Open as `.pnid.json` (File System Access API, download/upload fallback); "unsaved changes" indicator

## 9. Validation engine (v1 checks)

Non-blocking warnings panel (engineering drawings are legitimately incomplete mid-work):
1. Duplicate tag
2. Instrument missing tag
3. Invalid ISA letter combination
4. Dangling line end (free end not on an off-page connector)
5. Incompatible connection (caught live at draw time too)
6. Duplicate line number

Each finding: message + click-to-locate on canvas.

## 10. Exports / deliverables (v1)

- **SVG** — native, exact vector output
- **PDF / print** — print pipeline with title block (drawing number, name, revision, author, date, sheet size A4–A1/ANSI B/D), margins and scale correct at real sheet sizes
- **Instrument index CSV** — tag, expansion, loop, connected line/equipment, service
- **Line list CSV** — line number parts, class, from → to
- **`.pnid.json`** — the open native format, versioned (`schemaVersion` + migrations)

Phase 2 (explicitly deferred): DEXPI/Proteus XML export, PNG raster export, DWG.

## 11. Testing strategy

- **Vitest, TDD for all logic:** tag parser/validator (table-driven across letter combos), auto-number allocator, loop derivation, CSV generators, schema migration, reconciler diffing, symbol port geometry
- **Playwright (thin):** one happy path — place pump + valve + two instruments, connect process + signal lines, tag, see validation clear, export SVG + index
- Symbol renderers: snapshot-test SVG output per symbol/config

## 12. Milestones

| # | Deliverable |
|---|---|
| M1 | Skeleton: Vite+React+TS+JointJS canvas, grid, pan/zoom, place one symbol, save/load JSON |
| M2 | Symbol library core: parameterized bubble + first ~30 symbols; palette with search |
| M3 | Lines: classes, ISA decorations, manhattan routing, ports, connection rules |
| M4 | Tags: ISA tables, parser/validator, property panel, auto-numbering, duplicates |
| M5 | Editor polish: selection, undo/redo, copy/paste, rotate, snap guides |
| M6 | Validation panel + loop panel |
| M7 | Exports: SVG, print/PDF + title block, instrument index + line list CSV |
| M8 | Symbol catalog to ~80, sample P&ID project, README/docs/CONTRIBUTING, AGPL text, v0.1 |

## 13. Risks & mitigations

- **Reconciler complexity** (store↔JointJS): keep mutations action-only; diff by id+version; covered by unit tests from M1.
- **ISA line glyph rendering** on routed paths: custom link view sampling `getPointAtLength`; prototype in M3 first week.
- **Print fidelity** (browser PDF quirks): test A3/A1 early in M7; svg2pdf fallback if print CSS disappoints.
- **JointJS paid-tier temptation:** selection, snaplines, undo are ours by design (store-level) — never depend on JointJS+ namespaces.
- **Symbol IP:** independent authorship rule above; reviewer checklist in CONTRIBUTING.
