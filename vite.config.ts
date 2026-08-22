/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PID Studio',
        short_name: 'PID Studio',
        description: 'Open-source intelligent P&ID editor',
        theme_color: '#2b6cb0',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        // Installed app claims .pnid files (double-click to open).
        file_handlers: [
          { action: '/', accept: { 'application/x-pnid': ['.pnid'] } },
        ],
      } as never,
      workbox: { maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
