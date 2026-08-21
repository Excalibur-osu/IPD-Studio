# PID Studio v0.2 (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.2.0: catalog completed to ~135 symbols, 6 new line classes, ISA-5.2 logic symbols, multi-sheet projects with linked off-page connectors, DEXPI-oriented Proteus XML export, PNG export, starter templates, routing/label polish — deployed to pid-studio-praharsh.web.app.

**Architecture:** Unchanged from v1 (store-owns-doc, JointJS controlled view, DOM-free logic). Two structural changes: the document schema moves to v2 (`sheets[]`, with v1→v2 migration) and links gain an optional three-path markup for double-line (jacketed) rendering. Everything else is additive data + one new export module.

**Tech Stack:** Existing v1 stack. New dev-dep: `fast-xml-parser` (tests only, parses the DEXPI output).

**Spec:** `docs/superpowers/specs/2026-08-20-pid-studio-design.md` (§A15 Phase-2) and `docs/superpowers/plans/2026-08-20-pid-studio-v1.md` Part A (phase-2 rows are the catalog contract).

## Global Constraints

Same as v1 plan verbatim: AGPL-3.0-only; no JointJS+ namespaces; TS strict; 8px grid, ports on 4px lattice; monochrome drawing; symbols authored from geometric first principles (never trace ISA/vendor artwork, never feed standards to AI); node ≥20, npm; commits end with the Claude Opus 5 Co-Authored-By line. New: every new symbol id extends `tests/symbols/catalog.test.ts`'s id list; `SYMBOLS.size` floor rises 60 → 130.

---

## Task 1: Branch + line-class extension

**Files:** Modify `src/model/types.ts` (LineClass union), `src/canvas/lineStyle.ts`, `src/canvas/glyphs.ts`, `src/canvas/connectionRules.ts`, `src/canvas/shapes.ts`; Test `tests/canvas/lineStyle2.test.ts`, extend `tests/canvas/connectionRules.test.ts`.

**Interfaces:** Produces LineClass additions `'signal.em' | 'pipe.jacketed' | 'pipe.traced' | 'pipe.existing' | 'pipe.underground' | 'pipe.battery-limit'`; `LineStroke` gains `double?: boolean` (jacketed); helper `isProcessClass(lineClass): boolean` (true for `process.*` AND `pipe.*`) used by `canConnect` and PropertyPanel grouping.

- [ ] `git checkout -b build/v0.2`.
- [ ] Failing tests: `isProcessClass('pipe.jacketed')===true`, `canConnect('process','process','pipe.jacketed')===true`, `canConnect('signal','signal','pipe.underground')===false`; strokes table covers all 16 classes; `GLYPHS['signal.em']` non-null (wave glyph `M -5 0 q 2.5 -4 5 0 q 2.5 4 5 0`), `GLYPHS['pipe.jacketed']` null.
- [ ] Implement: strokes — em `{width:1.25}`, jacketed `{width:2.5, double:true}`, traced `{width:1.25, dasharray:'8 3 2 3 2 3'}`, existing `{width:0.75}`, underground `{width:1.25, dasharray:'12 6'}`, battery-limit `{width:2.5, dasharray:'12 4 3 4'}`. `canConnect` switches on `isProcessClass`.
- [ ] Double-line rendering in `shapes.ts`: when `strokeFor(edge.lineClass).double`, set link markup to three paths (`wrapper` transparent w12 / `outline` black `width+3` / `line` white `width`) and attrs accordingly; `updateLink` resets markup+attrs when `double` flips. Model-level test: jacketed link has `attr('outline/stroke') === '#111'` and `attr('line/stroke') === '#fff'`; switching to `process.major` restores single-path attrs.
- [ ] All tests green → commit `feat: phase-2 line classes with jacketed double-line rendering`.

## Task 2: Valves, actuators, safety completion

