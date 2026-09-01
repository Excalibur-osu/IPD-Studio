import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    // pre-dismiss the first-run welcome overlay for every spec; the welcome
    // e2e opts back out with test.use({ storageState: ... empty })
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'pid.ui.welcomed', value: '1' },
            // The editor requires an account. Firebase keeps its session in
            // IndexedDB, which storageState cannot carry, so specs that are
            // testing the editor use the dev-only bypass instead of driving
            // the sign-in form 40 times. See devBypass() in EditorRoot.
            { name: 'pid.dev.skipAuth', value: '1' },
          ],
        },
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
