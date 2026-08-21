# PID Studio v0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.3.0: the open-source launch (GitHub + CI), the finished symbol catalog (~180 total), serious editor quality-of-life, CAD interop (DXF export + DXF underlay import + DWG spike report), auto-generated ISA-5.4-style loop diagrams, instrument datasheets, user-defined custom symbols, DEXPI import/round-trip, and installable offline PWA — deployed to pid-studio-praharsh.web.app.

**Architecture:** Unchanged core (store-owns-doc, JointJS controlled view, DOM-free logic). Two schema-level additions carried as **schema v3**: optional `customSymbols[]` on the doc and optional `datasheet` record on nodes (v1/v2 files migrate transparently). Generated deliverables (loop sheets, datasheets, DXF) are pure functions of the model rendered on demand — never stored. DXF import lands as a locked background underlay layer, not editable geometry.

**Tech Stack:** Existing stack. New runtime deps: `fast-xml-parser` (moves from dev to runtime for DEXPI import), `dxf-parser` (DXF underlay import). New dev deps: `vite-plugin-pwa`. CI: GitHub Actions (node 20, npm ci, vitest, build, Playwright).

**Spec:** `docs/superpowers/specs/2026-08-20-pid-studio-design.md` (§A15 Phase-3) + v1 plan Part A phase-3 rows + README v0.3 roadmap.

## Global Constraints

Unchanged from v1/v2 verbatim: AGPL-3.0-only; no JointJS+ namespaces; TS strict; 8px grid / 4px port lattice; monochrome drawing; independent symbol authorship (never trace ISA/vendor artwork, never feed standards to AI — now also enforced on **user-imported** symbols via CONTRIBUTING + import dialog notice); node ≥20, npm; commit trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. New: imported SVG is sanitized (no scripts/foreignObject/event handlers/external refs) before entering the doc; `SYMBOLS.size` floor rises 130 → 175.

## Scope decisions (approve/override these)

| Item | Decision | Why |
|---|---|---|
| Real-time collaboration (Yjs) | **Deferred to v0.4** | Requires a server component, which breaks the "no backend, drawings never leave your machine" promise that is currently a selling point. Doing it right = separate opt-in self-hosted sync service + CRDT restructuring of the store. Deserves its own release. |
| Comments / review mode | Deferred to v0.4 | Rides on the collaboration data layer. |
| DWG **import** | Spike only (Task 12) | DWG is a closed format; the honest options (LibreDWG wasm, ODA) need evaluation, not promises. DXF import ships instead. |
| Mobile/touch, i18n | Out | Different user base; no demand signal yet. |
| GitHub repo | **In, needs your choice** | Task 1 asks you for the repo name + public/private before creating anything. |

---

## Part A — v0.3 catalog completion (phase-3 rows, ~45 symbols)

Same authoring rules and test pattern as v1/v2. Geometry hints follow the established vocabulary (paths on the 8px grid, ports on the 4px lattice).

### A1. Solids handling & long-tail process (Task 4)

| id | name | geometry hint | ports |
|---|---|---|---|
| conveyor.belt | Belt Conveyor | two end circles r6 + top/bottom tangent lines, 80×16 | w(0,8) e(80,8) process |
| conveyor.screw | Screw Conveyor | rect 80×16 + internal zigzag helix | w/e |
| bucket-elevator | Bucket Elevator | tall rect 24×80 + two pulley circles + bucket ticks | s(12,80) n(12,0) |
| feeder.rotary | Rotary Feeder / Airlock | square 32×32 + inscribed circle + 4 vane spokes | n/s |
| crusher | Crusher / Mill | inverted trapezoid 48×40 + two roll circles inside | n(24,0) s(24,40) |
| screen.vibrating | Vibrating Screen | inclined rect + hatch + spring zigzags below | n, s1(oversize), s2(fines) |
| clarifier | Clarifier / Thickener | wide shallow trapezoid 80×32 + center shaft + rake arms | w in, e overflow, s underflow |
| filter.press | Filter Press | row of 6 vertical plates in frame 64×32 | w in, s filtrate |
| filter.rotary | Rotary Drum Filter | large circle r20 in tray rect + scraper line | w in, e cake, s filtrate |
| dryer.rotary | Rotary Dryer | long rect 96×24, slight slope, two support rollers | w in, e out |
| dryer.spray | Spray Dryer | wide cone 64×72 + top nozzle + side air duct | n feed, e air, s powder |
| dryer.tray | Tray Dryer | rect 48×48 + 4 tray lines + door diagonal | w/e air |
| evaporator | Evaporator | vertical vessel + internal calandria hatch + vapor head | w feed, n vapor, s conc |
| crystallizer | Crystallizer | vessel + internal draft tube + agitator | w/n/s |
| bagfilter | Bag House / Dust Collector | rect 48×64 + 3 hanging bag lines + hopper bottom | w dirty, n clean, s dust |
| coalescer | Coalescer | horizontal vessel + 2 internal element bars | w/e/s |
| hydrocyclone | Hydrocyclone | small cyclone cone 24×40 | w in, n overflow, s underflow |
| mill.ball | Ball Mill | horizontal cylinder 64×32 on two trunnion circles | w/e |
| extruder | Extruder | tapered barrel 72×20 + hopper on top | n feed, e out |
| blender.ribbon | Ribbon Blender | U-trough 56×32 + helix line + motor block | n/s |