**Files:** Modify `src/symbols/lib/valves-manual.ts`, `valves-control.ts`, `safety.ts`, `lib/index.ts`; extend `tests/symbols/catalog.test.ts`.

New defs (geometry: bowtie base `M0 0 L0 16 L16 8 Z M32 0 L32 16 L16 8 Z` unless noted):

| id | geometry |
|---|---|
| valve.pinch | two arcs facing in `M4 0 Q16 8 28 0 M4 16 Q16 8 28 16` + flow line `M0 8 H32` |
| valve.stopcheck | check body + stem T `M16 0 V8 M10 0 H22` |
| valve.fourway | 32×32, four triangles apex-center, ports w/e/n/s |
| valve.angle | 24×24 two triangles at 90° (`M0 0 L0 16 L12 8?` inlet left `M0 2 L0 18 L16 10 Z`, outlet down `M8 24 L24 24 L16 10 Z`), ports (0,10)→snap (0,12) style — author on lattice |
| valve.knife | gate + blade `M16 0 V8` + crossbar `M12 2 H20` |
| psv.pilot | psv + small pilot box `M2 4 h8 v8 h-8 Z` beside spring |
| pvsv | psv mirrored spring drawn as vacuum arc + `V` label |
| vacuum-breaker | circle r8 on stem + open triangle up |
| flame-arrestor | rect 32×16 + vertical hatch `M8 0 V16 M16 0 V16 M24 0 V16` |
| breather | T-stub + two opposed open triangles |
| bpcv | pcv.self with tap drawn to UPSTREAM side (`M4 32 V12 H10`) |
| tcv.self | cv body + bulb circle r4 + capillary wavy line to line tap |

Actuator additions on cv (`configOptions.actuator` += `digital`, `electro-hydraulic`): digital = square + "D"; electro-hydraulic = rect + "EH".

- [ ] Extend catalog test ids + per-family spot checks (pinch has two Q arcs; fourway has 4 ports; digital actuator renders `>D<`). Red → implement → green → commit `feat: phase-2 valve, actuator, and safety symbols`.

## Task 3: Flow elements + measurement accessories completion

**Files:** Modify `src/symbols/lib/flow-elements.ts`, `accessories.ts`; extend catalog test.

| id | geometry |
|---|---|
| fe.nozzle | flange bars + inward-curved throat `M14 0 Q18 8 14 16` |
| fe.pitot | line + L-probe `M16 8 V0 H24` |
| fe.avgpitot | pitot + 3 dots on stem |
| fe.ultrasonic | line + two angled transducer boxes (`M8 0 h8 v6 h-8 Z` rotated ±, draw as parallelograms `M6 0 L14 0 L11 6 L3 6 Z` above, mirrored below-right) |
| fe.thermal | line + circle r8 + "T" |
| fe.pd | circle r8 + inner oval gears (two circles r3 side by side) |
| acc.bulb | circle r6 + capillary wavy `M12 12 q4 4 8 0 q4 -4 8 0` |
| acc.bimetal | dial circle r7 + coiled stem (small spiral approx: 3 nested arcs) |
| acc.seal | flange bars + membrane arc between |
| acc.floatcage | side cage rect 16×32 with 2 nozzle stubs + float circle r4 |
| acc.radar | horn trapezoid `M8 0 h16 l-4 12 h-8 Z` + stem |
| acc.loadcell | rect 24×12 + "LC" under vessel-mount stub |

- [ ] Extend ids + spot checks → red → implement → green → commit `feat: phase-2 flow element and accessory symbols`.

## Task 4: Rotating completion

**Files:** Modify `src/symbols/lib/rotating.ts`; extend catalog test.

