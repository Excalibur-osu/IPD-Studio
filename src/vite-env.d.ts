/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected by Vite from package.json. */
declare const __APP_VERSION__: string

/** Firebase web config. All optional: a build without them runs fully local,
 *  with accounts and cloud drawings switched off (see src/auth/firebase.ts). */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