### A2. Utilities, electrical, packaged (Task 5)

| id | name | geometry hint | ports |
|---|---|---|---|
| deaerator | Deaerator | horizontal vessel + dome head on top | w/n/s/e |
| chiller | Chiller Package | rect 64×40 + internal coil zigzag + `CH` | w/e chw, n/s cw |
| package-unit | Package Unit (boundary box) | dashed rect 96×64 + label slot | 4 `both` ports |
| boiler | Boiler | rect 64×56 + drum circle top + burner triangle | w bfw, n steam, s blowdown |
| stack | Stack / Chimney | tall taper 16×64 | s(8,64) |
| flare | Flare | tall stub + tip triangle + 3 flame arcs | s |
| air-dryer | Instrument Air Dryer | twin towers 2× rect 16×40 + crossover valves | w/e |
| filter-sep | Filter Separator | vertical vessel + element band + boot | w/e/s |
| elec.mcc | MCC | rect 48×32 + 3 vertical bucket lines + `MCC` | e signal |
| elec.ups | UPS | rect 32×24 + battery glyph + `UPS` | w/e signal |
| elec.barrier | IS Barrier | rect 24×16 + zener zigzag + `IS` | w/e signal |
| elec.transformer | Transformer | two overlapping circles | w/e signal |
| fit.union | Union | line + 3 close bars (middle taller) | w/e |
| fit.coupling | Quick Coupling | line + two facing half-arcs | w/e |
| fit.exhaust-head | Exhaust Head | stem + T-cap with drip skirt | s |
| fit.mixing-tee | Mixing Tee | T-junction + internal arrow pair | w/e/n |
| fit.hose-station | Utility Hose Station | valve + hose wave + `HS` label slot | w |
| fit.rupture-pin | Rupture Pin Valve | bowtie + pin stem + crossbar | w/e |
| fit.trap-float | Float Steam Trap | circle + internal float dot | w/e |
| fit.trap-bucket | Inverted Bucket Trap | circle + internal U | w/e |
| fit.trap-thermo | Thermodynamic Trap | circle + internal disc bar | w/e |
| sample.cooler | Sample Cooler | small coil rect + `SC` | w/e |
| ann.matchline | Match Line | heavy dash-dot vertical 8×96 + `MATCH LINE` text | none |
| ann.detail-flag | Detail Flag | circle split with detail/sheet halves | none |
| ann.holds | HOLD Flag | octagon + `HOLD` | none |

Palette totals after Tasks 4–5: **~180 symbols / 200+ palette entries**.

---

## Part B — File structure (new/changed)

