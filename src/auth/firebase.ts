// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { firebaseConfig, firebaseReady } from './config'

export { firebaseConfig, firebaseReady }

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

/** Lazily created so nothing pays for Firebase until a visitor actually signs
 *  in or opens their cloud drawings. Firestore deliberately lives in
 *  `cloud/firestore.ts` — it is the larger half of the SDK and only the
 *  cloud-drawings feature needs it. */
export function firebaseApp(): FirebaseApp {
  if (!firebaseReady) {
    throw new Error(
      'No Firebase project is configured, so accounts and cloud drawings are off. ' +
        'Copy .env.example to .env.local and fill in your own Firebase web config to enable them.',
    )
  }
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export function auth(): Auth {
  if (!authInstance) authInstance = getAuth(firebaseApp())
  return authInstance
}
