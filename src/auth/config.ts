// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * Which Firebase project this build talks to — read from the environment, with
 * NO built-in fallback.
 *
 * A Firebase web config is not a secret: it identifies a project to the client
 * and ships in the bundle by design, with access enforced by `firestore.rules`
 * and the Auth authorized-domains list. The reason it is env-only is different.
 * A hardcoded default would be INHERITED BY EVERY FORK, so a fork's users would
 * silently sign into the upstream project — real accounts and real drawings
 * landing in a stranger's Firestore, against their quota. Absent config is the
 * safe default; `firebaseReady` turns the whole account layer off instead.
 *
 * Deliberately free of `firebase/*` imports so anything can ask "is there a
 * backend?" without pulling the SDK into its chunk.
 *
 * Copy `.env.example` to `.env.local` to enable accounts.
 */
const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/**
 * Whether this build has a backend at all. False in a fork with no
 * `.env.local`, and in CI. Everything account-shaped — the sign-in gate, the
 * account menu, cloud drawings — checks this first; drawing never needed one.
 */
export const firebaseReady: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)