| id | geometry |
|---|---|
| pump.peristaltic | circle r14 + 3 inner roller circles r3 at 120° |
| pump.plunger | rect 32×16 + rod `M32 8 H40` + crank circle r6 |
| pump.submersible | vertical capsule 16×32 + inner pump circle + cable stub top |
| pump.vacuum | circle r14 + inward arrows (`M4 16 L12 16 M9 13 L12 16 L9 19` mirrored) |
| comp.recip | rect 40×20 + piston line + crank circle |
| comp.screw | rect 40×24 + two crossed screw circles r7 |
| turbine.steam | narrowing trapezoid `M4 4 L44 12 V20 L4 28 Z` |
| vfd | square 24×24 + "VFD" + signal ports n/s |

- [ ] Ids + checks (turbine narrows left→right — first x greater height) → implement → commit `feat: phase-2 rotating equipment symbols`.

## Task 5: Vessels, columns, heat completion

**Files:** Modify `src/symbols/lib/vessels.ts`, `heat.ts`; extend catalog test.

| id | geometry |
|---|---|
| vessel.floating-roof | tank rect + inner floating line with side seals `M4 20 H60 M4 16 V24 M60 16 V24` |
| vessel.sphere | circle r28 + support legs `M14 52 L8 64 M50 52 L56 64` |
| vessel.bullet | horizontal capsule 80×32 + saddles |
| vessel.open | rect open top (no top line) |
| vessel.silo | rect 48×40 + cone bottom `M0 40 L24 64 L48 40` + bottom port (24,64) |
| vessel.column-packed | capsule + two hatch bands (`x` marks rows) instead of trays |
| vessel.fixedbed | vertical vessel + single hatch band mid |
| vessel.sep3 | horizontal vessel + weir line `M56 24 V40` + boot rect bottom `M28 48 h12 v10 h-12 Z` |
| cyclone | inverted cone + tangential inlet rect + top vortex tube |
| hx.kettle | horizontal shell + inner U-bundle lines + weir + vapor top port |
| hx.doublepipe | long rect 64×12 with inner pipe line + crossover ends |
| heater.electric | rect 40×24 + zigzag element `M8 12 l4 -6 l6 12 l6 -12 l6 12 l4 -6` |
| heater.fired | box 56×64 + burner triangle bottom + stack rect top + coil zigzag inside |
| hx.condenser | shell-tube + condensate drain leg `M24 32 V44` |
| cooling-tower | trapezoid `M8 0 L56 0 L48 48 L16 48 Z` + fan circle top + fill hatch |

- [ ] Ids + checks → implement → commit `feat: phase-2 vessel and heat-transfer symbols`.

## Task 6: Solids, inline, annotation completion

**Files:** Modify `src/symbols/lib/inline.ts`, `annotation.ts`; extend catalog test.

| id | geometry |
|---|---|
| strainer.basket | line + hanging U-basket `M12 4 V14 a4 4 0 0 0 8 0 V4` + hatch |
| strainer.cone | line + open cone flag `M16 4 L10 16 M16 4 L22 16` |
| centrifuge | trapezoid bowl + shaft + motor block |
| scrubber | vertical capsule + packing hatch + side inlet low, top outlet |
| demister | rect band 32×8 with `x` hatch (inline in vessel nozzle) |
| mixer.static | rect 40×16 + two crossed vanes `M4 2 L36 14 M4 14 L36 2` |
| fit.reducer-ecc | trapezoid flat bottom `M0 0 L24 8 V16 H0 Z` |
| fit.blind | line stub + end bar + cap bar `M16 0 V16 M20 4 V12` |
| fit.spade | single paddle: circle r5 filled + handle line up |
| fit.hose | wavy line `M0 8 q4 -6 8 0 q4 6 8 0 q4 -6 8 0 q4 6 8 0` |
| fit.expansion | rect 24×16 with 3 corrugation arcs |
| fit.sightglass | line + circle r7 open + two bars |
| fit.silencer | rect 16×32 + diagonal hatch, port s |
| fit.quill | stem + nozzle tip triangle into line |
| ann.insulation | short double-arc band + `INS` |
| ann.slope | open triangle + `%` text slot (label) |
| ann.tiein | triangle flag `M0 16 L8 0 L16 16 Z` + label below |
| ann.bl-flag | diamond + `BL` |
| ann.onpage | circle r12 split by horizontal line (ref/sheet text via label) |
| ann.revtriangle | triangle r10 (label = rev number) |
| ann.equipstrip | 64×24 two-row rect (renders label only; lines `M0 12 H64`) |