```
.github/workflows/ci.yml            build+test+e2e on push/PR (T1)
src/
  model/types.ts                    +schemaVersion 3, CustomSymbolDef, node.datasheet (T8/T9)
  model/migrate.ts                  v2→v3 passthrough migration (T9)
  search/findTag.ts                 cross-sheet tag/label search (T2)
  canvas/alignment.ts               align/distribute + drag snap-guides (T2)
  canvas/underlay.ts                DXF underlay layer management (T12)
  export/dxf.ts                     R12 ASCII DXF writer (T6)
  export/loopDiagram.ts             ISA-5.4-style loop sheet SVG generator (T7)
  export/datasheetPdf.ts            datasheet print pipeline (T8)
  export/printAll.ts                all-sheets PDF pipeline (T3)
  import/dexpi.ts                   Proteus XML → ProjectDoc (T10)
  import/dxfUnderlay.ts             dxf-parser → underlay polylines (T12)
  import/svgSymbol.ts               SVG sanitize + normalize for custom symbols (T9)
  symbols/custom.ts                 runtime registration of doc.customSymbols (T9)
  symbols/lib/{solids,utilities}.ts phase-3 catalog (T4, T5)
  panels/SearchOverlay.tsx          Ctrl+F find-tag overlay (T2)
  panels/DatasheetEditor.tsx        per-instrument datasheet form (T8)
  panels/SymbolImportDialog.tsx     custom symbol import + port editor (T9)
  panels/LoopPanel.tsx              +"Loop diagram" button per loop (T7)
docs/DWG-IMPORT-SPIKE.md            spike findings (T12)
```

---

## Task 1: Open-source launch — GitHub repo + CI  *(USER GATE: repo name & visibility)*

