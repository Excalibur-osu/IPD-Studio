# PID Studio v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.1 of an open-source, browser-based intelligent P&ID editor: drag-and-drop ISA-5.1-style symbols, zoomable sheet, obstacle-avoiding orthogonal process/signal lines with correct ISA decorations, validated ISA tags with auto-numbering, validation + loop panels, and exports (SVG, print/PDF with title block, instrument index CSV, line list CSV).

**Architecture:** Unidirectional data flow. A Zustand domain store holds the document (`ProjectDoc`) as the single source of truth with zundo undo/redo; JointJS (`@joint/core`, MPL-2.0) renders it as a controlled SVG view via a reconciler; all interactions translate to store actions. Pure logic (ISA tables, tag parsing, loop derivation, CSV/exports, line-glyph geometry) lives in DOM-free modules.

**Tech Stack:** Vite, React 18, TypeScript (strict), @joint/core ^4, zustand ^5, zundo ^2, idb-keyval ^6, ulid ^2, vitest ^3, Playwright (e2e, final task).

**Spec:** `docs/superpowers/specs/2026-08-20-pid-studio-design.md`

## Global Constraints

- License AGPL-3.0-only; every dependency must be MIT/ISC/BSD/MPL-2.0 — nothing from JointJS+ (`joint.ui.*`, `dia.CommandManager` are forbidden namespaces).
- TypeScript `strict: true`; no `any` except in test fixtures.
- Grid unit = **8 px**. All symbol geometry, ports, and snapping align to it.
- Drawing is monochrome black-on-white (engineering sheet); app chrome may be styled freely.
- Symbols are authored from geometric first principles; never copy/trace ISA/vendor artwork; never feed standard documents to AI tools (CONTRIBUTING rule).
- Node ≥ 20, npm (no pnpm/yarn), package name `pid-studio`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Sheet sizes (landscape, mm): A4 297×210, A3 420×297, A2 594×420, A1 841×594, ANSI B 431.8×279.4, ANSI D 863.6×558.8. Conversion: 1 mm = 3.7795 px. Default sheet A3.

---

## Part A — The Complete Symbol & Line Catalog

This is the industry catalog the app will grow into. **Phase column:** `1` = this plan (v0.1, ~84 symbols), `2` = v0.2 (catalog completion + DEXPI), `3` = v0.3+ (collaboration & generation features). Tag prefixes follow ISA-5.1 conventions.

### A1. Instrument bubbles (one parameterized symbol → 16 variants) — Phase 1

| display \ location | Field | Control room (primary) | Behind panel | Local panel |
|---|---|---|---|---|
| Discrete | plain circle | circle + solid center line | circle + dashed line | circle + double line |
| Shared display/control (DCS) | circle in square | + solid line | + dashed line | + double line |
| Computer function | hexagon | + solid line | + dashed line | + double line |
| PLC | diamond in square | + solid line | + dashed line | + double line |

Palette presets (same symbol, pre-filled letters): FT, FIT, FIC, FE, PT, PIT, PIC, PG, PDT, LT, LIT, LIC, LG, TT, TIT, TIC, TE, TW, AT, AIT, HS, ZSC, ZSO, SC, WT, VT.

### A2. Line classes

| Class | Rendering | ISA meaning | Phase |
|---|---|---|---|
| process.major | solid 2.5px | primary process pipe | 1 |
| process.minor | solid 1.25px | secondary/utility pipe | 1 |
| process.impulse | solid 1px short | instrument process connection | 1 |
| signal.electric | dashed 4-3 | electrical signal | 1 |
| signal.pneumatic | solid + ⫽ pairs every 24px | pneumatic signal | 1 |
| signal.hydraulic | solid + L ticks | hydraulic signal | 1 |
| signal.capillary | solid + × marks | filled-system capillary | 1 |
| signal.data | solid + ○ every 24px | shared data link | 1 |
| signal.software | dashed + ○ | software/internal data | 1 |
| link.internal | fine dash 2-2 | internal system link | 1 |
| signal.em | solid + ~ marks | electromagnetic/sonic (guided) | 2 |
| pipe.jacketed | double parallel line | jacketed pipe | 2 |
| pipe.traced | solid + dotted companion | heat-traced | 2 |
| pipe.existing | thin 0.75px | existing plant | 2 |
| pipe.underground | long-dash | buried | 2 |
| pipe.battery-limit | chain dash-dot heavy | battery limit / match line | 2 |

### A3. Valves — manual / on-off

| Symbol | Geometry (local px) | Tag | Phase |
|---|---|---|---|
| Gate | bowtie: `M0 0 L0 16 L16 8 Z M32 0 L32 16 L16 8 Z`, ports (0,8)(32,8) | HV/— | 1 |
| Globe | bowtie + filled circle r4 @(16,8) | HV | 1 |
| Ball | bowtie + open circle r6 @(16,8) | HV | 1 |
| Butterfly | end bars `M0 0 V16 M32 0 V16` + diagonal `M4 14 L28 2` + dot r2 | HV | 1 |
| Plug | bowtie + open rect 8×8 @center | HV | 1 |
| Needle | globe + stem `M16 8 V0` with arrowhead | HV | 1 |
| Diaphragm (weir) | bowtie + arc cap over center | HV | 1 |
| Pinch | two arcs facing in + flow line | HV | 2 |
| Check (swing) | open triangle `M4 2 L28 8 L4 14 Z` + seat bar `M28 0 V16` | — | 1 |
| Stop-check | check + stem T on top | — | 2 |
| 3-way | bowtie + bottom triangle `M8 24 L24 24 L16 8 Z`, 3rd port (16,24) | HV | 1 |
| 4-way | four triangles to center, 4 ports | HV | 2 |
| Angle | two triangles at 90°, ports (0,8)(24,32)-style | HV | 2 |
| Knife gate | gate + blade line | HV | 2 |

### A4. Control valves & actuators (body × actuator composition) — bodies Phase 1: globe, butterfly, ball; actuators Phase 1 marked

| Actuator (drawn above body on stem) | Geometry | Phase |
|---|---|---|
| Spring-diaphragm | mushroom arc `M6 8 a10 6 0 0 1 20 0 Z` on stem | 1 |
| Piston (cylinder) | rect 16×10 with center line | 1 |
| Motor (MOV) | circle r7 + "M" | 1 |
| Solenoid (SOV) | square 12×12 + "S" | 1 |
| Manual handwheel | T-bar | 1 |
| Digital/smart positioner box | small square on side + signal port | 2 |
| Electro-hydraulic | rect + "EH" | 2 |
| Fail action marks | FC: arrow toward seat; FO: arrow away; FL: crossbar — drawn beside stem | 1 |
| Tags | FV/PV/LV/TV (throttling), XV (on-off), also FCV/PCV self-regulating below | — |

