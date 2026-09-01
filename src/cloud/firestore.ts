// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseApp } from '../auth/firebase'

/** Kept out of `auth/firebase.ts` deliberately: Firestore is the larger half of
 *  the SDK, and only the cloud-drawings feature needs it. Signing in should not
 *  make anyone download it. */
let dbInstance: Firestore | null = null

export function db(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(firebaseApp())
  return dbInstance
}
