import { fieldsFor } from '../model/datasheet'
import type { PlantNode } from '../model/types'
import { formatTag } from '../isa/tag'
import { expandLetters } from '../isa/tag'
import { useStore } from '../store/store'
import { printDatasheet } from '../export/datasheetPdf'

const SECTION_TITLES: Record<string, string> = {
  general: 'General',
  process: 'Process Conditions',
  element: 'Element / Body',
  signal: 'Signal & Electrical',
}

export default function DatasheetEditor({ node, onClose }: { node: PlantNode; onClose: () => void }) {
  const setDatasheet = useStore((s) => s.setDatasheet)
  const doc = useStore((s) => s.doc)
  const letters = node.tag?.letters ?? 'XX'
  const sections = fieldsFor(letters)
  const title = node.tag ? formatTag(node.tag, '-') : 'Untagged instrument'

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="datasheet-box" onClick={(e) => e.stopPropagation()}>
        <div className="datasheet-head">
          <div>
            <b>{title}</b>
            <span className="datasheet-sub"> {expandLetters(letters)}</span>
          </div>
          <div className="prop-row">
            <button onClick={() => printDatasheet(doc, node)}>Print PDF</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="datasheet-body">
          {Object.entries(sections).map(([section, fields]) =>
            fields.length === 0 ? null : (
              <section key={section}>
                <div className="prop-title">{SECTION_TITLES[section]}</div>
                {fields.map((f) => (
                  <label className="datasheet-field" key={f.key}>
                    <span>{f.label}</span>
                    <input
                      value={node.datasheet?.[f.key] ?? ''}
                      onChange={(e) => setDatasheet(node.id, { [f.key]: e.target.value })}
                    />
                  </label>
                ))}
              </section>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
