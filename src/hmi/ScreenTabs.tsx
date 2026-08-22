import { useState } from 'react'
import { useStore } from '../store/store'

export default function ScreenTabs() {
  const screens = useStore((s) => s.doc.hmiScreens)
  const activeScreenId = useStore((s) => s.activeScreenId)
  const setActiveScreen = useStore((s) => s.setActiveScreen)
  const addScreen = useStore((s) => s.addScreen)
  const renameScreen = useStore((s) => s.renameScreen)
  const deleteScreen = useStore((s) => s.deleteScreen)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="hmi-tabs">
      {screens.map((sc) => (
        <div
          key={sc.id}
          className={`hmi-tab${sc.id === activeScreenId ? ' active' : ''}`}
          onClick={() => setActiveScreen(sc.id)}
          onDoubleClick={() => { setEditing(sc.id); setDraft(sc.name) }}
        >
          {editing === sc.id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { renameScreen(sc.id, draft || sc.name); setEditing(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          ) : (
            <>
              <span>{sc.name}</span>
              <button
                className="sheet-close"
                title="Delete screen"
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Delete ${sc.name}?`)) deleteScreen(sc.id)
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}
      <button className="hmi-tab" title="Add screen" onClick={addScreen}>＋</button>
    </div>
  )
}
