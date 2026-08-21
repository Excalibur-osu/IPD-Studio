# Contributing to PID Studio

## Dev setup

```bash
npm install
npm run dev          # editor at localhost:5173
npm test             # vitest unit tests
npx playwright test  # e2e happy path
npm run build        # type-check + production build
```

## Architecture in one paragraph

The Zustand store (`src/store`) owns the document — plain JSON, immutable
updates, zundo undo. JointJS renders it through a one-way reconciler
(`src/canvas/reconciler.ts`); every user gesture becomes a store action, never
a direct graph mutation. Pure logic (ISA tables, tag parsing, validation,
CSV/exports, glyph geometry) lives in DOM-free modules with table-driven
tests. Symbols are data (`src/symbols/lib`): SVG-string renderers plus port
definitions parsed to JointJS markup by `src/canvas/markupParser.ts`.

## Adding a symbol

1. Add a `SymbolDef` to the right module in `src/symbols/lib/` — geometry on
   the 8px grid, ports on the 4px lattice, `stroke="currentColor"`.
2. Register it in `src/symbols/lib/index.ts` (or its module's array).
3. Extend `tests/symbols/catalog.test.ts` with its id and a geometry check.
4. Eyeball it in the palette (`npm run dev`) at 100% and 200% zoom.

### Symbol IP rule (non-negotiable)

Symbols must be **authored independently from geometric first principles**
(a gate valve is two triangles; a field instrument is a circle). Never trace,
copy, or vectorize artwork from the ISA-5.1 standard document, vendor
libraries, or other software. Never feed standards documents into AI tools to
generate symbols. PRs that can't establish independent authorship are closed.

## Tests are the contract

Every logic change lands with tests (TDD preferred). UI-only changes need at
minimum a passing build plus the e2e happy path.
