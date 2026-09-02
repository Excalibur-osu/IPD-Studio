# The project assistant — design

Date: 2026-09-02
Status: approved, awaiting implementation plan
Target versions: v0.17.0 (foundations), v0.18.0 (assistant v1)
Written against v0.16.0 (schemaVersion 5, 20,273 LOC, HEAD `be431e9`)

## Problem

The user wants an in-app assistant that works like an engineer: it answers
questions about the drawing, predicts and finds errors, and can edit or delete
in the workspace — with every action gated by an explicit allow/deny prompt, and
with full awareness of what is currently selected.

Two constraints come from the codebase's own prior decisions and are honoured
rather than overturned:

- `ENGINEERING-PLATFORM-PLAN.md` §5.5 scopes the assistant to *grounded
  retrieval over the entity index*, producing jump lists into real objects.
- §9 lists "a generic AI chatbot" under what not to build: *"An assistant that
  cannot ground an answer in the model will invent tags."*

This design satisfies the user's request **and** those constraints, by making
grounding a structural property rather than a prompt instruction.

## The product decision

> **Not an LLM in your P&ID. A query engine over the plant model, with an LLM on
> the semantic quarter that queries cannot reach.**

Of twenty real questions an instrument engineer asks about a selected loop or
component (§6), **eleven are database queries, four are hybrids, one is domain
opinion, and four must be refused** because the document does not hold the data.

The eleven are answered by a deterministic template layer with **no model call
at all** — exact, instant, free, unhallucinatable. The LLM earns its keep on the
remaining semantic work, and on four questions its most valuable behaviour is
declining.

## Measured facts that shaped this

Measured against `examples/sample-refinery-unit.pnid.json` (3 sheets, 32 nodes,
30 edges):

| Measurement | Value | Consequence |
|---|---|---|
| Untagged-but-labelled nodes | **14 of 32 (44%)** | Nearly half the plant's identity lives in free text (`"TK-201 Crude Feed"`) that `deriveLoops` skips (`src/store/selectors.ts:18`) and `keyOfNode` cannot key (`src/model/registry.ts:60`). This is the LLM's strongest justification *and* the reason the assistant must often answer "that object is untagged". |
| Process edges carrying `arrow: 'flow'` | **4 of 20 (20%)** | Direction is *not knowable* for most lines. "What is downstream?" must be answered as adjacency with an explicit caveat, never guessed. |
| Whole document, distilled to engineering facts | **1,926 B ≈ 482 tokens** | Context size was never the constraint. Correctness is. A ~2 kB selection brief is affordable at any project size. |

## Decisions taken

| Decision | Choice |
|---|---|
| Brain | Hybrid. The LLM plans; it may only act through typed tools and may only assert facts a tool returned. |
| Tool surface | Two tiers. Intent-level tools composed from store actions — **never** a 1:1 wrapper (see below). |
| Read tools | Loop freely, unattended, no consent prompt. |
| Write tools | A frozen, reviewed plan. One bounded "re-plan once, then re-approve" escape hatch. |
| Unit of consent | The `FixSpec` — one engineering intention — never the store call, and never two `FixSpec`s behind one button. |
| Unit of undo | Identical to the unit of consent. One approved action = one `undo()`. |
| Destructive tools | None in v1. |
| Selection | The assistant never calls `setSelection`. It gets a separate non-undoable highlight channel. |
| Context | A ≤2 kB selection brief, preloaded and frozen into the message at send time. Depth beyond one hop comes from tools. |
| Transport | Behind an interface. BYO key in v1; hosted proxy deferred. |
| UI | A dock in the existing right column, mutually exclusive with the property panel. |

### Why a 1:1 store wrapper is incorrect, not merely inelegant

Every node/edge mutation routes through `patchSheet` (`src/store/store.ts:149`),
which only ever rewrites the **active** sheet. `setTag` resolves `activeSheet(s)`
and then bails silently:

```ts
// src/store/store.ts:315-317
const sheet = activeSheet(s)
const node = sheet.nodes.find((n) => n.id === id)
if (!node) return s
```

So "retag FT-201 on sheet-process" while Utilities is active is a **silent no-op
that throws nothing and returns nothing**. `applyFix` already hand-codes the
workaround (`src/assist/fixes.ts:27`). Exposing sixty such actions gives a model
sixty ways to report success on work it never did — the precise failure the
grounding rule exists to prevent.

