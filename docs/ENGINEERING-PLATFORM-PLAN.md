# IPD Studio — Engineering Platform Plan

**From "a P&ID editor with data behind it" to "an engineering data platform whose
front door is a P&ID."**

Status: proposal · Written against `v0.13.0` (schemaVersion 4, 19,357 LOC)
Scope: Phases 1–3, with Phase 1 specified to implementation detail.

---

## 0. What the audit found

Every recommendation below is anchored to something in the current code. These
are the findings that shaped the plan.

| # | Finding | Evidence |
|---|---------|----------|
| 1 | **Engineering data has no home.** It is scattered across `node.datasheet` (instruments only, freeform keys), `node.config` (render config that is *actually* engineering data — `cv.*` `fail` = FC/FO/FL), `edge.lineNumber` (4 strings), `node.cost`. Nothing exists for equipment specs, line specs, I/O, revision, status, or ownership. | `src/model/types.ts:45-95` |
| 2 | **`PlantNode.attrs` is declared and never used.** Zero reads, zero writes in the whole codebase. | `src/model/types.ts:70`; `grep -rn "\.attrs" src/` → nothing outside HMI |
| 3 | **Everything is derived, nothing is stored.** Instrument index, line list, loops, and costs are all computed at read time from `nodes`/`edges`. This is the project's great strength — deliverables *cannot* drift — and must be preserved, not replaced. | `src/export/csv.ts`, `src/store/selectors.ts:15`, `src/model/costs.ts:331` |
| 4 | **Records are keyed to node ids, so redrawing destroys data.** Delete an instrument bubble and redraw it and its whole ISA-20 datasheet is gone. `deleteIds` removes nodes with no record-preservation path. | `src/store/store.ts` `deleteIds`; `PlantNode.datasheet` |
| 5 | **Validation is a fixed list with a binary severity.** 7 hardcoded checks; `Finding.severity?: 'suggestion'` where *absence* means error. No rule config, no fixes (except one), no ignore. | `src/validate/checks.ts:13`, `src/model/types.ts:174-182` |
| 6 | **The advisor already does real engineering reasoning** — relief devices on vessels, controllers without final elements, I/P converters — but it is advisory-only and offers exactly one applicable fix. The engine for a QA product is half-built already. | `src/validate/suggest.ts`, `src/assist/fixes.ts` (`FixSpec` is a union of one member) |
| 7 | **Validation runs 3× per keystroke.** `useFindings()` is called independently by `StatusBar`, `Drawer`, and `ValidationPanel` — three separate `useMemo(doc)`. `useSuggestions()` runs 2×. Each walks every sheet and rebuilds its own `Map`s. | `src/panels/StatusBar.tsx:17`, `Drawer.tsx:12-13`, `ValidationPanel.tsx:38` |
| 8 | **The toolbar is already full.** It carries ~18 controls and has `overflow-x: auto` with a source comment conceding it scrolls on narrow windows. There is no room to hang five new modules off it. | `src/panels/Toolbar.tsx`, `src/app.css` `.toolbar` |
| 9 | **Cloud storage is hard-capped at 900,000 bytes** by a deployed Firestore rule, enforced server-side, on the whole drawing as one JSON string. | `firestore.rules`; `src/cloud/sync.ts:25` |
| 10 | **There is no entitlement mechanism anywhere in the app.** No licence key, no plan check, no feature gate. The v0.13.0 PolyForm move made commercial use *paid*, but nothing in the product distinguishes tiers. | `grep -rni "entitle\|tier\|subscription" src/` → nothing |

### The storage math that constrains everything

Measured against `examples/sample-refinery-unit.pnid.json` (3 sheets, 32 nodes,
30 edges):

```
pretty-printed  20,330 B  =  328 B/item     ← what ships to the cloud today
compact         10,201 B  =  165 B/item     ← 49.8% smaller, same data
```

`serializeDoc()` pretty-prints with `JSON.stringify(doc, null, 2)`, and
`buildPayload()` sends *that* to Firestore. **Half the cloud quota is currently
spent on indentation.**

Projected, compact, with a ~350 B engineering record per item:

| Items | Drawing | + records | Headroom to 900 kB |
|-------|---------|-----------|--------------------|
| 100   | 16 kB   | 50 kB     | 829 kB |
| 400   | 64 kB   | 201 kB    | 678 kB |
| 1000  | 161 kB  | 502 kB    | 376 kB |

**Two conclusions that decide the architecture:**

1. **The engineering registry fits.** Even a 1000-item project with full records
   leaves 376 kB of headroom. Adding the database does not break the cloud.
2. **Snapshot-based revisions do not fit.** At 400 items you would fit two
   snapshots; at 1000, zero. Revisions **must** be diffs, and above ~400 items
   they must live outside the drawing blob. This is a day-one design constraint,
   not a Phase-3 optimisation.

---

## 1. The product decision

Do not build a better drawing editor. Build the thing the drawing is a view of.

> **IPD Studio turns a P&ID into a connected engineering data model, checks that
> model against your company's standards, and keeps every downstream deliverable
> consistent with it.**

The economic claim is one sentence: *the drawing and the paperwork can no longer
disagree.* That is what an engineering department pays for, and it is a claim
this codebase is unusually well positioned to make, because finding #3 means the
generated deliverables already cannot drift. The gap is that only a fraction of
real engineering data can be entered at all.

**The one architectural idea:** every engineering object gets a durable identity
(its tag), a record attached to that identity, and a derived view of everywhere
it appears. The drawing becomes one view of the record, not its container.

---

## 2. Data architecture

### 2.1 The engineering registry

```ts
// src/model/registry.ts  (new)

export type EntityKind = 'instrument' | 'equipment' | 'line' | 'loop'

export interface EngineeringRecord {
  /** Canonical identity: 'FT-101', 'P-101', '6"-CW-101-001', 'LOOP-F-101'. */
  key: string
  kind: EntityKind
  /** Values keyed by field id from the active standard's catalog. */
  fields: Record<string, string>
  status?: 'draft' | 'in-review' | 'approved' | 'issued'
  owner?: string
  /** Revision in which this record last changed. */
  rev?: string
  updated?: string
}

// src/model/types.ts  (ProjectDoc, schemaVersion 5)
registry?: Record<string, EngineeringRecord>
```

