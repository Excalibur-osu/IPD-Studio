import { useEffect } from 'react'
import { useStore } from '../store/store'
import { openFile, saveFile } from '../persist/file'
import { createEmptyDoc } from '../model/doc'
import { canvasRef, zoomAt } from '../canvas/paperSetup'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import type { LineClass } from '../model/types'
import { exportSvgFile } from '../export/svg'
import { printPdf } from '../export/printPdf'
import { printAllSheets } from '../export/printAll'
import { downloadInstrumentIndex, downloadLineList } from '../export/csv'
import { downloadDexpi } from '../export/dexpi'
import { downloadDxf } from '../export/dxf'
import { exportPng } from '../export/png'
import templateBlank from '../../examples/template-blank-a3.pnid.json'
import templateUtility from '../../examples/template-utility-a1.pnid.json'
import { loadDoc } from '../model/migrate'
import samplePlant from '../../examples/sample-plant.pnid.json'

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

export default function Toolbar() {
  const dirty = useStore((s) => s.dirty)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const activeLineClass = useStore((s) => s.activeLineClass)
  const setActiveLineClass = useStore((s) => s.setActiveLineClass)
  const name = useStore((s) => s.doc.meta.name)

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
      <strong className="app-name">PID Studio</strong>
      <span className="doc-name">{name}{dirty ? ' •' : ''}</span>
      <span className="tb-sep" />
      <button onClick={newDoc}>New</button>
      <button onClick={() => void openFile()}>Open</button>
      <button onClick={() => void saveFile()}>Save</button>
      <select
        className="tb-template"
        value=""
        onChange={(e) => {
          const pick = e.target.value
          if (!pick) return
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          const source = pick === 'sample' ? samplePlant : pick === 'blank' ? templateBlank : templateUtility
          useStore.getState().loadIntoStore(loadDoc(source))
        }}
      >
        <option value="">Templates…</option>
        <option value="sample">Sample plant</option>
        <option value="blank">Blank A3 drawing</option>
        <option value="utility">Utility headers (A1)</option>
      </select>
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
      <span className="tb-sep" />
      <button onClick={() => zoomCenter(1.2)}>＋</button>
      <button onClick={() => zoomCenter(1 / 1.2)}>－</button>
      <button onClick={zoomFit}>Fit</button>
      <span className="tb-grow" />
      <button onClick={() => exportSvgFile()}>SVG</button>
      <button onClick={() => printPdf()}>PDF</button>
      <button onClick={() => void printAllSheets()} title="Print every sheet">PDF all</button>
      <button onClick={() => exportPng()}>PNG</button>
      <button onClick={() => downloadDexpi()}>DEXPI</button>
      <button onClick={() => downloadDxf()}>DXF</button>
      <button onClick={() => downloadInstrumentIndex()}>Index</button>
      <button onClick={() => downloadLineList()}>Lines</button>
    </header>
  )
}
