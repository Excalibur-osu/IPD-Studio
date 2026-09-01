/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const LICENSE_BANNER = `/*! @license IPD Studio v${pkg.version} | Copyright (c) 2026 Praharsh Nagpure
 * PolyForm Noncommercial 1.0.0 - NONCOMMERCIAL USE ONLY.
 * Commercial use (incl. internal use at a for-profit company) requires a paid
 * license: praharshchamp610@gmail.com | https://github.com/Coldbari/IPD-Studio
 */
`

/**
 * Stamps the license banner onto every emitted JS chunk.
 *
 * `build.rollupOptions.output.banner` is silently dropped by rolldown, and a
 * source-level comment would be stripped by the minifier, so this runs at
 * `generateBundle` - after rendering and minification - which is the only
 * point the text is guaranteed to survive into dist/. The banner is what
 * dates a copy during license enforcement (docs/LICENSE-ENFORCEMENT.md).
 */
function licenseBanner(): Plugin {
  return {
    name: 'ipd-license-banner',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') chunk.code = LICENSE_BANNER + chunk.code
      }
    },
  }
}

export default defineConfig({
  // The version is shown in the app so people can tell at a glance whether
  // they are on the build that has the fix they were told about.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    licenseBanner(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'IPD Studio',
        short_name: 'IPD Studio',
        description: 'Intelligent P&ID editor and HMI training simulator',
        // The installed app is the editor, not the marketing homepage at '/'.
        start_url: '/app',
        scope: '/',
        theme_color: '#2b6cb0',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        // Installed app claims .pnid files (double-click to open).
        file_handlers: [
          { action: '/app', accept: { 'application/x-pnid': ['.pnid'] } },
        ],
      } as never,
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Homepage screenshots are ~1.6 MB and the editor never shows them;
        // precaching them would tax every install for marketing artwork.
        globIgnores: ['**/media/**'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
