# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.13.x (current) | ✅ Security fixes |
| ≤ 0.12.x | ❌ Not supported — please upgrade |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via either:

- **GitHub Security Advisories** — [report a vulnerability](https://github.com/Coldbari/IPD-Studio/security/advisories/new)
  (preferred; keeps the discussion private until a fix ships)
- **Email** — praharshchamp610@gmail.com with `SECURITY` in the subject

Please include: what you found, how to reproduce it, the affected version, and
the impact as you see it. A proof-of-concept `.pnid.json` or SVG file is ideal.

**Response:** initial acknowledgement within 72 hours, an assessment within 7
days, and a fix or a documented mitigation for confirmed issues before public
disclosure. Please allow 90 days before disclosing publicly. Reporters are
credited in the advisory and the changelog unless they prefer otherwise.

## Threat model

IPD Studio is a **local-first, client-side browser application**. There is no
backend, no account system, and no server that stores user data — drawings live
in the browser's IndexedDB and in files on the user's own machine. That removes
most of the usual server-side attack surface and concentrates risk in what the
app *parses*.

**In scope — the app parses untrusted files, and that's where the risk is:**

- **Imported SVG symbols** — sanitized by `src/import/svgSymbol.ts`, which
  strips scripts, event handlers, and external references. Any bypass of that
  sanitizer (XSS via a crafted symbol) is a genuine vulnerability and the
  highest-value thing to look for.
- **`.pnid.json` project files** — prototype pollution, or a crafted document
  that achieves script execution when rendered
- **DEXPI/Proteus XML import** — XXE, entity expansion, parser abuse
- **DXF underlay import** — parser crashes, memory exhaustion, injection into
  rendered output
- **Service worker / PWA caching** — cache poisoning, stale-content attacks
- Dependency vulnerabilities reachable from the shipped bundle

**Out of scope:**

- Anything requiring the attacker to already control the user's machine or
  browser profile
- Self-XSS a user must deliberately perform on themselves
- Missing hardening headers on the demo deployment with no demonstrated impact
- Denial of service via absurdly large files the user chose to open
- Reports from automated scanners with no working proof of concept
- **Licence violations** — real, but not security. Those go to
  [docs/LICENSE-ENFORCEMENT.md](docs/LICENSE-ENFORCEMENT.md).

## Safety notice

HMI Studio is a **training and demonstration simulator**. It is not certified
for, and must never be connected to, real plant control, safety instrumented
systems, or live process equipment. Drawings and calculations it produces are
engineering aids that require review by a qualified engineer — they are not
approved-for-construction deliverables.

## Researching under the licence

The licence is PolyForm Noncommercial 1.0.0, which explicitly permits use for
**research, experiment, and testing**. Security research on IPD Studio is
welcome and needs no separate permission. Please test against your own local
build rather than the shared demo deployment.
