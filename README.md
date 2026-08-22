# PID Studio

**Open-source, browser-based intelligent P&ID editor.** Drag ISA-5.1-style
symbols onto a sheet, connect process and signal lines with proper orthogonal
routing, tag instruments with validated ISA tags — and generate real
engineering deliverables.

Local-first: no backend, no account, no upload. Drawings live on your machine.

## Why

Every browser diagramming tool treats a P&ID as clipart. Every intelligent
P&ID tool is a $2,600+/year desktop install. PID Studio is the missing thing:
**data behind the drawing, in the browser, free (AGPL).**

- Tags are parsed and validated against ISA-5.1 letter tables — type `FIC` and
  the editor knows it's a *Flow Indicating Controller*
- Loop numbers auto-assign; duplicates are flagged live
- Control loops derive automatically from the tags
- The instrument index and line list are generated from the model, not typed
- The document is versioned open JSON, designed to map onto DEXPI

## Features (v0.3)

- **HMI Studio (v0.6)** — build operator screens from your P&ID and run them
  as a live training simulation: faceplates, PI control loops auto-wired from
  your ISA tags, alarms with acknowledge, flow animation, classic and ISA-101
  high-performance themes ([docs](docs/HMI.md))
- **180+ parametric symbols, 200+ palette entries** — instrument bubbles (all
  16 ISA display/location variants from one parameterized symbol), control
  valves with 7 actuator types and fail-action marks, 14 manual valve types,
  safety/relief devices, 14 flow elements, level/temperature/pressure
  accessories, pumps, compressors, turbines, spheres, silos, columns,
  reactors, separators, heat exchangers, fired heaters, cooling towers,
  ISA-5.2 logic gates (AND/OR/NOT), DCS/PLC/SIS system boxes, fittings,
  solids handling (conveyors, crushers, dryers, clarifiers), boilers, flares,
  MCC/UPS/IS barriers, steam trap variants — plus **your own imported SVG
  symbols** with a click-to-place port editor
- **16 line classes** with correct ISA rendering: heavy/light process,
  impulse, electric (dashed), pneumatic (double slash), hydraulic, capillary,
  data/software (circles), electromagnetic, jacketed (double line),
  heat-traced, underground, existing, battery limit
- **Multi-sheet projects** — sheet tabs, per-sheet title blocks, off-page
  connectors linked across sheets with jump-to-target, project-wide tag
  validation
- **DEXPI-oriented export *and import*** — Proteus Schema 4.2-shaped XML with
  a documented model mapping ([docs/DEXPI-MAPPING.md](docs/DEXPI-MAPPING.md));
  PID Studio files round-trip, foreign files map via ComponentClass
- **CAD interop** — layered R12 **DXF export** (opens in AutoCAD/LibreCAD),
  and **DXF underlay import**: load a legacy drawing as a locked gray
  background and redraw intelligently on top
  ([DWG findings](docs/DWG-IMPORT-SPIKE.md))
- **Generated deliverables** — one-click **ISA-5.4-style loop diagrams**
  (field / marshalling / control room with numbered terminals) and
  **ISA-20-style instrument datasheets** (form editor, PDF, CSV matrix)
- **Works offline** — installable PWA; the whole editor runs with no internet
- **Editor power** — Ctrl+F find-any-tag across sheets, align/distribute,
  live snap guides, print-all-sheets PDF, line sequence auto-numbering
- **Obstacle-avoiding orthogonal routing** with draggable waypoints, ports
  with connection rules (a pneumatic signal won't connect to a pipe nozzle)
- **Live validation**: duplicate tags, missing tags, illegal ISA letters,
  dangling lines, incompatible connections, duplicate line numbers
- **Deliverables**: SVG + PNG export, print-to-PDF at true sheet scale
  (A4–A1, ANSI B/D) with title block, instrument index CSV, line list CSV,
  DEXPI XML — plus starter templates
- **Editor**: zoom-to-cursor, pan, marquee select, undo/redo, copy/paste,
  rotate, snap-to-grid, keyboard shortcuts, autosave with restore

## Quick start

```bash
npm install
npm run dev     # open http://localhost:5173, press "Sample" for a demo plant
npm test        # 247 unit tests
npx playwright test   # e2e
```

## File format

Drawings save as `.pnid.json` — versioned, human-readable JSON
(`schemaVersion`, sheet metadata, `nodes[]`, `edges[]`). See
[examples/sample-plant.pnid.json](examples/sample-plant.pnid.json).

## Roadmap

- **v0.4** — real-time collaboration (opt-in self-hosted sync; the no-backend
  local-first default stays), review comments, DEXPI conformance hardening,
  in-app DWG per the [spike findings](docs/DWG-IMPORT-SPIKE.md)

## Symbols & standards

Symbols are authored independently as original SVG from public-domain
geometric conventions. This project is not affiliated with or endorsed by the
International Society of Automation. "ISA" is referenced solely to describe
the drawing conventions the symbols follow.

## License

AGPL-3.0-only — free forever, and every hosted derivative must publish its
source. See [LICENSE](LICENSE).
