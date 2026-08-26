import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { openFile, saveFile } from '../persist/file'
import HistoryDialog from './HistoryDialog'
import { createEmptyDoc } from '../model/doc'
import { canvasRef, zoomAt } from '../canvas/paperSetup'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import type { LineClass } from '../model/types'
import ExportMenu from './ExportMenu'
import FluidsDialog from './FluidsDialog'
import templateBlank from '../../examples/template-blank-a3.pnid.json'
import templateUtility from '../../examples/template-utility-a1.pnid.json'
import { loadDoc } from '../model/migrate'
import { parseDxfUnderlay } from '../import/dxfUnderlay'
import { sheetPx } from '../model/doc'
import { activeSheet } from '../store/store'
import samplePlant from '../../examples/sample-plant.pnid.json'
import sampleRefinery from '../../examples/sample-refinery-unit.pnid.json'
import templateHmiDemo from '../../examples/template-hmi-demo.pnid.json'

function zoomCenter(factor: number) {
  const paper = canvasRef.paper
  if (!paper) return
  const el = paper.el as HTMLElement
  const rect = el.getBoundingClientRect()
  zoomAt(paper, rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
}

function zoomFit() {
  canvasRef.paper?.transformToFitContent({ padding: 40, minScale: 0.25, maxScale: 2, verticalAlign: 'middle', horizontalAlign: 'middle' })
}

export default function Toolbar({ onOpenHmi }: { onOpenHmi?: () => void } = {}) {
  const dirty = useStore((s) => s.dirty)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const activeLineClass = useStore((s) => s.activeLineClass)
  const setActiveLineClass = useStore((s) => s.setActiveLineClass)
  const name = useStore((s) => s.doc.meta.name)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [fluidsOpen, setFluidsOpen] = useState(false)

  useEffect(() => {
    const onSave = () => void saveFile()
    window.addEventListener('pid:save', onSave)
    return () => window.removeEventListener('pid:save', onSave)
  }, [])

  const newDoc = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    useStore.getState().loadIntoStore(createEmptyDoc())
  }

  return (
    <header className="toolbar">
      <strong className="app-name">IPD Studio</strong>
      <span className="doc-name">{name}{dirty ? ' •' : ''}</span>
      <span className="tb-sep" />
      <button onClick={newDoc}>New</button>
      <button onClick={() => void openFile()}>Open</button>
      <button onClick={() => void saveFile()}>Save</button>
      <button onClick={() => setHistoryOpen(true)} title="Restore an earlier snapshot">⏱</button>
      {historyOpen && <HistoryDialog onClose={() => setHistoryOpen(false)} />}
      <select
        className="tb-template"
        value=""
        onChange={(e) => {
          const pick = e.target.value
          if (!pick) return
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          const source = pick === 'sample' ? samplePlant : pick === 'refinery' ? sampleRefinery : pick === 'hmi-demo' ? templateHmiDemo : pick === 'blank' ? templateBlank : templateUtility
          useStore.getState().loadIntoStore(loadDoc(source))
        }}
      >
        <option value="">Templates…</option>
        <option value="sample">Sample plant</option>
        <option value="refinery">Refinery unit (3 sheets)</option>
        <option value="hmi-demo">HMI demo (tank level loop)</option>
        <option value="blank">Blank A3 drawing</option>
        <option value="utility">Utility headers (A1)</option>
      </select>
      <span className="tb-sep" />
      <button
        onClick={() => {
          const state = useStore.getState()
          const sheet = activeSheet(state)
          if (sheet.underlay) {
            if (window.confirm('Remove the DXF underlay from this sheet?')) state.setUnderlay(undefined)
            return
          }
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.dxf'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            try {
              const px = sheetPx(sheet.sheetSize)
              const { polylines, warnings } = parseDxfUnderlay(await file.text(), px)
              state.setUnderlay({ name: file.name, polylines })
              if (warnings.length) window.alert(`Underlay loaded with notes:\n${warnings.join('\n')}`)
            } catch (err) {
              window.alert(`Could not read DXF: ${(err as Error).message}`)
            }
          }
          input.click()
        }}
        title="Load a DXF as a locked trace-over background"
      >
        Underlay
      </button>
      <span className="tb-sep" />
      <button onClick={undo} title="Ctrl+Z">↩</button>
      <button onClick={redo} title="Ctrl+Y">↪</button>
      <span className="tb-sep" />
      <label className="tb-line">
        Draw:
        <select value={activeLineClass} onChange={(e) => setActiveLineClass(e.target.value as LineClass)}>
          {Object.entries(LINE_CLASS_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </label>
      <button data-testid="tb-fluids" onClick={() => setFluidsOpen(true)}
        title="Define fluids/services (Water, Steam…) — assign them to lines in the line's properties">
        Fluids
      </button>
      {fluidsOpen && <FluidsDialog onClose={() => setFluidsOpen(false)} />}
      <span className="tb-sep" />
      <button onClick={() => zoomCenter(1.2)}>＋</button>
      <button onClick={() => zoomCenter(1 / 1.2)}>－</button>
      <button onClick={zoomFit}>Fit</button>
      <span className="tb-sep" />
      <button onClick={onOpenHmi} title="Switch to the HMI workspace" data-testid="open-hmi">HMI ⇄</button>
      <span className="tb-grow" />
      <ExportMenu />
    </header>
  )
}
