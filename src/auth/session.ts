// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/** Firebase is only fetched once some part of the UI actually needs a session.
 *  The import is dynamic on purpose: a static one would pull the whole Firebase
 *  SDK into the entry chunk, so every homepage visitor would download the auth
 *  stack before reading a headline. Several components can ask independently;
 *  only the first one subscribes. */
let started = false

export function ensureAuth(): void {
  if (started) return
  started = true
  void import('./authStore').then((m) => m.initAuth())
}