- [ ] Ids + checks → implement → commit `feat: phase-2 solids, inline, and annotation symbols`.

## Task 7: ISA-5.2 logic + control hardware

**Files:** Modify `src/symbols/lib/control.ts`; extend catalog test.

| id | geometry |
|---|---|
| logic.and | rect 32×24 + text `AND`, signal ports w1(0,8) w2(0,16) e(32,12) |
| logic.or | rect + `OR`, same ports |
| logic.not | rect + `NOT` + output dot circle r2 at e |
| ctl.dcs | nested rects (outer 40×24, inner inset 4) + `DCS` |
| ctl.plc | nested rects + `PLC` |
| ctl.sis | nested rects + `SIS`, heavier outer stroke 2.5 |
| ctl.jb | square 24×24 + `JB` |
| ctl.panel | rect 40×24 + `LP` |

All ports kind `signal`. Category `control`.

- [ ] Ids + checks (logic gates have 3 signal ports; NOT has output dot) → implement → green. Also bump the catalog floor assertion: `SYMBOLS.size >= 130`. Commit `feat: ISA-5.2 logic gates and control hardware symbols`.

## Task 8: Multi-sheet documents (schema v2)

**Files:** Modify `src/model/types.ts`, `src/model/doc.ts`, `src/model/migrate.ts`, `src/store/store.ts`, `src/store/selectors.ts`, `src/canvas/Canvas.tsx`, `src/validate/checks.ts`, `src/export/{svg,printPdf,csv}.ts`, `src/panels/{PropertyPanel,Toolbar}.tsx`; Create `src/panels/SheetTabs.tsx`; Tests `tests/model/migrate2.test.ts`, extend store/validate tests.

**Interfaces (the contract every later task uses):**

```ts
export interface Sheet {
  id: string
  name: string            // "Sheet 1"
  drawingNumber: string
  revision: string
  sheetSize: SheetSize
  nodes: PlantNode[]
  edges: PlantEdge[]
}
export interface ProjectDoc {
  schemaVersion: 2
  meta: { name: string; author: string; created: string; modified: string }
  settings: { gridPx: number; tagSeparator: '-' | '' }
  sheets: Sheet[]
}
// PlantNode gains: link?: { sheetId: string; nodeId: string }   // off-page pairing
```

Store: `activeSheetId: string`; `activeSheet(s): Sheet` selector; every existing node/edge action targets the active sheet; new actions `addSheet(): string`, `renameSheet(id, name)`, `deleteSheet(id)` (refuses last sheet), `setActiveSheet(id)`, `setSheetMeta(patch)`, `setNodeLink(nodeId, link | undefined)`.

Migration: `loadDoc` accepts v1 (wraps `{meta, nodes, edges}` into one Sheet, project meta keeps name/author) and v2 (validated pass-through). `createEmptyDoc` emits v2 with one sheet.