**Files:** Create `.github/workflows/ci.yml`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/symbol-request.yml`; Modify `README.md` (badges, clone URL).

**Interfaces:** Produces the `origin` remote all later release tasks push to.

- [ ] **Ask the user**: repo name (`pid-studio`?), owner account, public now or after v0.3. STOP until answered.
- [ ] `gh auth status` — if not authenticated, ask the user to run `gh auth login` (cannot proceed headlessly).
- [ ] `gh repo create <owner>/<name> --public --source . --push` (or `--private` per answer).
- [ ] `ci.yml`: on push/PR → checkout, node 20, `npm ci`, `npm test`, `npm run build`, `npx playwright install chromium --with-deps`, `npx playwright test`. Badge in README.
- [ ] Issue templates: bug report (version, browser, steps, .pnid.json attachment note); symbol request (name, industry, reference *description* — explicit "do not attach copyrighted standard excerpts").
- [ ] Verify: push runs CI green on GitHub. Commit `chore: GitHub repo, CI, issue templates`.

## Task 2: Editor QoL I — find tag, align/distribute, drag snap-guides

**Files:** Create `src/search/findTag.ts`, `src/panels/SearchOverlay.tsx`, `src/canvas/alignment.ts`; Modify `src/canvas/interactions.ts` (Ctrl+F, align keybinds), `src/panels/Toolbar.tsx` (align buttons on multi-select), `src/app.css`; Test `tests/search/findTag.test.ts`, `tests/canvas/alignment.test.ts`.

**Interfaces:** Produces `findTag(doc, query): { sheetId, nodeId, tag?, label? }[]` (case-insensitive match on formatted tag and label, all sheets); `alignNodes(nodes, mode: 'left'|'right'|'top'|'bottom'|'center-h'|'center-v'): {id,x,y}[]`; `distributeNodes(nodes, axis: 'h'|'v'): {id,x,y}[]`; `snapGuides(dragging: PlantNode, others: PlantNode[], tolerance = 4): { x?: number; y?: number }` (edge+center alignment candidates for live guide lines).

- [ ] Failing tests: `findTag` finds `FIC-101` by `fic`, `101`, and by label substring, reports the right sheet; `alignNodes` left-aligns to min-x; `distributeNodes` spaces 3 nodes evenly by centers; `snapGuides` returns x when dragged center within 4px of another center, empty object when nothing near.
- [ ] Implement pure modules → green.
- [ ] SearchOverlay: Ctrl+F opens centered input; результат list keyboard-navigable; Enter → `setActiveSheet` + select + center (reuse `locateCell` from ValidationPanel). Guides: during element drag (`element:pointermove`), compute `snapGuides` vs same-sheet nodes, draw 1px blue lines via an absolutely-positioned SVG overlay, snap the drop by adjusting commit position in the existing `element:pointerup` handler.
- [ ] Manual check + commit `feat: find-tag search, align/distribute, drag snap guides`.

## Task 3: Editor QoL II — print all sheets, line auto-number, palette quick-add

**Files:** Create `src/export/printAll.ts`; Modify `src/panels/Toolbar.tsx` (`PDF ▾` split: active sheet / all sheets), `src/panels/PropertyPanel.tsx` (line-number "auto seq" button), `src/panels/Palette.tsx` (Enter on search result places at sheet center); Test `tests/export/printAll.test.ts` (page-count logic), extend `tests/isa/autonumber.test.ts`.

**Interfaces:** Produces `printAllSheets()` (iframe with one `@page`-sized `<svg>` per sheet — reuses `exportSvg(doc, sheet)` per sheet with page-break CSS); `nextLineSeq(doc): string` in `src/isa/autonumber.ts` — max numeric `lineNumber.seq` across all sheets + 1, zero-padded 3 (`'001'`…).

- [ ] Failing tests: `nextLineSeq` on empty doc → `'001'`; with seqs 001,003 → `'004'` (max+1, no gap-filling — line numbers are historical, unlike loop numbers); printAll produces N svg strings for N sheets (pure helper `allSheetSvgs(doc): string[]` tested, iframe untested).
- [ ] Implement; palette Enter-places snapped to visible center via `paper.clientToLocalPoint` of canvas midpoint.
- [ ] Commit `feat: print-all-sheets, line sequence auto-number, palette quick-add`.

## Task 4: Catalog — solids handling (Part A1, 20 symbols)

**Files:** Create `src/symbols/lib/solids.ts`; Modify `src/symbols/lib/index.ts`; extend `tests/symbols/catalog.test.ts` (PHASE3_IDS list + spot checks: conveyor has two r6 circles; clarifier rake present; hydrocyclone 3 ports).

- [ ] Ids red → implement per Part A1 geometry hints → green → commit `feat: phase-3 solids handling symbols`.

## Task 5: Catalog — utilities, electrical, packaged (Part A2, 25 symbols)

**Files:** Create `src/symbols/lib/utilities.ts`; Modify `src/symbols/lib/index.ts`; extend catalog test (floor → `SYMBOLS.size >= 175`; spot checks: package-unit renders dashed rect; barrier has zener zigzag; flare has flame arcs).

- [ ] Red → implement → green → commit `feat: phase-3 utility, electrical, and packaged-unit symbols`.

## Task 6: DXF export (AutoCAD R12 ASCII)

**Files:** Create `src/export/dxf.ts`; Modify `src/panels/Toolbar.tsx` (DXF button); Test `tests/export/dxf.test.ts`.

**Interfaces:** Produces `dxfForSheet(doc: ProjectDoc, sheetId: string): string` and `downloadDxf(): void`. Layers: `PROCESS`, `SIGNAL`, `SYMBOLS`, `TEXT`, `FRAME`. Y-axis flipped (DXF is y-up): `dxfY = sheetHeightPx - y`.

Writer core (group-code pair emitter — this is the whole trick):

```ts
const pair = (code: number, value: string | number) => `${code}\n${value}\n`
// SECTION/TABLES boilerplate for R12 with the 5 layers, then ENTITIES:
// edge routes  -> POLYLINE/VERTEX/SEQEND on PROCESS or SIGNAL layer
// symbol prims -> markupParser output per node, transformed by node x/y/rotation:
//   path 'M/L/H/V' runs -> POLYLINE; circle -> CIRCLE; 'a' arcs -> approximated
//   as 8-segment POLYLINE arcs; polygon -> closed POLYLINE; text -> TEXT (height 8)
// tags/labels  -> TEXT on TEXT layer;  border+title block -> FRAME layer
```

Route geometry for edges: model-only reproduction — straight source→vertices→target polyline (the manhattan route lives in the view; the DXF export documents this simplification in the file header comment 999).

- [ ] Failing tests: output starts `0\nSECTION`, ends `0\nEOF`; contains `LAYER` table with 5 names; a pump node yields ≥1 `CIRCLE` with center matching transformed x/y; a tagged bubble yields `TEXT` containing `FT-101`; edge with 1 vertex yields POLYLINE with 3 VERTEX records; y-flip correct (vertex y = sheetH - modelY).
- [ ] Implement (pure string building — fully unit-testable) → green → toolbar button → manual check: file opens in a DXF viewer (LibreCAD/online viewer) → commit `feat: R12 DXF export with layered geometry`.

## Task 7: ISA-5.4-style loop diagram generation

**Files:** Create `src/export/loopDiagram.ts`; Modify `src/panels/LoopPanel.tsx` (per-loop "Diagram" button → print window); Test `tests/export/loopDiagram.test.ts`.

**Interfaces:** Produces `loopDiagramSvg(doc: ProjectDoc, family: string, loop: string): string` — a self-contained A4-landscape SVG:

```
+----------------- FIELD -----------------+--- MARSHALLING ---+---- CONTROL ROOM ----+
| primary element (FE/TE/well symbols)    |  JB-xxx terminal   |  controller bubble   |
| transmitter bubble + tag                |  strip (generated  |  (shared display)    |
| final element (valve+actuator) w/ tag   |  numbered 1..n)    |  I/O channel labels  |
+-----------------------------------------+--------------------+----------------------+
```

Layout algorithm (pure): classify loop members by letters — `E`→element, `T`→transmitter, `S`/`A` terminal→switch/alarm, `C`→controller, terminal `V`/`Z`→final element, `Y`→relay. Three fixed columns (x = 40 / 420 / 700 in a 1123×794 px A4L sheet); members stacked top-down within their column with 90px pitch; signal connections drawn as straight dashed/solid lines through numbered terminal-pair stubs at the marshalling column (terminals auto-numbered 1,2,…). Reuses `getSymbol(...).render` for member glyphs and the existing title-block helper with `Loop F-101` as drawing title.

- [ ] Failing tests: FT/FIC/FV loop → SVG contains 3 member groups, FT placed in field column (x<400), FIC in control column (x>600), 2 terminal pairs numbered; switch-only loop (LSH + alarm) renders without controller column entries; unknown members fall back to field column; output parses as XML (reuse fast-xml-parser validator).
- [ ] Implement pure generator → green → LoopPanel button opens print window (same iframe pipeline as printPdf with A4 landscape) → commit `feat: generated ISA-5.4-style loop diagrams`.

## Task 8: Instrument datasheets (ISA-20-style)

**Files:** Create `src/model/datasheet.ts`, `src/panels/DatasheetEditor.tsx`, `src/export/datasheetPdf.ts`; Modify `src/model/types.ts` (`PlantNode.datasheet?: Record<string, string>`), `src/panels/PropertyPanel.tsx` ("Datasheet…" button on instruments), `src/export/csv.ts` (`datasheetMatrixCsv`); Test `tests/model/datasheet.test.ts`.

**Interfaces:** Produces `DATASHEET_SECTIONS: Record<'general'|'process'|'element'|'signal', {key: string; label: string}[]>` — general: service, area, line/equipment, P&ID no; process: fluid, phase, flow min/norm/max, pressure, temperature, density/viscosity; element: type, size/rating, material, connection; signal: output, range, power, fail action, IS/Ex rating. `fieldsFor(letters: string): typeof DATASHEET_SECTIONS` prunes irrelevant sections (e.g. hand switches drop process fluid rows); `datasheetMatrixCsv(doc): string` — one row per instrument, union of populated keys as columns.

- [ ] Failing tests: sections stable and keyed; `fieldsFor('HS')` omits `process` section; matrix CSV includes only instruments and a `flow.norm` column when any instrument fills it; values round-trip through doc serialization (plain optional record — no schema break, v2 loaders unaffected).
- [ ] DatasheetEditor: modal over canvas, sectioned inputs bound to `node.datasheet` via new store action `setDatasheet(id, patch)` (add to store with test); PDF: print pipeline rendering a one-page A4 form (label/value grid + title block).
- [ ] Commit `feat: ISA-20-style instrument datasheets with CSV matrix and PDF`.

## Task 9: Custom symbols (SVG import + port editor) — schema v3

**Files:** Create `src/import/svgSymbol.ts`, `src/symbols/custom.ts`, `src/panels/SymbolImportDialog.tsx`; Modify `src/model/types.ts` (`schemaVersion: 3`, `customSymbols?: CustomSymbolDef[]`), `src/model/migrate.ts` (accept 1/2/3 → emit 3), `src/model/doc.ts`, `src/store/store.ts` (`addCustomSymbol`, `removeCustomSymbol`), `src/panels/Palette.tsx` ("Custom" category + Import button), `src/canvas/shapes.ts` (registry miss → look up doc customSymbols); Test `tests/import/svgSymbol.test.ts`, extend migrate tests.

**Interfaces:**

```ts
export interface CustomSymbolDef {
  id: string            // 'custom.<ulid>'
  name: string
  svg: string           // sanitized inner SVG markup
  gridSize: { w: number; h: number }
  ports: PortDef[]      // user-placed, snapped to 4px lattice
  tagRule: 'isa-instrument' | 'valve' | 'equipment' | 'none'
  keywords: string[]
}
export function sanitizeSvg(raw: string): { svg: string; warnings: string[] }  // strips <script>,
// <foreignObject>, on* attributes, external href/url() refs, <style>; keeps path/rect/circle/
// ellipse/line/polyline/polygon/g/text; normalizes viewBox → 0 0 w h scaled to ≤ 96px major side,
// rounded up to whole grid units. Throws SvgImportError when nothing drawable remains.
export function registerCustomSymbols(doc: ProjectDoc): void  // (re)registers into SYMBOLS as
// SymbolDef with render: () => def.svg; called on loadIntoStore and addCustomSymbol.
```

- [ ] Failing tests: sanitizer strips `<script>`/`onclick`/`xlink:href`, keeps geometry, scales a 200×100 viewBox to 96×48 with gridSize {12,6}; rejects empty/img-only SVG; migrate: v2 file loads as v3 with `customSymbols` undefined; custom symbol round-trips through save/load and re-registers.
- [ ] Import dialog: file/paste → sanitize → preview at grid scale → click preview to add ports (snap 4px, kind picker, delete) → name/tagRule/keywords → `addCustomSymbol`. IP notice text in dialog: "Import only artwork you created or may redistribute. Do not trace standards or vendor libraries."
- [ ] Sheet placement, save/open, palette listing verified in e2e addition (import via `page.setInputFiles` with a fixture SVG).
- [ ] Commit `feat: custom symbol import with port editor (schema v3)`.

## Task 10: DEXPI import + round-trip

**Files:** Create `src/import/dexpi.ts`; Modify `package.json` (fast-xml-parser → dependencies), `src/panels/Toolbar.tsx` (Open accepts `.dexpi.xml`), `src/export/componentClass.ts` (`symbolForComponentClass` reverse map); Test `tests/import/dexpi.test.ts`.

**Interfaces:** Produces `importDexpi(xml: string): { sheet: Sheet; warnings: string[] }` — parses PlantModel; PID Studio exports restore exactly (SymbolId/Rotation/tag GenericAttributes honored); foreign files map via `symbolForComponentClass(cls): string` (reverse of the export map, first match, default `ann.text` placeholder node with label = TagName + warning); Equipment/ProcessInstrument → nodes at Position/Location; PipingNetworkSegment/InformationFlow → edges (Connection From/To when ids resolve, CenterLine first/last coordinate as free ends otherwise; LineClass generic attr honored, else `process.major`/`signal.electric` by element type).

- [ ] Failing tests: **round-trip** — build fixture doc, `dexpiXml` → `importDexpi` → nodes/edges deep-equal modulo ids and vertex loss; foreign-file fixture (hand-written minimal PlantModel without PIDStudio attrs) imports pump as `pump.centrifugal` via ComponentClass with 1 warning for an unknown class; malformed XML throws typed `DexpiImportError`.
- [ ] Implement; Open flow: extension switch — `.pnid.json` → loadDoc, `.dexpi.xml`/`.xml` → importDexpi into a new doc (single sheet) with warnings toast in status bar.
- [ ] Commit `feat: DEXPI import with export round-trip`.

## Task 11: PWA — installable, offline

**Files:** Modify `vite.config.ts` (vite-plugin-pwa: `registerType: 'prompt'`, precache app shell + examples), `index.html` (theme-color, icons), Create `public/icon-192.png`, `public/icon-512.png` (drawn: white instrument bubble on #2b6cb0, generated via our own SVG→PNG canvas pipeline in a scratch script); Modify `src/panels/StatusBar.tsx` (update-available → "Reload for update" chip).

- [ ] `npm i -D vite-plugin-pwa`; configure; icons generated and committed.
- [ ] Verify: `npm run build && npm run preview` → Lighthouse-style manual check: manifest present, SW controls page, airplane-mode reload still serves the editor, update prompt appears on redeploy. e2e untouched (dev server bypasses SW).
- [ ] Commit `feat: installable PWA with offline app shell`.

## Task 12: CAD import — DXF underlay + DWG spike report

**Files:** Create `src/import/dxfUnderlay.ts`, `src/canvas/underlay.ts`, `docs/DWG-IMPORT-SPIKE.md`; Modify `src/panels/Toolbar.tsx` (Underlay… button: load/clear), `src/model/types.ts` (`Sheet.underlay?: { name: string; polylines: {x:number;y:number}[][] }`); Test `tests/import/dxfUnderlay.test.ts`.

**Interfaces:** Produces `parseDxfUnderlay(text: string): { name?: string; polylines: {x:number;y:number}[][]; warnings: string[] }` using `dxf-parser`: LINE/LWPOLYLINE/POLYLINE/ARC/CIRCLE (arcs tessellated at 15°) flattened to polylines, scaled/translated to fit the sheet with 24px margin, y-flipped. `underlay.ts`: renders `sheet.underlay` as a locked light-gray (#b8bec8, 1px) SVG group *behind* the JointJS layers, excluded from exports and hit-testing; reconciled on sheet switch.

- [ ] Failing tests: LINE entity → one 2-point polyline; CIRCLE → closed 24-point polyline; unsupported entities counted in warnings; scaling maps model extents onto sheet extents preserving aspect.
- [ ] Implement + toolbar wiring (trace-over workflow: engineer loads a legacy DXF, redraws intelligently on top, clears underlay).
- [ ] **DWG spike (timeboxed to one session):** attempt `libredwg-web`/wasm conversion of a sample DWG → DXF in-browser; document in `docs/DWG-IMPORT-SPIKE.md`: what worked, bundle cost, license implications (LibreDWG is GPL — compatible with AGPL app but heavy), recommendation (likely: "convert DWG→DXF externally; in-app DWG not worth 8MB wasm in v0.4 either"). Report is the deliverable; no DWG code ships.
- [ ] Commit `feat: DXF underlay import; docs: DWG import spike findings`.

## Task 13: Samples, docs, contributing refresh

**Files:** Create `examples/sample-refinery-unit.pnid.json` (v3, 3 sheets: process + utilities + logic, linked off-page connectors, datasheets filled on 3 instruments, one custom symbol embedded); Modify `README.md` (v0.3 features, GIFs/screenshots section, CI badge), `CONTRIBUTING.md` (custom-symbol IP rule, catalog request flow via issue template), Templates dropdown (+ new sample).

- [ ] Author sample (verified: 0 findings, loop diagrams generate for its 4 loops, DEXPI round-trips).
- [ ] Docs updated; roadmap trimmed to v0.4 (collaboration, comments, DEXPI certification path, DWG per spike).
- [ ] Commit `docs: v0.3 sample project and documentation refresh`.

## Task 14: Release v0.3.0

- [ ] Full verify: `npm test` (target ≥ 260 tests), `npm run build`, `npx playwright test` — green on the branch AND after merge to `main`.
- [ ] Phase-3 audit: every Part A row implemented or explicitly listed in README v0.4 roadmap (no silent drops).
- [ ] `package.json` 0.3.0, tag `v0.3.0`, merge, push to GitHub (CI green), `npx firebase-tools deploy --only hosting --project pid-studio-praharsh`, cache-busted live verification incl. one loop-diagram generation and a DXF download.
- [ ] Commit `chore: v0.3.0`.

---

## Execution estimate

| Tasks | Size |
|---|---|
| T1 repo/CI | S (blocked on your repo answers) |
| T2–T3 QoL | M |
| T4–T5 catalog | M |
| T6 DXF export | M |
| T7 loop diagrams | M–L (layout is the risk; pure function keeps it testable) |
| T8 datasheets | M |
| T9 custom symbols | L (dialog UX + sanitizer + schema v3) |
| T10 DEXPI import | M |
| T11 PWA | S |
| T12 DXF underlay + spike | M |
| T13–T14 samples/release | S |

## Self-review

- **Coverage vs roadmap:** custom symbols → T9; collaboration → explicit deferral in Scope decisions; loop diagrams → T7; datasheets → T8; DWG spike → T12; remaining catalog → T4–T5; DEXPI import → T10. Extras justified: GitHub/CI (open-source promise), DXF export/underlay (research showed DWG interop is the #1 professional gate — DXF is the achievable 80%), PWA (local-first promise made installable), QoL (top friction from v0.2 usage). ✓
- **Placeholders:** none — every task names files, signatures, test cases, and geometry/algorithm specifics; the two research items (DWG) are scoped as report-deliverable spikes, not vague promises. ✓
- **Type consistency:** `CustomSymbolDef`/`sanitizeSvg` (T9) consumed by palette/shapes registration; `dxfForSheet`/`loopDiagramSvg`/`importDexpi` signatures declared once and reused in toolbar/panel wiring; `Sheet.underlay` (T12) is the only other schema touch and rides the v3 bump from T9. ✓
