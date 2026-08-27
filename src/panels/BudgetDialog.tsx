import Modal from './Modal'
import { useStore } from '../store/store'
import { projectCost } from '../model/costs'
import { download } from '../export/csv'

const CURRENCIES = ['$', '€', '₹', '£', '¥']
const FACTORS: [number, string][] = [
  [1, '1× — hardware only'],
  [3, '3× — typical installed cost (piping, wiring, labor)'],
  [5, '5× — full plant, Lang factor (engineering + construction)'],
]

const money = (cur: string, v: number) => `${cur}${Math.round(v).toLocaleString('en-US')}`

/** Project budget & cost estimate: set the target, tune unit prices, see the
 *  live breakdown. Prices are budgetary defaults (order-of-magnitude, USD
 *  scale) — override any of them for your market. */
export default function BudgetDialog({ onClose }: { onClose(): void }) {
  const doc = useStore((s) => s.doc)
  const setBudget = useStore((s) => s.setBudget)
  const setPriceOverride = useStore((s) => s.setPriceOverride)
  const budget = doc.budget
  const cur = budget?.currency ?? '$'
  const report = projectCost(doc)
  const remaining = budget?.total !== undefined ? budget.total - report.total : undefined

  const exportCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s)
    const rows = [
      ['Item', 'Count', `Unit price (${cur})`, `Subtotal (${cur})`],
      ...report.lines.map((l) => [l.label, String(l.count), String(l.unit), String(l.subtotal)]),
      [],
      ['Hardware subtotal', '', '', String(report.hardware)],
      ['Install factor', '', '', String(budget?.installFactor ?? 1)],
      ['Estimated total', '', '', String(report.total)],
      ...(budget?.total !== undefined ? [['Budget', '', '', String(budget.total)]] : []),
    ]
    download(`${doc.meta.name || 'diagram'}-cost-estimate.csv`, rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv')
  }

  return (
    <Modal title="Budget & cost estimate" onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#556' }}>Budget
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={cur} onChange={(e) => setBudget({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                data-testid="budget-total" type="number" min={0} placeholder="not set"
                value={budget?.total ?? ''} style={{ width: 130 }}
                onChange={(e) => setBudget({ total: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
          </label>
          <label style={{ fontSize: 12, color: '#556', flex: 1, minWidth: 220 }}>Estimate covers
            <select
              value={budget?.installFactor ?? 1} style={{ width: '100%' }}
              onChange={(e) => setBudget({ installFactor: Number(e.target.value) })}
            >
              {FACTORS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #d5d5d5', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f2f2f6', position: 'sticky', top: 0 }}>
                <th style={{ padding: '6px 8px' }}>Item</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Unit price</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => {
                const overridden = budget?.overrides?.[l.key] !== undefined
                return (
                  <tr key={l.key} style={{ borderTop: '1px solid #e5e5ea' }}>
                    <td style={{ padding: '4px 8px' }}>{l.label}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{l.count}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input
                        type="number" min={0} value={l.unit}
                        style={{ width: 84, textAlign: 'right', fontWeight: overridden ? 700 : 400 }}
                        title={overridden ? 'Overridden for this project' : 'Budgetary default — edit for your market'}
                        onChange={(e) => setPriceOverride(l.key, e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{money(cur, l.subtotal)}</td>
                    <td style={{ padding: '4px 4px' }}>
                      {overridden && (
                        <button title="Reset to the default price" onClick={() => setPriceOverride(l.key, undefined)}>↺</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {report.lines.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 12, color: '#889' }}>Place components on the drawing and they appear here with prices.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {report.unpriced > 0 && (
          <p style={{ fontSize: 11.5, color: '#b7791f', margin: 0 }}>
            ⚠ {report.unpriced} component{report.unpriced > 1 ? 's have' : ' has'} no price — set one in the table above or on the component itself.
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
          <strong data-testid="budget-est">Estimated: {money(cur, report.total)}</strong>
          {remaining !== undefined && (
            <span style={{ color: remaining < 0 ? '#c53030' : '#2f855a', fontWeight: 600 }}>
              {remaining < 0 ? `${money(cur, -remaining)} over budget` : `${money(cur, remaining)} remaining`}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={exportCsv}>Cost estimate CSV</button>
        </div>

        <p style={{ fontSize: 11, color: '#889', margin: 0 }}>
          Prices are budgetary (order-of-magnitude) defaults — real quotes vary
          with size, material, and rating. Edit any unit price for your market;
          bold = overridden. Exact per-component prices: select the component →
          Cost field.
        </p>
      </div>
    </Modal>
  )
}