- [ ] Failing tests: v1 sample fixture migrates to 1-sheet v2 preserving nodes/edges/drawingNumber; v2 round-trips; `addSheet` appends + switches; `deleteSheet` refuses last; actions only touch active sheet; cross-sheet duplicate tag still flagged by `runChecks` (checks iterate ALL sheets, findings gain `sheetId`); off-page node with `link` to missing target → `broken-link` finding; off-page without link → `unlinked-offpage` info.
- [ ] Implement model+store+migration. Reconciler wiring in Canvas: subscribe to `(doc, activeSheetId)`; on sheet switch `graph.clear()` then `reconcile(graph, activeSheet, undefined)`; same-sheet edits diff as before (pass sheet slices, not whole doc — `reconcile(graph, sheet, prevSheet)` signature change: takes `{nodes, edges}`).
- [ ] `SheetTabs.tsx` above the drawer: tab per sheet (click switches, double-click renames inline, × deletes with confirm, + adds). PropertyPanel: sheet meta editor moves to per-sheet fields + project name; off-page connector selection shows link picker (sheet dropdown → off-page nodes on that sheet) and a "Go to linked" button (`setActiveSheet` + select target). Exports: SVG/PDF/print use active sheet (title block from sheet meta); CSVs iterate all sheets (add `Sheet` column); sample-plant fixture updated to v2 via migration on load (file stays v1 to exercise migration).
- [ ] Full suite + e2e green (e2e gains: add sheet, switch, symbol placed on sheet 2 not visible on sheet 1). Commit `feat: multi-sheet projects with linked off-page connectors (schema v2)`.

## Task 9: DEXPI-oriented Proteus XML export

**Files:** Create `src/export/dexpi.ts`, `src/export/componentClass.ts`, `docs/DEXPI-MAPPING.md`; Modify `src/panels/Toolbar.tsx`; Test `tests/export/dexpi.test.ts`. Dev-dep: `npm i -D fast-xml-parser`.

**Interfaces:** `dexpiXml(doc: ProjectDoc, sheetId: string): string`; `componentClassFor(symbolId: string): string` (explicit map, default `'PlantItem'` — e.g. `pump.centrifugal→'CentrifugalPump'`, `valve.gate→'GateValve'`, `cv.globe→'ControlValve'`, `instr.bubble→'ProcessInstrument'`, `vessel.tank→'Tank'`, `hx.shell-tube→'HeatExchanger'`, `psv→'SafetyValve'`); toolbar `DEXPI` button downloads `<name>.dexpi.xml`.

Output shape (Proteus Schema 4.2-oriented):

```xml
<PlantModel>
  <PlantInformation Application="PID Studio" ApplicationVersion="0.2.0"
    OriginatingSystem="PID Studio" Date="..." Units="px" SchemaVersion="4.2.0"/>
  <Drawing Name="{sheet.name}" Type="PID">
    <Extent><Min X="0" Y="0"/><Max X="{sheetPx.w}" Y="{sheetPx.h}"/></Extent>
  </Drawing>
  <Equipment ID="{node.id}" TagName="{label|tag}" ComponentClass="{class}">
    <Position><Location X="{x}" Y="{y}"/></Position>
    <GenericAttributes Set="PIDStudio">
      <GenericAttribute Name="SymbolId" Value="{symbolId}"/>
      <GenericAttribute Name="Rotation" Value="{rotation}"/>
    </GenericAttributes>
  </Equipment>
  <!-- kind=instrument → <ProcessInstrument> same shape; tag letters/loop as GenericAttributes -->
  <PipingNetworkSystem ID="pns-{n}">
    <PipingNetworkSegment ID="{edge.id}" >
      <Connection FromID="{sourceNodeId}" FromNode="{portId}" ToID="..." ToNode="..."/>
      <CenterLine> <Coordinate X=".." Y=".."/> ... </CenterLine>  <!-- from vertices -->
      <GenericAttributes Set="PIDStudio"><GenericAttribute Name="LineClass" Value="{lineClass}"/>
        <!-- LineNumber parts when present --></GenericAttributes>
    </PipingNetworkSegment>
  </PipingNetworkSystem>
  <InformationFlow ID="{edge.id}"> ... </InformationFlow>  <!-- signal.* edges -->
</PlantModel>
```

