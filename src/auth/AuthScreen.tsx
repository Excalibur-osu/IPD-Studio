// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import AuthForm from './AuthForm'
import { navigate } from '../routes'
import './authScreen.css'

/** Stands in front of the editor. IPD Studio requires an account, so this is
 *  the first thing most people see — it carries the product's name and what it
 *  is, not just a bare form on an empty page. */
export default function AuthScreen() {
  return (
    <div className="gate">
      <div className="gate-panel">
        <div className="gate-brand">
          <button type="button" className="gate-home" onClick={() => navigate('/')}>
            ← IPD Studio
          </button>
          <h1>Sign in to keep drawing</h1>
          <p>
            Your P&amp;IDs, HMI screens and cost estimates live in your account, so they open on
            whatever machine you sit down at.
          </p>
          <ul className="gate-points">
            <li>ISA-5.1 tags parsed and validated as you draw</li>
            <li>Instrument index and line list generated from the model</li>
            <li>Operator screens you can run as a live simulation</li>
          </ul>
        </div>

        <div className="gate-form">
          <AuthForm onDone={() => { /* the auth listener swaps this screen for the editor */ }} />
        </div>
      </div>
    </div>
  )
}