Second reason: `getSymbol` **throws** on an unknown id
(`src/symbols/registry.ts:16`) and `addNode` validates nothing
(`src/store/store.ts:188`). Unguarded call sites include `src/validate/checks.ts`,
`src/export/csv.ts` and `src/canvas/shapes.ts`. A hallucinated `symbolId` does
not draw the wrong thing — it white-screens the app on the next validation pass.
Whitelisting is crash prevention.

## Architecture

```
selection ──► buildIndex(doc)          memoised on doc identity, like issuesFor
                   │
                   ├──► selectionBrief()        ≤2 kB, deterministic, frozen at send
                   │
                   ├──► TEMPLATE LAYER          11 of 20 question types, zero model calls
                   │
                   └──► AGENT LOOP
                          read tools ─────────  free, unattended, no consent
                                │
                          proposed FixSpec[] ─  serializable values, never closures
                                │
                          describeFix() ──────  consent card + blast radius + ghost preview
                                │
                          applyFix() ─────────  { ok, changedIds }, one undo step
                                │
                          grounding validator   blocks unknown tags BEFORE render
                                │
                          citation chips ─────  [[ref|id]] → pid-cite highlight channel
```

## 1. Foundations — `buildIndex` and the rule interface

> **Status note, 2026-09-02.** Most of this section was built in a parallel
> session while this spec was being written, and is present in the working tree
> uncommitted: `src/model/projectIndex.ts` (the index), `src/validate/rules.ts`
> (`Rule` / `RuleFinding`), `src/validate/engine.ts` (`runRules`, severity
> ordering, per-rule crash containment), `src/validate/rules/` (21 rules across
> five disciplines), and `doc.qa.ignored` for auditable ignores. What remains for
> v0.17.0 is the fix representation (§5) and the five bugs (§16). Verify against
> the tree before implementing anything here.

Prerequisite work, shipping in v0.17.0. **Not** the full 24-rule QA engine from
plan §4.2 — only the two pieces that prevent the assistant being rewritten when
that engine lands:

1. **`buildIndex(doc): ProjectIndex`** in `src/store/selectors.ts`, memoised on
   document identity with the same single-entry cache as
   `src/validate/issues.ts:30-39` and for the same stated reason. One walk
   produces: nodes by id · edges by node · tags → nodes · loops · records by key ·
   neighbour lists · port kinds. This also fixes plan finding #7 (validation
   running 3× per keystroke).
2. **Stable finding identity** — `ruleId + entityKey`, replacing the current
   `checkId:targetId` strings (`src/validate/checks.ts:24`). The existing 16
   rules are ported unchanged; no new rules. Stable ids are what let the
   assistant say *"this finding — the one you ignored last week"*, and what stops
   it hard-coding a two-value severity where absence means error
   (`src/model/types.ts:186`).

### Reconciling the two definitions of "loop"

The codebase currently holds two incompatible ones, and the disagreement between
them is where real drawing errors live:

- `deriveLoops()` groups by first letter + loop number across all sheets and
  **never reads an edge** (`src/store/selectors.ts:15-24`).
- The `no-final-element` rule asks whether a valve is reachable over signal lines
  within 3 hops (`src/validate/suggest.ts:114`).

`buildIndex` computes **both** and exposes the diff (`taggedNotWired`,
`wiredNotTagged`). Neither is deleted; the difference is a finding.

## 2. The selection brief — `src/assist/context.ts`

One pure function, `selectionBrief(index, activeSheetId, selection)`. This is the
only thing the model learns about the selection without a tool call. Hard-capped
at ~2 kB serialized; `budget.truncated: true` instructs the model to call a tool
rather than infer.

For a single node the brief carries: id (the citation key) · ref · sheet ·
kind · symbol · tag with `expandLetters()` and `validateLetters()` output ·
label · config **and `configOptions`** · ports with connection state · the
engineering record read through `fieldValue()` (so the pre-v5 `node.datasheet`
fallback applies) with `filled/total` counts · neighbours · open findings.

`configOptions` is load-bearing: handing the model the *closed set* of legal
values (`src/symbols/lib/valves-control.ts:125`) is what lets it propose
`fail: "fc"` and never `fail: "fail-shut"`.

### Walk depths, and why each is that number

