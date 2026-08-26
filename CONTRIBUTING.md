# Contributing to IPD Studio

Thanks for helping build the free, browser-native intelligent P&ID tool.
All contributions are welcome: bug fixes, new symbols, HMI widgets, docs,
translations of engineering conventions you know from your industry — even a
well-written bug report with a `.pnid` file attached moves the project.

## Your first contribution, step by step

1. **Fork** the repo on GitHub (button top-right), then clone your fork:

   ```bash
   git clone https://github.com/<your-username>/pid-studio.git
   cd pid-studio
   npm install
   npm run dev        # editor at http://localhost:5173
   ```

2. **Pick something.** Issues labeled `good first issue` are sized for a first
   PR; `help wanted` are bigger but unclaimed. Or just fix what bugs you.
   For anything large, open an issue first so we agree on the approach
   before you invest the time.

3. **Branch** off `main`:

   ```bash
   git checkout -b feat/foot-valve-symbol   # feat/… fix/… docs/…
   ```

4. **Make the change, tests first.** Logic changes start with a failing test
   (see "Tests are the contract" below). Run the gates locally:

   ```bash
   npm test             # unit (vitest)
   npx playwright test  # e2e (starts its own dev server)
   npm run build        # type-check + production build
   ```

5. **Commit** in the conventional style used throughout the history:

   ```
   feat(pid): foot valve symbol with strainer hatch
   fix(hmi): trend hover cursor froze the wrong window
   ```

6. **Push and open a Pull Request** against `main`:

   ```bash
   git push -u origin feat/foot-valve-symbol
   ```

   The PR template asks how you verified it — fill it honestly. CI-less for
   now, so your local test run *is* the gate.

7. **Review.** Expect concrete feedback; push follow-up commits to the same
   branch (no force-push needed). Once approved it's squash-merged, and your
   change ships to [the live app](https://pid-studio-praharsh.web.app) with
   the next release.

## What we especially need

- **Symbols** you miss from real drawings (follow "Adding a symbol" below —
  and the IP rule, always)
- **Industry review**: wrong conventions, wrong letter combinations, things a
  practicing I&C engineer would flinch at — file issues, you don't need to code
- **HMI widgets** and simulation depth (see `src/hmi/`)
- **Import/export fidelity**: DEXPI conformance, DXF quirks from real CAD files
- **Docs and examples**: a good example plant teaches more than a manual

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

### Custom symbols

Users can import their own SVG symbols (palette → "Import symbol…"). The
sanitizer (`src/import/svgSymbol.ts`) strips scripts, event handlers, and
external references; keep it that way when touching import code.

### Symbol IP rule (non-negotiable)

Symbols must be **authored independently from geometric first principles**
(a gate valve is two triangles; a field instrument is a circle). Never trace,
copy, or vectorize artwork from the ISA-5.1 standard document, vendor
libraries, or other software. Never feed standards documents into AI tools to
generate symbols. PRs that can't establish independent authorship are closed.

## Tests are the contract

Every logic change lands with tests (TDD preferred). UI-only changes need at
minimum a passing build plus the e2e happy path.
