import { useEffect } from 'react'
import { useStore } from '../store/store'
import { openFile, saveFile } from '../persist/file'
import { createEmptyDoc } from '../model/doc'
import { canvasRef, zoomAt } from '../canvas/paperSetup'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import type { LineClass } from '../model/types'
import { exportSvgFile } from '../export/svg'
import { printPdf } from '../export/printPdf'
import { downloadInstrumentIndex, downloadLineList } from '../export/csv'
import { downloadDexpi } from '../export/dexpi'
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
      <button onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) useStore.getState().loadIntoStore(loadDoc(samplePlant)) }}>Sample</button>
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
      <button onClick={() => downloadDexpi()}>DEXPI</button>
      <button onClick={() => downloadInstrumentIndex()}>Index</button>
      <button onClick={() => downloadLineList()}>Lines</button>
    </header>
  )
}