### 2.2 Why tag-keyed, not node-keyed

This is the load-bearing decision. Four reasons:

1. **A tag is the engineering identity; a node is a placement of it.** The same
   tag legitimately appears more than once — an off-page continuation, a valve
   shown on two sheets, a header on a utility drawing.
2. **Delete-and-redraw is normal drafting.** Node-id keying silently destroys an
   approved datasheet (finding #4). Tag keying survives it.
3. **Every deliverable already joins on tag.** `instrumentIndexCsv`,
   `deriveLoops`, `printLoopDiagram`, `importFromPid`'s widget binding — all of
   them key on `formatTag(node.tag, '-')`. The registry joins the same way, so
   nothing new has to be threaded through.
4. **It makes a duplicate tag a *data* error, not a cosmetic one** — which is the
   correct severity and something the current binary model cannot express.

**Trade-off, stated plainly:** untagged objects get no record. That is a
deliberate forcing function — "tag it before you can spec it" is how engineering
databases work — but it means equipment, which today often carries only a
`label`, must be tagged. Mitigation: the QA engine ships a fix that assigns the
next free equipment tag from a label, and the standard defines the equipment tag
format.

### 2.3 Store invariants (must be enforced, not assumed)

These live in `src/store/store.ts` and each gets a unit test:

| Action | Rule |
|--------|------|
| `setTag(id, next)` | Old tag had a record, new tag has none → **move** the record (a rename carries its data). New tag already has a record → do **not** merge; raise a `record-collision` finding. The old tag is still worn by another node → **copy**, do not move. |
| `deleteIds(ids)` | **Never** delete the record. An orphan is a QA finding (`orphan-record`) with an explicit purge action. Deleting a symbol must not silently bin approved engineering data. |
| `setEdge(id, {lineNumber})` | Same move/copy/collide rules, keyed on the formatted line number. |
| `pasteNodes` / `addBatch` | Pasted tags are re-numbered (existing behaviour); records are **not** copied — a pasted symbol is a new object needing its own spec. |

All of this sits inside the existing `patchSheet`/`set` calls, so `zundo`
`temporal` gives registry edits undo/redo for free.

### 2.4 Migration to schemaVersion 5

`src/model/migrate.ts` gains a `migrateV4`:

- `node.datasheet` → `registry[tag].fields` (keys already namespaced:
  `general.service`, `signal.range` …, so they transfer verbatim).
- `node.config.fail` on `cv.*` → `registry[tag].fields['element.failPosition']`,
  **mirrored** — the symbol keeps rendering from `config`, and a store action
  keeps the two in step. Do not fork the source of truth for something drawn.
- `settings.numberStart`, `settings.tagSeparator`, `doc.fluids` → `doc.standard`
  (§4.3), with the old fields retained and read as fallback for one release.
- Untagged nodes with a `datasheet` → tag auto-assigned, or the datasheet is
  parked under `registry['__unassigned:<nodeId>']` and surfaced as a finding.

**Read-fallback rule:** for one release, every reader tries
`registry[tag]?.fields[k] ?? node.datasheet?.[k]`. A v5 file opened by a v4 build
loses the registry but keeps the drawing — acceptable and non-destructive,
matching how `loadDoc` already tolerates v2/v3.

### 2.5 Cloud storage changes

1. `serializeDoc(doc, { pretty = true })`. The `.pnid` file stays pretty —
   human-readable JSON is a documented feature. `buildPayload()` passes
   `{ pretty: false }`. **One-line change, halves the cloud payload.** Do this in
   the first release, before the registry needs the room.
2. Revisions are **diffs**, not snapshots (§4.5).
3. Above a size threshold, revisions move to
   `users/{uid}/drawings/{id}/revisions/{revId}` — one Firestore document each,
   so the 900 kB cap applies per revision rather than to their sum. Needs a
   `firestore.rules` addition. The `.pnid` file is uncapped and always carries
   everything, so a downloaded project is never partial.

---

## 3. Navigation & UX architecture

This comes **first**, in the release before any module needs it. Five new
modules cannot hang off a toolbar that already scrolls (finding #8), and
retrofitting navigation after the fact is how tools become unusable.

### 3.1 The workspace rail

A 48 px vertical rail on the left edge. It replaces the single `HMI ⇄` button
and the `workspace: 'pid' | 'hmi'` boolean with named, linkable routes.

```
┌─────┐
│  ▣  │  Project       dashboard · standards · revisions
│  ✎  │  Draw          the P&ID editor            ← default
│  ▦  │  Data          index · lines · equipment · I/O
│  ✓  │  Checks    ②   the QA report
│  🖨 │  Deliverables  datasheets · loop diagrams · packages
│  ⊞  │  HMI           HMI Studio
└─────┘
```

Rules that keep it honest:

- **Draw stays the default and stays untouched.** Someone who only wants to draw
  gains a 48 px strip and loses nothing. `App.tsx`'s current layout survives
  intact inside the Draw workspace.
- Each workspace is a route (`/app/draw`, `/app/data`, …) extending the existing
  `src/routes.ts`, and each is a `lazy()` chunk — matching the split already used
  for `EditorRoot` and `HmiWorkspace`, so the Draw bundle does not grow.
- Collapses to icons under 1100 px; `Ctrl+1..6` switches; labels in tooltips.
- **Badges are the only thing that ever pulls attention out of Draw**, and only
  for counts that are actionable (criticals, pending reviews). No red dots for
  information.

### 3.2 The object inspector — the database's front door

The user-facing promise is "click FT-101, see its engineering record." Deliver
that **in the existing property panel**, not a new window, by giving it tabs when
a tagged object is selected:

```
PROPERTIES                                    ▸
┌────────┬─────────────┬────────────┬─────────┐
│ Symbol │ Engineering │ Where used │ History │
└────────┴─────────────┴────────────┴─────────┘
```

| Tab | Content |
|-----|---------|
| **Symbol** | Today's `NodeProps` verbatim — geometry, rotation, label, pins, cost. Nothing moves, nothing breaks. |
| **Engineering** | The record. Fields come from the active standard's catalog, so a company profile changes what is asked for. Empty required fields are marked, not hidden. |
| **Where used** | Every place this tag appears: sheets, loop, line, HMI screen, datasheet, loop diagram, I/O point, C&E row. **Every row is a jump.** |
| **History** | This tag's revision entries — what changed, when, in which rev, by whom. |

**Why tabs and not a modal:** the drawing must stay visible while you read the
record. That is the entire point of the P&ID being the front door — a modal hides
the thing you are asking about. (The ISA-20 datasheet stays a modal, correctly:
it is a print-shaped form you complete and leave, not something you consult while
drawing.)

*Where used* is the connective tissue. It is what makes the product feel like a
database rather than a longer form, and it is cheap — every relationship it
displays is already derivable today.

### 3.3 Command palette (`Ctrl+K`)

One entry point for a growing app, absorbing the existing `Ctrl+F`:

```
Ctrl+K
  FT-101            → jump to the object (any workspace)
  > new revision    → run a command
  ? untagged        → run a saved query, results as a jump list
```

`Ctrl+F` keeps working as an alias so nobody's muscle memory breaks. This is the
single highest-leverage navigation investment: it makes every future module
reachable without ever touching the toolbar again.

### 3.4 The drawer

Reduce from three tabs to two: **Issues** (validation + advisor merged, grouped
by severity) and **Loops**. The full report lives in the Checks workspace; the
drawer is the glance version.

Rationale: two views of the same findings at different depth is good design
(glance vs. work). Three tabs showing three overlapping lists is not — today
"Validation" and "Advisor" are the same engine split by an implicit severity flag.

### 3.5 Navigation invariants

Rules the whole plan obeys, so the app stays navigable as it grows:

1. **Every engineering object is ≤2 actions away from anywhere.** `Ctrl+K`, type
   the tag.
2. **Every finding, table row and report line is a jump, never just text.**
   `locateCell()` (`ValidationPanel.tsx:24`) is already the primitive — extend it
   to cross-workspace jumps rather than inventing a second mechanism.
3. **Nothing new is modal** unless it is a form you complete and leave.
4. **No workspace ever takes over on its own.** Badges pull; they never push.
5. **Every destructive or irreversible engineering action names its blast radius
   before it runs** — "this affects 5 documents", "37 existing tags would violate
   this standard".

---

## 4. Phase 1 — make the existing product professional

Five features. Each specified as: goal · data · UI · files · tasks · tests ·
acceptance · risk.

Order is not arbitrary — §6 explains why each depends on the last.

---

### 4.0 — The navigation shell (prerequisite, ships first)

**Goal.** Give the next five features somewhere to live, and improve navigation
on its own merits so the release stands up even if nothing follows it.

**Data.** None. Pure UI and routing.

**UI.** §3.1 rail, §3.2 inspector tabs (Symbol tab only at first — the others
appear as their features land), §3.3 command palette, §3.4 drawer merge.

**Files**

| File | Change |
|------|--------|
| `src/routes.ts` | `'/app/:workspace'`, default `draw`; back/forward; `navigate()` |
| `src/WorkspaceRail.tsx` | **new** — the rail, badges, `Ctrl+1..6` |
| `src/EditorRoot.tsx` | render rail + active workspace; lazy-load each |
| `src/App.tsx` | becomes `DrawWorkspace`; drop the `'pid'\|'hmi'` boolean |
| `src/panels/CommandPalette.tsx` | **new** — absorbs `SearchOverlay`, adds commands |
| `src/panels/SearchOverlay.tsx` | deleted; `findTag` reused by the palette |
| `src/panels/Drawer.tsx` | 3 tabs → 2 (Issues, Loops) |
| `src/panels/PropertyPanel.tsx` | inspector tab strip; `NodeProps` → Symbol tab |
| `src/app.css` | `--rail-w: 48px`; grid gains a rail column |
| `src/hmi/HmiWorkspace.tsx` | `onExit` → route change |

**Tasks**

1. Extend `routes.ts` to parse `/app/<workspace>`; keep `/app` → `/app/draw`.
2. Build the rail; badge counts from a single shared selector (§7.1).
3. Lift `App.tsx`'s grid into `DrawWorkspace`; `EditorRoot` owns rail + outlet.
4. Command palette: tag jumps (reuse `findTag`), then a `Command[]` registry that
   later features append to.
5. Merge Validation + Advisor into one Issues list grouped by severity.
6. Add the inspector tab strip with one tab; the rest slot in later.

**Tests**

- `tests/routes.test.ts` — extend: workspace routes parse, unknown → draw.
- `tests/panels/commandPalette.test.ts` — **new**: tag match, command match,
  `Ctrl+F` alias.
- `e2e/navigation.spec.ts` — **new**: rail switches workspace, URL changes, back
  button returns, `Ctrl+K` opens and jumps.
- Existing `e2e/*.spec.ts` — audit for `/app` assumptions; `happy-path.spec.ts`
  and `hmi.spec.ts` both navigate and will need the new route.

**Acceptance.** A user who only draws notices a 48 px rail and a better `Ctrl+F`.
No drawing workflow changed. All existing e2e specs pass.

**Risk.** Touching `App.tsx` and the CSS grid risks layout regressions in the
most-used screen. Mitigate: `e2e/screenshot.spec.ts` already exists — capture
baselines before the change and diff after.

---

### 4.1 — The engineering database

**Goal.** Every tagged object has a record; clicking it on the drawing opens
that record; the record survives redrawing, renaming, and deletion.

**Data.** §2.1 `registry`, §2.3 invariants, §2.4 migration to schemaVersion 5.

**UI.** Inspector *Engineering* and *Where used* tabs (§3.2).

The Engineering tab renders from the standard's field catalog, grouped:

```
FT-101   Flow Transmitter                     ● Draft
─────────────────────────────────────────────────────
IDENTITY
  Service          Feed water
  Area / Unit      Unit 100
  Loop             FIC-101                      → jump
  Line             6"-CW-101                    → jump
  Location         Field

MEASUREMENT
  Range            0 – 100 m³/h                 ⚠ required
  Signal           4–20 mA HART
  Process conn.    1/2" NPT

DEVICE
  Manufacturer     —
  Model            —

  Datasheet ↗   Loop diagram ↗   HMI object ↗
```

`⚠ required` comes from the standard, not from a hardcoded list — the same
mechanism the QA engine reads (§4.2), so the panel and the report can never
disagree about what is required.

**Files**

| File | Change |
|------|--------|
| `src/model/registry.ts` | **new** — types, `recordFor()`, `keyOf()`, move/copy/collide helpers |
| `src/model/types.ts` | `ProjectDoc.registry`, `schemaVersion: 5`; delete dead `attrs` |
| `src/model/migrate.ts` | `migrateV4`, read-fallback |
| `src/store/store.ts` | `setRecordField`, `setRecordStatus`, `purgeRecord`; invariants inside `setTag` / `deleteIds` / `setEdge` |
| `src/store/selectors.ts` | `buildIndex(doc)` (§7.1), `whereUsed(index, key)` |
| `src/panels/InspectorEngineering.tsx` | **new** |
| `src/panels/InspectorWhereUsed.tsx` | **new** |
| `src/panels/DatasheetEditor.tsx` | read/write the registry, not `node.datasheet` |
| `src/export/csv.ts` | index/line-list read registry fields |
| `src/persist/file.ts` | `serializeDoc(doc, {pretty})` |
| `src/cloud/sync.ts` | `buildPayload` → compact |

**Tasks**

1. `registry.ts` + `keyOf(node)` / `keyOf(edge)` canonicalisation.
2. `ProjectDoc.registry`; bump to schemaVersion 5; `migrateV4` with fallback.
3. Store actions and the four invariants (§2.3), each with a test.
4. `buildIndex(doc)` — one pass producing nodes-by-id, edges-by-node, tags,
   loops, records, neighbours. Everything downstream consumes this.
5. `whereUsed()` over the index: sheets, loop, line, HMI screen, deliverables.
6. The two inspector tabs.
7. Point `DatasheetEditor` and the CSV exports at the registry.
8. Compact cloud serialisation.

**Tests**

- `tests/model/registry.test.ts` — **new**: rename moves; rename onto an existing
  key collides and does not merge; delete orphans rather than destroys; paste
  does not copy records; copy-on-shared-tag.
- `tests/model/migrate.test.ts` — extend: a v4 doc with `node.datasheet` migrates
  losslessly; untagged datasheets are parked, not dropped.
- `tests/store/registry.test.ts` — **new**: every mutation is a single undo step.
- `tests/export/csv.test.ts` — extend: index rows carry registry fields.
- `tests/cloud/sync.test.ts` — extend: `buildPayload` is compact; `sizeBytes`
  drops ~50% for the refinery sample.
- `e2e/engineering.spec.ts` — **new**: tag → fill a field → delete the symbol →
  redraw with the same tag → the field is still there.

**Acceptance.** Deleting and redrawing FT-101 preserves its record. Renaming
FT-101 → FT-102 carries it. The instrument index CSV contains registry fields.
Cloud payload for the refinery sample is ~10 kB, not ~20 kB.

**Risk.** The tag-keyed choice forces equipment to be tagged (§2.2). Mitigate
with the auto-tag fix in §4.2 and by shipping the equipment tag format in the
default standard.

---

### 4.2 — The QA engine

**Goal.** Replace 7 hardcoded checks and a one-fix advisor with a configurable
rule engine that produces an engineering QA report an engineer would sign.

**Data.**

```ts
// src/validate/rules.ts  (new)
export interface Rule {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  discipline: 'tagging' | 'topology' | 'process' | 'instrumentation' | 'data' | 'standard'
  /** Runs over the shared index — never re-walks the doc. */
  run(ix: ProjectIndex, std: StandardProfile): RuleFinding[]
}

export interface RuleFinding {
  ruleId: string
  /** Stable across redraws: rule + entity, not rule + node id. */
  key: string
  entityKey: string
  message: string
  targetId?: string      // node/edge id for the jump
  sheetId?: string
  fix?: { label: string; apply(): void }
}

// ProjectDoc
qa?: { ignored: Record<string, { reason: string; by: string; at: string }> }
```

Four changes from today that matter:

1. **Severity is explicit**, replacing `severity?: 'suggestion'` where absence
   meant error (finding #5).
2. **Findings key on `ruleId + entityKey`, not node id** — so an ignore survives
   a redraw, and a finding can be tracked across revisions.
3. **Any rule can offer a fix.** `FixSpec` today is a union of exactly one
   member (`src/validate/suggest.ts:10`); it becomes a closure the rule returns.
4. **Ignore carries a reason and an author.** An engineer must be able to say
   "yes, intentional" and have it stick and be auditable — this is the single
   feature that decides whether a QA report gets used or ignored wholesale.

**Rule catalogue for Phase 1** — 24 rules, 12 of which exist in some form today:

*Critical*
`duplicate-tag`✓ · `invalid-letters`✓ · `incompatible-connection`✓ ·
`broken-offpage-link`✓ · `no-fail-position`✓→promoted · `no-relief-device`✓→promoted ·
`transmitter-no-receiver`✓→promoted · `orphan-record`★ · `tag-format-violation`★ ·
`line-number-format-violation`★

*Warning*
`missing-tag`✓ · `dangling-end`✓ · `duplicate-line-number`✓ ·
`controller-no-final-element`✓ · `required-field-empty`★ · `line-no-spec`★ ·
`line-no-service`★ · `equipment-no-record`★ · `instrument-not-in-loop`★

*Info*
`duplicate-parallel-line`✓ · `valve-tag-on-bubble`✓ · `needs-ip-converter`✓(has fix) ·
`not-in-datasheet-package`★ · `tag-numbering-gap`★

✓ exists · ★ new · promoted = exists as advice, becomes an error when the
standard demands it

**Fixes shipping in Phase 1:** assign next free tag · set fail position ·
link off-page connector · purge orphan record · renumber duplicate tag ·
adopt line service from the connected run · insert I/P converter (exists).

**UI.** The Checks workspace:

```
ENGINEERING QA                    Sheet: all ▾   Discipline: all ▾   [Re-run]

🔴 CRITICAL · 2
   FT-101 has no receiving instrument in loop 101       [Fix ▾] [Open] [Ignore]
   XV-204 has no defined fail position                  [Fix ▾] [Open] [Ignore]

🟠 WARNING · 3
   PT-301 — required field "Calibrated range" is empty  [Open] [Ignore]
   …

🔵 INFO · 2                                                        ▸ collapsed

⊘ IGNORED · 4                                                      ▸ collapsed
```

Grouping is by **severity first, discipline second** — an engineer triages by
"what blocks issue", not by "what kind of check". Filters for sheet and
discipline. Ignored items stay visible in a collapsed group; hidden ignores rot.

The drawer's Issues tab shows the same findings, criticals only, as a glance.

**Files**

| File | Change |
|------|--------|
| `src/validate/rules.ts` | **new** — `Rule`, `RuleFinding`, registry |
| `src/validate/rules/*.ts` | **new** — one module per discipline |
| `src/validate/engine.ts` | **new** — `runRules(ix, std, ignored)` |
| `src/validate/checks.ts` | ported into rules; kept as a thin adapter for one release |
| `src/validate/suggest.ts` | ported into rules; advisor severity → `info` |
| `src/assist/fixes.ts` | fixes become rule-owned closures; `insert-ip` moves |
| `src/store/selectors.ts` | one memoised `useQa()` (§7.1) |
| `src/workspaces/ChecksWorkspace.tsx` | **new** |
| `src/panels/Drawer.tsx` | Issues tab reads `useQa()` |
| `src/panels/StatusBar.tsx` | reads `useQa()`, shows critical count |

**Tests**

- `tests/validate/rules/*.test.ts` — **one file per rule**, positive and negative.
  The existing `tests/validate/checks.test.ts` patterns port directly.
- `tests/validate/engine.test.ts` — **new**: ignores suppress; ignore survives a
  redraw (key stability); severity overrides from the standard apply; `off`
  disables.
- `tests/assist/fixes.test.ts` — extend: every shipped fix is one undo step and
  clears its own finding.
- `e2e/qa.spec.ts` — **new**: create a violation → appears critical → apply fix →
  clears; ignore with a reason → moves to Ignored and persists across reload.

**Acceptance.** 24 rules run; every fix is one undo step and clears its finding;
an ignore survives delete-and-redraw; a full pass over a 500-item project stays
under 16 ms (§7.2).

**Risk.** Promoting advice to critical will make existing drawings light up red
on upgrade. Mitigate: promotions are **off by default** in the built-in standard
and switched on in a company profile; ship a one-time "N findings are new in this
version — review or ignore all" banner.

---

### 4.3 — Company standards

**Goal.** The validator checks against *your company's* rules, not generic ones.
This is what turns a checker into something a company will pay for.

**Data.**

```ts
// src/model/standard.ts  (new)
export interface StandardProfile {
  id: string
  name: string                       // 'Company XYZ — Rev 3'
  tagFormat: {
    pattern: 'LL-NNN' | 'LL-NNNA' | 'AREA-LL-NNN'
    separator: '-' | ''
    numberStart: 100 | 1
    digits: 3 | 4
    perArea?: boolean
  }
  lineNumber: {
    order: ('size' | 'service' | 'spec' | 'seq')[]   // 6"-CW-150-001 vs 6"-150-CW-001
    separator: string
    sizeUnit: 'in' | 'DN'
  }
  /** Field ids that must be filled before a status can advance. Drives BOTH
   *  the inspector's ⚠ markers and the required-field-empty rule. */
  required: { instrument: string[]; equipment: string[]; line: string[] }
  conventions: {
    valveFailPosition: 'required' | 'optional'
    defaultSignal: string
    defaultLocation: 'field' | 'panel'
    sheetSize: SheetSize
    titleBlock?: string
  }
  fluids?: Fluid[]
  severityOverrides?: Record<string, 'critical' | 'warning' | 'info' | 'off'>
}

// ProjectDoc
standard?: StandardProfile
```

Stored **in the document**, so a `.pnid` is self-describing and a reviewer opening
it checks against the same rules the author did. Also exportable as
`.ipdstd.json` so one company file seeds every project.

`settings.numberStart`, `settings.tagSeparator` and `doc.fluids` migrate in and
are read as fallback for one release (§2.4).

**UI.** Project workspace → Standards. A settings page, not a modal.

The one detail that decides adoption: **a live impact preview before you apply.**

```
Tag format         LL-NNN ▾            ⚠ 37 existing tags would violate this
Line numbering     size-service-spec-seq ▾    ✓ all 84 lines conform
Required (instr.)  [Service ×] [Range ×] [Signal ×] [+ add]
                                       ⚠ 112 instruments would gain a warning

                                    [Preview changes]  [Apply]
```

Without that preview nobody dares turn a standard on in a live project, and the
feature dies. `[Preview changes]` opens the QA report filtered to
would-be-new findings.

**Files**

| File | Change |
|------|--------|
| `src/model/standard.ts` | **new** — type, `DEFAULT_STANDARD`, `validateProfile()` |
| `src/model/types.ts` | `ProjectDoc.standard` |
| `src/model/migrate.ts` | fold legacy settings in |
| `src/isa/tag.ts` | `formatTag`/`parseTag` take the profile |
| `src/isa/autonumber.ts` | `numberStart`/digits/per-area from the profile |
| `src/validate/rules/standard.ts` | **new** — format + required-field rules |
| `src/workspaces/StandardsPage.tsx` | **new** |
| `src/panels/FluidsDialog.tsx` | reads profile fluids |
| `src/persist/standard.ts` | **new** — import/export `.ipdstd.json` |

**Tests**

- `tests/model/standard.test.ts` — **new**: defaults; round-trip; a malformed
  profile is rejected with a readable message.
- `tests/isa/tag.test.ts` — extend: `AREA-LL-NNN` parses and formats; 4-digit.
- `tests/validate/rules/standard.test.ts` — **new**: format violations by
  profile; `required` drives `required-field-empty`; `off` disables a rule.
- `e2e/standards.spec.ts` — **new**: change the tag format → preview reports the
  count → apply → the QA report matches the preview exactly.

**Acceptance.** Two profiles over one drawing produce two different QA reports.
The preview count equals the post-apply count. A `.ipdstd.json` round-trips.

**Risk.** Changing the tag format on a live project is destructive if it
auto-renames. It must **not** — the standard *validates*, and renaming is an
explicit fix per object (or a reviewed bulk fix). Never silently rewrite tags.

---

### 4.4 — Project dashboard

**Goal.** Opening a project answers "where does this stand?" in one screen.

**Data.** None new. Every number is derived from `buildIndex` + the standard +
`projectCost` (which already exists, `src/model/costs.ts:331`).

**UI.** The Project workspace landing page. Every tile is a jump.

```
FEED WATER UNIT — REV 3                            Issued 12 Aug 2026

 P&IDs  3      Instruments 386     Lines 214     Equipment 71
 ──────────────────────────────────────────────────────────────
 ENGINEERING COMPLETENESS                                   82%
 ████████████████████████████░░░░░░
 Instruments 94%   Lines 71%   Equipment 58%          → Data

 QUALITY                              DELIVERABLES
 🔴 4 critical                        Datasheets    342 / 386
 🟠 12 warnings          → Checks     Loop diagrams 301 / 386   → Deliverables
 🟢 370 clean                         I/O assigned  —

 BUDGET                               RECENT REVISIONS
 $2.4M of $3.0M  ████████░░          Rev 3  12 Aug  FT-101 range …
 installed ×3.0        → Budget      Rev 2  04 Aug  LT-204 added   → Revisions
```

**Completeness** is the only non-trivial computation: per kind, the fraction of
`standard.required` fields that are filled, averaged over objects of that kind.
It depends on §4.3, which is why the dashboard follows standards in the sequence.

**Files**

| File | Change |
|------|--------|
| `src/model/health.ts` | **new** — `projectHealth(ix, std)` returning every tile's numbers |
| `src/workspaces/ProjectWorkspace.tsx` | **new** |
| `src/workspaces/tiles/*.tsx` | **new** — one component per tile |

**Tests**

- `tests/model/health.test.ts` — **new**: completeness maths incl. the
  zero-objects and no-required-fields edge cases (must not read 0% or NaN);
  counts match the index.
- `e2e/dashboard.spec.ts` — **new**: every tile navigates to the right workspace
  with the right filter applied.

**Acceptance.** Numbers agree with the underlying workspaces exactly — a
dashboard that disagrees with the report it links to is worse than none.

**Risk.** Low. The main trap is a "completeness" number that is quietly
meaningless; guard it with the edge-case tests and show "—" rather than a
percentage when the denominator is zero.

---

### 4.5 — Revisions & change tracking

**Goal.** Answer "what changed between Rev 3 and Rev 4?" in engineering terms.

**Data.**

```ts
// src/model/revision.ts  (new)
export interface Revision {
  id: string
  number: string            // '0', 'A', '1'
  issuedAt: string
  issuedBy: string
  reason: string
  changes: Change[]
  /** Geometry churn, summarised — never itemised. */
  geometryNote?: string     // '3 symbols repositioned on Sheet 2'
}

export interface Change {
  entityKey: string         // 'FT-101' | '6"-CW-101' | 'sheet:S1'
  kind: 'added' | 'removed' | 'modified'
  field?: string
  before?: string
  after?: string
}

// ProjectDoc
revisions?: Revision[]
/** Entity-level snapshot of the last issued revision, for diffing. */
revBaseline?: Record<string, Record<string, string>>
```

**The design call that matters: revisions diff engineering data, not drawing
coordinates.** Moving a symbol 8 px is not an engineering change and must never
appear in a revision report. The baseline is the derived *entity table* — tags,
record fields, line numbers, connections, loop membership — not `x`/`y`.
Geometry gets one summary line and no detail.

**The storage design, forced by the measurement in §0:** full snapshots do not
fit (2 at 400 items, 0 at 1000). So:

- A revision stores only its diff. A typical rev touches 5–50 entities → 2–8 kB.
- One `revBaseline` is kept (≈40–60 kB at 400 items); older states are
  reconstructed by replaying diffs backwards.
- Above a threshold, revisions move to
  `users/{uid}/drawings/{id}/revisions/{revId}` (one Firestore doc each) so the
  900 kB cap applies per revision. `firestore.rules` extended accordingly.
- The `.pnid` file always carries everything — it has no cap.

**UI.** Project → Revisions, plus the inspector's History tab.

```
REV 3 → REV 4                                        18 changes   [Export PDF]

  ADDED · 4
  🟢 LT-204      Level Transmitter        Sheet 2      → jump
  🟢 6"-CW-118   Cooling water line       Sheet 2

  MODIFIED · 11
  🟡 FT-101      Calibrated range   0–100 m³/h → 0–150 m³/h
  🟡 FIC-101     Location           Field → Control Room
  🟡 XV-204      Fail position      FO → FC

  REMOVED · 3
  🔴 XV-301      Shutdown valve           was Sheet 1

  3 symbols repositioned on Sheet 2 (no engineering change)
```

Issuing a revision opens a dialog that states the blast radius before it commits
(invariant #5): how many objects changed, how many criticals are open, and which
deliverables will be marked stale.

**Files**

| File | Change |
|------|--------|
| `src/model/revision.ts` | **new** — types, `entitySnapshot(ix)`, `diffSnapshots(a,b)` |
| `src/model/types.ts` | `revisions`, `revBaseline` |
| `src/store/store.ts` | `issueRevision(number, reason)` |
| `src/workspaces/RevisionsPage.tsx` | **new** — list + compare |
| `src/panels/InspectorHistory.tsx` | **new** |
| `src/panels/IssueRevisionDialog.tsx` | **new** |
| `src/export/revisionReport.ts` | **new** — the compare view as PDF |
| `src/cloud/sync.ts` | revisions subcollection above threshold |
| `firestore.rules` | revisions subcollection rule |

**Tests**

- `tests/model/revision.test.ts` — **new**: a pure move produces zero changes;
  a field edit produces exactly one; add/remove classified correctly; backward
  replay reconstructs an older state exactly (golden fixture).
- `tests/cloud/sync.test.ts` — extend: a 40-revision project stays under the cap;
  the split threshold triggers.
- `e2e/revisions.spec.ts` — **new**: edit a range → issue Rev 1 → compare shows
  exactly that change and no geometry noise.

**Acceptance.** Repositioning symbols produces no revision entries. A 40-revision,
400-item project saves to the cloud. Backward replay is byte-exact against the
golden fixture.

**Risk.** The diff is the hardest correctness problem in Phase 1 — a wrong
revision report is worse than no revision report. Mitigate with golden-file tests
and by shipping revisions **last**, once the registry has settled.

---

## 5. Phase 2 — make it save engineering hours

Phase 1 makes the data exist and be trustworthy. Phase 2 makes it *do work*.
Specified to design detail; each becomes a Phase-1-depth spec when scheduled.

### 5.1 Deliverable synchronisation

**The claim:** change FT-101's range and the tool says *"this affects 5
documents"* and regenerates them.

**What makes it real:** deliverables must become **tracked objects**, not
one-shot downloads. Today `downloadInstrumentIndex()` writes a file and forgets.

```ts
interface IssuedDeliverable {
  id: string
  type: 'instrument-index' | 'line-list' | 'datasheet' | 'loop-diagram' | 'io-list'
  scope?: string           // the tag, for per-object deliverables
  generatedAt: string
  atRev: string
  /** Hash of the inputs it was generated from — staleness without storing a copy. */
  inputHash: string
}
```

Plus a declarative dependency map:

```ts
const DELIVERABLE_INPUTS: Record<DeliverableType, (ix, key) => string[]>
// 'datasheet' depends on registry[key].fields + tag + loop
// 'loop-diagram' depends on every member of the loop + their signal fields
```

Then staleness is a hash comparison, and *"3 documents require regeneration"* is
a query, not a guess. **Regenerate all** is a batch over the stale set.

**Sequencing note:** this depends on Phase 1's registry (inputs) and revisions
(`atRev`). It is the single most valuable Phase 2 item and should go first.

### 5.2 Editable engineering tables

The Data workspace: Instrument Index · Line List · Equipment List · I/O List as
sub-tabs. A plain grid — no new dependency — with inline edit writing straight to
the registry, column sets from the standard, filter/sort/group, and CSV
round-trip so a bulk fill can happen in Excel and come back.

Two hard parts: **paste-a-block** semantics (must be one undo step) and
**virtualisation** past ~2000 rows.

This is where the Line List becomes a real object (material, rating, design P/T,
insulation, tracing, from/to) and the Equipment List appears for the first time —
both are `EntityKind`s the registry already supports, so this is UI, not schema.

### 5.3 Review workflow

Comment threads keyed on `entityKey`, and a status machine:

```
draft → in-check → in-review → approved → issued
```

with the transition to `approved` **gated on zero open criticals** — the QA
engine finally has teeth. Comments carry author, timestamp, and
open/commented/resolved state.

Single-user first (named roles, no server): one person can still run
design → check → review on their own work, and the audit trail is real. Real
multi-user follows in Phase 3 with the sync layer.

### 5.4 I/O engineering

An `io` block on the instrument record — signal type, rack, slot, channel, card,
JB, cable — plus a card-configuration model and auto-assignment (next free
channel on a compatible card). Produces the I/O list deliverable, and sets up the
cable/JB schedules in Phase 3.

This is the item that makes IPD Studio legible to DCS/PLC engineers, and it is
mostly data-entry UI over an existing spine once §5.2 lands.

### 5.5 Project assistant

**Grounded retrieval over the entity index — not a chatbot over the drawing.**

```
"Show all pressure instruments connected to steam lines"
  → parse to a structured filter over buildIndex()
  → 7 results, as a jump list

"Which loops are missing a controller?"   → runs an existing rule
"What changed in revision 4?"             → reads the revision diff
"Find instruments without datasheets"     → a registry query
```

Every answer is a **jump list into real objects**, never prose about them. If a
question cannot be answered by a query over the model, the assistant says so
rather than generating. That constraint is the whole design: a P&ID assistant
that hallucinates a tag is worse than no assistant, because the output looks
exactly like an answer.

---

## 6. Phase 3 — make it hard to replace

Directional. What matters here is the decisions, not the schedule.

| Item | The decision that matters |
|------|---------------------------|
| **PFD / BFD → P&ID** | DEXPI 2.0 (Oct 2025) covers BFD, PFD and P&ID in one specification. Target it *after* the registry exists — DEXPI 2.0's value is its attribute model, and today there is nothing in IPD Studio for those attributes to map onto. The current export is Proteus-4.2-shaped geometry. |
| **Control logic** | Extend the loop object with strategy (PID/cascade/ratio/feedforward/split-range), tuning, and interlocks. The HMI simulator already runs PI loops from ISA tags (`src/hmi/sim/engine.ts`) — this connects the engineering model to a simulator that already exists rather than building one. |
| **SIS / Cause & Effect** | SIF objects, voting, trip conditions; the C&E matrix as a first-class deliverable with staleness (§5.1) so it flags when the P&ID moves under it. Highest-value single module for process-safety buyers. |
| **MOC** | Sits directly on Phase 1 revisions + Phase 2 review. Cheap once both exist; incoherent before. |
| **Collaboration** | Needs a server, which breaks local-first — so it must be opt-in and additive. **Note the registry helps here:** a flat, key-addressed `Record<string, EngineeringRecord>` is far more mergeable than nested `sheets[].nodes[]` arrays. Phase 1's data shape is deliberately CRDT-friendly. |
| **Enterprise** | SSO, RBAC, audit, on-prem. Gate this behind real demand; it is months of work that produces no engineering value on its own. |

---

## 7. Cross-cutting concerns

### 7.1 One index, one memo

Today `runChecks` runs **3×** and `runSuggestions` **2×** per document change
(finding #7), each rebuilding its own maps, each walking every sheet.

Fix, in §4.0:

```ts
// src/store/selectors.ts
export function useIndex(): ProjectIndex   // memoised once on doc identity
export function useQa(): QaReport          // memoised on (index, standard, ignored)
```

`StatusBar`, `Drawer`, `ChecksWorkspace`, the dashboard and the rail badge all
read the same memo. One pass, one result, no possibility of two panels disagreeing.

`buildIndex(doc)` produces, in a single walk: nodes by id · edges by node ·
tags → nodes · loops · records by key · neighbour lists · port kinds. Every rule
and every deliverable consumes it instead of re-walking.

### 7.2 Performance budget

| Operation | Budget | Why |
|-----------|--------|-----|
| `buildIndex` on 500 items | < 8 ms | runs on every doc change |
| Full rule pass, 24 rules, 500 items | < 16 ms | one frame |
| Inspector tab switch | < 50 ms | feels instant |
| Dashboard render | < 200 ms | it is a landing page, not a keystroke |

If the rule pass exceeds budget, move it to a Web Worker before optimising rules
individually — `ProjectDoc` is plain JSON and therefore structured-cloneable, so
this is a cheap escape hatch. Add a `tests/perf/` guard that fails CI on a
regression against a generated 500-item fixture.

### 7.3 Migration & compatibility

- One schema bump for all of Phase 1: **4 → 5**, landing with §4.1.
- Read-fallback for one release (§2.4): new readers accept old shapes.
- `loadDoc` already tolerates v2/v3 by passing them through; follow that pattern.
- A v5 file opened by a v4 build loses the registry but keeps the drawing —
  degraded, never destructive.
- Every migration gets a golden-file test with a real fixture, not a synthetic one.

### 7.4 Licensing & entitlement — the gap

**There is no entitlement mechanism in the product at all** (finding #10). If
Phase 1 is meant to be the paid tier, that is prerequisite work, and it needs an
honest premise:

> Client-side feature gating in a source-available repository is **advisory**.
> Anyone can build from source with the check removed. The enforceable boundary
> is the **service**, not the bundle.

So the defensible split is:

| Tier | Boundary |
|------|----------|
| **Community** | The full local editor. Draw, validate, export, local files. Enforced by the licence text, not by code. |
| **Professional** | Account-tier features that run through the cloud: sync across devices, revision storage, deliverable registry, standards library, assistant. Enforced by Firestore rules against a `users/{uid}/plan` field — server-side, real. |
| **Enterprise** | Organisation accounts, RBAC, audit, on-prem. |

Design implication for Phase 1: features whose value is inherently *cloud-shaped*
(revision storage, shared standards, deliverable registry) are the ones with a
real commercial boundary. Features that are pure local computation (the QA
engine, the dashboard) can be gated only advisorily — so treat them as
community-tier value that makes the product worth adopting, and monetise the
service around them. Trying to lock the QA engine client-side will cost more
engineering than it protects.

### 7.5 Testing strategy

Follow what the repo already does — `vitest` in `tests/<area>/`, Playwright in
`e2e/`, the `window.__pid` store hook for e2e setup.

Additions:

- **One test file per rule.** 24 rules, 24 files, positive + negative each. This
  is the difference between a QA engine that is trusted and one that is not.
- **Golden fixtures** for migration and revision diffs — real `.pnid` files
  committed under `tests/fixtures/`.
- **Invariant tests** for the registry (§2.3) — these encode the decisions that
  are easiest to break accidentally.
- **A perf fixture** — generated 500-item project, guarding §7.2.
- **Screenshot baselines** before the §4.0 layout change (`e2e/screenshot.spec.ts`
  already exists).

---

## 8. Sequencing

One feature per minor release. Every release ships value on its own — nothing
here requires the user to wait for a later one to benefit.

| Release | Ships | Depends on | Standalone value |
|---------|-------|-----------|------------------|
| **v0.14.0** | Navigation shell (§4.0) + compact cloud payload | — | Better navigation, `Ctrl+K`, half-size cloud saves |
| **v0.15.0** | Engineering registry + inspector (§4.1) | v0.14 | Records survive redraws; data has a home |
| **v0.16.0** | QA engine + Checks workspace (§4.2) | v0.15 | 24 rules, fixes, auditable ignores |
| **v0.17.0** | Company standards (§4.3) | v0.16 | The validator checks *your* rules |
| **v0.18.0** | Project dashboard (§4.4) | v0.17 | One screen answers "where does this stand" |
| **v0.19.0** | Revisions + compare (§4.5) | v0.15, v0.18 | Rev-to-rev change reports |
| **v0.20.0+** | Phase 2 (§5), starting with deliverable sync | Phase 1 | — |

**Why this order, precisely:**

- **Shell first** because five modules cannot hang off a full toolbar, and
  retrofitting navigation is how tools become unusable.
- **Registry before QA** because 9 of the 24 rules check record data that does
  not exist yet.
- **Standards after QA** because a standard is expressed *as rule configuration*
  — building it first would mean designing config for an engine that isn't there.
- **Dashboard after standards** because completeness is measured against
  `standard.required`; before that it has no denominator.
- **Revisions last in Phase 1** because they diff the registry, and the registry
  shape must have settled first. It is also the hardest correctness problem here
  (§4.5 risk), so it benefits from landing on stable ground.

---

## 9. What not to build

Stated as decisions, with reasons, so they don't get relitigated:

| Not this | Why |
|----------|-----|
| **More symbols** | 195+ is already past the point of diminishing returns. The gap is not "which symbol", it is "what does this symbol know". |
| **A generic AI chatbot** | An assistant that cannot ground an answer in the model will invent tags. §5.5 is retrieval over the index or it is nothing. |
| **3D, animations, themes, mobile** | None of these move an engineering deliverable. |
| **Real-time collaboration before the data model** | Merging nested `sheets[].nodes[]` arrays is a research problem; merging a flat keyed registry is not. Do the data model first — Phase 1 makes collaboration *easier*, not later. |
| **Client-side feature locks** | Advisory in a source-available repo (§7.4). Spend the effort on the service boundary instead. |
| **Auto-renaming tags when a standard changes** | Silently rewriting engineering identities is the fastest way to lose a user's trust. Validate; offer per-object fixes; never rewrite unasked. |
| **Itemising geometry in revision reports** | A rev report full of "moved 8 px" is a rev report nobody reads (§4.5). |

---

## 10. The shape of the thing, once Phase 1 lands

```
                        ONE PLANT MODEL
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    THE DRAWING          THE REGISTRY          THE STANDARD
   sheets · nodes      tag-keyed records     formats · required
      · edges           · status · owner      · severities
        │                     │                     │
        └─────────┬───────────┴──────────┬──────────┘
                  │                      │
             QA ENGINE               DERIVED VIEWS
          24 rules · fixes        index · lines · equipment
          · auditable ignores      loops · I/O · costs
                  │                      │
                  └──────────┬───────────┘
                             │
                      DELIVERABLES
              datasheets · loop diagrams · CSV
                  DEXPI · DXF · PDF · HMI
                             │
                        REVISIONS
                   diffed on engineering data,
                     never on coordinates
```

The drawing stays the front door. Everything behind it finally has somewhere to
live, one engine that checks it, and a record of how it changed.

---

*Grounded in an audit of IPD Studio v0.13.0 — 19,357 LOC across 137 source
files — with storage figures measured against `examples/sample-refinery-unit.pnid.json`.*
