import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './app.css'
import { useStore } from './store/store'
import { canvasRef } from './canvas/paperSetup'
import { startAutosave, restoreAutosave } from './persist/autosave'

// Dev/e2e hook: drive the store from the console or Playwright.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__pid = { useStore, canvasRef }
}

startAutosave()
void restoreAutosave().then((saved) => {
  if (saved && window.confirm(`Restore autosaved drawing “${saved.meta.name}”?`)) {
    useStore.getState().loadIntoStore(saved)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
