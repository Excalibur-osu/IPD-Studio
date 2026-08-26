import Modal from './Modal'
import { useStore } from '../store/store'
import { DEFAULT_FLUIDS } from '../model/doc'

/** Manage the document's process services: name + line color. Assigning a
 *  fluid to a line spreads it along the connected run automatically. */
export default function FluidsDialog({ onClose }: { onClose(): void }) {
  // NB: select the raw field — `?? []` inside the selector mints a new array
  // every snapshot and loops React when the doc has no fluids yet
  const fluids = useStore((s) => s.doc.fluids) ?? []
  const addFluid = useStore((s) => s.addFluid)
  const updateFluid = useStore((s) => s.updateFluid)
  const removeFluid = useStore((s) => s.removeFluid)
  return (
    <Modal title="Fluids / services" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
        {fluids.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={f.color}
              title="Line color"
              onChange={(e) => updateFluid(f.id, { color: e.target.value })}
              style={{ width: 34, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <input
              value={f.name}
              onChange={(e) => updateFluid(f.id, { name: e.target.value })}
              style={{ flex: 1 }}
            />
            <button title="Delete (clears it from all lines)" onClick={() => removeFluid(f.id)}>✕</button>
          </div>
        ))}
        {fluids.length === 0 && (
          <button onClick={() => DEFAULT_FLUIDS.forEach((f) => addFluid(f.name, f.color))}>
            Add starter set (Water, Steam, Air…)
          </button>
        )}
        <button data-testid="fluid-add" onClick={() => addFluid('New fluid', '#607d8b')}>＋ Add fluid</button>
        <p style={{ fontSize: 11, color: '#889', margin: 0 }}>
          Pick a fluid on a selected line — it colors the whole connected run
          (through valves, pumps, fittings; stops at vessels).
        </p>
      </div>
    </Modal>
  )
}
