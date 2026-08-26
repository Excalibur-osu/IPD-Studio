# Tracking copies & enforcing the AGPL (maintainer guide)

How to find out if someone took IPD Studio commercial without honoring the
AGPL or buying a commercial license — and what to do about it.

## 1. Fingerprints already in the code

These strings are distinctive enough that a copy almost certainly still
contains some of them, even after light rebranding. Search engines and
GitHub code search will find them in minified bundles too:

- `application/x-pnid` (the file MIME type)
- `.pnid` file extension + `schemaVersion` JSON shape
- `instr.bubble`, `comp.centrifugal`, `fit.pulsation-dampener` (symbol ids)
- `hmi-spin`, `hmi-blink`, `hmi-pulse` (CSS animation classes)
- `Training / demo simulation — not for operations` (HMI banner text)
- `pid-studio-praharsh` (if they forgot to change deploy configs)

## 2. Periodic searches (monthly, ~10 minutes)

- **GitHub code search:** search for
  [`application/x-pnid`](https://github.com/search?q=%22application%2Fx-pnid%22&type=code)
  and [`instr.bubble`](https://github.com/search?q=%22instr.bubble%22+%22hmi-spin%22&type=code)
  — anything outside `Coldbari/IPD-Studio` and its forks deserves a look.
  Forks themselves are fine (that's the license working); look for
  *detached* copies with the history stripped.
- **Google / Bing:** `"IPD Studio"`, `"P&ID editor" "hmi-spin"`,
  `intext:"application/x-pnid"`.
- **Google Alerts** (one-time setup at google.com/alerts): create alerts
  for `"IPD Studio"` and `"pnid" P&ID editor` — findings arrive by email.
- **npm:** search npm for republished packages containing the symbol
  library (`npm search pnid p&id`).

## 3. Checking a suspect commercial site

1. Open their app, view page source / the JS bundles (DevTools → Sources).
2. Search the bundles for the fingerprints above. Minification does not
   remove string literals.
3. If it's a hit and they modified the code: AGPL §13 requires them to
   offer their **complete corresponding source** to their users. No source
   offer → violation.

## 4. Escalation ladder (cheapest first)

1. **Friendly email** — most violations are ignorance. Point at
   `COMMERCIAL-LICENSE.md`; offer the paid license. This converts
   violators into customers.
2. **GitHub DMCA takedown** (if hosted on GitHub):
   https://github.com/contact/dmca — effective and free.
3. **Hosting provider abuse contact** (for non-GitHub hosting) — providers
   act on copyright complaints.
4. **Software Freedom Conservancy** (https://sfconservancy.org) — advises
   on AGPL enforcement, sometimes takes cases pro bono.
5. Lawyer letter — rarely needed; step 1 resolves most cases.

## 5. What NOT to do

- Don't add phone-home telemetry to detect copies — it would betray the
  local-first promise to legitimate users, and violators would strip it
  anyway. String fingerprints + search do the job.
- Don't demand more than the license grants: unmodified mirroring with the
  license intact, forks on GitHub, and internal company use are all
  **permitted** — enforcement is only for proprietary redistribution or
  unpublished modified hosting.
