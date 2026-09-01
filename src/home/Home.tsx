// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { VersionBanner } from '../panels/VersionNote'
import UpdateToast from '../panels/UpdateToast'
import './home.css'

const REPO = 'https://github.com/Coldbari/IPD-Studio'
const DEMO = 'https://coldbari.github.io/IPD-Studio/'
const LICENCE = `${REPO}/blob/main/COMMERCIAL-LICENSE.md`
const DOCS = `${REPO}/tree/main/docs`
const EMAIL = 'praharshchamp610@gmail.com'

export default function Home({
  onSignIn,
  onOpenEditor,
}: {
  onSignIn(): void
  onOpenEditor(): void
}) {
  return (
    <div className="home">
      <a className="skip" href="#main">Skip to content</a>

      <VersionBanner />

      <header className="bar">
        <span className="wordmark">IPD Studio</span>
        <nav className="bar-nav" aria-label="Sections">
          <a href="#what">What it does</a>
          <a href="#hmi">HMI Studio</a>
          <a href="#licence">Licence</a>
          <a href={DOCS} target="_blank" rel="noreferrer">Docs</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="bar-actions">
          <button type="button" className="link" onClick={onSignIn}>Sign in</button>
          <button type="button" className="btn" onClick={onOpenEditor}>Open the editor</button>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <h1>A P&amp;ID is a database that happens to look like a drawing.</h1>
          <p>
            Draw with real ISA-5.1 symbols and the tags mean something. Type <code>FT-101</code> and
            IPD Studio knows it is a flow transmitter on loop 101, checks it against the letter
            tables, and builds your instrument index and line list from the model instead of asking
            you to type them twice.
          </p>
          <p className="actions">
            <button type="button" className="btn btn-lg" onClick={onOpenEditor}>Open the editor</button>
            <a className="btn btn-lg btn-quiet" href={DEMO} target="_blank" rel="noreferrer">Watch the demo</a>
          </p>
          <p className="note">Runs in the browser. Nothing to install — create a free account and start drawing.</p>
        </section>

        <figure className="shot">
          <img src="/media/editor.png" alt="The IPD Studio editor: symbol palette on the left, a tagged P&ID on an A3 sheet, properties on the right" width={1600} height={1000} />
        </figure>

        <section id="what" className="what">
          <h2>What it does</h2>
          <div className="cols">
            <div>
              <h3>Tags that are read, not just drawn</h3>
              <p>
                Every tag is parsed against the ISA-5.1 letter tables. Loop numbers auto-assign per
                type, duplicates are flagged as you work, and control loops fall out of the tags on
                their own.
              </p>
            </div>
            <div>
              <h3>Deliverables from the model</h3>
              <p>
                Instrument index, line list, datasheets and loop diagrams are generated from the
                document, so they cannot drift from the drawing. Export DEXPI, DXF, PDF or CSV.
              </p>
            </div>
            <div>
              <h3>Costs while you draw</h3>
              <p>
                Components carry budgetary prices, so the estimate moves as the drawing does, with
                installed-cost factors and a warning when you pass the budget you set.
              </p>
            </div>
          </div>
        </section>

        <section id="hmi" className="hmi">
          <div className="hmi-copy">
            <h2>Then run the plant you drew</h2>
            <p>
              One click turns the P&amp;ID into an operator screen. PI loops wire themselves from
              your tags, ISA-18.2 alarms carry priorities and shelving, trends plot against a real
              time axis, and you can trip a pump or stick a valve to see what the trainee does.
            </p>
          </div>
          <figure className="shot shot-inline">
            <img src="/media/hmi.png" alt="The same plant as an operator screen, with tanks, pumps, valves and live displays" loading="lazy" width={1600} height={1000} />
          </figure>
        </section>

        <section id="licence" className="licence">
          <h2>Licence</h2>
          <p className="lede">
            IPD Studio is source-available under PolyForm Noncommercial 1.0.0 — not open source. You
            can read the code, learn from it and verify what it does. Commercial use is a paid
            licence, and that licence is what keeps it free for everyone in the first column.
          </p>
          <div className="cols">
            <div>
              <h3>Free, no permission needed</h3>
              <ul>
                <li>Personal use, study and hobby projects</li>
                <li>Students and coursework</li>
                <li>Universities, schools and labs</li>
                <li>Charities and public research bodies</li>
                <li>Government institutions</li>
              </ul>
            </div>
            <div>
              <h3>Needs a paid licence</h3>
              <ul>
                <li>Use by or for a for-profit company, including internally</li>
                <li>P&amp;IDs drawn for paid client or consulting work</li>
                <li>Paid operator training delivered with HMI Studio</li>
                <li>Embedding, hosting or reselling IPD Studio</li>
              </ul>
              <p>
                <a href={LICENCE} target="_blank" rel="noreferrer">Read the commercial licence</a> or
                email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
              </p>
            </div>
          </div>
        </section>

        <section className="last">
          <h2>Start drawing</h2>
          <p>Free for personal, academic, nonprofit and government use. Your drawings stay private to your account.</p>
          <button type="button" className="btn btn-lg" onClick={onOpenEditor}>Open the editor</button>
        </section>
      </main>

      {/* A drawing sheet ends in a title block; so does this page. */}
      <footer className="block">
        <dl>
          <div><dt>Drawing</dt><dd>IPD Studio — intelligent P&amp;ID editor</dd></div>
          <div><dt>Rev</dt><dd>{__APP_VERSION__}</dd></div>
          <div><dt>Licence</dt><dd><a href={LICENCE} target="_blank" rel="noreferrer">PolyForm Noncommercial 1.0.0</a></dd></div>
          <div><dt>Drawn by</dt><dd>Praharsh Nagpure</dd></div>
          <div><dt>Source</dt><dd><a href={REPO} target="_blank" rel="noreferrer">github.com/Coldbari/IPD-Studio</a></dd></div>
          <div><dt>Contact</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
        </dl>
      </footer>
      <UpdateToast />
    </div>
  )
}