### A5. Safety / relief / self-actuated

| Symbol | Tag | Phase |
|---|---|---|
| Pressure safety valve (angle body + spring zigzag) | PSV | 1 |
| Vacuum relief valve | PVSV | 2 |
| Pilot-operated PSV | PSV | 2 |
| Rupture disc (flange bars + upward arc) | PSE | 1 |
| Vacuum breaker | VB | 2 |
| Flame arrestor (rect + honeycomb hatch) | FA | 2 |
| Conservation/breather vent | PVRV | 2 |
| Self-acting pressure regulator (valve + integral diaphragm, downstream tap) | PCV | 1 |
| Back-pressure regulator (upstream tap) | BPCV/PCV | 2 |
| Self-acting temperature regulator (bulb + capillary) | TCV | 2 |
| Excess-flow valve | XFV | 3 |

### A6. Flow primary elements

| Symbol | Tag | Phase |
|---|---|---|
| Orifice plate between flange bars (`M0 8 H32 M14 0 V16 M18 0 V16`) | FE | 1 |
| Venturi (mirrored trapezoids) | FE | 1 |
| Flow nozzle | FE | 2 |
| Pitot / averaging pitot (Annubar-style) | FE | 2 |
| Magnetic flowmeter (circle + electrode dots on flow line) | FE/FIT | 1 |
| Coriolis (twin U-tubes) | FE/FIT | 1 |
| Vortex (circle + bluff-body triangle) | FE/FIT | 1 |
| Turbine (circle + rotor cross) | FE/FIT | 1 |
| Ultrasonic clamp-on (angled transducer pair) | FE/FIT | 2 |
| Thermal mass | FE | 2 |
| Positive-displacement meter | FQI | 2 |
| Rotameter / variable area (tapered tube + float) | FI | 1 |
| Weir / flume (open channel) | FE | 3 |
| Restriction orifice (RO plate, single bar + `RO`) | RO | 1 |

### A7. Temperature / pressure / level accessories

| Symbol | Tag | Phase |
|---|---|---|
| Thermowell (closed socket into line) | TW | 1 |
| Filled-bulb + capillary | TE | 2 |
| Bimetal dial thermometer | TI | 2 |
| Pressure gauge (bubble PG on impulse stem) | PG/PI | 1 |
| Diaphragm seal (small circle + membrane bar) | — | 2 |
| 3/5-valve manifold | — | 3 |
| Gauge glass / sight level (vertical tube + valves) | LG | 1 |
| External float / displacer cage | LT | 2 |
| Radar level nozzle (horn into vessel) | LT | 2 |
| Load-cell mount | WT | 2 |

### A8. Pumps, compressors, drivers

| Symbol | Geometry hint | Tag | Phase |
|---|---|---|---|
| Centrifugal pump | circle r14 + tangential discharge duct top-right, ports suction L / discharge R-top | P- | 1 |
| PD gear/screw pump | circle + two inner gear circles | P- | 1 |
| Diaphragm/metering pump | circle + inner diaphragm arc + stroke arrow | P- | 1 |
| Peristaltic | circle + inner rollers | P- | 2 |
| Plunger/piston pump | rect + crank circle | P- | 2 |
| Submersible/sump | pump in well outline | P- | 2 |
| Ejector / eductor (jet pump) | converging-diverging nozzle body | EJ- | 1 |
| Vacuum pump | circle + inward arrows | P- | 2 |
| Centrifugal compressor | widening trapezoid `M4 4 L44 0 L44 32 L4 28 Z` | K-/C- | 1 |
| Reciprocating compressor | cylinder + piston rod + crank | K- | 2 |
| Screw compressor | rect + twin screws | K- | 2 |
| Blower / fan | circle + inner fan blades | B-/F- | 1 |
| Steam/gas turbine (driver) | narrowing trapezoid | ST-/GT- | 2 |
| Electric motor | circle + "M" | M- | 1 |
| Engine | rect + "E" | — | 3 |
| VFD (drive box on motor feed) | square + "VFD" | SC | 2 |
| Gearbox | meshed squares | — | 3 |
| Agitator/mixer (shaft + impeller, motor block on top) | — | A-/AG- | 1 |

### A9. Vessels, columns, reactors

| Symbol | Tag | Phase |
|---|---|---|
| Vertical vessel/drum (capsule) | V-/D- | 1 |
| Horizontal vessel/drum | V-/D- | 1 |
| Atmospheric storage tank (flat-bottom rect, cone/flat top) | TK- | 1 |
| Floating-roof tank | TK- | 2 |
| Sphere | V- | 2 |
| Bullet | V- | 2 |
| Open tank/pit | TK- | 2 |
| Silo/hopper (rect + cone bottom) | S- | 2 |
| Tray column (capsule + horizontal tray lines) | C-/T- | 1 |
| Packed column (capsule + packing hatch zones) | C- | 2 |
| Jacketed CSTR (vessel + jacket outline + agitator) | R- | 1 |
| Fixed-bed reactor (vessel + bed hatch) | R- | 2 |
| Tubular/PFR | R- | 3 |
| 2-phase separator / KO drum | V- | 1 |
| 3-phase separator (horizontal + weir + boot) | V- | 2 |
| Cyclone (cone + tangential inlet) | CY- | 2 |
| Deaerator | DA- | 3 |

### A10. Heat transfer

| Symbol | Tag | Phase |
|---|---|---|
| Shell & tube HX (circle + through-line + shell nozzles) | E- | 1 |
| U-tube / kettle reboiler (horizontal shell + bundle + weir) | E- | 2 |
| Plate HX (rect + pack of diagonals) | E- | 1 |
| Double-pipe | E- | 2 |
| Air cooler / fin-fan (rect + fan circle + blades) | E-/AC- | 1 |
| Spiral | E- | 3 |
| Electric heater (rect + zigzag element) | H-/EH- | 2 |
| Fired heater / furnace (box + burner + stack) | H-/F- | 2 |
| Boiler | B- | 3 |
| Condenser (HX + drain leg) | E- | 2 |
| Cooling tower (trapezoid + fan + fill hatch) | CT- | 2 |
| Chiller package | CH- | 3 |

### A11. Solids handling & separation

