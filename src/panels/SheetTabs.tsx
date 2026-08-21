import { useState } from 'react'
import { useStore } from '../store/store'

export default function SheetTabs() {
  const sheets = useStore((s) => s.doc.sheets)
  const activeSheetId = useStore((s) => s.activeSheetId)
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  const addSheet = useStore((s) => s.addSheet)
  const renameSheet = useStore((s) => s.renameSheet)
  const deleteSheet = useStore((s) => s.deleteSheet)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="sheet-tabs">
      {sheets.map((sh) => (
        <div
          key={sh.id}
          className={`sheet-tab${sh.id === activeSheetId ? ' active' : ''}`}
          onClick={() => setActiveSheet(sh.id)}
          onDoubleClick={() => { setEditing(sh.id); setDraft(sh.name) }}
        >
          {editing === sh.id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { renameSheet(sh.id, draft || sh.name); setEditing(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          ) : (
            <>
              <span>{sh.name}</span>
              {sheets.length > 1 && (
                <button
                  className="sheet-close"
                  title="Delete sheet"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Delete ${sh.name} and everything on it?`)) deleteSheet(sh.id)
                  }}
                >
                  ×
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button className="sheet-add" title="Add sheet" onClick={() => addSheet()}>＋</button>
    </div>
  )
}
