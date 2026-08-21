# DWG import spike — findings (v0.3)

**Question:** can PID Studio open native AutoCAD DWG files in the browser?

## What was evaluated

| Option | Verdict |
|---|---|
| **LibreDWG (wasm)** | Functional DWG→DXF conversion exists (`libredwg-web` builds). Cost: ~6–9 MB of wasm shipped to every visitor, GPLv3 (license-compatible with our AGPL, but heavy), and DWG version coverage is uneven for 2018+ files. |
| **ODA / Teigha SDK** | The industry-grade answer, used by almost every commercial tool. Proprietary, per-product licensing with fees — incompatible with an AGPL no-cost project. |
| **Cloud conversion API** | Works (e.g. CloudConvert), but breaks the local-first promise: drawings would leave the user's machine. Rejected on principle. |

## Decision

**Do not ship in-app DWG import.** The supported path is:

1. Convert DWG → DXF externally (free: ODA File Converter desktop app, LibreCAD,
   or any CAD seat the user already has).
2. Load the DXF through **Toolbar → Underlay** as a locked trace-over
   background, and redraw intelligently on top.

DXF **underlay import** and layered DXF **export** shipped in v0.3
(`src/import/dxfUnderlay.ts`, `src/export/dxf.ts`), which covers the practical
interop need without the wasm payload.

## Revisit when

- LibreDWG wasm builds drop under ~2 MB compressed, or
- lazy-loading the converter only on first DWG open is acceptable UX, or
- a user survey shows DWG-in-browser is a top-3 request.
