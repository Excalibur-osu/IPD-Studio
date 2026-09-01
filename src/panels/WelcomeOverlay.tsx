// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { useState } from 'react'
import Modal from './Modal'
import { useStore } from '../store/store'
import { loadDoc } from '../model/migrate'
import samplePlant from '../../examples/sample-plant.pnid.json'

const KEY = 'pid.ui.welcomed'
/** Streamed from the project site — 23 MB doesn't belong in the PWA bundle. */
const DEMO_URL = 'https://coldbari.github.io/IPD-Studio/media/demo-full.mp4'
const DEMO_POSTER = 'https://coldbari.github.io/IPD-Studio/media/editor.png'

const seen = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
const markSeen = (): void => {
  try { localStorage.setItem(KEY, '1') } catch { /* private mode */ }
}

/** First-visit welcome: the demo plays right here, ways in below. Shown once. */
export default function WelcomeOverlay() {
  const [open, setOpen] = useState(() => !seen())
  if (!open) return null
  const close = () => { markSeen(); setOpen(false) }
  return (
    <Modal title="Welcome to IPD Studio 👋" onClose={close} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13, color: '#556', margin: 0 }}>
          P&ID drawing with real ISA symbols — and an HMI simulator that
          brings your plant to life. Free for personal, academic, and nonprofit
          use. Here's 2½ minutes of it:
        </p>
        <video
          data-testid="welcome-video"
          src={DEMO_URL}
          poster={DEMO_POSTER}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', borderRadius: 6, background: '#0d1220', border: '1px solid #d5d5d5' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button data-testid="welcome-sample" style={{ flex: 1, padding: '10px 12px' }}
            onClick={() => { useStore.getState().loadIntoStore(loadDoc(samplePlant)); close() }}>
            🏭 <strong>Open the sample plant</strong>
          </button>
          <button data-testid="welcome-blank" style={{ flex: 1, padding: '10px 12px' }} onClick={close}>
            ✏️ <strong>Start drawing</strong>
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#889', margin: 0 }}>
          Everything stays on your machine — no account, no upload.
        </p>
      </div>
    </Modal>
  )
}
