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

## Features (v0.1)

- **60+ parametric symbols, 80 palette entries** — instrument bubbles (all 16
  ISA display/location variants from one parameterized symbol), control valves
  with 5 actuator types and fail-action marks, manual valves, PSV/rupture disc,
  flow elements (orifice to coriolis), pumps, compressors, vessels, columns,
  reactors, heat exchangers, fittings, off-page connectors
- **10 line classes** with correct ISA rendering: heavy/light process lines,
  impulse, electric (dashed), pneumatic (double slash), hydraulic, capillary,
  data/software (circles), internal links — decorations ride the routed path
- **Obstacle-avoiding orthogonal routing** with draggable waypoints, ports
  with connection rules (a pneumatic signal won't connect to a pipe nozzle)
- **Live validation**: duplicate tags, missing tags, illegal ISA letters,
  dangling lines, incompatible connections, duplicate line numbers
- **Deliverables**: SVG export, print-to-PDF at true sheet scale (A4–A1,
  ANSI B/D) with title block, instrument index CSV, line list CSV
- **Editor**: zoom-to-cursor, pan, marquee select, undo/redo, copy/paste,
  rotate, snap-to-grid, keyboard shortcuts, autosave with restore

## Quick start

```bash
npm install
npm run dev     # open http://localhost:5173, press "Sample" for a demo plant
npm test        # 186 unit tests
npx playwright test   # e2e
```

## File format

Drawings save as `.pnid.json` — versioned, human-readable JSON
(`schemaVersion`, sheet metadata, `nodes[]`, `edges[]`). See
[examples/sample-plant.pnid.json](examples/sample-plant.pnid.json).

## Roadmap

- **v0.2** — catalog completion (~75 more symbols), DEXPI/Proteus XML export,
  PNG export, multi-sheet projects with linked off-page connectors, ISA-5.2
  logic symbols, custom symbol import
- **v0.3+** — real-time collaboration (Yjs, self-hosted), auto-generated loop
  diagrams (ISA-5.4), instrument datasheets (ISA-20 style), DWG import spike

## Symbols & standards

Symbols are authored independently as original SVG from public-domain
geometric conventions. This project is not affiliated with or endorsed by the
International Society of Automation. "ISA" is referenced solely to describe
the drawing conventions the symbols follow.

## License

AGPL-3.0-only — free forever, and every hosted derivative must publish its
source. See [LICENSE](LICENSE).
