# IPD Studio

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Coldbari)
[![Live demo](https://img.shields.io/badge/Live%20demo-%E2%96%B6-2b6cb0)](https://pid-studio-praharsh.web.app)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

**Open-source, browser-based intelligent P&ID editor.** Drag ISA-5.1-style
symbols onto a sheet, connect process and signal lines with proper orthogonal
routing, tag instruments with validated ISA tags — and generate real
engineering deliverables.

Local-first: no backend, no account, no upload. Drawings live on your machine.

**▶ Try it now: [pid-studio-praharsh.web.app](https://pid-studio-praharsh.web.app)** — pick *Templates → Sample plant* for a demo.

<p align="center">
  <img src="docs/media/demo.gif" alt="IPD Studio demo: drawing a plant P&ID, coloring fluid services, and opening it in HMI Studio" width="840">
</p>
<p align="center"><em>A real drawing session, sped up: place instruments → draw the loops → color the services → open it in HMI Studio.<br>
<strong><a href="docs/media/demo-full.mp4">▶ Watch the full 2½-minute video</a></strong></em></p>

<p align="center">
  <img src="docs/media/editor.png" alt="The P&ID editor: ISA symbol palette, typical loops, multi-sheet drawing with validation and advisor" width="840">
</p>
<p align="center"><em>The editor: ISA-5.1 palette with instrument presets and typical loops, multi-sheet drawings, live validation & advisor.</em></p>

<p align="center">
  <img src="docs/media/fluids.png" alt="Fluid services: water, steam, and slurry coloring whole line runs" width="49%">
  <img src="docs/media/hmi.png" alt="HMI Studio: the same plant as an operator screen with tanks, valves, pumps, and live displays" width="49%">
</p>
<p align="center"><em>Left: fluid services color whole line runs (water/steam/slurry). Right: the same plant in HMI Studio — tanks, valves, pumps, and displays ready to simulate.</em></p>

## Why

Every browser diagramming tool treats a P&ID as clipart. Every intelligent
P&ID tool is a $2,600+/year desktop install. IPD Studio is the missing thing:
**data behind the drawing, in the browser, free (AGPL).**

- Tags are parsed and validated against ISA-5.1 letter tables — type `FIC` and
  the editor knows it's a *Flow Indicating Controller*
- Loop numbers auto-assign; duplicates are flagged live
- Control loops derive automatically from the tags
- The instrument index and line list are generated from the model, not typed
- The document is versioned open JSON, designed to map onto DEXPI

## Features (v0.9)

- **HMI Studio** — build operator screens from your P&ID (or import them in
  one click) and run them as a live training simulation: DCS-style faceplates,
  PI control loops auto-wired from your ISA tags, ISA-18.2 alarms (priorities,
  deadband, shelve/out-of-service), multi-pen trends with a real time axis,
  motor-driven equipment (pumps, compressors, conveyors) you can start, stop,
  and trip, flow-network simulation with fan-out, training upsets (trip a
  pump, stick a valve, plug a line), classic and ISA-101 high-performance
  themes ([docs](docs/HMI.md))
- **Fluid services** — define media once (Water blue, Steam red, Slurry
  brown…), assign one to a line and the color spreads along the whole
  connected run; imported HMI pipes inherit it
- **Full instrumentation palette** — a 60-entry ISA-5.1 preset catalog
  (every element/transmitter/indicator/controller/converter/switch for
  flow, pressure, level, temperature, analysis + more), searchable by
  shortcut (`FT`) or full name ("flow transmitter"), placed pre-tagged with
  per-type auto-numbering
- **195+ parametric symbols** — instrument bubbles (all
  16 ISA display/location variants from one parameterized symbol), control
  valves with 7 actuator types and fail-action marks, 14 manual valve types,
  safety/relief devices, 14 flow elements, level/temperature/pressure
  accessories, pumps, compressors, turbines, spheres, silos, columns,
  reactors, separators, heat exchangers, fired heaters, cooling towers,
  ISA-5.2 logic gates (AND/OR/NOT), DCS/PLC/SIS system boxes, fittings,
  solids handling (conveyors, crushers, dryers, clarifiers), boilers, flares,
  MCC/UPS/IS barriers, steam trap variants, solenoid (XV) and motor-operated
  (MOV) valves, foot/ball-check/float valves, air filter regulators, pulsation
  dampeners, drain funnels, fans, coils — plus **your own imported SVG
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
  IPD Studio files round-trip, foreign files map via ComponentClass
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
git clone https://github.com/Coldbari/IPD-Studio.git
cd IPD-Studio
npm install
npm run dev     # open http://localhost:5173, Templates → Sample for a demo plant
npm test        # 600+ unit tests
npx playwright test   # e2e suite (starts its own dev server)
```

## File format

Drawings save as `.pnid.json` — versioned, human-readable JSON
(`schemaVersion`, sheet metadata, `nodes[]`, `edges[]`). See
[examples/sample-plant.pnid.json](examples/sample-plant.pnid.json).

## Roadmap

- Custom **HMI widgets from your own SVG** with animation bindings (level
  fills, spin-on-run) — the same import pipeline the P&ID symbols already have
- Legend sheet generation (line classes + fluid colors in use)
- Real-time collaboration (opt-in self-hosted sync; the no-backend
  local-first default stays), review comments
- DEXPI conformance hardening; in-app DWG per the
  [spike findings](docs/DWG-IMPORT-SPIKE.md)

## Contributing

PRs, symbol requests, and bug reports are all welcome — start with
[CONTRIBUTING.md](CONTRIBUTING.md) for the fork→branch→PR flow, the
architecture in one paragraph, and the how-to for adding a symbol. If you're
a practicing I&C or process engineer, even a "this convention is wrong"
issue is a valuable contribution.

## Support the project

IPD Studio is built and maintained free. If it saves you a license fee, you
can [sponsor the project on GitHub](https://github.com/sponsors/Coldbari) —
sponsorship pays for the time that turns issues into releases.

## Symbols & standards

Symbols are authored independently as original SVG from public-domain
geometric conventions. This project is not affiliated with or endorsed by the
International Society of Automation. "ISA" is referenced solely to describe
the drawing conventions the symbols follow.

## License

AGPL-3.0-only — free forever, and every hosted derivative must publish its
source. See [LICENSE](LICENSE).
