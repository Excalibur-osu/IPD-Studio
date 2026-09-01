// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

/**
 * Firebase auth codes read like stack traces ("Firebase: Error
 * (auth/invalid-credential)."). Users see these at the exact moment they are
 * least patient, so every sentence here says what happened and what to do
 * next, and none of them blame the person typing.
 */
export const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look quite right. Check it and try again.',
  'auth/user-disabled': 'This account is disabled. Get in touch if that seems wrong.',
  'auth/user-not-found': 'No account uses that email yet. Create one, or check the address.',
  'auth/wrong-password': 'That password does not match this account. Try again, or use Forgot password.',
  'auth/invalid-credential': 'That email and password do not match an account. Check both, or use Forgot password.',
  'auth/email-already-in-use': 'An account already uses that email. Sign in instead, or reset the password.',
  'auth/weak-password': 'Passwords need at least 6 characters. Pick a longer one.',
  'auth/too-many-requests': 'Too many attempts from this device. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Could not reach the sign-in server. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The Google window closed before sign-in finished. Try again when you are ready.',
  'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site, then try again.',
  'auth/cancelled-popup-request': 'Only one sign-in window can be open at a time. Use the one already open.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this project yet.',
  'auth/requires-recent-login': 'For safety this step needs a fresh sign-in. Sign out, sign back in, then try again.',
  'auth/missing-email': 'Enter your email address first.',
  'auth/missing-password': 'Enter your password to continue.',
  'auth/unauthorized-domain': 'Sign-in is not allowed from this address yet. Open the app from its usual URL.',
  'auth/account-exists-with-different-credential':
    'That email already signs in another way. Use the method you set up first, then link Google from your account.',
}

const GENERIC = 'Something went wrong while signing in. Try again in a moment.'

function readString(err: unknown, key: 'code' | 'message'): string {
  if (typeof err === 'object' && err !== null && key in err) {
    const value = (err as Record<string, unknown>)[key]
    if (typeof value === 'string') return value
  }
  return ''
}

/** A readable sentence for any auth failure: mapped code, then the raw
 *  message (SDK prefix stripped), then a generic apology. */
export function authErrorMessage(err: unknown): string {
  const mapped = AUTH_MESSAGES[readString(err, 'code')]
  if (mapped) return mapped
  const raw = readString(err, 'message').replace(/^Firebase:\s*/, '').trim()
  return raw || GENERIC
}
