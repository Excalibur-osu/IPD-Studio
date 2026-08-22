import './hmi.css'
import { useEffect, useState } from 'react'
import { useStore, activeHmiScreen } from '../store/store'
import HmiToolbar from './HmiToolbar'
import ScreenTabs from './ScreenTabs'
import HmiPalette from './HmiPalette'
import HmiCanvas from './HmiCanvas'
import HmiPropertyPanel from './HmiPropertyPanel'

export default function HmiWorkspace({ onExit }: { onExit(): void }) {
  const screen = useStore(activeHmiScreen)
  const activeScreenId = useStore((s) => s.activeScreenId)
  const addScreen = useStore((s) => s.addScreen)
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState<'select' | 'pipe'>('select')
  useEffect(() => { setSelection([]); setTool('select') }, [activeScreenId])
  return (
    <div className="hmi">
      <HmiToolbar onExit={onExit} tool={tool} setTool={setTool} />
      <div className="hmi-side"><HmiPalette /></div>
      <div className="hmi-center">
        {screen ? (
          <>
            <div className="hmi-canvas-wrap">
              <HmiCanvas
                screen={screen}
                selection={selection}
                onSelect={setSelection}
                mode="edit"
                tool={tool}
                onToolDone={() => setTool('select')}
              />
            </div>
            <ScreenTabs />
          </>
        ) : (
          <div className="hmi-empty">
            <p>No HMI screens yet.</p>
            <button onClick={addScreen}>New screen</button>
            <button disabled title="Coming soon">Build from P&ID sheet…</button>
          </div>
        )}
      </div>
      <div className="hmi-props"><HmiPropertyPanel selection={selection} /></div>
      <div className="hmi-status"><span>HMI workspace</span></div>
    </div>
  )
}
