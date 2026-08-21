import { useState } from 'react'
import ValidationPanel, { useFindings } from './ValidationPanel'
import LoopPanel from './LoopPanel'

export default function Drawer() {
  const [tab, setTab] = useState<'validation' | 'loops' | null>(null)
  const findings = useFindings()
  return (
    <div className="drawer">
      <div className="drawer-tabs">
        <button className={tab === 'validation' ? 'active' : ''} onClick={() => setTab(tab === 'validation' ? null : 'validation')}>
          Validation{findings.length ? ` (${findings.length})` : ''}
        </button>
        <button className={tab === 'loops' ? 'active' : ''} onClick={() => setTab(tab === 'loops' ? null : 'loops')}>
          Loops
        </button>
      </div>
      {tab === 'validation' && <ValidationPanel />}
      {tab === 'loops' && <LoopPanel />}
    </div>
  )
}