- [ ] Failing tests (fast-xml-parser): output parses; PlantModel root with PlantInformation attrs; one Equipment per equipment node with Position matching x/y; instruments become ProcessInstrument with TagName `FT-101`; process edges appear as PipingNetworkSegment with correct Connection From/To; signal edges become InformationFlow; XML-escapes `<`, `&`, `"` in labels.
- [ ] Implement builder with a tiny `el(tag, attrs, children)` string helper + `escapeXml`. Write `docs/DEXPI-MAPPING.md`: table model→Proteus with the honesty note ("DEXPI-oriented export, Proteus 4.2 shape; not certified; geometry in px, 1mm=3.7795px").
- [ ] Toolbar button + green suite. Commit `feat: DEXPI-oriented Proteus XML export with mapping doc`.

## Task 10: PNG export + starter templates + polish

**Files:** Create `src/export/png.ts`, `examples/template-blank-a3.pnid.json`, `examples/template-utility-a1.pnid.json`; Modify `src/panels/Toolbar.tsx` (PNG button; Sample→Templates dropdown: Sample plant / Blank A3 / Utility A1), `src/canvas/shapes.ts` (label halo), `src/canvas/interactions.ts` (router polish).

- [ ] `png.ts`: `exportPng(scale = 2)` — serialize `exportSvg(doc)` → `new Image` from blob URL → draw on canvas `sheetPx * scale` → `toBlob('image/png')` → download `<name>.png`. (Browser-only; verified via e2e download assertion.)
- [ ] Templates: blank A3 = empty v2 doc with drawing frame meta; utility A1 = header/border + 3 labeled off-page connectors, no equipment. Both load via the Templates dropdown (same confirm-if-dirty flow as Sample).
- [ ] Polish (a): tag/label text gains halo — add `paintOrder:'stroke'`, `stroke:'#fff'`, `strokeWidth:3` to `tagAttrs` base so text stays readable crossing lines; snapshot-affecting: update reconciler test expectation if it asserts exact attrs.
- [ ] Polish (b): router start/end directions — in `makeLink`/`updateLink`, when an end is a port, set `router.args.startDirections`/`endDirections` from the port's position on its symbol (x===0→['left'], x===w→['right'], y===0→['top'], y===h→['bottom'], else omit) using the symbol def; kills the odd jog at FIC→FV. Model test: link from a `w` port carries `startDirections:['left']`.
- [ ] e2e additions: PNG button triggers download; template loads clean. Commit `feat: PNG export, starter templates, text halo and router direction polish`.

## Task 11: Release v0.2.0

**Files:** Modify `README.md` (feature list, symbol count, DEXPI section), `package.json` (0.2.0); sample stays v1-format (migration proof).

- [ ] Full verify: `npm test`, `npm run build`, `npx playwright test` all green; audit Part A phase-2 rows vs registry (every row marked 2 in v1-plan Part A is either implemented or explicitly listed in README roadmap as moved to v0.3 — no silent drops).
- [ ] README: bump counts, add Multi-sheet + DEXPI + PNG sections, roadmap trims delivered items.
- [ ] `git tag v0.2.0`; merge `build/v0.2` → `main` (suite on merged result); `npm run build && npx firebase-tools deploy --only hosting --project pid-studio-praharsh`; screenshot live site. Commit `chore: v0.2.0`.

---

## Self-review

- **Spec coverage:** §A15 Phase-2 items — catalog completion T2–T7; DEXPI T9; PNG T10; multi-sheet T8; templates T10; new line classes T1; ISA-5.2 T7. Custom-symbol import (SVG upload + port editor) is **deferred to v0.3** — recorded in T11 README roadmap step, not silently dropped. ✓
- **Placeholders:** none — every symbol row carries geometry, every module change names its file; novel code (schema v2, DEXPI shape, double-line markup, router directions) is specified concretely. ✓
- **Type consistency:** `Sheet`/`ProjectDoc v2` defined once in T8 and consumed by T9 (`dexpiXml(doc, sheetId)`) and T10 (templates as v2 docs); `isProcessClass` defined T1, used T8 validation; `reconcile(graph, sheet, prevSheet)` signature change called out in T8. ✓
