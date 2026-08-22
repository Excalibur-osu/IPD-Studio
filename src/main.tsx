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

// Installed-PWA file handling: double-clicked .pnid files arrive here.
interface LaunchQueueWindow extends Window {
  launchQueue?: { setConsumer(cb: (params: { files: { getFile(): Promise<File> }[] }) => void): void }
}
;(window as LaunchQueueWindow).launchQueue?.setConsumer((params) => {
  void (async () => {
    const handle = params.files?.[0]
    if (!handle) return
    const file = await handle.getFile()
    const { loadAnyText } = await import('./persist/file')
    loadAnyText(file.name, await file.text())
  })()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
