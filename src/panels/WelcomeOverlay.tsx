import { useState } from 'react'
import Modal from './Modal'
import { useStore } from '../store/store'
import { loadDoc } from '../model/migrate'
import samplePlant from '../../examples/sample-plant.pnid.json'

const KEY = 'pid.ui.welcomed'

const seen = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
const markSeen = (): void => {
  try { localStorage.setItem(KEY, '1') } catch { /* private mode */ }
}

/** First-visit welcome: three ways in, shown once per browser. */
export default function WelcomeOverlay() {
  const [open, setOpen] = useState(() => !seen())
  if (!open) return null
  const close = () => { markSeen(); setOpen(false) }
  return (
    <Modal title="Welcome to IPD Studio 👋" onClose={close} width={430}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13, color: '#556', margin: 0 }}>
          Free, open-source P&ID drawing with real ISA symbols — and an HMI
          simulator that brings your plant to life. Pick a starting point:
        </p>
        <button data-testid="welcome-sample" style={{ padding: '10px 12px', textAlign: 'left' }}
          onClick={() => { useStore.getState().loadIntoStore(loadDoc(samplePlant)); close() }}>
          🏭 <strong>Open the sample plant</strong> — a tagged, wired unit to explore
        </button>
        <a href="https://github.com/Coldbari/IPD-Studio/blob/main/docs/media/demo-full.mp4"
          target="_blank" rel="noreferrer" onClick={close}
          style={{ padding: '10px 12px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', textDecoration: 'none', color: 'inherit' }}>
          ▶ <strong>Watch the 2½-minute demo</strong> — drawing to running HMI
        </a>
        <button data-testid="welcome-blank" style={{ padding: '10px 12px', textAlign: 'left' }} onClick={close}>
          ✏️ <strong>Start drawing</strong> — blank sheet, symbols on the left
        </button>
        <p style={{ fontSize: 11, color: '#889', margin: 0 }}>
          Everything stays on your machine — no account, no upload.
        </p>
      </div>
    </Modal>
  )
}
