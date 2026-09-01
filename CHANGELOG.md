# Changelog

All notable changes to IPD Studio. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.0] — 2026-09-01 — magnetic docking

### Added

- **Magnetic docking** — connect by touching instead of by drawing. Drag a
  symbol (in from the palette, or one already on the sheet) so one of its
  connection points comes within ~18 screen px of another symbol's, and a
  ring marks the point it has caught while every connection point on the
  sheet lights up. Let go and the symbol clicks into place — the two points
  land on exactly the same spot — with the line already drawn between them.
  Because lines store ports and not coordinates, pulling the pair apart
  afterwards stretches the pipe instead of breaking it.
  - The line class is chosen from the two port kinds, so a controller docking
    onto a valve's signal boss gets `signal.electric` even with a process
    class selected in the toolbar; incompatible pairings never dock.
  - The symbol and the line it docked onto are ONE undo step, whether they
    arrived from the palette (`addBatch`) or from a drag (`dockNode`).
  - A pair that is already joined won't dock again, so nudging a docked
    symbol can't stack a second line on top of the first.

## [0.15.0] — 2026-09-01 — the engineering registry

Second step of the engineering-platform plan
([docs/ENGINEERING-PLATFORM-PLAN.md](docs/ENGINEERING-PLATFORM-PLAN.md), §4.1).
Engineering data finally has a home of its own.

### ⚠️ Document format: schemaVersion 4 → 5

Documents saved by this version **cannot be opened by v0.14.0 or earlier**
(older builds reject an unknown schema version rather than silently misreading
it). Opening an older document is unaffected — v1 through v4 all migrate in.

### Added

- **Engineering records** (`doc.registry`) — every tagged object gets a record
  holding what it *is*, separate from where it is drawn. Records are keyed by
  **tag**, not node id, so they survive deleting and redrawing a symbol, and
  follow it through a rename.
- **Inspector "Engineering" tab** — the record for the selected object, with a
  field catalog per kind: instruments get calibrated range and signal, valves
  get trim, Cv and fail position, equipment gets duty and construction, lines
  get pipe class, design conditions, insulation and tracing. A fill meter shows
  how complete the record is.
- **Record status** — draft / in review / approved / issued, ready for the
  review workflow.
- **Orphan records are surfaced, not silently kept** — deleting a symbol leaves
  its record behind on purpose (deleting a symbol and discarding an approved
  datasheet are different intentions). The advisor reports the orphan and offers
  to purge it.

### Changed

- **The datasheet form and the Engineering tab are two views of one record**,
  not two stores. The printed datasheet and the datasheet-matrix CSV read the
  same values.
- **`node.datasheet` is deprecated but still read.** Values migrate into the
  registry on load, and every reader falls back to the old field for one
  release, so nothing is lost and a half-migrated document still shows its data.
  A datasheet on an untagged symbol is parked rather than dropped.
- Removed `PlantNode.attrs` — declared since v1, never read or written.

### Store invariants (each covered by a test)

- A rename **moves** the record; if another symbol still wears the old tag it
  **copies** instead.
- A rename onto a tag that already has a record **refuses to merge** and leaves
  both intact — merging two engineering records is unrecoverable.
- Deleting a symbol **never** deletes its record.
- A pasted symbol arrives untagged and gets **no** copied record.

## [0.14.0] — 2026-09-01 — the navigation shell

First step of the engineering-platform plan
([docs/ENGINEERING-PLATFORM-PLAN.md](docs/ENGINEERING-PLATFORM-PLAN.md), §4.0).
No new document data: this release makes room for the five features that follow
and improves navigation on its own merits.

### Added

- **Workspace rail** — top-level navigation down the left edge: Draw, Data,
  Checks, HMI. The toolbar was full (~18 controls already scrolling), with
  nowhere to hang a second screen. `Ctrl+1..4` switches; the Checks entry
  carries a badge when there are findings.
- **Workspaces are real routes** — `/app/draw`, `/app/data`, `/app/checks`,
  `/app/hmi`. Linkable, back-button-able, and each a lazy chunk, so Draw does
  not pay for the report tables or the HMI simulator. Bare `/app` and any older
  deep link still open the drawing.
- **Command palette (`Ctrl+K`)** — jump to any tag from any workspace, or type
  `>` for commands. `Ctrl+F` still opens it, so the find-a-tag habit is intact.
  Replaces the search overlay.
- **Data workspace** — the instrument index and line list on screen instead of
  only in a downloaded CSV, built from the *same* rows the CSV writers emit, so
  the screen and the report cannot disagree. Every row locates its object back
  on the sheet.
- **Checks workspace** — every finding and suggestion, full screen and grouped,
  instead of a 190 px drawer. Fixes can be applied from here.
- **Inspector "Where used" tab** — for a selected object: its sheet, the rest of
  its loop, its connected lines, and the HMI screens showing it. All derived;
  every row is a jump.

### Changed

- **Cloud saves are ~50% smaller.** `serializeDoc()` pretty-printed with
  `JSON.stringify(doc, null, 2)` and the cloud payload used that verbatim, so
  half the 900 kB Firestore budget was indentation — measured at 328 B/item
  pretty against 165 B/item compact on the 3-sheet refinery sample. The `.pnid`
  file stays pretty; only the cloud copy is compact.
- **Validation runs once per edit, not three times.** The status bar, the drawer
  and the validation panel each held their own `useMemo(doc)`, so every keystroke
  ran the checks 3× and the suggestions 2×, each walking every sheet. They now
  share one pass (`src/validate/issues.ts`), which also makes it impossible for
  two panels to disagree about what is wrong.
- **Drawer: Validation + Advisor merged into one Issues tab.** They were always
  one engine split by an implicit severity flag; the full report lives in Checks.
