// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { create } from 'zustand'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export interface AuthState {
  user: User | null
  /** False until Firebase has answered once. Without it the UI cannot tell
   *  "still checking the session" from "definitely signed out", and every
   *  reload flashes the signed-out chrome at a signed-in user. */
  ready: boolean
}

export const useAuthStore = create<AuthState>()(() => ({ user: null, ready: false }))

/** Subscribe to session changes; returns the unsubscribe for effect cleanup. */
export function initAuth(): () => void {
  return onAuthStateChanged(
    auth(),
    (user) => useAuthStore.setState({ user, ready: true }),
    () => useAuthStore.setState({ user: null, ready: true }),
  )
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email.trim(), password)
}

export async function register(email: string, password: string, displayName?: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password)
  const name = displayName?.trim()
  if (name) {
    await updateProfile(cred.user, { displayName: name })
    // A profile edit does not re-fire onAuthStateChanged, so push the fresh
    // user through by hand or the greeting shows an empty name until reload.
    useAuthStore.setState({ user: auth().currentUser })
  }
  // Best effort: a bounced verification email must not cost someone the
  // account they just created — they are signed in either way.
  try {
    await sendEmailVerification(cred.user)
  } catch {
    // ignored on purpose
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth(), new GoogleAuthProvider())
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email.trim())
}

export async function signOutUser(): Promise<void> {
  await signOut(auth())
}
