import { useMemo, useState } from 'react'
import { byCategory, searchSymbols } from '../symbols/registry'
import { placeAtCenter, placeTypicalAtCenter } from '../canvas/dropHandling'
import { TYPICALS } from '../assist/typicals'
import { useStore } from '../store/store'
import SymbolImportDialog from './SymbolImportDialog'
import type { SymbolCategory, SymbolDef } from '../symbols/types'

export const DRAG_MIME = 'application/x-pid-symbol'

export interface DragPayload {
  symbolId: string
  presetLetters?: string
}

const CATEGORY_ORDER: [SymbolCategory, string][] = [
  ['custom', 'Custom'],
  ['instruments', 'Instruments'],
  ['control-valves', 'Control Valves'],
  ['valves', 'Manual Valves'],
  ['safety', 'Safety & Relief'],
  ['flow-elements', 'Flow Elements'],
  ['accessories', 'Accessories'],
  ['rotating', 'Pumps & Rotating'],
  ['vessels', 'Vessels & Columns'],
  ['heat', 'Heat Transfer'],
  ['inline', 'Fittings & Inline'],
  ['control', 'Control & Logic'],
  ['annotation', 'Annotation'],
]

const INSTRUMENT_PRESETS = ['FT', 'FIT', 'FIC', 'FE', 'FY', 'PT', 'PIT', 'PIC', 'PDT', 'PY', 'LT', 'LIT', 'LIC', 'LY', 'TT', 'TIT', 'TIC', 'TY', 'AT', 'AIT', 'SC', 'HS', 'ZSC', 'ZSO']

function Preview({ def }: { def: SymbolDef }) {
  const w = def.gridSize.w * 8
  const h = def.gridSize.h * 8
  return (
    <svg
      viewBox={`-2 -2 ${w + 4} ${h + 4}`}
      className="palette-preview"
      dangerouslySetInnerHTML={{ __html: def.render(def.defaultConfig ?? {}) }}
    />
  )
}

function Entry({ def, label, presetLetters }: { def: SymbolDef; label: string; presetLetters?: string }) {
  return (
    <div
      className="palette-entry"
      draggable
      title={label}
      onDragStart={(e) => {
        const payload: DragPayload = { symbolId: def.id }
        if (presetLetters) payload.presetLetters = presetLetters
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <Preview def={def} />
      <span className="palette-label">{label}</span>
    </div>
  )
}

export default function Palette({ onCollapse }: { onCollapse?: () => void }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const customSymbols = useStore((s) => s.doc.customSymbols)
  const groups = useMemo(() => byCategory(), [customSymbols])
  const results = useMemo(() => (query ? searchSymbols(query) : null), [query, customSymbols])

  const toggle = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <aside className="palette">
      <div className="palette-head">
        <input
          className="palette-search"
          placeholder="Search symbols…  (Enter places)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results && results[0]) {
              placeAtCenter(results[0].id)
            }
          }}
        />
        {onCollapse && (
          <button className="panel-collapse" title="Hide palette" onClick={onCollapse}>◂</button>
        )}
      </div>
      <button className="palette-import" onClick={() => setImportOpen(true)}>＋ Import symbol…</button>
      {importOpen && <SymbolImportDialog onClose={() => setImportOpen(false)} />}
      {!query && (
        <section>
          <button className="palette-cat" onClick={() => toggle('typicals')}>
            {!collapsed.has('typicals') ? '▾' : '▸'} Typical Loops
          </button>
          {!collapsed.has('typicals') && (
            <div className="typical-list">
              {TYPICALS.map((t) => (
                <button
                  key={t.id}
                  className="typical-entry"
                  title={`Place a wired, tagged ${t.name.toLowerCase()}`}
                  onClick={() => placeTypicalAtCenter(t.id)}
                >
                  ⚡ {t.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {results ? (
        <div className="palette-grid">
          {results.map((def) => (
            <Entry key={def.id} def={def} label={def.name} />
          ))}
        </div>
      ) : (
        CATEGORY_ORDER.map(([cat, title]) => {
          const defs = groups.get(cat) ?? []
          if (defs.length === 0) return null
          const isOpen = !collapsed.has(cat)
          return (
            <section key={cat}>
              <button className="palette-cat" onClick={() => toggle(cat)}>
                {isOpen ? '▾' : '▸'} {title}
              </button>
              {isOpen && (
                <div className="palette-grid">
                  {cat === 'instruments' &&
                    INSTRUMENT_PRESETS.map((letters) => (
                      <Entry
                        key={letters}
                        def={defs.find((d) => d.id === 'instr.bubble')!}
                        label={letters}
                        presetLetters={letters}
                      />
                    ))}
                  {defs.map((def) => (
                    <Entry key={def.id} def={def} label={def.name} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </aside>
  )
}
