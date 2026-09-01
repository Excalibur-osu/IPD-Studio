# Homepage, accounts, and cloud drawings — design

Date: 2026-08-31
Status: approved, in implementation
Target version: v0.13.0

## Problem

IPD Studio is a single-page editor served at `/`. There is no landing page, no
concept of a user, and drawings live only in the browser's IndexedDB or in a
file the user saves by hand. Someone who opens the app on a second machine
starts from nothing.

Three things are wanted:

1. A homepage that explains the product, styled after operonsolutions.com.
2. Registration and login.
3. Drawings saved to Firebase so a returning user finds their work.

## Decisions taken

| Decision | Choice |
|---|---|
| Anonymous access | Editor stays fully usable with no account. Sign-in only adds cloud drawings. |
| Routing | Homepage at `/`, editor at `/app`. |
| Storage | One Firestore document per drawing, doc JSON stored as a string field. |
| Sign-in methods | Email + password, and Google. |
| Out of scope | Teams, sharing, public links, real-time collaboration, thumbnails, billing. |

## Licensing context

The working tree is mid-migration from AGPL-3.0-only to **PolyForm
Noncommercial 1.0.0** (v0.13.0), with a paid commercial license alongside. The
homepage copy must reflect this: *source-available, free for noncommercial use,
commercial use requires a license.* It must not say "open source" or "AGPL".

Every new source file carries the project's SPDX header.

## Architecture

### Routing — `src/routes.ts`

No router dependency; three routes do not justify one. Firebase Hosting already
rewrites `**` to `index.html`, so real paths work.

- `useRoute()` — reads `location.pathname`, subscribes to `popstate`.
- `navigate(path)` — `history.pushState` + notify.

`main.tsx` renders `Home` at `/` and lazy-loads the editor at `/app`. Today
every visitor downloads JointJS, the symbol catalog and the HMI simulator
before reading a headline; after the split the homepage ships a small bundle
and the editor loads on demand.

Editor-only side effects (autosave restore, `launchQueue` file handling) move
out of `main.tsx` into the editor route so they do not run for visitors.

PWA `start_url` and the `.pnid` `file_handlers` action move from `/` to `/app`.

### Homepage — `src/home/`

Operon's section order, IPD Studio's existing dark palette (`#0d1220` ground,
`#4da3ff` accent, taken from `docs/index.html`).

1. Nav — logo, Features, HMI Studio, Licensing, Docs, GitHub; Sign in; Open the editor
2. Hero — headline, subhead, dual CTA, editor screenshot
3. Three claims — validated ISA tags, loops derive themselves, deliverables generated
4. Features 01–04 — P&ID editor, HMI Studio, budget estimator, open deliverables
5. The layer underneath — versioned open JSON mapping onto DEXPI
6. Use-case grid — six cards
7. Your drawings stay yours — local-first by default, cloud opt-in, licensing
8. Final CTA
9. Footer

Media: the three PNGs from `docs/media/` are copied to `public/media/` and lazy
loaded below the fold. The 7.6 MB GIF and 23.8 MB MP4 stay out of the hosted
bundle; the video is linked to its GitHub Pages copy.

### Auth — `src/auth/`

- `firebase.ts` — app init, exports `auth` and `db`.
- `authStore.ts` — zustand slice fed by `onAuthStateChanged`; `user | null`, `ready`.
- `AuthDialog.tsx` — sign in / register tabs, password reset, Google button, built on the existing `Modal`.
- `errors.ts` — Firebase error codes mapped to readable sentences.

The Firebase web config is committed, not held as a secret. It is public by
design; CI builds with no secrets, and access is controlled by authorized
domains plus security rules.

### Cloud drawings — `src/cloud/`

Collection `users/{uid}/drawings/{drawingId}`:

| Field | Type | Purpose |
|---|---|---|
| `name` | string | list view without downloading the drawing |
| `doc` | string | the whole `ProjectDoc` as JSON |
| `sheetCount` | number | list view detail |
| `sizeBytes` | number | quota feedback |
| `createdAt` / `updatedAt` | timestamp | ordering, conflict detection |

**Why `doc` is a string, not a map.** Firestore rejects nested arrays, and
`Sheet.underlay.polylines` is `{x,y}[][]` — an array directly containing
arrays. Writing the document as a map throws at runtime as soon as a DXF
underlay is present. Serialising with the existing `serializeDoc` sidesteps
that and `undefined`-valued fields, and makes the size check trivial.

- `sync.ts` — `saveToCloud`, `loadFromCloud`, `listDrawings`, `renameDrawing`, `deleteDrawing`. Refuses above ~900 KB with a message naming the DXF underlay as the usual cause.
- `CloudDialog.tsx` — "My drawings": open, rename, delete, save as new.
- Cloud autosave is debounced and runs only once a drawing has a `cloudId`.
- Local IndexedDB autosave is unchanged; it remains the offline safety net.
- Conflicts: last write wins, with a warning when the remote `updatedAt` has
  moved since load. No merge.

`firestore.rules`: owner-only read and write, plus a server-side size cap.

## Consequences

- All 10 e2e specs navigate to `/`; they move to `/app`.
- README's "no backend, no account, no upload" becomes "local-first by default, cloud optional".
- `firebase.json` gains a `firestore` block.
- Firebase console needs Email/Password and Google providers enabled and a
  Firestore database created.

## Testing

- Unit (vitest, Firebase mocked): route matching and navigation, cloud
  document shape and size guard, round-trip of a doc containing a DXF
  underlay, auth error mapping, drawing metadata derivation.
- E2E (Playwright): homepage renders and its CTA reaches the editor; the
  editor still works anonymously at `/app`.
- No test performs live network calls.