| Walk | Depth | Reuses | Rationale |
|---|---|---|---|
| Process | Expand through pass-through hardware only; include the first non-pass-through node, flagged `terminal` | `passesThrough()` / `propagateFluid()`, `src/model/fluidFlow.ts:17,31` | The process question is always "what is this between?" This is already the boundary `setEdgeFluid` uses to spread a service (`src/store/store.ts:526`), so the brief and the app cannot disagree. Cap 40 nodes. |
| Signal | 3 hops over `signal.*` + `link.internal` | `signalReach()`, `src/validate/suggest.ts:45` | 3 is already the number `no-final-element` uses (`suggest.ts:114`). Matching it means the assistant and the Advisor can never contradict each other. It covers transmitter → I/P → valve. Past 3, a multi-drop bus swallows the sheet. |
| Tag family | Project-wide, zero hops | `deriveLoops()`, `src/store/selectors.ts:15` | A pure tag join; cheap, and what every deliverable already uses. |

Everything past those bounds is a **query, not context** — the model calls
`walk_process(id, hops)` / `walk_signal(id, hops)` so the extra facts arrive as
tool results (assertable, citable) rather than free prompt text.

### Per-shape rules

- **1 node** — full focus, both neighbourhoods, loop block if tagged.
- **1 edge** — focus edge, both end nodes at full depth, the run, the line
  record, plus `arrowsMarked / arrowsTotal` so the model knows when direction is
  unknowable.
- **2–8 objects** — focus-lite each, one de-duplicated union neighbourhood, a
  loop block per distinct `(family, number)`, plus `commonality` (same loop? same
  run? contiguous?). "Why did you select these five together" is the real question.
- **>8 objects** — aggregate only: counts by kind, tag families, loops touched,
  findings by rule, top 10 findings. A 200-object selection is a scope, not a subject.
- **Mixed** — first node is focus, rest shallow, `kind: "mixed"` so the model asks.
- **Empty** — the active sheet's aggregate, and the assistant must *say* "nothing
  is selected; I'm answering about sheet Process." Never silently widen to the project.

## 3. The template layer

Answers the eleven model-free question types with no network call. Each template
renders a jump list, never prose about objects.

**Matching is deterministic in v1** — keyword patterns plus selection shape, in
the style of `src/search/`'s existing matching. The LLM is not used to classify
intent, because a classifier call costs the same round trip the template layer
exists to avoid, and a misclassification would silently route a query question
into the generative path. On no match, the question goes to the agent loop.

This layer is the thesis: half the catalogue is a query, and queries are exact,
instant, free and unhallucinatable. They buy the trust the LLM will spend.

## 4. Read tools

All pure over `buildIndex`, all returning ids, none prompting for consent. Every
result carries `rev` (§8) and a `total` alongside its rows — a result silently
capped at 50 is how a model concludes "there are no others".

| Tool | Returns |
|---|---|
| `get_object(id)` | The focus shape from §2 |
| `get_loop(family, number)` | Both loop definitions, roles via `classifyMember` (`src/export/loopDiagram.ts:19`), the matching `TYPICALS` template and what is missing |
| `walk_process(id, hops)` | Run membership on the `propagateFluid` boundary |
| `walk_signal(id, hops)` | `signalReach` results |
| `list_findings(scope)` | `issuesFor(doc)` rows with stable ids and `hasFix` |
| `get_record(key)` | The record **plus the field catalog for its kind** (`src/model/fields.ts:150`) — which is what stops the model inventing a field key |

`get_loop` uses `classifyMember` so "the final element" means the same thing to
the assistant as it does to the generated loop diagram.

## 5. Write tools — the fix vocabulary

`FixSpec` stays a **serializable discriminated union**
(`src/validate/suggest.ts:11`). The plan's `fix: { label, apply() }` closure idea
(§4.2) is explicitly rejected: a closure cannot be shown in a consent dialog as
data, logged, or replayed in a test. Rules return a `FixSpec` value; the model
*proposes* one; the user approves; `applyFix` dispatches.

> **Conflict to resolve, 2026-09-02.** The in-flight QA engine adopted the
> closure form — `src/validate/rules.ts:26-29` defines
> `interface Fix { label: string; apply(): void }`. This must change before the
> rules multiply. Either form below satisfies the spec; the second requires no
> call-site rewrites:
>
> - `RuleFinding.fix?: { label: string; spec: FixSpec }`, or
> - `{ label, spec, apply() }` where `apply()` delegates to `applyFix(spec)`.
>
> Without one of them the assistant can only *run* a fix, never show the user
> what it would do first — which defeats the consent model the feature rests on.

Two required changes to the existing dispatcher:

