import { useState } from 'react'
import { getSymbol } from '../symbols/registry'
import { activeSheet, pauseHistory, resumeHistory, useStore } from '../store/store'
import type { LineClass, PlantEdge, PlantNode, SheetSize } from '../model/types'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import TagEditor from './TagEditor'
import { applyAlignment, duplicateSelection } from '../canvas/interactions'
import { nextLineSeq } from '../isa/autonumber'
import DatasheetEditor from './DatasheetEditor'
import FluidsDialog from './FluidsDialog'

const SHEETS: SheetSize[] = ['A4', 'A3', 'A2', 'A1', 'ANSI_B', 'ANSI_D']

function SheetProps() {
  const meta = useStore((s) => s.doc.meta)
  const sheet = useStore((s) => activeSheet(s))
  const numberStart = useStore((s) => s.doc.settings.numberStart ?? 100)
  const setMeta = useStore((s) => s.setMeta)
  const setSettings = useStore((s) => s.setSettings)
  const setSheetMeta = useStore((s) => s.setSheetMeta)
  return (
    <>
      <div className="prop-title">Project</div>
      <label className="prop-field">Name<input value={meta.name} onChange={(e) => { setMeta({ name: e.target.value }); pauseHistory() }} onBlur={resumeHistory} /></label>
      <label className="prop-field">Author<input value={meta.author} onChange={(e) => { setMeta({ author: e.target.value }); pauseHistory() }} onBlur={resumeHistory} /></label>
      <label className="prop-field">Tag numbering starts at
        <select
          value={String(numberStart)}
          onChange={(e) => setSettings({ numberStart: e.target.value === '1' ? 1 : 100 })}
        >
          <option value="100">100, 101, 102…</option>
          <option value="1">001, 002, 003…</option>
        </select>
      </label>
      <div className="prop-title">{sheet.name}</div>
      <label className="prop-field">Drawing №<input value={sheet.drawingNumber} onChange={(e) => { setSheetMeta({ drawingNumber: e.target.value }); pauseHistory() }} onBlur={resumeHistory} /></label>
      <label className="prop-field">Revision<input value={sheet.revision} onChange={(e) => { setSheetMeta({ revision: e.target.value }); pauseHistory() }} onBlur={resumeHistory} /></label>
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
  const armPin = useStore((s) => s.armPin)
  const setArmPin = useStore((s) => s.setArmPin)
  const removeExtraPort = useStore((s) => s.removeExtraPort)
  const setNodeConfig = useStore((s) => s.setNodeConfig)
  const setLabel = useStore((s) => s.setLabel)
  const setLabelPos = useStore((s) => s.setLabelPos)
  const setTagOffset = useStore((s) => s.setTagOffset)
  const setLabelOffset = useStore((s) => s.setLabelOffset)
  const rotateNode = useStore((s) => s.rotateNode)
  const setNodeStretch = useStore((s) => s.setNodeStretch)
  const [datasheetOpen, setDatasheetOpen] = useState(false)
  const sx = node.scaleX ?? node.scale ?? 1
  const sy = node.scaleY ?? node.scale ?? 1
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
        <input value={node.label ?? ''} onChange={(e) => { setLabel(node.id, e.target.value); pauseHistory() }} onBlur={resumeHistory} placeholder="Service / name" />
      </label>
      {(node.label ?? '') !== '' && (
        <label className="prop-field">Label position
          <select
            title="Label position"
            value={node.labelPos ?? 'below'}
            onChange={(e) => setLabelPos(node.id, e.target.value as 'below' | 'center')}
          >
            <option value="below">below the symbol</option>
            <option value="center">inside, centered</option>
          </select>
        </label>
      )}
      <div className="prop-row">
        <button onClick={() => rotateNode(node.id)}>Rotate 90°</button>
        <button onClick={duplicateSelection} title="Ctrl+D">Duplicate</button>
        <span className="prop-hint">{node.rotation}°</span>
      </div>
      <div className="prop-row">
        <span className="prop-hint">Size</span>
        <button title="Smaller" disabled={sx <= 0.5 && sy <= 0.5} onClick={() => setNodeStretch(node.id, sx - 0.25, sy - 0.25)}>−</button>
        <span className="scale-value">{sx === sy ? `${sx}×` : `${sx}/${sy}×`}</span>
        <button title="Larger" disabled={sx >= 4 || sy >= 4} onClick={() => setNodeStretch(node.id, sx + 0.25, sy + 0.25)}>＋</button>
        {(sx !== 1 || sy !== 1) && <button title="Reset size" onClick={() => setNodeStretch(node.id, 1, 1)}>reset</button>}
      </div>
      <div className="prop-row">
        <span className="prop-hint">Width</span>
        <button title="Narrower" disabled={sx <= 0.5} onClick={() => setNodeStretch(node.id, sx - 0.25, sy)}>−</button>
        <span className="scale-value">{sx}×</span>
        <button title="Wider" disabled={sx >= 4} onClick={() => setNodeStretch(node.id, sx + 0.25, sy)}>＋</button>
      </div>
      <div className="prop-row">
        <span className="prop-hint">Height</span>
        <button title="Shorter" disabled={sy <= 0.5} onClick={() => setNodeStretch(node.id, sx, sy - 0.25)}>−</button>
        <span className="scale-value">{sy}×</span>
        <button title="Taller" disabled={sy >= 4} onClick={() => setNodeStretch(node.id, sx, sy + 0.25)}>＋</button>
      </div>
      {node.kind !== 'annotation' && (
        <div className="prop-row">
          <span className="prop-hint">Pins</span>
          <button
            className={armPin === node.id ? 'arm-on' : ''}
            title="Add a connection pin: click this button, then click the spot on the symbol"
            onClick={() => setArmPin(armPin === node.id ? null : node.id)}
          >
            {armPin === node.id ? 'Click the symbol… (Esc cancels)' : '＋ Add pin'}
          </button>
        </div>
      )}
      {(node.extraPorts ?? []).map((p) => (
        <div className="prop-row" key={p.id}>
          <span className="prop-hint">{p.id} · ({p.x}, {p.y})</span>
          <button title="Remove this pin (its lines go with it)" onClick={() => removeExtraPort(node.id, p.id)}>✕</button>
        </div>
      ))}
      {(node.tagOffset || node.labelOffset) && (
        <div className="prop-row">
          <button onClick={() => { setTagOffset(node.id, undefined); setLabelOffset(node.id, undefined) }}>
            Reset text position
          </button>
        </div>
      )}
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
  const setEdgeFluid = useStore((s) => s.setEdgeFluid)
  const doc = useStore((s) => s.doc)
  const [fluidsOpen, setFluidsOpen] = useState(false)
  const isProcess = edge.lineClass.startsWith('process')
  const isPipe = isProcess || edge.lineClass.startsWith('pipe.')
  const fluid = (doc.fluids ?? []).find((f) => f.id === edge.fluidId)
  const ln = edge.lineNumber ?? { size: '', spec: '', service: '', seq: '' }
  const setLn = (patch: Partial<typeof ln>) => { setEdge(edge.id, { lineNumber: { ...ln, ...patch } }); pauseHistory() }
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
      {isPipe && (
        <label className="prop-field">Fluid
          <div className="tag-row">
            <span
              aria-hidden
              style={{ width: 14, height: 14, borderRadius: 3, alignSelf: 'center', flex: '0 0 auto',
                background: fluid?.color ?? 'transparent', border: '1px solid #b5b5c5' }}
            />
            <select
              data-testid="edge-fluid"
              value={edge.fluidId ?? ''}
              title="Assigning a fluid colors the whole connected run"
              onChange={(e) => setEdgeFluid(edge.id, e.target.value === '' ? undefined : e.target.value)}
            >
              <option value="">— none —</option>
              {(doc.fluids ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button title="Edit fluids…" onClick={() => setFluidsOpen(true)}>✎</button>
          </div>
        </label>
      )}
      {fluidsOpen && <FluidsDialog onClose={() => setFluidsOpen(false)} />}
      {isProcess && (
        <div className="prop-group">
          <div className="prop-title">Line Number</div>
          <div className="tag-row">
            <input placeholder='size (2")' value={ln.size} onChange={(e) => setLn({ size: e.target.value })} onBlur={resumeHistory} />
            <input placeholder="spec" value={ln.spec} onChange={(e) => setLn({ spec: e.target.value })} onBlur={resumeHistory} />
          </div>
          <div className="tag-row">
            <input placeholder="service" value={ln.service} onChange={(e) => setLn({ service: e.target.value })} onBlur={resumeHistory} />
            <input placeholder="seq" value={ln.seq} onChange={(e) => setLn({ seq: e.target.value })} onBlur={resumeHistory} />
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
        <div className="prop-row">
          <button onClick={duplicateSelection} title="Ctrl+D">Duplicate</button>
          <button onClick={deleteSelected}>Delete selection</button>
        </div>
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
