import { useEffect, useMemo, useRef, useState } from 'react'
import { findTag } from '../search/findTag'
import { useStore } from '../store/store'
import { locateCell } from './ValidationPanel'

export default function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const doc = useStore((s) => s.doc)
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => findTag(doc, query).slice(0, 12), [doc, query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(true)
        setQuery('')
        setCursor(0)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  const jump = (i: number) => {
    const hit = hits[i]
    if (!hit) return
    setActiveSheet(hit.sheetId)
    // locate after the sheet switch has reconciled
    setTimeout(() => locateCell(hit.nodeId), 50)
    setOpen(false)
  }

  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Find tag or label…  (Esc to close)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
            if (e.key === 'Enter') jump(cursor)
          }}
        />
        {hits.length > 0 && (
          <ul>
            {hits.map((h, i) => (
              <li
                key={h.nodeId}
                className={i === cursor ? 'active' : ''}
                onMouseEnter={() => setCursor(i)}
                onClick={() => jump(i)}
              >
                <b>{h.display}</b> <span className="search-sheet">{h.sheetName}</span>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && hits.length === 0 && <div className="search-empty">No matches</div>}
      </div>
    </div>
  )
}
