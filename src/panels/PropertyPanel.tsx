import { useState } from 'react'
import { getSymbol } from '../symbols/registry'
import { activeSheet, useStore } from '../store/store'
import type { LineClass, PlantEdge, PlantNode, SheetSize } from '../model/types'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import TagEditor from './TagEditor'
import { applyAlignment } from '../canvas/interactions'
import { nextLineSeq } from '../isa/autonumber'
import DatasheetEditor from './DatasheetEditor'

const SHEETS: SheetSize[] = ['A4', 'A3', 'A2', 'A1', 'ANSI_B', 'ANSI_D']

function SheetProps() {
  const meta = useStore((s) => s.doc.meta)
  const sheet = useStore((s) => activeSheet(s))
  const setMeta = useStore((s) => s.setMeta)
  const setSheetMeta = useStore((s) => s.setSheetMeta)
  return (
    <>
      <div className="prop-title">Project</div>
      <label className="prop-field">Name<input value={meta.name} onChange={(e) => setMeta({ name: e.target.value })} /></label>
      <label className="prop-field">Author<input value={meta.author} onChange={(e) => setMeta({ author: e.target.value })} /></label>
      <div className="prop-title">{sheet.name}</div>
      <label className="prop-field">Drawing №<input value={sheet.drawingNumber} onChange={(e) => setSheetMeta({ drawingNumber: e.target.value })} /></label>
      <label className="prop-field">Revision<input value={sheet.revision} onChange={(e) => setSheetMeta({ revision: e.target.value })} /></label>
      <label className="prop-field">Sheet size
        <select value={sheet.sheetSize} onChange={(e) => setSheetMeta({ sheetSize: e.target.value as SheetSize })}>
          {SHEETS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </label>
    </>
  )
}

function OffPageLink({ node }: { node: PlantNode }) {
  const doc = useStore((s) => s.doc)
  const currentSheetId = useStore((s) => s.activeSheetId)
  const setNodeLink = useStore((s) => s.setNodeLink)
  const setActiveSheet = useStore((s) => s.setActiveSheet)
  const setSelection = useStore((s) => s.setSelection)
  const targetSheets = doc.sheets.filter((sh) => sh.id !== currentSheetId)
  const linkedSheet = node.link ? doc.sheets.find((sh) => sh.id === node.link!.sheetId) : undefined
  return (
    <div className="prop-group">
      <div className="prop-title">Linked To</div>
      <label className="prop-field">Sheet
        <select
          value={node.link?.sheetId ?? ''}
          onChange={(e) => {
            const sheetId = e.target.value
            if (!sheetId) setNodeLink(node.id, undefined)
            else setNodeLink(node.id, { sheetId, nodeId: '' })
          }}
        >
          <option value="">— not linked —</option>
          {targetSheets.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
        </select>
      </label>
      {linkedSheet && (
        <label className="prop-field">Connector
          <select
            value={node.link?.nodeId ?? ''}
            onChange={(e) => setNodeLink(node.id, { sheetId: linkedSheet.id, nodeId: e.target.value })}
          >
            <option value="">— pick —</option>
            {linkedSheet.nodes.filter((n) => n.symbolId === 'ann.offpage').map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
      )}
      {node.link?.nodeId && (
        <button onClick={() => { setActiveSheet(node.link!.sheetId); setSelection([node.link!.nodeId]) }}>
          Go to linked connector
        </button>
      )}
    </div>
  )
}

function NodeProps({ node }: { node: PlantNode }) {
  const def = getSymbol(node.symbolId)
  const setNodeConfig = useStore((s) => s.setNodeConfig)
  const setLabel = useStore((s) => s.setLabel)
  const rotateNode = useStore((s) => s.rotateNode)
  const setNodeScale = useStore((s) => s.setNodeScale)
  const [datasheetOpen, setDatasheetOpen] = useState(false)
  const scale = node.scale ?? 1
  return (
    <>
      <div className="prop-title">{def.name}</div>
      {def.configOptions &&
        Object.entries(def.configOptions).map(([key, values]) => (
          <label className="prop-field" key={key}>
            {key}
            <select
              value={node.config?.[key] ?? def.defaultConfig?.[key] ?? values[0]}
              onChange={(e) => setNodeConfig(node.id, { ...def.defaultConfig, ...node.config, [key]: e.target.value })}
            >
              {values.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ))}
      {def.tagRule !== 'none' && <TagEditor node={node} />}
      {node.symbolId === 'ann.offpage' && <OffPageLink node={node} />}
      <label className="prop-field">Label
        <input value={node.label ?? ''} onChange={(e) => setLabel(node.id, e.target.value)} placeholder="Service / name" />
      </label>
      <div className="prop-row">
        <button onClick={() => rotateNode(node.id)}>Rotate 90°</button>
        <span className="prop-hint">{node.rotation}°</span>
      </div>
      <div className="prop-row">
        <span className="prop-hint">Size</span>
        <button title="Smaller" disabled={scale <= 0.5} onClick={() => setNodeScale(node.id, scale - 0.25)}>−</button>
        <span className="scale-value">{scale}×</span>
        <button title="Larger" disabled={scale >= 3} onClick={() => setNodeScale(node.id, scale + 0.25)}>＋</button>
        {scale !== 1 && <button title="Reset size" onClick={() => setNodeScale(node.id, 1)}>reset</button>}
      </div>
      {node.kind === 'instrument' && (
        <div className="prop-row">
          <button onClick={() => setDatasheetOpen(true)}>Datasheet…</button>
        </div>
      )}
      {datasheetOpen && <DatasheetEditor node={node} onClose={() => setDatasheetOpen(false)} />}
    </>
  )
}

function EdgeProps({ edge }: { edge: PlantEdge }) {
  const setEdge = useStore((s) => s.setEdge)
  const doc = useStore((s) => s.doc)
  const isProcess = edge.lineClass.startsWith('process')
  const ln = edge.lineNumber ?? { size: '', spec: '', service: '', seq: '' }
  const setLn = (patch: Partial<typeof ln>) => setEdge(edge.id, { lineNumber: { ...ln, ...patch } })
  return (
    <>
      <div className="prop-title">Line</div>
      <label className="prop-field">Class
        <select value={edge.lineClass} onChange={(e) => setEdge(edge.id, { lineClass: e.target.value as LineClass })}>
          {Object.entries(LINE_CLASS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </label>
      <label className="prop-check">
        <input
          type="checkbox"
          checked={edge.arrow === 'flow'}
          onChange={(e) => setEdge(edge.id, { arrow: e.target.checked ? 'flow' : 'none' })}
        />
        Flow arrow
      </label>
      {isProcess && (
        <div className="prop-group">
          <div className="prop-title">Line Number</div>
          <div className="tag-row">
            <input placeholder='size (2")' value={ln.size} onChange={(e) => setLn({ size: e.target.value })} />
            <input placeholder="spec" value={ln.spec} onChange={(e) => setLn({ spec: e.target.value })} />
          </div>
          <div className="tag-row">
            <input placeholder="service" value={ln.service} onChange={(e) => setLn({ service: e.target.value })} />
            <input placeholder="seq" value={ln.seq} onChange={(e) => setLn({ seq: e.target.value })} />
            <button className="tag-auto" title="Next free sequence" onClick={() => setLn({ seq: nextLineSeq(doc) })}>№</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function PropertyPanel({ onCollapse }: { onCollapse?: () => void }) {
  const selection = useStore((s) => s.selection)
  const doc = useStore((s) => s.doc)
  const activeSheetId = useStore((s) => s.activeSheetId)
  const deleteSelected = useStore((s) => s.deleteSelected)

  let body
  if (selection.length === 0) {
    body = <SheetProps />
  } else if (selection.length === 1) {
    const id = selection[0]!
    const sheet = activeSheet({ doc, activeSheetId })
    const node = sheet.nodes.find((n) => n.id === id)
    const edge = sheet.edges.find((e) => e.id === id)
    body = node ? <NodeProps key={id} node={node} /> : edge ? <EdgeProps key={id} edge={edge} /> : <SheetProps />
  } else {
    body = (
      <>
        <div className="prop-title">{selection.length} items selected</div>
        <div className="prop-title">Align</div>
        <div className="align-grid">
          <button onClick={() => applyAlignment('left')}>⇤ Left</button>
          <button onClick={() => applyAlignment('center-v')}>⇹ Centers</button>
          <button onClick={() => applyAlignment('right')}>⇥ Right</button>
          <button onClick={() => applyAlignment('top')}>⤒ Top</button>
          <button onClick={() => applyAlignment('center-h')}>⇳ Middles</button>
          <button onClick={() => applyAlignment('bottom')}>⤓ Bottom</button>
          <button onClick={() => applyAlignment('distribute-h')}>↔ Distribute</button>
          <button onClick={() => applyAlignment('distribute-v')}>↕ Distribute</button>
        </div>
        <button onClick={deleteSelected}>Delete selection</button>
      </>
    )
  }
  return (
    <aside className="props">
      {onCollapse && (
        <div className="props-head">
          <button className="panel-collapse" title="Hide properties" onClick={onCollapse}>▸</button>
        </div>
      )}
      {body}
    </aside>
  )
}