- The HMI button left the toolbar for the rail.

## [0.13.0] — 2026-08-31

### ⚠️ Licence change — BREAKING for commercial users

IPD Studio moved from **AGPL-3.0-only** to
**[PolyForm Noncommercial 1.0.0](LICENSE)**. The project is now
*source-available*, not open source.

- **Free, no permission needed** — personal use, study, research, hobby
  projects, students, educational institutions, charities, public research
  bodies, public health and safety organizations, environmental organizations,
  and government institutions.
- **Now requires a paid licence** — any use by or on behalf of a for-profit
  company, including internal use, paid client work, paid operator training,
  and embedding or hosting IPD Studio in anything you sell.
  See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).
- **Not retroactive.** Versions **up to and including v0.12.1 remain available
  under AGPL-3.0-only** to everyone who received them. That grant is perpetual
  and is not revoked. If you depend on AGPL terms, v0.12.1 is unaffected.
- Your drawings are unaffected either way — the licence covers the software,
  not the documents you produce with it.

### Added

- `NOTICE` — copyright, licence summary, licence history, and third-party
  component attributions
- `SECURITY.md` — private vulnerability reporting, threat model for a
  local-first client-side app, and the HMI "not for real operations" notice
- `CHANGELOG.md` — this file
- SPDX headers on all 137 source files
- `@license` build banner preserved through minification, so the terms travel
  with any copy of the bundle
- Contributor Licence Agreement in [CONTRIBUTING.md](CONTRIBUTING.md), needed
  for code contributions so commercial licences can be granted

### Changed

- README, project site, in-app strings, and the PWA manifest no longer
  describe the project as open source or free for commercial use
- [docs/LICENSE-ENFORCEMENT.md](docs/LICENSE-ENFORCEMENT.md) rewritten for the
  new licence, including the PolyForm 32-day cure clock and a warning to
  establish a copy's version before alleging any violation
- [docs/DWG-IMPORT-SPIKE.md](docs/DWG-IMPORT-SPIKE.md) — the GPLv3 LibreDWG
  option is now closed; GPL code cannot be combined with a noncommercial
  licence. ODA/Teigha becomes the only viable path.

### Fixed

- Stale clone URL in CONTRIBUTING (`pid-studio` → `IPD-Studio`)
- CONTRIBUTING no longer claims the project is "CI-less"; CI has existed since
  v0.9.19

## [0.12.0] — 2026-08-27

- The canvas is a real viewport: Fit fits your screen, plus a workspace design
  pass
- Moving a group of symbols now carries their lines with them

## [0.11.0] — 2026-08-26

- Researched component prices; budget moves to the toolbar; real currency
  conversion
- **0.11.1** — enter budgets in lakh/crore (or K/M/B) instead of counting zeros
- **0.11.2** — the component panel shows its budgetary price, basis and range,
  and says when you override it

## [0.10.0] — 2026-08-26

- Budget & cost estimator: budgetary price table, live total vs budget,
  per-project and per-component overrides, cost CSV export

## [0.9.0] – [0.9.20] — 2026-08-21 → 2026-08-26

Rebranded to **IPD Studio** (0.9.15) and built out HMI Studio:

- HMI tag picker — bind by picking, never typing (0.9.0)
- DCS-style operation: faceplate v2, bumpless transfer, command journal (0.9.2)
- Trends with a real time axis: multi-pen, mm:ss, hover cursor, sparklines (0.9.3)
- ISA-18.2 alarms: deadband, 3 priorities, shelve/OOS/SBD (0.9.4)
- Screens & chrome: home screen, drag-reorder, Modal, run header (0.9.5)
- Import v2: multi-sheet dialog + generated L1 plant overview (0.9.6)
- Simulation depth: fan-out flow, equipment dynamics, process events (0.9.7)
- Import fidelity: routed pipes, vessel shapes, orientation (0.9.8–0.9.9)
- Equipment pack: compressor/blower/agitator/conveyor/heater with motor
  dynamics (0.9.10)
- Full ISA instrumentation palette with shortcut and full-name search (0.9.11)
- Frequent-industry symbol pack — 11 symbols across 5 sections (0.9.12)
- Fluid services: define media, assign to a line, colour flows through the
  whole run; HMI pipes inherit (0.9.13–0.9.14)
- Sponsorship, welcome overlay, update toast, Dependabot + CodeQL (0.9.16–0.9.20)

## [0.8.0] – [0.8.8] — 2026-08-21

- User-added connection pins and the ISA valve positioner (0.8.3)
- Control valve geometry reworked to 64×48 with clear stubs and no overlaps
  (0.8.4–0.8.8)
- Line lifecycle: no resurrection, gesture-granular bends, segment dragging
  (0.8.2)
- Imported real plants now come up calm rather than alarming (0.8.1)

## [0.6.0] – [0.7.x] — 2026-08-20

- HMI Studio first release with memoized widget rendering (0.6.0)
- Polish round from user feedback (0.6.1)

## [0.1.0] – [0.5.x] — 2026-08-20

Initial development: the P&ID editor core — ISA-5.1 symbol library, tag
parsing and validation, orthogonal routing with ports and connection rules,
multi-sheet projects, DEXPI/DXF import and export, generated loop diagrams
and datasheets, and the `.pnid.json` document format.

[0.13.0]: https://github.com/Coldbari/IPD-Studio/releases/tag/v0.13.0
[0.12.0]: https://github.com/Coldbari/IPD-Studio/releases/tag/v0.12.0
[0.11.0]: https://github.com/Coldbari/IPD-Studio/releases/tag/v0.11.0
[0.10.0]: https://github.com/Coldbari/IPD-Studio/releases/tag/v0.10.0
