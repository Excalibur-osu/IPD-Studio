import { useState } from 'react'
import ValidationPanel, { useFindings } from './ValidationPanel'
import AdvisorPanel, { useSuggestions } from './AdvisorPanel'
import LoopPanel from './LoopPanel'

export default function Drawer() {
  const [tab, setTab] = useState<'validation' | 'advisor' | 'loops' | null>(null)
  const findings = useFindings()
  const suggestions = useSuggestions()
  return (
    <div className="drawer">
      <div className="drawer-tabs">
        <button className={tab === 'validation' ? 'active' : ''} onClick={() => setTab(tab === 'validation' ? null : 'validation')}>
          Validation{findings.length ? ` (${findings.length})` : ''}
        </button>
        <button className={tab === 'advisor' ? 'active' : ''} onClick={() => setTab(tab === 'advisor' ? null : 'advisor')}>
          Advisor{suggestions.length ? ` (${suggestions.length})` : ''}
        </button>
        <button className={tab === 'loops' ? 'active' : ''} onClick={() => setTab(tab === 'loops' ? null : 'loops')}>
          Loops
        </button>
      </div>
      {tab === 'validation' && <ValidationPanel />}
      {tab === 'advisor' && <AdvisorPanel />}
      {tab === 'loops' && <LoopPanel />}
    </div>
  )
}