- **`applyFix` must return `{ ok, changedIds, message }`.** Today it returns
  `void` and silently no-ops on bad input (`src/assist/fixes.ts:31,36`). A tool
  that fails silently cannot ground a follow-up claim.
- **Add `describeFix(fix, doc) → { title, blastRadius, affectedIds }**, so the
  consent card and the assistant share one description.

v1 ships **three** fixes, each chosen to prove one mechanism:

| Fix | Rule | Proves |
|---|---|---|
| `assign-tag` | `missing-tag`, `src/validate/checks.ts:41` | Tag inheritance via `suggestLoop` (`src/isa/autonumber.ts:57`) — the model never authors a loop number |
| `set-fail-position` | `no-fail-position`, `src/validate/suggest.ts:136` | Writes **both** `setNodeConfig` and `setRecordField` — the symbol renders from `config`, the datasheet reads the record. Writing one creates exactly the drawing-vs-paperwork divergence this product exists to prevent |
| `delete-duplicate-line` | `duplicate-line`, `src/validate/suggest.ts:152` | Trivially safe, trivially undoable, currently the most obviously fixable suggestion with no fix attached |

Designed and deferred to v2: `renumber-tag`, `add-relief`, `link-offpage`,
`adopt-line-service`, `set-line-number`, `swap-symbol`, `add-loop-member`.

## 6. The question catalogue

The behavioural spec. **M** = answerable from the document. **D** = needs domain
knowledge the LLM supplies. **U** = unanswerable; the assistant must say so.

| # | Question | Class |
|---|---|---|
| 1 | Is this loop complete? | M (+D garnish) |
| 2 | What is FIC-201 controlling? | M, partial |
| 3 | What fails if PT-101 fails? | M + D, split |
| 4 | Why is this valve fail-closed? | **U** → redirect |
| 5 | What's my hazard here? | D, heavily caveated — partly U |
| 6 | Does this vessel have relief? | M |
| 7 | Is this PSV sized right? | **U** |
| 8 | What instruments are on this line? | M |
| 9 | Which loops are missing a controller? | M |
| 10 | Why did the Advisor say "FT-201 measures but nothing receives it"? | M |
| 11 | What's downstream of this valve? | M, mandatory caveat |
| 12 | Is this tag ISA-legal? | M |
| 13 | Should this be FIC or FC? | M + D |
| 14 | What signal type should drive this valve? | M |
| 15 | What's the calibrated range of this transmitter? | M, retrieval only |
| 16 | Which instruments have no datasheet? | M |
| 17 | What changed since revision 2? | **U** |
| 18 | Is this interlock complete / what trips this? | **U**, mostly |
| 19 | How much does this loop cost? | M |
| 20 | Does the HMI screen for this loop show everything it should? | M |

Three that define the product's character:

- **#4 is the acceptance test for the whole grounding design.** The document
  records *that* a valve is FC (`config.fail`), never *why*. No rationale field
  exists in `FIELD_CATALOG`. The assistant must say so, then offer the convention
  as clearly-marked opinion.
- **#3 is the best grounding demo.** Reach is mechanical (`signalReach`);
  behaviour on loss of signal is retrieval from `signal.fail` and each valve's
  `config.fail`. When `fail` is `'none'` — the `no-fail-position` case — the
  correct answer is *"unknown, and that is the finding."*
- **#15 must never infer a range from the service name.** That is precisely the
  plausible-looking hallucination that destroys trust. Empty means empty, plus an
  offer to fill it.

**Refusal is a feature, but never a dead end.** Every "I can't" ships with what
is missing, which field would hold it, and a one-click fix to create it.

## 7. Grounding enforcement — `src/assist/grounding.ts`

A pure function `validate(answer, doc, toolResults) → Violation[]`. Two layers.

**Layer 1 — structured citations.** The answer schema forbids bare identifiers.
Prose references objects only as `[[ref|id]]`. The renderer resolves the id in
the index and renders **the document's current ref, not the model's string**.
That inversion is the whole trick: the model cannot make the UI display
"FT-205" for a node named "FT-201", because the UI never renders model text.

**Layer 2 — free-text tag scan.** Models write bare tags in prose anyway. The
scanner already exists: `TAG_RE` (`src/isa/tag.ts:23`), un-anchored to a global
word-boundary form, with hits checked against `liveKeys(doc.sheets)`
(`src/model/registry.ts:108`) — which already yields every tag *and* line number
worn by anything on any sheet.

| Case | Action |
|---|---|
| Well-formed tag **absent from the document** | **Hard block + one regeneration**, violation fed back ("FT-205 does not exist; the flow instruments here are FE-201, FT-201"). Second failure → refuse and render the raw finding list |
| **Known** tag outside the brief | Warn, don't block. The allow-set is brief ids ∪ every id any tool returned this turn |
| Tag-shaped string inside a quoted user phrase or fenced block | Skip — echoing the user's own typo must not trigger a block |

Also validated: line numbers via `keyOfEdge` · symbol ids via `SYMBOLS.has`
(never `getSymbol`, which throws) · field keys via `fieldKeysFor(kind)` ·
proposed ISA letters via `validateLetters` · and **every numeric claim must carry
`{ value, source: { id, fieldKey } }`**, re-read and string-compared. Mismatch
blocks.

**Honest limitation:** this cannot catch a false *relationship* between two real
objects ("FT-201 is downstream of FV-201" when it is upstream). Mitigation: every
relational claim carries the id of the tool call that produced it, and the
validator checks the claim's objects appear in that call's result. Not airtight,
but it converts "the model asserted" into "the model cited" — auditable and
testable.

## 8. Consent

Three tiers, decided by what `undo()` can restore.

| Tier | Contents | Prompt |
|---|---|---|
| **R — read/navigate** | All read tools. Also selection, active sheet and viewport: `zundo` does not even record them (`partialize: (state) => ({ doc: state.doc })`, `src/store/store.ts:891`) | Never. A card for "jump to FT-101" trains the user to stop reading cards |
| **M — mutating, undoable** | The three v1 fixes | One card per `FixSpec` |
| **D — destructive** | `deleteIds`, `deleteSheet`, `purgeRecord`, `removeFluid` | **Not exposed in v1** |

`loadIntoStore` is not a tool at any tier: it calls
`temporal.getState().clear()` and sets `cloudId: null` (`src/store/store.ts:650`),
destroying undo history and unlinking the cloud drawing. Nor is there any generic
`applyPatch(json)` escape hatch — a typed boundary with one generic tool is not a
boundary.

**The card shows, in this order:** the model's prose (marked as the model
talking); a **structured diff rendered by the app from the typed tool arguments,
never from model text**; a ghost preview for spatial fixes; and for anything with
reach, a blast-radius line computed by walking the document. If prose and diff
disagree, the diff is what happens.

**Options:** `Allow` · `Allow this kind for this session` · `Deny` · `Deny and
say why`. The last is the highest-value and cheapest — free text goes back as the
tool result, so a rejection becomes steering rather than a dead end.

**Session grants live in a module-scoped `Set`, cleared on `loadIntoStore`.**
Never in `doc` (it is exported and emailed — a grant travelling inside a `.pnid`
would pre-authorise an assistant on a stranger's machine), never in localStorage
(per-origin, so a grant made while doodling would apply to a client's
confidential drawing), never in Firestore.

### Staleness

A module-level `docRev` counter, bumped by a store subscriber on doc identity
change (same pattern as `src/persist/autosave.ts:52`). Every read result carries
`rev`; every write carries `expectRev`, checked at commit time inside the
transaction. This closes the window where the user drags a symbol during the
seconds a consent dialog is open.

## 9. Undo

**One consented `FixSpec` = one undo step.** The primitive exists and needs no
new store code: `pauseHistory` / `resumeHistory` (`src/store/store.ts:904-909`).
The sequence matters — let the *first* mutation record normally, then pause, then
run the rest, then resume, exactly as the label drag does at
`src/canvas/Canvas.tsx:156`. Pausing before the first mutation records nothing,
and the user's next Ctrl+Z would undo *their own* previous edit. `try/finally`
around `resumeHistory()` is mandatory.

This matches the codebase's stated principle — `dockNode`'s comment
(`src/store/store.ts:33`): the move and the line it creates are one undo step
*"because they are one gesture to the user."*

**"Undo everything the assistant just did"** is a journal plus counted `undo()`,
never a snapshot restore. Record the `doc` reference before and after each commit
(identity is already the change signal everywhere: `reconciler.ts`,
`issues.ts:30`). Revert = call `undo()` until `doc === beforeRef`. If the current
`doc` no longer matches the recorded `after`, the user has edited since —
**don't offer bulk revert at all**; offer "show me what this changed". Honest
beats clever, and `limit: 200` (`src/store/store.ts:892`) means a big enough
burst is not fully undoable anyway.

The transcript *is* the journal — same object, two readings: conversation going
down, audit log going up. No second panel.

## 10. Highlighting and citations

### Canvas → assistant

The panel subscribes to `s.selection` the way `syncSelection` already does
(`src/canvas/interactions.ts:537`), recomputes the brief, and renders a **context
chip strip** above the composer: `[FE-201 ×] [FIC-201 ×] [+ include loop F-201]`.
That strip *is* the feature — the user sees what the assistant is about to be
told, and can trim it. The brief is recomputed live but **frozen into the message
at send time** and shown inline, so scrollback never lies about what an old
answer was grounded in.

### Assistant → canvas

A second, **non-undoable** highlighter channel `pid-cite` alongside
`pid-selection` (`src/canvas/interactions.ts:494`), in amber/dashed, driven by a
small store slice `highlight: { ids, tone }`. ~30 lines mirroring `syncSelection`.

The assistant **never calls `setSelection`**. Selection is the user's pointer;
`interactions.ts:296` uses it for real editing gestures, and taking it
mid-conversation destroys the context the answer was about. The assistant may
*propose* "select these".

Every answer carries a **focus set** distinct from its inline citations, rendered
as "Show on drawing" — highlights the whole set and fits the view to its bounding
box. When `focusOrder` is true (causal chains like PT-101 → PIC-101 → PV-101) it
flashes them in sequence, which is more legible than the prose and costs an array
of ids.

## 11. Ghost preview

Feasible, and built. The naive approach fails for a known reason: `reconcile`
ends with a sweep removing every cell not backed by the document
(`src/canvas/reconciler.ts:65-68`), so ghost *cells* die on the next store change.

But the app never needed cells for overlays. Four working precedents create raw
SVG inside `.joint-layers` — the group carrying the pan/zoom transform, so the
overlay sits on the sheet, not the viewport: `renderSheet`
(`src/canvas/paperSetup.ts:66`), `renderUnderlay` (`src/canvas/underlay.ts:15`),
`showDockHint` (`src/canvas/autoConnect.ts:158`), and the alignment guides
(`src/canvas/interactions.ts:326`). All are `pointer-events: none`, all invisible
to the reconciler, all survive every store update.

Geometry is free: `SymbolDef.render(cfg)` returns SVG
(`src/symbols/types.ts:42`), which is what `markupFor` already feeds JointJS. A
`renderGhosts(paper, proposed)` calls the same renderer at the same `dimsFor` box
and gets pixel-identical geometry at `opacity: .45`, dashed. Deletions get a red
halo rect at `cell.getBBox()`.

**Two non-negotiable details:**

- **Add `.pid-ghost` to the export strip list** (`src/export/svg.ts:60-69`,
  alongside `.pid-underlay` and `.pid-sheet`). Miss this and a *rejected*
  proposal ships inside a delivered SVG or PDF. That is the worst bug this
  feature can have.
- Ghosts never enter `doc`, so autosave and cloud sync cannot see them. That
  falls out for free, which is how we know the design is right.

## 12. Transport

```ts
// src/assist/transport/types.ts
export interface AssistTransport {
  readonly id: string
  readonly label: string
  /** Mirrors firebaseReady (src/auth/config.ts:38): the UI asks before offering. */
  isConfigured(): boolean
  send(req: AssistRequest, signal: AbortSignal): AsyncIterable<AssistEvent>
}
```

`send` yields **provider-neutral events**, never raw SSE. All wire-format
knowledge is confined behind the iterator, so swapping BYOK for a hosted proxy is
one line in `pickTransport()`. Degrades the way the rest of the app does
(`src/auth/config.ts:33-40`): key present → BYOK; else `firebaseReady` → proxy;
else the panel says the assistant isn't configured and the app is untouched.

## 13. UI placement

**A dock in the existing right column, mutually exclusive with the property
panel, switched by a segmented control above it.**

Rejected, with reasons:

- **A 5th rail workspace** is disqualified by code, not taste. Every non-`draw`
  workspace unmounts `<App/>` (`src/EditorRoot.tsx:35-43`), which unmounts
  `<Canvas/>`, whose cleanup calls `paper.remove()` (`src/canvas/Canvas.tsx:191`).
  **A rail workspace and a ghost preview are mutually exclusive.**
- **The command-palette overlay** dims and blocks the whole app
  (`src/app.css:191`) and closes on any outside click
  (`src/panels/CommandPalette.tsx:121`). Ctrl+K should *summon* the dock and get
  out of the way — reuse the entry point, not the container.
- **The Drawer** is `max-height: 190px; flex: none` (`src/app.css:139`) and
  horizontal; a conversation with consent cards and diff tables is vertical. A
  third tab also re-creates the three-overlapping-lists problem plan §3.4
  deliberately collapsed into two.
- **A floating panel** covers the canvas — exactly the region the ghost preview
  needs — and there is no floating-window infrastructure here.

Column arithmetic decides the rest: rail 60 + palette 236 + props 288 + a new
320px dock = 904px of chrome, leaving 376px of canvas on a 1280 laptop
(`src/app.css:30-43`). Sharing the 288px props column costs **zero** new pixels
and inherits the collapse strip that already exists. Both are right-hand
inspectors, and while reading a consent card you are not editing a property field.

The toolbar earns exactly **one** control — an icon toggle at the existing 26px
geometry. Everything else lives in the dock and on Ctrl+K.

## 14. Privacy and licensing

**Two published claims break the moment this ships and must be rewritten in the
same release:**

- `SECURITY.md:31` — *"There is no backend, no account system, and no server that
  stores user data"* (already stale since v0.13 accounts; decisively false once
  drawing content reaches an inference API).
- `README.md:106` — *"Works offline — the whole editor runs with no internet."*
  The assistant must therefore degrade to **absent** — no entry point, no error
  toast.

**Consent before the first request:** a one-time modal at first use, not at boot,
using the existing `src/panels/Modal.tsx`. Two checkboxes, not one — *"I
understand my drawing content is sent to \<provider\>"* and *"I am authorised to
send this drawing outside my organisation."* The second matters: the users are
consultants and EPC staff whose drawings are frequently under NDA.

**The assistant sends a projection, never `doc`.** Excluded by default:
`doc.meta.author` and the account email · `doc.customSymbols` (the user's own SVG
IP) · `sheet.underlay` (a DXF underlay is almost always *someone else's* drawing
— the single highest-risk field in the document) · `doc.budget` and `node.cost` ·
`cloudId`.

The control is not a policy document, it is a test: build the projection as an
**explicit allowlist** with a vitest that enumerates `ProjectDoc`'s keys and
**fails when a new field appears unclassified**. That single test is the entire
privacy mechanism; everything else is documentation.

**Key ownership: BYO, stored in the browser, never in `doc` or Firestore.** A
project-owned key would make the maintainer pay for commercial users' inference —
precisely the use `COMMERCIAL-LICENSE.md` says is not free — and turn the demo
deployment into a free commercial service. The existing env mechanism cannot be
reused: `.env.example` states plainly that the Firebase config ships in the
client bundle and is not a secret. An LLM key emphatically is.

Consequence to accept openly: **a BYO-key assistant is community tier by
construction and monetises nothing.** Per plan §7.4 the enforceable boundary is
the service, so the paid version is the hosted proxy with entitlement checked
server-side. Both can coexist; the transport interface (§12) keeps that door open.

## 15. Testing

Nothing about consent, diffs, ghosts, undo grouping, or redaction needs an LLM —
that is the point of the architecture. One interface, one method, everything else
deterministic. Production is HTTP; tests get a `ScriptedTransport` fed fixture
turns.

Vitest, following `tests/store/budget.test.ts:9`'s existing setup pattern:

- Every tool against the real store, positive and negative.
- **The redaction allowlist test** that fails on a new unclassified `ProjectDoc`
  field — the most valuable single test in the feature.
- Diff builder: tool args + doc → expected rows, no model involved.
- **Undo grouping:** apply a fix, assert `temporal.getState().pastStates.length`
  grew by exactly 1, assert one `undo()` restores the prior doc.
- Denial: a scripted transcript where a tool is denied; assert `doc` identity is
  unchanged and the reason reached the next turn.
- **The critical negative test:** a transcript where the model is denied and then
  asserts the fact anyway. The assertion is that the grounding validator
  *rejects the message* — not that the prose looks plausible. This encodes "may
  only assert facts a tool returned."

Playwright via `window.__pid` (`src/main.tsx:52`) plus a dev-only transport seam
guarded by `import.meta.env.DEV`, the same technique as the `pid.dev.skipAuth`
bypass (`src/EditorRoot.tsx:91`). Assert: card renders the right diff · Deny
leaves `doc` identity unchanged · one Ctrl+Z reverts a fix · `.pid-ghost` exists
before approval and is gone after · **and never appears in `exportSvg()` output**.

Golden transcripts under `tests/fixtures/assistant/`, per plan §7.5. Recorded
once, replayed forever, re-recorded deliberately and reviewed like code. One live
smoke test behind an env var, never in CI.

## 16. Sequencing

| Release | Ships | Standalone value |
|---|---|---|
| **v0.17.0** | The QA engine (index, rules, engine, ignores — largely built already, see §1), the fix-representation change (§5), and the five bug fixes below | 21 rules with auditable ignores; cross-sheet selection finally works; engineering records stop being stranded; validation walks the document once instead of three times |
| **v0.18.0** | Assistant v1 — brief, template layer, 6 read tools, 3 fixes, grounding validator, consent, ghosts, dock, BYOK | "The Advisor you can talk to" |
| **v0.19.0+** | The remaining QA rules (plan §4.2), the other 7 fixes, destructive tools with blast-radius cards, hosted proxy | — |

### The five bugs, landing in v0.17.0

1. **`setTag` discards the `collision` flag.** `retagRegistry` returns
   `{ registry, collision }` (`src/model/registry.ts:95`) — the flag exists
   because *"silently merging two engineering records is unrecoverable"* — but
   `setTag` destructures only `registry` (`src/store/store.ts:326`). Retag onto an
   occupied tag and the record is silently stranded.
2. **Cross-sheet selection is invisible.** `LoopPanel` selects project-wide ids
   (`src/panels/LoopPanel.tsx:22`); `syncSelection` only iterates the active
   sheet's cells (`src/canvas/interactions.ts:495`).
3. **`PropertyPanel` can't inspect an off-sheet selection** — it looks the id up
   only in `activeSheet` (`src/panels/PropertyPanel.tsx:293`). Same root cause.
4. **`applyFix` returns `void`** and silently no-ops (`src/assist/fixes.ts:31`).
   Must return `{ ok, changedIds, message }`.
5. **`locateCell` can't cross sheets**, so `AdvisorPanel` works around it with
   `setTimeout(…, 50)` (`src/panels/AdvisorPanel.tsx:39`). Give it a `sheetId`
   parameter that switches and retries on the next reconcile tick.

Bugs 2, 3 and 5 are **prerequisites** for the user's "highlight the selected
loop" requirement, not incidental cleanup.

The first implementation plan covers **v0.17.0 only**. v0.18.0 gets its own plan
once the foundations are on `main` and `buildIndex`'s shape has settled — the
selection brief is a projection of it, and specifying that projection against an
unbuilt index is how the two drift.

## 17. Out of scope

Stated as decisions so they are not relitigated.

| Not this | Why |
|---|---|
| A generic `applyPatch` / `setDoc` tool | A typed boundary with one generic tool is not a boundary |
| Assistant access to `loadIntoStore`, export, cloud sync, or account | Clears undo history and unlinks the cloud drawing (`src/store/store.ts:650`) |
| Destructive tools in v1 | Consent cards for deletion are the ones we would get wrong first, and getting them wrong once costs the trust the whole feature runs on |
| Autonomous or background runs | Nothing acts without a human in the foreground |
| "Auto-fix all findings" as one button | The unit of consent is one `FixSpec`. Seven fixes is seven dialogs or a reviewed multi-select list |
| Assistant-driven tag renumbering | Plan §9: *"Silently rewriting engineering identities is the fastest way to lose a user's trust"* |
| Persisted always-allow | A permission granted in a context nobody remembers is how manual mode silently becomes auto mode |
| Selections larger than 8 objects reasoned over individually | Aggregate counts only |
| Cross-sheet loop reasoning before bugs 2/3 are fixed | Highlighting half a loop and silently hiding the rest is worse than declining |
| Hazard analysis, relief sizing, SIS/trip logic | Questions 5, 7, 18. An assistant that answers these fluently is a professional liability |
| HMI tools | An entire second surface with no v1 value |
| Conversation memory across sessions | — |
| The word "prediction" | Replaced by two mechanical predictors that need no model: typical-completion from `TYPICALS`, and finding-delta against a hypothetical finished state. Both are what the user actually asked for |

---

*Grounded in an audit of IPD Studio v0.16.0 at `be431e9`, with figures measured
against `examples/sample-refinery-unit.pnid.json`.*
