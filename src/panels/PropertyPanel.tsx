import { getSymbol } from '../symbols/registry'
import { useStore } from '../store/store'
import type { LineClass, PlantEdge, PlantNode, SheetSize } from '../model/types'
import { LINE_CLASS_LABELS } from '../canvas/lineStyle'
import TagEditor from './TagEditor'

const SHEETS: SheetSize[] = ['A4', 'A3', 'A2', 'A1', 'ANSI_B', 'ANSI_D']

function SheetProps() {
  const meta = useStore((s) => s.doc.meta)
  const setMeta = useStore((s) => s.setMeta)
  return (
    <>
      <div className="prop-title">Drawing</div>
      <label className="prop-field">Name<input value={meta.name} onChange={(e) => setMeta({ name: e.target.value })} /></label>
      <label className="prop-field">Drawing №<input value={meta.drawingNumber} onChange={(e) => setMeta({ drawingNumber: e.target.value })} /></label>
      <label className="prop-field">Revision<input value={meta.revision} onChange={(e) => setMeta({ revision: e.target.value })} /></label>
      <label className="prop-field">Author<input value={meta.author} onChange={(e) => setMeta({ author: e.target.value })} /></label>
      <label className="prop-field">Sheet
        <select value={meta.sheetSize} onChange={(e) => setMeta({ sheetSize: e.target.value as SheetSize })}>
          {SHEETS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </label>
    </>
  )
}

function NodeProps({ node }: { node: PlantNode }) {
  const def = getSymbol(node.symbolId)
  const setNodeConfig = useStore((s) => s.setNodeConfig)
  const setLabel = useStore((s) => s.setLabel)
  const rotateNode = useStore((s) => s.rotateNode)
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
      <label className="prop-field">Label
        <input value={node.label ?? ''} onChange={(e) => setLabel(node.id, e.target.value)} placeholder="Service / name" />
      </label>
      <div className="prop-row">
        <button onClick={() => rotateNode(node.id)}>Rotate 90°</button>
        <span className="prop-hint">{node.rotation}°</span>
      </div>
    </>
  )
}

function EdgeProps({ edge }: { edge: PlantEdge }) {
  const setEdge = useStore((s) => s.setEdge)
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
          </div>
        </div>
      )}
    </>
  )
}

export default function PropertyPanel() {
  const selection = useStore((s) => s.selection)
  const doc = useStore((s) => s.doc)
  const deleteSelected = useStore((s) => s.deleteSelected)

  let body
  if (selection.length === 0) {
    body = <SheetProps />
  } else if (selection.length === 1) {
    const id = selection[0]!
    const node = doc.nodes.find((n) => n.id === id)
    const edge = doc.edges.find((e) => e.id === id)
    body = node ? <NodeProps key={id} node={node} /> : edge ? <EdgeProps key={id} edge={edge} /> : <SheetProps />
  } else {
    body = (
      <>
        <div className="prop-title">{selection.length} items selected</div>
        <button onClick={deleteSelected}>Delete selection</button>
      </>
    )
  }
  return <aside className="props">{body}</aside>
}
