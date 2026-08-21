import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './app.css'
import { useStore } from './store/store'
import { canvasRef } from './canvas/paperSetup'

// Dev/e2e hook: drive the store from the console or Playwright.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__pid = { useStore, canvasRef }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
