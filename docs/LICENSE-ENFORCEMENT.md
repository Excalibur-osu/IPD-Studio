# Tracking copies & enforcing the licence (maintainer guide)

How to find out if someone is using IPD Studio commercially without a paid
licence — and what to do about it.

Since v0.13.0 the licence is **PolyForm Noncommercial 1.0.0**. The line to
enforce is simpler than it was under the AGPL: **any commercial use at all
requires a paid licence.** You no longer have to prove they modified the code
or failed to publish source — commercial use *is* the violation.

## 0. Know what you're actually claiming

| Situation | Under AGPL (≤ v0.12.1) | Under PolyForm (≥ v0.13.0) |
|---|---|---|
| Company uses it internally, unmodified | Permitted | **Violation** |
| Consultant draws client P&IDs with it | Permitted | **Violation** |
| Paid training run on HMI Studio | Permitted | **Violation** |
| Hosted, modified, source published | Permitted | **Violation** |
| Student / university / NGO / govt use | Permitted | Permitted |

⚠️ **Anyone can still lawfully use v0.12.1 or earlier under the AGPL,
commercially.** Before sending any notice, establish *which version* they
have. Check their bundle for the `@license` banner (it carries the version) or
for post-0.13.0 features. Accusing someone over a legitimately AGPL-licensed
copy is the one mistake that costs you credibility.

## 1. Fingerprints already in the code

These strings are distinctive enough that a copy almost certainly still
contains some of them, even after light rebranding. Search engines and
GitHub code search find them in minified bundles too:

- `@license IPD Studio v` — the build banner, injected by `vite.config.ts`
  and preserved through minification. Its presence dates their copy.
- `SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0` — on all 137 source
  files. Present in any copy of the *source*; its deliberate removal is
  evidence of wilfulness, which matters for damages.
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
  Note the two pre-existing forks (`GonzaloMig`, `dk009dk`) hold perpetual
  AGPL rights to the code as it stood at fork time; they are not violations.
- **Google / Bing:** `"IPD Studio"`, `"P&ID editor" "hmi-spin"`,
  `intext:"application/x-pnid"`. Add `-github.com` to surface commercial sites.
- **Google Alerts** (one-time setup at google.com/alerts): alerts for
  `"IPD Studio"` and `"pnid" P&ID editor` — findings arrive by email.
- **npm:** search for republished packages containing the symbol library
  (`npm search pnid p&id`).
- **LinkedIn / job ads:** engineering consultancies naming the tool in
  service descriptions are the highest-value leads — they are commercial by
  definition and easy to convert.

## 3. Checking a suspect commercial site

1. Open their app, view page source / the JS bundles (DevTools → Sources).
2. Search the bundles for the fingerprints above. Minification does not
   remove string literals, and the `@license` banner is preserved by design.
3. **Establish the version.** The banner carries it. If it predates v0.13.0,
   they may be lawfully on the AGPL — check whether they are also *hosting a
   modified* copy without publishing source, which was the AGPL violation.
4. Screenshot and archive (web.archive.org) before contacting them. Evidence
   disappears the moment you send an email.

## 4. Escalation ladder (cheapest first)

1. **Friendly email** — most violations are genuine ignorance, and this
   licence is newer than the project. Point at `COMMERCIAL-LICENSE.md`, offer
   the paid licence, name a price. This converts violators into customers,
   which is the actual goal. Do not lead with legal threats.
2. **Formal notice.** PolyForm §Violations gives them **32 days** from written
   notice to come into full compliance, after which all their licences end
   automatically. Send it in writing, dated, and keep a copy — that clock is
   the strongest lever in the licence, and it only starts when you write.
3. **GitHub DMCA takedown** (if hosted on GitHub):
   https://github.com/contact/dmca — effective and free.
4. **Hosting provider abuse contact** (non-GitHub hosting) — providers act on
   copyright complaints.
5. Lawyer letter — rarely needed; step 1 resolves most cases.

Note: the Software Freedom Conservancy assists with *open-source* licence
enforcement and will **not** take PolyForm cases. That backstop went away with
the AGPL — enforcement is now on you.

## 5. What NOT to do

- **Don't accuse before checking the version.** A pre-0.13.0 copy used
  commercially is lawful. This is the one costly mistake.
- **Don't add phone-home telemetry to detect copies** — it would betray the
  local-first promise to legitimate users, and violators would strip it
  anyway. String fingerprints + search do the job.
- **Don't chase permitted users.** Students, universities, hospitals,
  charities, and government bodies are explicitly licensed, regardless of how
  they are funded. Leave them alone; they are the reason the licence exists in
  this shape.
- **Don't demand more than the licence grants.** Noncommercial forks, mirrors
  with the licence intact, and modifications for permitted purposes are all
  allowed.