| Symbol | Tag | Phase |
|---|---|---|
| Y-strainer (45° pocket on line) | — | 1 |
| Basket/duplex strainer | — | 2 |
| Temporary cone strainer (witch's hat flag) | — | 2 |
| Cartridge/bag filter vessel | F-/FL- | 1 |
| Filter press | FP- | 3 |
| Rotary drum filter | F- | 3 |
| Centrifuge | CF- | 2 |
| Bag house / dust collector | DC- | 3 |
| Scrubber (packed) | SC- | 2 |
| Demister pad (hatch band in vessel) | — | 2 |
| Coalescer | — | 3 |
| Hydrocyclone | — | 3 |
| Clarifier/thickener | CL- | 3 |
| Rotary dryer / spray dryer / tray dryer | D- | 3 |
| Evaporator | EV- | 3 |
| Crystallizer | CR- | 3 |
| Screen (vibrating) | SC- | 3 |
| Crusher / mill | M- | 3 |
| Belt conveyor / screw conveyor / bucket elevator | CV- | 3 |
| Rotary/screw feeder, rotary airlock | FD- | 3 |
| Static mixer (rect + crossed vanes, inline) | MX- | 2 |

### A12. Piping fittings & inline items

| Symbol | Phase |
|---|---|
| Concentric reducer (trapezoid outline) | 1 |
| Eccentric reducer (flat bottom) | 2 |
| Flange pair (double bars) | 1 |
| Blind flange (single bar + cap) | 2 |
| Spectacle blind — open / closed (linked ○ and ●) | 1 |
| Spade / spacer (single ● / ○ paddle) | 2 |
| Union / coupling / quick-connect | 3 |
| Hose (wavy segment) / hose station | 2 |
| Expansion joint / bellows (corrugated band) | 2 |
| Steam trap (circle + inner "T"; float/thermo/inverted-bucket variants ph3) | 1 |
| Sight glass inline (circle + parallel bars) | 2 |
| Sample point (SC valve + label flag) | 1 |
| Drain / vent to atmosphere (short stub + open triangle "V"/"D") | 1 |
| Funnel / tundish (open V to drain) | 2 |
| Silencer (rect + hatch on vent) | 2 |
| Exhaust head | 3 |
| Injection quill / spray nozzle | 2 |
| Mixing tee | 3 |
| Spec break (double slash + spec labels each side) | 1 |
| Insulation/tracing spec mark | 2 |
| Slope mark (▷ slope %) | 2 |
| Tie-in flag (△ TP-n) | 2 |
| Battery-limit flag | 2 |

### A13. Control-system hardware & logic

| Symbol | Phase |
|---|---|
| Interlock diamond ("I" in ◇ on signal lines) | 1 |
| Logic function box (ISA-5.2 AND/OR/NOT gates) | 2 |
| DCS / PLC / SIS system boxes (rectangle nests) | 2 |
| Junction box (JB square) | 2 |
| Local control panel (LP rect) | 2 |
| MCC / VFD / UPS blocks | 3 |
| IS barrier (rect + zener mark) | 3 |
| SIS final-element trip loop (per ISA-84 conventions) | 3 |

### A14. Annotation & drawing furniture

| Item | Phase |
|---|---|
| Off-page connector (pentagon arrow, ref text, bidirectional pairing) | 1 |
| On-page reference (circle-split) | 2 |
| Flow direction arrow (solid ▶ on line) | 1 |
| Free text note + leader | 1 |
| Note flag (hexagon n) | 1 |
| Revision cloud + rev triangle | 1 (cloud), 2 (triangle) |
| Equipment title block strip (name + tag + duty above symbol) | 2 |
| Title block (sheet frame, project/dwg no./rev/author/date/scale) | 1 |
| Match line | 2 |
| North arrow / plot plan items | never (not P&ID) |

**Phase totals:** Phase 1 ≈ 84 palette entries + 10 line classes; Phase 2 ≈ +75; Phase 3 ≈ +45 plus generation features.

### A15. Phase feature breakdown

- **Phase 1 (v0.1, this plan):** editor + catalog above marked 1, tags/validation/loops, exports, autosave, sample project, docs.
- **Phase 2 (v0.2):** catalog completion (marked 2), DEXPI/Proteus XML export + import validation via pyDEXPI reference files, PNG export, multi-sheet projects with linked off-page connectors, drawing templates, jacketed/traced line classes, ISA-5.2 logic symbols, custom user symbols (SVG import with port editor).
- **Phase 3 (v0.3+):** real-time collaboration (Yjs over optional self-hosted ws server, stays AGPL), auto-generated loop diagrams (ISA-5.4) from the model, instrument datasheet stubs (ISA-20 style), DWG/DXF import spike (LibreDWG/ODA evaluation), plugin/scripting API, PWA offline install, remaining catalog (marked 3).

---

## Part B — File Structure (v1)

```
pid-studio/
  LICENSE                      AGPL-3.0 text
  README.md
  CONTRIBUTING.md              incl. symbol-authorship IP rule
  index.html  vite.config.ts  tsconfig.json  package.json
  src/
    main.tsx  App.tsx  app.css
    model/
      types.ts                 ProjectDoc, PlantNode, PlantEdge, Tag, LineClass, SheetSize
      doc.ts                   createEmptyDoc(), touch(), SHEET_SIZES_MM, mmToPx
      migrate.ts               loadDoc(json): migrations by schemaVersion
    isa/
      letters.ts               FIRST_LETTERS, FIRST_MODIFIERS, SUCCEEDING_LETTERS tables
      tag.ts                   parseTag, validateLetters, expandLetters, formatTag
      autonumber.ts            nextLoopNumber(doc, letters)
    symbols/
      types.ts                 SymbolDef, PortDef, SymbolCategory
      registry.ts              SYMBOLS map, byCategory(), search()
      lib/
        bubble.ts              parameterized instrument bubble (A1)
        valves-manual.ts       A3 phase-1 set
        valves-control.ts      A4 bodies+actuators composition
        safety.ts              A5 phase-1
        flow-elements.ts       A6 phase-1
        accessories.ts         A7 phase-1
        rotating.ts            A8 phase-1
        vessels.ts             A9 phase-1
        heat.ts                A10 phase-1
        inline.ts              A11+A12 phase-1
        control.ts             A13 phase-1 (interlock)
        annotation.ts          A14 phase-1
    store/
      store.ts                 zustand+zundo: doc + ui slices, actions
      selectors.ts             deriveLoops, instrumentIndexRows, lineListRows
    canvas/
      shapes.ts                PidSymbol element & PidLine link factories
      lineStyle.ts             stroke/dash per LineClass + glyph spec
      glyphs.ts                pure: glyphPointsForRoute(points, spacing)
      decorations.ts           applies glyph labels to links
      reconciler.ts            reconcile(graph, doc, prevDoc)
      Canvas.tsx               paper mount, zoom/pan, grid, events→actions
      interactions.ts          selection, keyboard map, palette drop handling
      connectionRules.ts       canConnect(sourcePort, targetPort, lineClass)
    panels/
      Palette.tsx  PropertyPanel.tsx  TagEditor.tsx
      ValidationPanel.tsx  LoopPanel.tsx  Toolbar.tsx  StatusBar.tsx
    validate/
      checks.ts                the 6 v1 checks → Finding[]
    export/
      svg.ts                   exportSvg(paper, doc)
      printPdf.ts              print pipeline + TitleBlock svg
      csv.ts                   instrumentIndexCsv(doc), lineListCsv(doc)
    persist/
      autosave.ts              IndexedDB debounced snapshot + restore
      file.ts                  saveAs/open .pnid.json (FS Access API + fallback)
  tests/  (mirrors src; vitest)
  e2e/    happy-path.spec.ts (Playwright, final task)
  examples/ sample-plant.pnid.json
```

---

## Part C — Tasks

### Task 1: Scaffold, license, toolchain

**Files:** Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/app.css`, `LICENSE`, `README.md`, `.gitignore`
**Interfaces:** Produces the running dev shell all later tasks mount into.

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts` (dir already has git + docs; allow merge), then `npm i @joint/core zustand zundo idb-keyval ulid && npm i -D vitest @vitest/coverage-v8 jsdom`
- [ ] **Step 2:** tsconfig: set `"strict": true`, `"noUncheckedIndexedAccess": true`. vite.config.ts add:
```ts
/// <reference types="vitest/config" />
export default defineConfig({ plugins: [react()], test: { environment: 'node', include: ['tests/**/*.test.ts'] } })
```
- [ ] **Step 3:** Replace App.tsx with three-column CSS grid shell (`palette | canvas | props`, header toolbar row, footer status row) rendering placeholder divs; app.css with the grid, `html,body,#root{height:100%}`.
- [ ] **Step 4:** Download AGPL-3.0 text into `LICENSE`; README stub (name, one-paragraph pitch, dev quickstart, license badge); `package.json` set `"license": "AGPL-3.0-only"`, script `"test": "vitest run"`.
- [ ] **Step 5:** Verify `npm run dev` serves the shell and `npm test` runs 0 tests green. Commit `feat: scaffold Vite+React+TS shell with AGPL license`.

### Task 2: Domain model + empty doc + migrations

**Files:** Create: `src/model/types.ts`, `src/model/doc.ts`, `src/model/migrate.ts`; Test: `tests/model/doc.test.ts`
**Interfaces:** Produces: all types from spec §4 verbatim (`ProjectDoc`, `PlantNode`, `PlantEdge`, `Tag`, `LineClass` union incl. `process.impulse`, `EdgeEnd = {nodeId,portId}|{x,y}`), `createEmptyDoc(name?: string): ProjectDoc`, `SHEET_SIZES_MM: Record<SheetSize,{w:number,h:number}>`, `mmToPx(mm:number): number` (×3.7795), `loadDoc(raw: unknown): ProjectDoc` (throws `DocError` on bad schema, migrates old versions).

- [ ] **Step 1:** Write failing tests: empty doc has schemaVersion 1, A3 default, iso `created`; `mmToPx(420)` ≈ 1587.4; `loadDoc` round-trips `createEmptyDoc()`, throws on `{schemaVersion: 99}` and on missing `nodes`.
- [ ] **Step 2:** Run `npx vitest run tests/model` → FAIL (module not found).
- [ ] **Step 3:** Implement types exactly as spec §4 (+ `SheetSize`, `Finding` type `{id, checkId, message, targetId?}`); implement doc.ts and migrate.ts (v1 passthrough with shape guard).
- [ ] **Step 4:** Tests pass. Commit `feat: domain model, sheet sizes, doc load/migrate`.

### Task 3: ISA letter tables + tag parser/validator/expander

**Files:** Create: `src/isa/letters.ts`, `src/isa/tag.ts`; Test: `tests/isa/tag.test.ts`
**Interfaces:** Produces: `parseTag(s: string): Tag | null` ("FIC-101A"→{letters:'FIC',loop:'101',suffix:'A'}, separator optional); `formatTag(t: Tag, sep: '-'|''): string`; `validateLetters(letters: string): {ok: true, parts: LetterPart[]} | {ok: false, reason: string}`; `expandLetters(letters: string): string` ("FIC"→"Flow Indicating Controller", best-effort even when invalid).

- [ ] **Step 1:** letters.ts data (independently authored public-knowledge tables): `FIRST_LETTERS` A Analysis, B Burner/Combustion, C User's Choice, D User's Choice, E Voltage, F Flow Rate, G User's Choice, H Hand, I Current, J Power, K Time, L Level, M User's Choice, N User's Choice, O User's Choice, P Pressure, Q Quantity, R Radiation, S Speed/Frequency, T Temperature, U Multivariable, V Vibration, W Weight/Force, X Unclassified, Y Event/State, Z Position/Dimension. `FIRST_MODIFIERS` D Differential, F Ratio, J Scan, K Time-Rate-of-Change, Q Totalize, S Safety, X/Y/Z axes. `SUCCEEDING` A Alarm, B User's Choice, C Control, E Primary Element, G Glass/Gauge, I Indicate, K Control Station, L Light, N User's Choice, O Orifice/Restriction, P Test Point, R Record, S Switch, T Transmit, U Multifunction, V Valve/Damper, W Well, X Unclassified, Y Compute/Relay, Z Driver/Actuator; trailing modifiers H High, L Low, M Middle, plus HH/LL doubles and switch-state O/C after S.
- [ ] **Step 2:** Table-driven failing tests — valid: FT, FE, FIC, FIT, FQI, PDT, PDIC, PSV, PCV, PG, PIT, LT, LIC, LG, LSHH, LSLL, TT, TIC, TE, TW, TAH, AIT, HS, XV, FV, ZSC, ZSO, SC, UY, YIC?→no: use YIC invalid check below; invalid: `Fic` (case), `IT` fine? I=Current valid → include as valid; invalid rows: `QQ` (modifier first), `FZZ`? Z driver terminal twice → invalid, `AB` B user's-choice unknown → warning-ok policy: user's-choice letters validate with `parts` labeled "User's Choice"; hard-invalid: empty, 1 char, >5 chars, lowercase, `F1C` digits. Expansions asserted: FIC, PDT ("Pressure Differential Transmitter"), LSHH ("Level Switch High-High"), ZSO ("Position Switch Open"), PSV ("Pressure Safety Valve").
- [ ] **Step 3:** Run → FAIL. Implement parser: uppercase check, first letter lookup; second char as modifier iff in FIRST_MODIFIERS ∧ length>2 ∧ combination in known pair-set {PD,TD,FQ,FF,PS,LS? no—LS is L+S switch}: rule = treat as modifier only for pairs {AD? no}: implement explicit modifier-pair allowlist {PD, DP? no, FQ, FF, TD, KQ, PS on PSV/PSE only}; simpler deterministic rule (document it): scan left→right, char2 is modifier if `letters.length>2 && FIRST_MODIFIERS[char2] && char2 !== 'S'` plus special-case `S` as Safety when followed by V/E (PSV, PSE, TSV). Remaining chars must be SUCCEEDING; trailing H/L runs and O/C-after-S handled; else `{ok:false, reason}`.
- [ ] **Step 4:** All tag tests pass (≥40 rows). Commit `feat: ISA-5.1 letter tables and tag parse/validate/expand`.

### Task 4: Auto-numbering

**Files:** Create: `src/isa/autonumber.ts`; Test: `tests/isa/autonumber.test.ts`
**Interfaces:** Consumes `ProjectDoc`, `Tag`. Produces: `nextLoopNumber(doc: ProjectDoc, letters: string): string` — family = first letter; returns lowest unused integer ≥ 100 as string; `isDuplicateTag(doc, tag, excludeNodeId?): boolean` (letters+loop+suffix exact match).

- [ ] **Step 1:** Failing tests: empty doc → "100"; existing FT-100, FIC-101 → F family next "102"; gap FT-100, FT-102 → "101"; P family independent → "100"; duplicate detection incl. suffix distinction (FT-101A vs FT-101B not duplicates) and exclude-self on edit.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat: loop auto-numbering and duplicate detection`.

### Task 5: Store — document actions + undo

**Files:** Create: `src/store/store.ts`; Test: `tests/store/store.test.ts`
**Interfaces:** Consumes model + isa. Produces (used by every UI task): `useStore` zustand hook; state `{doc: ProjectDoc, selection: string[], dirty: boolean}`; actions `addNode(partial: Omit<PlantNode,'id'>): string`, `moveNodes(ids: string[], dx: number, dy: number)`, `setNodePos(id, x, y)`, `rotateNode(id)` (+90 cycle), `setNodeConfig(id, config)`, `setTag(id, tag: Tag | undefined)`, `setLabel(id, label)`, `addEdge(partial: Omit<PlantEdge,'id'>): string`, `setEdge(id, patch: Partial<PlantEdge>)`, `setEdgeVertices(id, vertices)`, `deleteSelected()`, `deleteIds(ids: string[])` (cascades edges attached to deleted nodes), `setSelection(ids)`, `pasteNodes(nodes, edges)` (new ids, +16px offset, tags stripped), `loadIntoStore(doc)`, `undo()`, `redo()` via zundo temporal (partialize: only `doc`). All doc mutations set `dirty=true` and `doc.meta.modified`.

- [ ] **Step 1:** Failing tests with `useStore.getState()`: add+move+snap not here (snap is canvas concern — positions stored raw); delete cascades attached edges; paste strips tags and remaps edge endpoints among pasted set; undo restores previous doc but not selection; redo works; loadIntoStore clears history.
- [ ] **Step 2:** FAIL → implement with `create<StoreState>()(temporal(...))`, ulid ids → PASS. Commit `feat: document store with actions and undo/redo`.

### Task 6: Symbol foundation + parameterized instrument bubble

**Files:** Create: `src/symbols/types.ts`, `src/symbols/registry.ts`, `src/symbols/lib/bubble.ts`; Test: `tests/symbols/bubble.test.ts`
**Interfaces:** Produces: `SymbolDef` exactly per spec §5 (`render(cfg: Record<string,string>): string` returns inner SVG markup, stroke `currentColor`, fill `none` unless stated, stroke-width 1.5); `PortDef {id,x,y,kind:'process'|'signal'|'both'}`; `registerSymbols(defs: SymbolDef[])`, `getSymbol(id): SymbolDef`, `byCategory(): Map<SymbolCategory, SymbolDef[]>`, `searchSymbols(q): SymbolDef[]` (name+keywords). Bubble: id `instr.bubble`, gridSize 5×5 (40px), cfg `display: discrete|shared|computer|plc`, `location: field|control-room|behind-panel|local-panel`; ports N/E/S/W kind 'both'; tagRule 'isa-instrument'.

- [ ] **Step 1:** Failing tests: registry lookup + search('valve') empty for now; bubble render for all 16 display×location combos — assert snapshot strings contain expected primitives (discrete/field: one `<circle r="18"`; shared adds `<rect`; computer: `<polygon` 6 points; plc: rotated square polygon inside rect; control-room adds full-width `<line y1="20" y2="20"`; behind-panel that line with `stroke-dasharray`; local-panel two lines y=17.5,22.5).
- [ ] **Step 2:** FAIL → implement geometry in 40×40 local space (circle c20,20 r18; square 2,2,36,36; hexagon pts (20,2)(36,11)(36,29)(20,38)(4,29)(4,11); plc diamond (20,4)(36,20)(20,36)(4,20) inside square) → PASS. Commit `feat: symbol registry and 16-variant instrument bubble`.

### Task 7: Symbol batch — manual valves + control valves + safety

**Files:** Create: `src/symbols/lib/valves-manual.ts`, `valves-control.ts`, `safety.ts`; Test: `tests/symbols/valves.test.ts`
**Interfaces:** Produces symbol ids `valve.gate|globe|ball|butterfly|plug|needle|diaphragm|check|threeway`, `cv.globe|butterfly|ball` with cfg `{actuator: diaphragm|piston|motor|solenoid|manual, fail: none|fc|fo|fl}` (composed markup: body from A3 geometry + stem + actuator glyph from A4 table; signal port `{id:'sig', y:0, kind:'signal'}` at actuator top, process ports at body ends), `psv` (angle body: vertical inlet triangle apex-up at bottom port, horizontal outlet triangle to right port, spring zigzag `M16 14 l6 -3 l-6 -3 l6 -3` above), `rupture-disc`, `pcv.self` per A5. Geometry strings from Part A tables are the implementation content.

- [ ] **Step 1:** Failing snapshot/geometry tests: every def registers; gate path equals A3 string; each cv cfg variant contains its actuator primitive ("M" text for motor, rect for piston/solenoid, arc path for diaphragm); fail marks render when set; psv has ports bottom(16,40)+right(40,? per 40-high box) and spring path present; all ports land on the 8px grid (assert `x%8===0||x===center` rule: use multiples of 4 allowed for centers — assert documented rule `%4===0`).
- [ ] **Step 2:** FAIL → implement all defs → PASS. **Step 3:** `npm run dev`, temporarily render a test sheet of these SVGs in App (throwaway route) and eyeball shapes; delete throwaway. Commit `feat: valve, control valve, and safety symbol sets`.

### Task 8: Symbol batch — flow elements, accessories, rotating, vessels, heat, inline, annotation

**Files:** Create: `src/symbols/lib/{flow-elements,accessories,rotating,vessels,heat,inline,control,annotation}.ts`; Test: `tests/symbols/catalog.test.ts`
**Interfaces:** Produces every remaining Phase-1 id from Part A tables (A6: `fe.orifice|venturi|magmeter|coriolis|vortex|turbine|rotameter|ro`; A7: `acc.thermowell|pg|lg`; A8: `pump.centrifugal|gear|diaphragm`, `ejector`, `comp.centrifugal`, `blower`, `motor`, `agitator`; A9: `vessel.vertical|horizontal|tank|column-tray|cstr|ko-drum`; A10: `hx.shell-tube|plate|air-cooler`; A11/A12: `strainer.y`, `filter.cartridge`, `fit.reducer|flanges|spectacle|steam-trap|sample|drain|vent|specbreak`; A13: `ctl.interlock`; A14: `ann.offpage|arrow|text|noteflag|cloud`). Equipment ports = process nozzles at grid-aligned positions (tank: top/bottom/side; column: top/bottom + 2 side; pump: suction W, discharge NE; hx: 4).

- [ ] **Step 1:** Failing test: catalog completeness — assert `SYMBOLS.size >= 60` after batch registration and EVERY id above resolves; per-family spot geometry checks (pump circle r14 + discharge duct; column ≥3 tray lines; orifice = 3 line segments; offpage pentagon closes).
- [ ] **Step 2:** FAIL → implement using Part A geometry hints (author paths on 8px grid; equipment default gridSize 6×6 to 6×10) → PASS. **Step 3:** visual eyeball sheet as in Task 7. Commit `feat: phase-1 equipment, flow element, fitting, annotation symbols`.

### Task 9: Canvas mount — paper, grid, zoom, pan

**Files:** Create: `src/canvas/Canvas.tsx`; Modify: `src/App.tsx` (mount it); Test: `tests/canvas/canvas.test.ts` (jsdom: `// @vitest-environment jsdom`)
**Interfaces:** Consumes store doc.meta.sheetSize. Produces: `<Canvas/>` rendering a `dia.Paper` sized to sheet px with 8px dot-grid, white sheet on gray backdrop, wheel-zoom to cursor (0.25–4×, `paper.scale`+`translate` math), space-or-middle-drag pan, and exports helper `paperRef` context for later tasks (`CanvasCtx = {getPaper(): dia.Paper|null, getGraph(): dia.Graph}` via React context).

- [ ] **Step 1:** Failing jsdom test: mounting Canvas creates a paper whose `getComputedSize()` matches A3 px (1587×1122 ±1) and grid drawn (`drawGrid` called / grid option set).
- [ ] **Step 2:** FAIL → implement (`new dia.Graph({}, {cellNamespace: shapes})`, `new dia.Paper({el, model, width, height, gridSize: 8, drawGrid: {name:'dot'}, background:{color:'#fff'}, async: true, interactive: {linkMove: false}})`; wheel handler: `const s = clamp(scale * (e.deltaY<0?1.1:0.9)); paper.scaleUniformAtPoint(s, localPoint)` implement via matrix; keydown space toggles pan mode with pointer capture) → PASS + manual check: dev server shows empty A3 sheet, zooms at cursor, pans.
- [ ] **Step 3:** Commit `feat: sheet canvas with grid, cursor zoom, pan`.

### Task 10: Shapes + reconciler (store → graph)

**Files:** Create: `src/canvas/shapes.ts`, `src/canvas/reconciler.ts`; Test: `tests/canvas/reconciler.test.ts` (jsdom)
**Interfaces:** Consumes SymbolDef registry, ProjectDoc. Produces: `makeElement(node: PlantNode): dia.Element` — generic `pid.Symbol` with markup `<g class="sym">${def.render(node.config??{})}</g>` + tag `<text>`s, size gridSize×8, position, angle=rotation, ports from def (JointJS port groups by kind, magnets); `makeLink(edge: PlantEdge): dia.Link` — `pid.Line` with `router: {name:'manhattan', args:{step: 8, padding: 16}}`, `connector: {name:'normal'}`, endpoints port-anchored or point-anchored, vertices, base attrs from `lineStyle.ts` (Task 11 supplies decorations; here stroke/dasharray only — inline `LINE_STROKES` map in shapes.ts to keep this task self-contained, moved nothing later: lineStyle.ts created HERE with `strokeFor(lineClass): {width, dasharray?}` per A2 phase-1 rows); `reconcile(graph, doc, prev)` — add/remove/update cells by id diff; update = position/angle/config-markup/tag-text/edge patch only when changed (compare via per-cell `data.rev` = JSON of relevant slice).

- [ ] **Step 1:** Failing tests (graph only, no paper): reconcile empty→2 nodes+1 edge creates 3 cells with right types/ids; moving node in doc updates cell position; removing edge removes cell; unchanged doc → zero `set` calls (spy); tag text renders letters+loop lines; port count matches def.
- [ ] **Step 2:** FAIL → implement → PASS. Wire `Canvas.tsx`: `useStore.subscribe(s => s.doc, (doc, prev) => reconcile(graph, doc, prev))` + initial reconcile. Manual: hack `addNode` from console → symbol appears. Commit `feat: joint shapes and store→graph reconciler`.

### Task 11: Line glyph decorations (pure geometry + link labels)

**Files:** Create: `src/canvas/glyphs.ts`, `src/canvas/decorations.ts`; Modify: `src/canvas/lineStyle.ts` (glyph spec per class); Test: `tests/canvas/glyphs.test.ts`
**Interfaces:** Produces: `glyphPointsForRoute(points: {x,y}[], spacing: number): {x,y,angle}[]` — pure walk along polyline emitting evenly spaced stations (skip 12px near ends/corners); `GLYPHS: Record<LineClass, {spacing: number, markup: string} | null>` (pneumatic: two 8px slashes; data: circle r2.5 filled white stroke black; software: same on dashed base; hydraulic: `L` tick; capillary: `×`); `applyDecorations(link: dia.Link, edge: PlantEdge)` — sets JointJS labels at computed `position: {distance}` values after route resolution (`link.findView(paper).getConnection().length()` — called from paper `link:render` hook registered in Canvas).

- [ ] **Step 1:** Failing tests for the pure part: straight 100px line spacing 24 → stations at ~24/48/72 with angle 0; L-route angles flip 90° after corner; corner-exclusion zone honored; per-class GLYPH table completeness for all 10 phase-1 classes (null for solid/dashed-only classes).
- [ ] **Step 2:** FAIL → implement → PASS. Manual: console-add pneumatic + data edges, verify slashes/circles ride the route and survive re-route on node drag. Commit `feat: ISA signal line glyph decorations`.

### Task 12: Palette + drag-to-place

**Files:** Create: `src/panels/Palette.tsx`; Modify: `src/App.tsx`, `src/canvas/Canvas.tsx` (drop handler)
**Interfaces:** Consumes registry byCategory/search, store addNode. Produces: left panel with search input + collapsible categories, each entry a 40px SVG preview (`dangerouslySetInnerHTML` of `def.render(defaults)` inside viewBox) with name tooltip; HTML5 drag (`dataTransfer.setData('application/x-pid-symbol', JSON.stringify({symbolId, presetLetters?}))`); canvas `drop` converts client→local coords (`paper.clientToLocalPoint`), snaps to 8, `addNode({symbolId, kind: def.category-mapped, x, y, rotation: 0, config: defaults, tag: presetLetters ? {letters: presetLetters, loop: nextLoopNumber(doc, presetLetters)} : undefined})`. Bubble presets listed in A1 appear under category "Instruments" as separate palette rows sharing `instr.bubble`.

- [ ] **Step 1:** Implement panel + drop (no new unit tests — covered by e2e later; keep search pure helper `searchSymbols` already tested).
- [ ] **Step 2:** Manual verification: drag FT preset → bubble lands snapped with tag FT-100 rendered; drag pump; search filters. Commit `feat: symbol palette with search and drag-to-place`.

### Task 13: Canvas interactions — select, move-commit, link drawing, delete, keyboard

**Files:** Create: `src/canvas/interactions.ts`, `src/canvas/connectionRules.ts`; Modify: `src/canvas/Canvas.tsx`; Test: `tests/canvas/connectionRules.test.ts`
**Interfaces:** Consumes store actions, port kinds. Produces: `canConnect(sourceKind: PortKind, targetKind: PortKind, lineClass: LineClass): boolean` (process.\*/impulse need both ∈ {process, both}; signal.\*/link.internal need ∈ {signal, both}); paper wiring: element click → `setSelection`; shift-click adds; blank pointerdown starts marquee rect (drawn as absolute-positioned div, on up selects intersecting cells); `element:pointerup` commits `setNodePos(id, snap8(x), snap8(y))`; port-magnet drag creates link with **current draw line-class** (store ui field `activeLineClass`, toolbar-set, default `process.major`), `paper.options.validateConnection` delegates to canConnect, `link:connect` commits `addEdge`; dragging link creates vertices → `setEdgeVertices` on up; Del/Backspace `deleteSelected`; Ctrl+Z/Y/S wired (S → Task 18 saveFile, stub console until then); R rotates selection; arrows nudge 8px (shift 1px — off-grid allowed deliberately for fine text placement); Ctrl+C/V copy/paste via store.
- [ ] **Step 1:** Failing tests for `canConnect` matrix (9 combos × classes) → FAIL → implement → PASS.
- [ ] **Step 2:** Wire everything; JointJS specifics: `paper.options.defaultLink = () => makeLink(draft)`, `markAvailable: true`, snapLinks radius 16.
- [ ] **Step 3:** Manual: place pump→valve→tank, draw process line pump→valve→tank with auto-routing around symbols; draw signal FT→FIC→FV refused onto process nozzle; move pump → routes re-solve; undo/redo replays. Commit `feat: selection, movement, validated link drawing, keyboard map`.

### Task 14: Property panel + tag editor

**Files:** Create: `src/panels/PropertyPanel.tsx`, `src/panels/TagEditor.tsx`; Modify: `src/App.tsx`
**Interfaces:** Consumes selection, symbols, isa, store setters. Produces: right panel switching on selection: **nothing** → sheet meta editor (name, drawing number, revision, author, sheetSize select); **node** → symbol name header, config selects built from def (bubble display/location dropdowns; cv actuator/fail), TagEditor when tagRule ≠ 'none', label input, rotation buttons; **edge** → lineClass select (grouped Process/Signal), flow-arrow toggle, lineNumber 4-field editor (size/spec/service/seq) when process.\*; multi-select → count + delete button. TagEditor: letters input (auto-uppercase) + loop + suffix; live `expandLetters` line; `validateLetters` message on invalid; duplicate warning via `isDuplicateTag`; "auto №" button fills `nextLoopNumber`.

- [ ] **Step 1:** Implement panel (logic already unit-tested in isa/store; this is wiring).
- [ ] **Step 2:** Manual: select bubble → change to PLC/behind-panel → glyph updates via reconciler; type `FIC` see "Flow Indicating Controller", type `FZC` see reason; duplicate FT-100 flags. Commit `feat: context property panel with live ISA tag editor`.

### Task 15: Validation engine + panel

**Files:** Create: `src/validate/checks.ts`, `src/panels/ValidationPanel.tsx`; Modify: `src/App.tsx`, `src/panels/StatusBar.tsx` (create), Test: `tests/validate/checks.test.ts`
**Interfaces:** Consumes doc + isa. Produces: `runChecks(doc: ProjectDoc): Finding[]` implementing the 6 spec checks (`duplicate-tag`, `missing-tag` (instrument kind w/o tag), `invalid-letters`, `dangling-end` (point-anchored end NOT on `ann.offpage` node), `incompatible-connection` (recheck stored edges), `duplicate-line-number`); panel lists findings grouped by check with count badge in status bar; clicking a finding → `setSelection([targetId])` + Canvas scrolls cell into view (`paper.translate` centering).

- [ ] **Step 1:** Failing table tests per check incl. clean-doc → `[]` → FAIL → implement → PASS.
- [ ] **Step 2:** Wire panel (recompute via `useMemo` on doc). Manual sanity. Commit `feat: live validation engine and findings panel`.

### Task 16: Loop panel

**Files:** Create: `src/store/selectors.ts`, `src/panels/LoopPanel.tsx`; Test: `tests/store/selectors.test.ts`
**Interfaces:** Produces: `deriveLoops(doc): Loop[]` where `Loop = {family: string, loop: string, members: {nodeId, tag: Tag}[], hint?: string}` — group tagged instrument/valve nodes by `tag.loop`; hint when family has measurement (T-suffix member) + controller (C) but no final element (V/Z member) → "no final element"; panel renders loops with member tags, click selects members.

- [ ] **Step 1:** Failing tests: FT-101+FIC-101+FV-101 one loop no hint; FT/FIC-102 hint present; suffixed members group together. FAIL → implement → PASS.
- [ ] **Step 2:** Panel wiring (tab beside ValidationPanel). Commit `feat: derived control-loop panel with completeness hints`.

### Task 17: Persistence — autosave + file save/open

**Files:** Create: `src/persist/autosave.ts`, `src/persist/file.ts`; Modify: `src/panels/Toolbar.tsx` (create: New/Open/Save/SaveAs/Undo/Redo/zoom/fit/export buttons), `src/App.tsx`; Test: `tests/persist/file.test.ts`
**Interfaces:** Produces: `startAutosave(store)` — subscribe doc, debounce 500ms, `set('pid-studio.autosave', doc)` via idb-keyval; `restoreAutosave(): Promise<ProjectDoc|null>` on boot (offer restore when found & differs from empty); `saveFile(doc, handle?)` — File System Access API `showSaveFilePicker({types: [{accept: {'application/json': ['.pnid.json']}}]})` with `<a download>` blob fallback, clears dirty; `openFile(): Promise<ProjectDoc>` via picker/input, through `loadDoc` (migrate+validate). Ctrl+S bound; dirty dot in title.

- [ ] **Step 1:** Failing tests for serialize→loadDoc round-trip incl. rejection of corrupt payload (mock idb with in-memory map). FAIL → implement → PASS.
- [ ] **Step 2:** Manual: draw, reload browser → restore prompt; Save→file; Open→same drawing. Commit `feat: IndexedDB autosave and .pnid.json save/open`.

### Task 18: Export — SVG, print/PDF with title block, CSVs

**Files:** Create: `src/export/svg.ts`, `src/export/printPdf.ts`, `src/export/csv.ts`; Modify: `src/panels/Toolbar.tsx`; Test: `tests/export/csv.test.ts`, `tests/export/svg.test.ts` (jsdom)
**Interfaces:** Produces: `exportSvg(paper, doc): string` — clone `paper.svg`, strip tools/grid/selection artifacts, inline computed stroke styles, set width/height mm + viewBox, prepend `<metadata>` app+version; `titleBlockSvg(meta): string` — bottom-right frame block (dwg no., name, rev, author, date, sheet) + sheet border, composed into export and print; `printPdf(paper, doc)` — hidden iframe, `@page {size: 420mm 297mm; margin: 0}` per sheetSize, body = export svg scaled 100%, `iframe.contentWindow.print()`; `instrumentIndexCsv(doc): string` columns Tag,Description,Loop,Symbol,Connected To (via edges→neighbor tags/labels),Notes; `lineListCsv(doc): string` columns Line No,Class,Size,Spec,Service,From,To. CSV quoting RFC-4180.

- [ ] **Step 1:** Failing csv tests (fixture doc from Task 16 tests reused; assert header rows, connected-to resolution, quote handling) + svg test (contains viewBox, no `.joint-tools`). FAIL → implement → PASS.
- [ ] **Step 2:** Manual: export SVG opens in browser identical to sheet; Print preview at A3 shows border+title block; CSVs open in Numbers/Excel. Commit `feat: SVG/print exports with title block, instrument index and line list CSVs`.

### Task 19: Sample project, symbol top-up to catalog, e2e, docs, v0.1

**Files:** Create: `examples/sample-plant.pnid.json`, `CONTRIBUTING.md`, `e2e/happy-path.spec.ts`, `playwright.config.ts`; Modify: `README.md`, `package.json` (version 0.1.0, scripts e2e)
**Interfaces:** Consumes everything.

- [ ] **Step 1:** Audit Part A phase-1 list vs registry; implement any missing defs (target ≥80 palette entries incl. presets) with the Task 7/8 test pattern (extend `catalog.test.ts` count + ids).
- [ ] **Step 2:** Author sample: feed tank → pump P-101 → FT/FIC/FV loop 101 → shell-tube HX with TT/TIC-102 on outlet → column C-101 with LT/LIC/LV-103, PSV-104 on overhead, off-page connectors; save as example; "Open sample" toolbar link fetches it.
- [ ] **Step 3:** `npm i -D @playwright/test`; e2e: load app → drag pump + tank + FT preset → draw process + electric signal → assert cells in DOM → set tag FIC → export index CSV → assert download content contains FIC row. Run headed once, then `npx playwright test` green.
- [ ] **Step 4:** README (screenshots, feature list, catalog phase table link, quickstart, roadmap = Part A15), CONTRIBUTING (dev setup, symbol authorship IP rule verbatim from Global Constraints, symbol PR checklist: def+ports on grid+tests+eyeball sheet).
- [ ] **Step 5:** Full `npm test && npx playwright test && npm run build` green. Tag `v0.1.0`. Commit `chore: v0.1.0 — sample plant, e2e, docs`.

---

## Self-review

- **Spec coverage:** §4 model→T2; §5 symbols→T6-8,19; §6 lines/routing→T10-11,13; §7 tags→T3-4,14; §8 UX→T9,12-14,17; §9 validation→T15; §10 exports→T18; loops→T16; persistence→T17; docs/license→T1,19. Milestones M1-M8 all mapped. ✓
- **Placeholders:** none — geometry lives in Part A tables; every logic step has concrete signatures/tests. ✓
- **Type consistency:** `ProjectDoc/PlantNode/PlantEdge/Tag/LineClass` defined once (T2) and consumed by name everywhere; store action names in T5 match usage in T12-18; `Finding` defined T2, produced T15. `lineStyle.ts` created in T10 (file-structure note corrected inline). ✓
