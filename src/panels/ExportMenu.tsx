import { useEffect, useRef, useState } from 'react'
import { exportSvgFile } from '../export/svg'
import { printPdf } from '../export/printPdf'
import { printAllSheets } from '../export/printAll'
import { exportPng } from '../export/png'
import { downloadDexpi } from '../export/dexpi'
import { downloadDxf } from '../export/dxf'
import { downloadDatasheetMatrix, downloadInstrumentIndex, downloadLineList } from '../export/csv'

interface Item {
  label: string
  hint?: string
  run: () => void
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Drawing',
    items: [
      { label: 'SVG image', run: () => exportSvgFile() },
      { label: 'PDF — this sheet', run: () => printPdf() },
      { label: 'PDF — all sheets', run: () => void printAllSheets() },
      { label: 'PNG image', run: () => exportPng() },
    ],
  },
  {
    title: 'CAD / data exchange',
    items: [
      { label: 'DXF (AutoCAD)', run: () => downloadDxf() },
      { label: 'DEXPI XML', run: () => downloadDexpi() },
    ],
  },
  {
    title: 'Reports (CSV)',
    items: [
      { label: 'Instrument index', run: () => downloadInstrumentIndex() },
      { label: 'Line list', run: () => downloadLineList() },
      { label: 'Datasheet matrix', run: () => downloadDatasheetMatrix() },
    ],
  },
]

/** All exports and reports behind one toolbar button, so the bar stays tidy. */
export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="export-menu" ref={rootRef}>
      <button className={open ? 'on' : ''} onClick={() => setOpen((v) => !v)}>
        Export ▾
      </button>
      {open && (
        <div className="export-pop" role="menu">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <div className="export-title">{sec.title}</div>
              {sec.items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  className="export-item"
                  onClick={() => {
                    item.run()
                    setOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
